import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';
import { isWeekend, toDateOnlyKey } from '../common/date.utils';

interface SalaryCalculation {
  baseSalary: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  presentDays: number;
  casualLeaveDays: number;
  halfDays: number;
  lossOfPayDays: number;
  totalPayDays: number;
  grossEarnings: number;
  deductions: number;
  reimbursements: number;
  netSalary: number;
}

@Injectable()
export class PayrollCalculatorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Working days = total calendar days in the month.
   * Company operates in India only. Month is 1-12 (January = 1).
   */
  private async calculateWorkingDays(year: number, month: number): Promise<number> {
    // Last day of month: new Date(year, month, 0) since day 0 = last day of previous month
    return new Date(year, month, 0).getDate();
  }

  async calculateSalary(
    userId: string,
    year: number,
    month: number,
    /**
     * Optional pre-fetched holiday keys (`YYYY-MM-DD`) for the payroll month.
     * Pass this when generating payroll for multiple employees in bulk so the
     * same holiday list is not queried from the DB once per employee.
     */
    prefetchedHolidayKeys?: Set<string>,
  ): Promise<SalaryCalculation> {
    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const baseSalary = Number(user.baseSalary);

    // Calculate working days for the month (calendar days)
    const workingDays = await this.calculateWorkingDays(year, month);

    // Get attendance records for the month (UTC midnight boundaries to avoid timezone cutoff)
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Index attendance records by date key for quick lookup
    const attendanceByDate = new Map(
      attendanceRecords.map((r) => [toDateOnlyKey(r.date), r]),
    );

    // Use pre-fetched holiday keys if provided (bulk payroll path), otherwise query.
    let holidayDateKeys: Set<string>;
    if (prefetchedHolidayKeys) {
      holidayDateKeys = prefetchedHolidayKeys;
    } else {
      const holidays = await this.prisma.holiday.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      });
      holidayDateKeys = new Set(holidays.map((h) => toDateOnlyKey(h.date)));
    }

    let weekendDays = 0;
    let holidayDays = 0;
    let presentDays = 0;
    let casualLeaveDays = 0;
    let halfDays = 0;
    let lossOfPayDays = 0;

    // If the employee joined mid-month in this payroll month, skip days before
    // their joining date — those days must not be counted as weekends, holidays,
    // or LOP since the employee was not yet employed.
    const joiningDate = user.dateOfJoining ? new Date(user.dateOfJoining) : null;
    const joiningIsThisMonth =
      joiningDate !== null &&
      joiningDate.getUTCFullYear() === year &&
      joiningDate.getUTCMonth() + 1 === month;
    const firstActiveDay = joiningIsThisMonth ? joiningDate!.getUTCDate() : 1;

    const daysInMonth = workingDays;
    for (let day = firstActiveDay; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dateKey = toDateOnlyKey(date);

      if (holidayDateKeys.has(dateKey)) {
        holidayDays++;
      } else if (isWeekend(date)) {
        weekendDays++;
      } else {
        // Weekday: use attendance record, or treat as LOP if no record exists
        const record = attendanceByDate.get(dateKey);
        if (!record) {
          lossOfPayDays++;
        } else {
          switch (record.status) {
            case AttendanceStatus.PRESENT:
              presentDays++;
              break;
            case AttendanceStatus.CASUAL_LEAVE:
              casualLeaveDays++;
              break;
            case AttendanceStatus.HALF_DAY:
              halfDays++;
              break;
            case AttendanceStatus.ABSENT:
              lossOfPayDays++;
              break;
            // WEEKEND / HOLIDAY statuses on a record are ignored here
            // since the calendar loop already handles them above
          }
        }
      }
    }

    // Calculate total pay days:
    // - Present and casual leave count fully
    // - Half days count as 0.5
    // - Weekends and holidays are treated as paid off-days
    const totalPayDays =
      presentDays +
      casualLeaveDays +
      halfDays * 0.5 +
      weekendDays +
      holidayDays;

    // Calculate gross earnings (prorated); guard against no working days
    if (workingDays <= 0) {
      throw new Error(`No working days in ${year}-${month}; cannot calculate salary.`);
    }
    const grossEarnings = Math.round((totalPayDays / workingDays) * baseSalary);

    // Future: Add deductions and reimbursements
    const deductions = 0;
    const reimbursements = 0;

    const netSalary = grossEarnings - deductions + reimbursements;

    return {
      baseSalary,
      workingDays,
      weekendDays,
      holidayDays,
      presentDays,
      casualLeaveDays,
      halfDays,
      lossOfPayDays,
      totalPayDays,
      grossEarnings,
      deductions,
      reimbursements,
      netSalary,
    };
  }
}
