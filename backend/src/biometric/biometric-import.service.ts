import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BiometricSyncService } from './biometric-sync.service';
import { readSheetAsArraysFromBuffer } from './biometric-excel.utils';
import { LeaveStatus, LeaveType } from '@prisma/client';
import { getAccruedCasualLeaveUpToMonth, getProRataCasualLeaveForYear } from '../leave/leave.utils';

export interface BiometricImportResult {
  logsCreated: number;
  logsSkipped: number;
  usersNotFound: number;
  errors: Array<{ row: number; reason: string }>;
  datesProcessed: string[];
  syncResults: Array<{ date: string; processed: number; skipped: number }>;
  overridden?: {
    month: string; // YYYY-MM
    biometricLogsDeleted: number;
    attendanceDeleted: number;
  };
  parseSummary?: {
    totalRowsSeen: number;
    rowsWithEmployeeAndDate: number;
    rowsSkippedNoUser: number;
    rowsSkippedMissingFields: number;
  };
}

export interface BiometricImportOptions {
  /**
   * If the upload's month already has biometric logs in DB, the API will return 409 unless this is true.
   * Only Super Admins can call the upload endpoint, but we still require an explicit confirmation flag.
   */
  confirmOverride?: boolean;
}

function parseDuration(durationStr: string): number {
  if (!durationStr || durationStr === '00:00') return 0;
  const parts = durationStr.split(':');
  if (parts.length === 2) {
    const [hours, minutes] = parts.map(Number);
    return hours * 60 + minutes;
  }
  return 0;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    // Normalise to UTC midnight using local date parts so non-ISO strings
    // like "03/07/2026" (parsed as local midnight) map to the correct UTC date.
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  } catch {
    return null;
  }
}

@Injectable()
export class BiometricImportService {
  private readonly logger = new Logger(BiometricImportService.name);

  constructor(
    private prisma: PrismaService,
    private biometricSyncService: BiometricSyncService,
  ) {}

  /**
   * Parse grouped biometric Excel (Device Log Duration Report format) from buffer,
   * create BiometricLog records, and auto-sync all dates to Attendance.
   */
  async getLogCount(): Promise<number> {
    return this.prisma.biometricLog.count();
  }

  async importFromBuffer(buffer: Buffer, options?: BiometricImportOptions): Promise<BiometricImportResult> {
    const result: BiometricImportResult = {
      logsCreated: 0,
      logsSkipped: 0,
      usersNotFound: 0,
      errors: [],
      datesProcessed: [],
      syncResults: [],
    };

    const data = (await readSheetAsArraysFromBuffer(buffer, {
      defval: null,
    })) as unknown[][];

    // User lookup cache to avoid repeated DB queries for the same name
    const userCache = new Map<string, { id: string; name: string; employeeId: string } | null>();
    const datesSet = new Set<string>();
    const logsToInsert: any[] = [];
    let monthStart: Date | null = null;
    let nextMonthStart: Date | null = null;
    const parseSummary = {
      totalRowsSeen: 0,
      rowsWithEmployeeAndDate: 0,
      rowsSkippedNoUser: 0,
      rowsSkippedMissingFields: 0,
    };

    const normalizeHeader = (v: unknown) =>
      String(v ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    // Find header row and column indices by header labels (more robust across device exports).
    let dataStartRow = -1;
    let colEmployee = 1;
    let colDate = 2;
    let colInDoor = 3;
    let colInTime = 4;
    let colOutDoor = 5;
    let colOutTime = 6;
    let colDuration = 7;

    const safeIncludes = (h: unknown, needle: string) =>
      typeof h === 'string' && h.includes(needle);

    for (let i = 0; i < data.length; i++) {
      const row = (data[i] as unknown[]) ?? [];
      const headers = row.map(normalizeHeader);
      const hasDate = headers.some((h) => h === 'date' || safeIncludes(h, 'date'));
      const hasEmp = headers.some((h) => safeIncludes(h, 'employee') || h === 'emp' || safeIncludes(h, 'name'));
      const hasInTime = headers.some((h) => safeIncludes(h, 'in time'));
      const hasOutTime = headers.some((h) => safeIncludes(h, 'out time'));
      if (!hasDate || !hasEmp) continue;

      // Resolve columns with best-effort matching.
      const idx = (pred: (h: string) => boolean) =>
        headers.findIndex((h) => typeof h === 'string' && pred(h));
      const e = idx((h) => h.includes('employee') || h === 'emp' || h.includes('employee :') || h.includes('name'));
      const d = idx((h) => h === 'date' || h.includes('date'));
      const it = idx((h) => h.includes('in time'));
      const ot = idx((h) => h.includes('out time'));
      const dur = idx((h) => h.includes('duration'));
      const idoor = idx((h) => h.includes('in door') || h === 'in');
      const odoor = idx((h) => h.includes('out door') || h === 'out');

      if (e !== -1) colEmployee = e;
      if (d !== -1) colDate = d;
      if (it !== -1) colInTime = it;
      if (ot !== -1) colOutTime = ot;
      if (dur !== -1) colDuration = dur;
      if (idoor !== -1) colInDoor = idoor;
      if (odoor !== -1) colOutDoor = odoor;

      // If times aren't labeled in this export, keep defaults.
      if (hasInTime || hasOutTime) {
        dataStartRow = i + 1;
        break;
      }

      // Fallback: accept "Employee / Date" header row even if time headers are missing.
      dataStartRow = i + 1;
      break;
    }

    if (dataStartRow === -1) {
      result.errors.push({ row: 0, reason: 'Could not find column header row (Employee / Date)' });
      result.parseSummary = parseSummary;
      return result;
    }

    for (let i = dataStartRow; i < data.length; i++) {
      parseSummary.totalRowsSeen++;
      try {
        const row = data[i] as unknown[];
        if (!row || row.length === 0) continue;

        const employeeNameRaw = row[colEmployee];
        const dateRaw = row[colDate];

        if (!employeeNameRaw || !dateRaw) continue;
        parseSummary.rowsWithEmployeeAndDate++;

        // Skip summary/total rows
        if (String(dateRaw).toLowerCase().includes('total')) continue;

        // ExcelJS returns date cells as Date objects; text cells come as strings
        let date: Date | null = null;
        if (dateRaw instanceof Date) {
          // Use local date parts so midnight IST maps to the correct UTC date
          date = new Date(Date.UTC(dateRaw.getFullYear(), dateRaw.getMonth(), dateRaw.getDate()));
        } else if (typeof dateRaw === 'string') {
          date = parseDate(dateRaw);
        } else {
          continue;
        }
        if (!date) continue;

        const employeeName = employeeNameRaw
          .toString()
          .replace(/\u2013|\u2014/g, '-') // en/em dash → hyphen
          .replace(/\s+/g, ' ')
          .trim();
        if (!employeeName) continue;

        // Resolve user (cached)
        if (!userCache.has(employeeName)) {
          let user = null;

          // 1. CITSEED employeeId match (e.g. "CITSEED001")
          if (employeeName.startsWith('CITSEED')) {
            user = await this.prisma.user.findUnique({
              where: { employeeId: employeeName },
            });
          }

          // 2. Leading employee number match (e.g. "81-Kiran H B" → employeeNumber 81)
          if (!user) {
            const numericPrefixMatch = employeeName.match(/^(\d+)/);
            if (numericPrefixMatch) {
              const employeeNumber = parseInt(numericPrefixMatch[1]);
              user = await this.prisma.user.findFirst({ where: { employeeNumber } });
            }
          }

          // 3. Fallback: exact name match (case-insensitive)
          if (!user) {
            user = await this.prisma.user.findFirst({
              where: { name: { equals: employeeName, mode: 'insensitive' } },
            });
          }

          // 4. Fallback: strip numeric prefix (e.g. "308-harsha gowda s" → "harsha gowda s")
          if (!user) {
            const stripped = employeeName.replace(/^\d+-/, '').trim();
            if (stripped && stripped !== employeeName) {
              user = await this.prisma.user.findFirst({
                where: { name: { equals: stripped, mode: 'insensitive' } },
              });
            }

            // 5. Also try stripping single-letter dept code (e.g. "1-A Akshara Reddy" → "Akshara Reddy")
            if (!user && stripped) {
              const strippedFurther = stripped.replace(/^[A-Za-z]\s+/, '').trim();
              if (strippedFurther && strippedFurther !== stripped) {
                user = await this.prisma.user.findFirst({
                  where: { name: { equals: strippedFurther, mode: 'insensitive' } },
                });
              }
            }
          }

          // 6. Fuzzy fallback: contains match (last resort; avoids dropping entire imports when names differ slightly)
          if (!user) {
            const stripped = employeeName.replace(/^\d+\s*-\s*/, '').trim();
            if (stripped && stripped.length >= 4) {
              user = await this.prisma.user.findFirst({
                where: { name: { contains: stripped, mode: 'insensitive' } },
              });
            }
          }

          userCache.set(
            employeeName,
            user ? { id: user.id, name: user.name, employeeId: user.employeeId } : null,
          );

          if (!user) {
            result.usersNotFound++;
            this.logger.warn(`Employee not found: ${employeeName}`);
          }
        }

        const currentUser = userCache.get(employeeName) ?? null;
        if (!currentUser) {
          parseSummary.rowsSkippedNoUser++;
          continue;
        }

        const inDoor = row[colInDoor] ? row[colInDoor].toString() : null;
        const outDoor = row[colOutDoor] ? row[colOutDoor].toString() : null;

        // Excel may store time cells as Date objects (epoch Jan 0 1900); handle both cases
        const inTimeRaw = row[colInTime];
        const outTimeRaw = row[colOutTime];
        const durationRaw = row[colDuration];

        let inTimeStr: string | null = null;
        let outTimeStrVal: string | null = null;
        let duration: number = 0;

        let inTime: Date | undefined;
        let outTime: Date | undefined;

        // Build a local-time Date from HH:MM string + date so the stored UTC value
        // is correct when the UI renders it in local timezone (IST).
        // "2026-03-02T08:37:00" (no tz suffix) → Node parses as local → 03:07 UTC in IST.
        // ExcelJS creates UTC-based Date objects for Excel time cells
        // (e.g. "08:37" → 1899-12-30T08:37:00Z). Read with getUTC* to get
        // the real Excel value, then store with setUTCHours so the DB holds
        // the naive time (08:37 UTC) and the UI displays it directly as 08:37.
        if (inTimeRaw instanceof Date) {
          const h = inTimeRaw.getUTCHours(), m = inTimeRaw.getUTCMinutes();
          inTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          inTime = new Date(date);
          inTime.setUTCHours(h, m, 0, 0);
        } else if (inTimeRaw) {
          inTimeStr = inTimeRaw.toString();
          const [h, m] = inTimeStr.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            inTime = new Date(date);
            inTime.setUTCHours(h, m, 0, 0);
          }
        }

        if (outTimeRaw instanceof Date) {
          const h = outTimeRaw.getUTCHours(), m = outTimeRaw.getUTCMinutes();
          outTimeStrVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          outTime = new Date(date);
          outTime.setUTCHours(h, m, 0, 0);
        } else if (outTimeRaw) {
          outTimeStrVal = outTimeRaw.toString();
          const [h, m] = outTimeStrVal.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            outTime = new Date(date);
            outTime.setUTCHours(h, m, 0, 0);
          }
        }

        if (durationRaw instanceof Date) {
          duration = durationRaw.getUTCHours() * 60 + durationRaw.getUTCMinutes();
        } else {
          duration = parseDuration(durationRaw ? durationRaw.toString() : '00:00');
        }

        logsToInsert.push({
          userId: currentUser.id,
          date,
          inTime: inTime ?? null,
          outTime: outTime ?? null,
          inDoor,
          outDoor,
          duration,
          rawData: {
            inDoor: inDoor ?? null,
            outDoor: outDoor ?? null,
            inTime: inTimeStr ?? null,
            outTime: outTimeStrVal ?? null,
            duration: durationRaw ? durationRaw.toString() : null,
          } as object,
          processed: false,
        });
        datesSet.add(date.toISOString().slice(0, 10));
      } catch (rowError: any) {
        result.errors.push({
          row: i + 1,
          reason: rowError.message || 'Unknown error',
        });
      }
    }
    result.parseSummary = parseSummary;

    if (logsToInsert.length > 0) {
      // Enforce a single-month upload so we can safely "replace the month" semantics.
      const yearMonths = new Set<string>();
      for (const dateStr of datesSet) yearMonths.add(dateStr.slice(0, 7)); // YYYY-MM

      if (yearMonths.size !== 1) {
        // Most device exports are one calendar month; enforce to avoid accidental wide deletes.
        result.errors.push({
          row: 0,
          reason:
            `Biometric upload must contain a single month, but found: ${Array.from(yearMonths).sort().join(', ')}`,
        });
        return result;
      }

      const month = Array.from(yearMonths)[0]; // YYYY-MM
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      monthStart = new Date(Date.UTC(year, monthIndex, 1));
      nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));

      const existingBiometricCount = await this.prisma.biometricLog.count({
        where: { date: { gte: monthStart, lt: nextMonthStart } },
      });
      const existingAttendanceCount = await this.prisma.attendance.count({
        where: { date: { gte: monthStart, lt: nextMonthStart }, manualOverride: false },
      });

      if (existingBiometricCount > 0 && !(options?.confirmOverride ?? false)) {
        throw new ConflictException({
          message:
            `Biometric data already exists for ${month}. Re-upload will override the entire month's biometric records.`,
          month,
          existing: {
            biometricLogs: existingBiometricCount,
            attendanceRecords: existingAttendanceCount,
          },
          requiresConfirmation: true,
        });
      }

      // Replace-the-month semantics:
      // - Delete all biometric logs for the month.
      // - Delete all attendance rows for the month that were NOT manually overridden.
      //   (Leave approvals + admin manual overrides should survive a biometric re-upload.)
      // - Insert fresh logs and re-sync all dates present in the upload.
      const overrideSummary =
        existingBiometricCount > 0
          ? await this.prisma.$transaction(async (tx) => {
              const deletedLogs = await tx.biometricLog.deleteMany({
                where: { date: { gte: monthStart, lt: nextMonthStart } },
              });
              const deletedAttendance = await tx.attendance.deleteMany({
                where: { date: { gte: monthStart, lt: nextMonthStart }, manualOverride: false },
              });
              const insertResult = await tx.biometricLog.createMany({ data: logsToInsert });
              result.logsCreated = insertResult.count;
              result.logsSkipped = 0;
              return {
                month,
                biometricLogsDeleted: deletedLogs.count,
                attendanceDeleted: deletedAttendance.count,
              };
            }, { timeout: 30000 })
          : await this.prisma.$transaction(async (tx) => {
              const insertResult = await tx.biometricLog.createMany({ data: logsToInsert });
              result.logsCreated = insertResult.count;
              result.logsSkipped = 0;
              return {
                month,
                biometricLogsDeleted: 0,
                attendanceDeleted: 0,
              };
            }, { timeout: 30000 });

      if (overrideSummary.biometricLogsDeleted > 0 || overrideSummary.attendanceDeleted > 0) {
        result.overridden = overrideSummary;
      }
    }

    // Auto-sync all distinct dates in parallel
    const sortedDates = Array.from(datesSet).sort();
    const syncResults = await Promise.all(
      sortedDates.map((dateStr) =>
        this.biometricSyncService
          .syncBiometricDataForDate(new Date(dateStr))
          .then((syncResult) => ({
            date: dateStr,
            processed: (syncResult as any)?.processed ?? 0,
            skipped: (syncResult as any)?.skipped ?? 0,
          })),
      ),
    );
    result.datesProcessed = sortedDates;
    result.syncResults = syncResults;

    // After biometric upload + sync, reconcile CL/leave balance for the affected month so
    // previously applied CL reflects the latest biometric-derived attendance.
    if (monthStart && nextMonthStart && logsToInsert.length > 0) {
      const affectedUserIds = Array.from(new Set(logsToInsert.map((l) => l.userId)));
      await this.reconcileCasualLeaveForMonth(monthStart, nextMonthStart, affectedUserIds);
    }

    this.logger.log(
      `Import complete: ${result.logsCreated} created, ${result.logsSkipped} skipped, ${result.usersNotFound} users not found, ${result.datesProcessed.length} dates synced`,
    );

    return result;
  }

  private computeAvailableCl(accrued: number, used: number, pending: number) {
    return Math.max(0, accrued - (used ?? 0) - (pending ?? 0));
  }

  /**
   * Reconcile leave applications + leave balance for CASUAL_LEAVE after biometric data changes.
   *
   * Rules:
   * - Attendance is recalculated from biometric logs.
   * - If a day previously marked as CL now has biometric-derived attendance (PRESENT/HALF_DAY/etc),
   *   the CL day should no longer count against the user's leave balance.
   * - We recompute each overlapping CL application's effective days based on Attendance rows that
   *   remain CASUAL_LEAVE (manualOverride=true), then recompute yearly used/pending and available.
   */
  private async reconcileCasualLeaveForMonth(
    monthStart: Date,
    nextMonthStart: Date,
    userIds: string[],
  ) {
    if (!userIds.length) return;
    const year = monthStart.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const now = new Date();
    const monthIndexNow = now.getUTCMonth();
    const nowYear = now.getUTCFullYear();

    // Keep transactions short (Prisma interactive transactions can time out on large datasets).
    await this.prisma.attendance.updateMany({
      where: {
        userId: { in: userIds },
        date: { gte: monthStart, lt: nextMonthStart },
        manualOverride: true,
        NOT: { status: 'CASUAL_LEAVE' },
      },
      data: { manualOverride: false },
    });

    for (const userId of userIds) {
      await this.prisma.$transaction(
        async (tx) => {
          // Find CL applications that overlap this month.
          const applications = await tx.leaveApplication.findMany({
            where: {
              userId,
              leaveType: LeaveType.CASUAL_LEAVE,
              status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
              fromDate: { lt: nextMonthStart },
              toDate: { gte: monthStart },
            },
            select: { id: true, fromDate: true, toDate: true, totalDays: true },
          });

          // Recompute each application's effective CL days from attendance rows.
          for (const app of applications) {
            const effectiveDays = await tx.attendance.count({
              where: {
                userId,
                date: { gte: app.fromDate, lte: app.toDate },
                status: 'CASUAL_LEAVE',
                manualOverride: true,
              },
            });
            if (effectiveDays !== app.totalDays) {
              await tx.leaveApplication.update({
                where: { id: app.id },
                data: { totalDays: effectiveDays },
              });
            }
          }

          // Recompute yearly used + pending from applications (post-adjustment).
          const yearApps = await tx.leaveApplication.findMany({
            where: {
              userId,
              leaveType: LeaveType.CASUAL_LEAVE,
              status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
              fromDate: { gte: yearStart, lt: nextYearStart },
            },
            select: { totalDays: true, status: true },
          });
          const used = yearApps
            .filter((a) => a.status === LeaveStatus.APPROVED)
            .reduce((sum, a) => sum + (a.totalDays ?? 0), 0);
          const pending = yearApps
            .filter((a) => a.status === LeaveStatus.PENDING)
            .reduce((sum, a) => sum + (a.totalDays ?? 0), 0);

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { dateOfJoining: true },
          });
          const doj = user?.dateOfJoining ?? yearStart;
          const proRataTotal = getProRataCasualLeaveForYear(doj, year);
          const accrued =
            nowYear === year
              ? getAccruedCasualLeaveUpToMonth(doj, year, monthIndexNow)
              : proRataTotal;
          const available = this.computeAvailableCl(accrued, used, pending);

          await tx.leaveBalance.upsert({
            where: { userId_year: { userId, year } },
            create: {
              userId,
              year,
              casualLeaveTotal: proRataTotal,
              casualLeaveUsed: used,
              casualLeavePending: pending,
              casualLeaveAvailable: available,
            },
            update: {
              casualLeaveTotal: proRataTotal,
              casualLeaveUsed: used,
              casualLeavePending: pending,
              casualLeaveAvailable: available,
            },
          });
        },
        // Give enough time for worst-case users with many applications.
        { timeout: 60_000, maxWait: 60_000 },
      );
    }
  }
}
