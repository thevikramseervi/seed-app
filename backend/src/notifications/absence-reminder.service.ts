import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus, LeaveType } from '@prisma/client';

@Injectable()
export class AbsenceReminderService {
  private readonly logger = new Logger(AbsenceReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every day at 2 PM. Looks at yesterday's attendance.
   * For any user marked ABSENT without an approved/pending UNPAID_LEAVE or
   * CASUAL_LEAVE covering that date, sends a notification suggesting they
   * apply for unpaid leave.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2PM)
  async remindForUnpaidLeave() {
    const now = new Date();
    // Build yesterday as a UTC midnight Date so the range aligns with @db.Date storage.
    const yesterdayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    );

    // Skip checks when yesterday was a weekend
    const dow = yesterdayUTC.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow === 0 || dow === 6) {
      return;
    }

    // For a @db.Date field Prisma uses UTC midnight; give a full-day window.
    const yStart = yesterdayUTC;
    const yEnd = new Date(yesterdayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Find ABSENT attendance for yesterday
    const absentRecords = await this.prisma.attendance.findMany({
      where: {
        date: {
          gte: yStart,
          lte: yEnd,
        },
        status: AttendanceStatus.ABSENT,
      },
      select: {
        userId: true,
        date: true,
      },
    });

    if (absentRecords.length === 0) {
      return;
    }

    const userIds = Array.from(new Set(absentRecords.map((r) => r.userId)));

    // Check for CASUAL or UNPAID leave applications overlapping yesterday
    const leaveApplications = await this.prisma.leaveApplication.findMany({
      where: {
        userId: { in: userIds },
        leaveType: {
          in: [LeaveType.UNPAID_LEAVE, LeaveType.CASUAL_LEAVE],
        },
        status: {
          in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
        },
        fromDate: { lte: yEnd },
        toDate: { gte: yStart },
      },
      select: {
        userId: true,
      },
    });

    const usersWithAnyLeave = new Set(leaveApplications.map((l) => l.userId));

    const usersNeedingReminder = userIds.filter((id) => !usersWithAnyLeave.has(id));

    if (usersNeedingReminder.length === 0) {
      return;
    }

    const dateLabel = yesterdayUTC.toISOString().slice(0, 10);

    await this.prisma.notification.createMany({
      data: usersNeedingReminder.map((userId) => ({
        userId,
        type: 'ABSENT_NO_UNPAID_LEAVE',
        title: 'Unpaid leave reminder',
        body: `You were marked absent on ${dateLabel}. Please apply for unpaid leave for this day if this is correct.`,
        data: {
          date: dateLabel,
        } as any,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Sent unpaid leave reminders for ${usersNeedingReminder.length} user(s) for ${dateLabel}`,
    );
  }
}

