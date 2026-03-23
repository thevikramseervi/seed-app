import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';
import { isWeekend } from '../common/date.utils';
import { getStatusFromWorkDurationMinutes } from '../common/attendance.utils';

interface BiometricEntry {
  employeeId: string;
  date: Date;
  inTime: Date | null;
  outTime: Date | null;
  inDoor: string | null;
  outDoor: string | null;
  duration: number; // in minutes
}

@Injectable()
export class BiometricSyncService {
  private readonly logger = new Logger(BiometricSyncService.name);

  constructor(private prisma: PrismaService) {}

  async processBiometricData(
    entries: BiometricEntry[],
    options?: { skipLogCreation?: boolean },
  ): Promise<any> {
    this.logger.log(`Processing ${entries.length} biometric entries...`);
    const skipLogCreation = options?.skipLogCreation ?? false;

    const results = {
      processed: 0,
      skipped: 0,
      errors: [],
    };

    // Group entries by employee and date
    const grouped = new Map<string, BiometricEntry[]>();
    const allDates: Date[] = [];

    for (const entry of entries) {
      const key = `${entry.employeeId}_${entry.date.toISOString().slice(0, 10)}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
        allDates.push(entry.date);
      }
      grouped.get(key)!.push(entry);
    }

    const uniqueEmployeeIds = [...new Set(entries.map((e) => e.employeeId))];
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Batch fetch users by employee IDs
    const users = await this.prisma.user.findMany({
      where: { employeeId: { in: uniqueEmployeeIds } },
    });
    const userByEmployeeId = new Map(users.map((u) => [u.employeeId, u]));

    // Batch fetch holidays in date range
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: minDate, lte: maxDate } },
    });
    const holidayDateKeys = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10)),
    );

    // Batch fetch approved leaves overlapping date range for our users
    const userIds = users.map((u) => u.id);
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        userId: { in: userIds },
        status: LeaveStatus.APPROVED,
        fromDate: { lte: maxDate },
        toDate: { gte: minDate },
      },
    });
    const leaveKeySet = new Set<string>();
    for (const leave of leaves) {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        leaveKeySet.add(`${leave.userId}_${d.toISOString().slice(0, 10)}`);
      }
    }

    // Process each employee's daily data
    for (const [key, dateEntries] of grouped) {
      try {
        const [employeeId] = key.split('_');
        const date = dateEntries[0].date;
        const dateKey = date.toISOString().slice(0, 10);

        const user = userByEmployeeId.get(employeeId);
        if (!user) {
          this.logger.warn(`User not found for employee ID: ${employeeId}`);
          results.skipped++;
          continue;
        }

        // Deduplicate entries (e.g. same file uploaded twice) so duration/attendance are not doubled
        const seenKey = new Set<string>();
        const uniqueEntries = dateEntries.filter((e) => {
          const k = `${e.inTime?.getTime() ?? 'n'}_${e.outTime?.getTime() ?? 'n'}_${e.duration}`;
          if (seenKey.has(k)) return false;
          seenKey.add(k);
          return true;
        });

        // Store biometric logs in batch (skip when entries came from existing logs)
        if (!skipLogCreation && uniqueEntries.length > 0) {
          await this.prisma.biometricLog.createMany({
            data: uniqueEntries.map((entry) => ({
              userId: user.id,
              date: entry.date,
              inTime: entry.inTime,
              outTime: entry.outTime,
              inDoor: entry.inDoor,
              outDoor: entry.outDoor,
              duration: entry.duration,
              rawData: entry as object,
              processed: false,
            })),
          });
        }

        const sorted = [...uniqueEntries].sort((a, b) => {
          const aTime = a.inTime?.getTime() ?? 0;
          const bTime = b.inTime?.getTime() ?? 0;
          return aTime - bTime;
        });
        const firstIn = sorted[0]?.inTime ?? null;
        const lastOut = sorted[sorted.length - 1]?.outTime ?? null;

        // Compute duration from actual timestamps (lastOut - firstIn) so device
        // inaccuracies in the Duration column don't affect attendance status.
        const totalDurationMinutes =
          firstIn && lastOut
            ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000)
            : uniqueEntries.reduce((sum, entry) => sum + entry.duration, 0);

        let status: AttendanceStatus;
        if (isWeekend(date)) {
          status = AttendanceStatus.WEEKEND;
        } else if (holidayDateKeys.has(dateKey)) {
          status = AttendanceStatus.HOLIDAY;
        } else if (leaveKeySet.has(`${user.id}_${dateKey}`)) {
          status = AttendanceStatus.CASUAL_LEAVE;
        } else {
          status = getStatusFromWorkDurationMinutes(totalDurationMinutes);
        }

        await this.prisma.attendance.upsert({
          where: {
            userId_date: { userId: user.id, date },
          },
          update: {
            status,
            firstInTime: firstIn ?? undefined,
            lastOutTime: lastOut ?? undefined,
            totalDuration: totalDurationMinutes,
            biometricSynced: true,
          },
          create: {
            userId: user.id,
            date,
            status,
            firstInTime: firstIn ?? undefined,
            lastOutTime: lastOut ?? undefined,
            totalDuration: totalDurationMinutes,
            biometricSynced: true,
          },
        });

        await this.prisma.biometricLog.updateMany({
          where: {
            userId: user.id,
            date,
            processed: false,
          },
          data: { processed: true },
        });

        results.processed++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Error processing entry: ${err.message}`);
        results.errors.push({ key, error: err.message });
      }
    }

    this.logger.log(
      `Processing complete. Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
    );

    return results;
  }

  async syncBiometricDataForDate(date: Date): Promise<any> {
    this.logger.log(`Syncing biometric data for ${date.toDateString()}...`);

    // Fetch unprocessed logs — group directly by userId (avoids fragile employeeId re-lookup)
    const unprocessedLogs = await this.prisma.biometricLog.findMany({
      where: { date, processed: false },
    });

    if (unprocessedLogs.length === 0) {
      this.logger.log('No unprocessed biometric data found');
      return { processed: 0, skipped: 0 };
    }

    const isHoliday = (await this.prisma.holiday.count({ where: { date } })) > 0;
    const dateIsWeekend = isWeekend(date);

    // Group logs by userId
    const byUser = new Map<string, typeof unprocessedLogs>();
    for (const log of unprocessedLogs) {
      if (!byUser.has(log.userId)) byUser.set(log.userId, []);
      byUser.get(log.userId)!.push(log);
    }

    // Batch fetch approved leaves for these users on this date
    const userIds = [...byUser.keys()];
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        userId: { in: userIds },
        status: LeaveStatus.APPROVED,
        fromDate: { lte: date },
        toDate: { gte: date },
      },
    });
    const leaveUserIds = new Set(leaves.map((l) => l.userId));

    let processed = 0;
    let skipped = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const [userId, logs] of byUser) {
      try {
        const sorted = [...logs]
          .filter((l) => l.inTime)
          .sort((a, b) => a.inTime!.getTime() - b.inTime!.getTime());

        const firstIn = sorted[0]?.inTime ?? null;
        const lastOut = sorted[sorted.length - 1]?.outTime ?? null;

        const totalDurationMinutes =
          firstIn && lastOut
            ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000)
            : logs.reduce((sum, l) => sum + l.duration, 0);

        let status: AttendanceStatus;
        if (dateIsWeekend) {
          status = AttendanceStatus.WEEKEND;
        } else if (isHoliday) {
          status = AttendanceStatus.HOLIDAY;
        } else if (leaveUserIds.has(userId)) {
          status = AttendanceStatus.CASUAL_LEAVE;
        } else {
          status = getStatusFromWorkDurationMinutes(totalDurationMinutes);
        }

        await this.prisma.attendance.upsert({
          where: { userId_date: { userId, date } },
          update: {
            status,
            firstInTime: firstIn ?? undefined,
            lastOutTime: lastOut ?? undefined,
            totalDuration: totalDurationMinutes,
            biometricSynced: true,
          },
          create: {
            userId,
            date,
            status,
            firstInTime: firstIn ?? undefined,
            lastOutTime: lastOut ?? undefined,
            totalDuration: totalDurationMinutes,
            biometricSynced: true,
          },
        });

        await this.prisma.biometricLog.updateMany({
          where: { userId, date, processed: false },
          data: { processed: true },
        });

        processed++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Error syncing userId ${userId}: ${err.message}`);
        errors.push({ userId, error: err.message });
        skipped++;
      }
    }

    this.logger.log(`Sync complete for ${date.toISOString().slice(0, 10)}: processed=${processed}, skipped=${skipped}`);
    return { processed, skipped, errors };
  }

  /**
   * Batch-sync unprocessed biometric logs for multiple dates in a single pass.
   * Fetches logs, holidays, and leaves ONCE instead of per-date, then upserts
   * attendance with controlled concurrency.
   */
  async syncBiometricDataBatch(
    dates: Date[],
  ): Promise<{ processed: number; skipped: number; details: Array<{ date: string; processed: number; skipped: number }> }> {
    if (dates.length === 0) return { processed: 0, skipped: 0, details: [] };

    // 1. Single query: all unprocessed logs for all dates
    const unprocessedLogs = await this.prisma.biometricLog.findMany({
      where: { date: { in: dates }, processed: false },
    });
    if (unprocessedLogs.length === 0) {
      return {
        processed: 0,
        skipped: 0,
        details: dates.map((d) => ({ date: d.toISOString().slice(0, 10), processed: 0, skipped: 0 })),
      };
    }

    // 2. Single query: holidays
    const holidays = await this.prisma.holiday.findMany({ where: { date: { in: dates } } });
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    // 3. Group by userId+date
    const byUserDate = new Map<string, typeof unprocessedLogs>();
    for (const log of unprocessedLogs) {
      const key = `${log.userId}_${log.date.toISOString().slice(0, 10)}`;
      if (!byUserDate.has(key)) byUserDate.set(key, []);
      byUserDate.get(key)!.push(log);
    }

    // 4. Single query: approved leaves for affected users
    const userIds = [...new Set(unprocessedLogs.map((l) => l.userId))];
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        userId: { in: userIds },
        status: LeaveStatus.APPROVED,
        fromDate: { lte: maxDate },
        toDate: { gte: minDate },
      },
    });
    const leaveKeySet = new Set<string>();
    for (const leave of leaves) {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        leaveKeySet.add(`${leave.userId}_${d.toISOString().slice(0, 10)}`);
      }
    }

    // 5. Process with controlled concurrency (batches of 10)
    let totalProcessed = 0;
    let totalSkipped = 0;
    const dateStats = new Map<string, { processed: number; skipped: number }>();

    const entries = [...byUserDate.entries()];
    const BATCH_SIZE = 10;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ([key, logs]) => {
          const userId = key.split('_')[0];
          const dateStr = key.split('_')[1];
          const date = logs[0].date;

          try {
            const dateIsWeekend = isWeekend(date);
            const isHoliday = holidayDates.has(dateStr);

            const sorted = [...logs]
              .filter((l) => l.inTime)
              .sort((a, b) => a.inTime!.getTime() - b.inTime!.getTime());
            const firstIn = sorted[0]?.inTime ?? null;
            const lastOut = sorted[sorted.length - 1]?.outTime ?? null;
            const totalDurationMinutes =
              firstIn && lastOut
                ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000)
                : logs.reduce((sum, l) => sum + l.duration, 0);

            let status: AttendanceStatus;
            if (dateIsWeekend) status = AttendanceStatus.WEEKEND;
            else if (isHoliday) status = AttendanceStatus.HOLIDAY;
            else if (leaveKeySet.has(key)) status = AttendanceStatus.CASUAL_LEAVE;
            else status = getStatusFromWorkDurationMinutes(totalDurationMinutes);

            await this.prisma.attendance.upsert({
              where: { userId_date: { userId, date } },
              update: { status, firstInTime: firstIn ?? undefined, lastOutTime: lastOut ?? undefined, totalDuration: totalDurationMinutes, biometricSynced: true },
              create: { userId, date, status, firstInTime: firstIn ?? undefined, lastOutTime: lastOut ?? undefined, totalDuration: totalDurationMinutes, biometricSynced: true },
            });

            totalProcessed++;
            const stat = dateStats.get(dateStr) ?? { processed: 0, skipped: 0 };
            stat.processed++;
            dateStats.set(dateStr, stat);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Batch sync error for ${key}: ${err.message}`);
            totalSkipped++;
            const stat = dateStats.get(dateStr) ?? { processed: 0, skipped: 0 };
            stat.skipped++;
            dateStats.set(dateStr, stat);
          }
        }),
      );
    }

    // 6. Batch mark all processed logs at once (single query instead of per-user-date)
    const processedLogIds = unprocessedLogs.map((l) => l.id);
    await this.prisma.biometricLog.updateMany({
      where: { id: { in: processedLogIds } },
      data: { processed: true },
    });

    this.logger.log(`Batch sync complete: ${totalProcessed} processed, ${totalSkipped} skipped across ${dates.length} dates`);

    return {
      processed: totalProcessed,
      skipped: totalSkipped,
      details: dates.map((d) => {
        const dateStr = d.toISOString().slice(0, 10);
        const stat = dateStats.get(dateStr) ?? { processed: 0, skipped: 0 };
        return { date: dateStr, ...stat };
      }),
    };
  }

  async syncBiometricDataForRange(startDate: Date, endDate: Date): Promise<any> {
    const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    if (start > end) {
      throw new Error('startDate must be before or equal to endDate');
    }

    let totalProcessed = 0;
    let totalSkipped = 0;
    const errors: Array<{ date: string; error: string }> = [];

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const result = await this.syncBiometricDataForDate(new Date(d));
      totalProcessed += result?.processed ?? 0;
      totalSkipped += result?.skipped ?? 0;
      (result?.errors ?? []).forEach((e: any) =>
        errors.push({ date: d.toISOString().slice(0, 10), error: e.error ?? String(e) }),
      );
    }

    return {
      processed: totalProcessed,
      skipped: totalSkipped,
      errors,
    };
  }

  async recalculateAttendanceDurations(startDate?: Date, endDate?: Date): Promise<{ updated: number; skipped: number }> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const records = await this.prisma.attendance.findMany({
      where: {
        biometricSynced: true,
        firstInTime: { not: null },
        lastOutTime: { not: null },
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    });

    let updated = 0;
    let skipped = 0;

    for (const record of records) {
      if (!record.firstInTime || !record.lastOutTime) { skipped++; continue; }

      const totalDurationMinutes = Math.round(
        (record.lastOutTime.getTime() - record.firstInTime.getTime()) / 60000,
      );

      const workdayStatuses: AttendanceStatus[] = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.HALF_DAY,
        AttendanceStatus.ABSENT,
      ];
      const newStatus = workdayStatuses.includes(record.status)
        ? getStatusFromWorkDurationMinutes(totalDurationMinutes)
        : record.status;

      await this.prisma.attendance.update({
        where: { id: record.id },
        data: { totalDuration: totalDurationMinutes, status: newStatus },
      });
      updated++;
    }

    this.logger.log(`Recalculate complete: ${updated} updated, ${skipped} skipped`);
    return { updated, skipped };
  }

  async getUnprocessedLogs() {
    return this.prisma.biometricLog.findMany({
      where: { processed: false },
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }
}
