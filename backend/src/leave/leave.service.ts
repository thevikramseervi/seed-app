import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { LeaveStatus, AttendanceStatus, LeaveType, Role } from '@prisma/client';
import { getAccruedCasualLeaveUpToMonth, getProRataCasualLeaveForYear } from './leave.utils';
import { toDateOnlyKey } from '../common/date.utils';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  private getUtcMonthBoundsForNow(now: Date = new Date()) {
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));
    const yearStart = new Date(Date.UTC(year, 0, 1));
    return { year, monthIndex, monthStart, nextMonthStart, yearStart };
  }

  private ensureNotFutureMonthRange(fromDate: Date, toDate: Date) {
    const now = new Date();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();

    const fromYear = fromDate.getUTCFullYear();
    const fromMonth = fromDate.getUTCMonth();
    const toYear = toDate.getUTCFullYear();
    const toMonth = toDate.getUTCMonth();

    const isFuture =
      fromYear > nowYear ||
      toYear > nowYear ||
      (fromYear === nowYear && fromMonth > nowMonth) ||
      (toYear === nowYear && toMonth > nowMonth);

    if (isFuture) {
      throw new BadRequestException(
        'You can only apply Casual Leave (CL) for dates up to the current month. Future-month CL requests are not allowed.',
      );
    }
  }

  private async getAccruedClForUserUpToCurrentMonth(
    tx: any,
    userId: string,
    year: number,
  ): Promise<{ accrued: number; cap: number }> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { dateOfJoining: true },
    });
    const doj = user?.dateOfJoining ?? new Date(Date.UTC(year, 0, 1));
    const { monthIndex } = this.getUtcMonthBoundsForNow();
    const cap = getProRataCasualLeaveForYear(doj, year);
    const accrued = getAccruedCasualLeaveUpToMonth(doj, year, monthIndex);
    return { accrued, cap };
  }

  private computeAvailableCl(accrued: number, used: number, pending: number) {
    return Math.max(0, accrued - (used ?? 0) - (pending ?? 0));
  }

  private calculateLeaveDays(
    fromDate: Date,
    toDate: Date,
    holidayKeys: Set<string> = new Set(),
  ): number {
    let days = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
      const dayOfWeek = current.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayKeys.has(toDateOnlyKey(current))) {
        days++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
  }

  async applyLeave(userId: string, applyLeaveDto: ApplyLeaveDto) {
    const fromDate = new Date(applyLeaveDto.fromDate);
    const toDate = new Date(applyLeaveDto.toDate);

    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException('Invalid fromDate');
    }
    if (isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid toDate');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('From date must be before or equal to to date');
    }
    if (fromDate.getUTCFullYear() !== toDate.getUTCFullYear()) {
      throw new BadRequestException('Leave applications cannot span across two calendar years');
    }

    // Fetch holidays in range so they are excluded from the leave day count
    const holidaysInRange = await this.prisma.holiday.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { date: true },
    });
    const holidayKeys = new Set(holidaysInRange.map((h) => toDateOnlyKey(h.date)));

    // Calculate leave days (excluding weekends and public holidays)
    const totalDays = this.calculateLeaveDays(fromDate, toDate, holidayKeys);

    if (totalDays === 0) {
      throw new BadRequestException('No working days in the selected date range');
    }

    // Get leave balance for current year and apply changes transactionally
    const year = fromDate.getUTCFullYear();

    return this.prisma.$transaction(async (tx) => {
      // For CASUAL_LEAVE, we track against leave balance.
      if (applyLeaveDto.leaveType === LeaveType.CASUAL_LEAVE) {
        // Prevent using CL for future months (e.g. applying in March for April dates).
        this.ensureNotFutureMonthRange(fromDate, toDate);

        let leaveBalance = await tx.leaveBalance.findUnique({
          where: {
            userId_year: {
              userId,
              year,
            },
          },
        });

        const { accrued: accruedUpToNow } = await this.getAccruedClForUserUpToCurrentMonth(tx, userId, year);

        if (!leaveBalance) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { dateOfJoining: true },
          });
          const proRataTotal = user
            ? getProRataCasualLeaveForYear(user.dateOfJoining, year)
            : 12;
          leaveBalance = await tx.leaveBalance.create({
            data: {
              userId,
              year,
              casualLeaveTotal: proRataTotal,
              casualLeaveUsed: 0,
              casualLeavePending: 0,
              casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, 0, 0),
            },
          });
        }

        // Enforce "only use CL accrued up to the current month" (carry from previous months allowed; future accrual not).
        const availableAccrued = this.computeAvailableCl(
          accruedUpToNow,
          leaveBalance.casualLeaveUsed,
          leaveBalance.casualLeavePending,
        );
        if (availableAccrued < totalDays) {
          throw new BadRequestException(
            `Insufficient CL available up to the current month. Available: ${availableAccrued}, Requested: ${totalDays}`,
          );
        }

        // Check for overlapping leave applications
        const overlapping = await tx.leaveApplication.findFirst({
          where: {
            userId,
            status: {
              in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
            },
            OR: [
              {
                fromDate: {
                  lte: toDate,
                },
                toDate: {
                  gte: fromDate,
                },
              },
            ],
          },
        });

        if (overlapping) {
          throw new ConflictException('You already have a leave application for overlapping dates');
        }

        // Create leave application
        const leaveApplication = await tx.leaveApplication.create({
          data: {
            userId,
            leaveType: applyLeaveDto.leaveType,
            fromDate,
            toDate,
            totalDays,
            reason: applyLeaveDto.reason,
            status: LeaveStatus.PENDING,
          },
          include: {
            user: {
              select: {
                employeeId: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Update leave balance (mark as pending)
        const updatedBalance = await tx.leaveBalance.update({
          where: {
            userId_year: {
              userId,
              year,
            },
          },
          data: {
            casualLeavePending: {
              increment: totalDays,
            },
          },
        });

        await tx.leaveBalance.update({
          where: { userId_year: { userId, year } },
          data: {
            casualLeaveAvailable: this.computeAvailableCl(
              accruedUpToNow,
              updatedBalance.casualLeaveUsed,
              updatedBalance.casualLeavePending,
            ),
          },
        });

        // Notify admins about new leave request
        const admins = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            role: {
              in: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
            },
          },
          select: { id: true },
        });

        const fromStr = fromDate.toISOString().slice(0, 10);
        const toStr = toDate.toISOString().slice(0, 10);
        const leaveLabel = 'casual leave';

        await Promise.all(
          admins.map((admin) =>
            tx.notification.create({
              data: {
                userId: admin.id,
                type: 'LEAVE_REQUEST',
                title: 'New leave request',
                body: `${leaveApplication.user.name} applied for ${leaveApplication.totalDays} day(s) of ${leaveLabel} from ${fromStr} to ${toStr}.`,
                data: {
                  applicationId: leaveApplication.id,
                  userId,
                  totalDays: leaveApplication.totalDays,
                  leaveType: leaveApplication.leaveType,
                },
              },
            }),
          ),
        );

        return leaveApplication;
      }

      // For UNPAID_LEAVE, we don't touch leave balance, but still enforce overlap rules.
      const overlapping = await tx.leaveApplication.findFirst({
        where: {
          userId,
          status: {
            in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
          },
          OR: [
            {
              fromDate: {
                lte: toDate,
              },
              toDate: {
                gte: fromDate,
              },
            },
          ],
        },
      });

      if (overlapping) {
        throw new ConflictException('You already have a leave application for overlapping dates');
      }

      const application = await tx.leaveApplication.create({
        data: {
          userId,
          leaveType: applyLeaveDto.leaveType,
          fromDate,
          toDate,
          totalDays,
          reason: applyLeaveDto.reason,
          status: LeaveStatus.PENDING,
        },
        include: {
          user: {
            select: {
              employeeId: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Notify admins about new unpaid leave request
      const admins = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          role: {
            in: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
          },
        },
        select: { id: true },
      });

      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = toDate.toISOString().slice(0, 10);
      const leaveLabel = 'unpaid leave';

      await Promise.all(
        admins.map((admin) =>
          tx.notification.create({
            data: {
              userId: admin.id,
              type: 'LEAVE_REQUEST',
              title: 'New leave request',
              body: `${application.user.name} applied for ${application.totalDays} day(s) of ${leaveLabel} from ${fromStr} to ${toStr}.`,
              data: {
                applicationId: application.id,
                userId,
                totalDays: application.totalDays,
                leaveType: application.leaveType,
              },
            },
          }),
        ),
      );

      return application;
    });
  }

  async approveLeave(applicationId: string, reviewedBy: string, reviewLeaveDto?: ReviewLeaveDto) {
    return this.prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findUnique({
        where: { id: reviewedBy },
        select: { role: true },
      });

      const application = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });

      if (!application) {
        throw new NotFoundException('Leave application not found');
      }

      if (application.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending leave applications can be approved. Reopen the application first.');
      }

      if (
        application.user.role &&
        (application.user.role === Role.LAB_ADMIN || application.user.role === Role.SUPER_ADMIN) &&
        reviewer?.role !== Role.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can approve leave for LAB_ADMIN or SUPER_ADMIN users',
        );
      }

      // Update application status
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: LeaveStatus.APPROVED,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: reviewLeaveDto?.comments,
        },
      });

      // For CASUAL_LEAVE, update leave balance; for UNPAID_LEAVE, don't touch balance.
      if (application.leaveType === LeaveType.CASUAL_LEAVE) {
        const year = application.fromDate.getUTCFullYear();
        const { accrued: accruedUpToNow } = await this.getAccruedClForUserUpToCurrentMonth(tx, application.userId, year);
        const b = await tx.leaveBalance.update({
          where: {
            userId_year: {
              userId: application.userId,
              year,
            },
          },
          data: {
            casualLeaveUsed: {
              increment: application.totalDays,
            },
            casualLeavePending: {
              decrement: application.totalDays,
            },
          },
        });
        await tx.leaveBalance.update({
          where: { userId_year: { userId: application.userId, year } },
          data: { casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, b.casualLeaveUsed, b.casualLeavePending) },
        });
      }

      // Create attendance records for leave dates (excluding weekends and public holidays)
      const leaveHolidays = await tx.holiday.findMany({
        where: { date: { gte: application.fromDate, lte: application.toDate } },
        select: { date: true },
      });
      const leaveHolidayKeys = new Set(leaveHolidays.map((h) => toDateOnlyKey(h.date)));

      const current = new Date(application.fromDate);
      const endDate = new Date(application.toDate);

      while (current <= endDate) {
        const dayOfWeek = current.getUTCDay();
        const dateKey = toDateOnlyKey(current);
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !leaveHolidayKeys.has(dateKey)) {
          const statusForDay =
            application.leaveType === LeaveType.CASUAL_LEAVE
              ? AttendanceStatus.CASUAL_LEAVE
              : AttendanceStatus.ABSENT;
          const attendanceDate = new Date(current);
          await tx.attendance.upsert({
            where: {
              userId_date: {
                userId: application.userId,
                date: attendanceDate,
              },
            },
            update: {
              status: statusForDay,
              manualOverride: true,
            },
            create: {
              userId: application.userId,
              date: attendanceDate,
              status: statusForDay,
              manualOverride: true,
              biometricSynced: false,
            },
          });
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      const updated = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: {
            select: {
              employeeId: true,
              name: true,
            },
          },
          reviewer: {
            select: {
              name: true,
            },
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: application.userId,
          type: 'LEAVE_APPROVED',
          title: 'Leave approved',
          body: `Your leave from ${application.fromDate.toISOString().slice(0, 10)} to ${application.toDate
            .toISOString()
            .slice(0, 10)} has been approved.`,
          data: {
            applicationId: application.id,
            totalDays: application.totalDays,
            leaveType: application.leaveType,
          },
        },
      });

      return updated;
    });
  }

  async rejectLeave(applicationId: string, reviewedBy: string, reviewLeaveDto?: ReviewLeaveDto) {
    return this.prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findUnique({
        where: { id: reviewedBy },
        select: { role: true },
      });

      const application = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });

      if (!application) {
        throw new NotFoundException('Leave application not found');
      }

      if (application.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending leave applications can be rejected');
      }

      if (
        application.user.role &&
        (application.user.role === Role.LAB_ADMIN || application.user.role === Role.SUPER_ADMIN) &&
        reviewer?.role !== Role.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can reject leave for LAB_ADMIN or SUPER_ADMIN users',
        );
      }

      // Update application status
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: LeaveStatus.REJECTED,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: reviewLeaveDto?.comments,
        },
      });

      // Restore leave balance only for CASUAL_LEAVE applications
      if (application.leaveType === LeaveType.CASUAL_LEAVE) {
        const year = application.fromDate.getUTCFullYear();
        const { accrued: accruedUpToNow } = await this.getAccruedClForUserUpToCurrentMonth(tx, application.userId, year);
        const b = await tx.leaveBalance.update({
          where: {
            userId_year: {
              userId: application.userId,
              year,
            },
          },
          data: {
            casualLeavePending: {
              decrement: application.totalDays,
            },
          },
        });
        await tx.leaveBalance.update({
          where: { userId_year: { userId: application.userId, year } },
          data: { casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, b.casualLeaveUsed, b.casualLeavePending) },
        });
      }

      const updated = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: {
            select: {
              employeeId: true,
              name: true,
            },
          },
          reviewer: {
            select: {
              name: true,
            },
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: application.userId,
          type: 'LEAVE_REJECTED',
          title: 'Leave rejected',
          body: `Your leave from ${application.fromDate.toISOString().slice(0, 10)} to ${application.toDate
            .toISOString()
            .slice(0, 10)} has been rejected.`,
          data: {
            applicationId: application.id,
            totalDays: application.totalDays,
            leaveType: application.leaveType,
          },
        },
      });

      return updated;
    });
  }

  async getMyApplications(userId: string, status?: LeaveStatus) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    return this.prisma.leaveApplication.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: {
        reviewer: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async getPendingApplications() {
    return this.prisma.leaveApplication.findMany({
      where: {
        status: LeaveStatus.PENDING,
      },
      orderBy: { appliedAt: 'asc' },
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            designation: true,
            role: true,
          },
        },
      },
    });
  }

  async getReport(
    userId?: string,
    status?: LeaveStatus,
    fromDate?: string,
    toDate?: string,
  ) {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : undefined;
      const to = toDate ? new Date(toDate) : undefined;

      if (from && to && from > to) {
        throw new BadRequestException('fromDate must be before or equal to toDate');
      }

      // Leaves that overlap the given window [from, to]
      where.AND = where.AND || [];
      const overlap: any = {};
      if (from && to) {
        overlap.fromDate = { lte: to };
        overlap.toDate = { gte: from };
      } else if (from) {
        overlap.toDate = { gte: from };
      } else if (to) {
        overlap.fromDate = { lte: to };
      }
      where.AND.push(overlap);
    }

    return this.prisma.leaveApplication.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            designation: true,
            role: true,
          },
        },
        reviewer: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async getMyLeaveBalance(userId: string, year: number) {
    // Fetch the user's joining date to compute pro-rata entitlement if needed.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfJoining: true },
    });
    const proRataTotal = user
      ? getProRataCasualLeaveForYear(user.dateOfJoining, year)
      : 12;

    // Use upsert so concurrent first-logins for the same user never race
    // into a duplicate-key violation (the old findUnique + create pair had
    // a TOCTOU window between the two separate DB round-trips).
    const leaveBalance = await this.prisma.leaveBalance.upsert({
      where: { userId_year: { userId, year } },
      create: {
        userId,
        year,
        casualLeaveTotal: proRataTotal,
        casualLeaveUsed: 0,
        casualLeavePending: 0,
        casualLeaveAvailable: proRataTotal,
      },
      update: {},
    });

    // Compute "available up to current month" dynamically, regardless of stored value.
    const { year: nowYear, monthIndex } = this.getUtcMonthBoundsForNow();
    const accruedUpToNow =
      nowYear === year
        ? getAccruedCasualLeaveUpToMonth(user.dateOfJoining, year, monthIndex)
        : proRataTotal;
    const availableAccrued = this.computeAvailableCl(
      accruedUpToNow,
      leaveBalance.casualLeaveUsed,
      leaveBalance.casualLeavePending,
    );

    // Map Prisma model fields to API shape expected by frontend
    return {
      id: leaveBalance.id,
      userId: leaveBalance.userId,
      year: leaveBalance.year,
      // "Out of 12" / yearly entitlement for the given year (pro-rata based on DOJ).
      totalLeaves: proRataTotal,
      // "Till now" / accrued up to the current month (or full entitlement for past years).
      accruedLeaves: accruedUpToNow,
      usedLeaves: leaveBalance.casualLeaveUsed,
      pendingLeaves: leaveBalance.casualLeavePending,
      availableLeaves: availableAccrued,
    };
  }

  async reopenLeave(applicationId: string, reviewedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findUnique({
        where: { id: reviewedBy },
        select: { role: true },
      });

      if (reviewer?.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only SUPER_ADMIN can reopen leave applications');
      }

      const application = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });

      if (!application) {
        throw new NotFoundException('Leave application not found');
      }

      if (
        application.status !== LeaveStatus.APPROVED &&
        application.status !== LeaveStatus.REJECTED
      ) {
        throw new BadRequestException('Only approved or rejected applications can be reopened');
      }

      const previousStatus = application.status;

      // Reverse balance changes
      if (application.leaveType === LeaveType.CASUAL_LEAVE) {
        const year = application.fromDate.getUTCFullYear();
        const { accrued: accruedUpToNow } = await this.getAccruedClForUserUpToCurrentMonth(tx, application.userId, year);
        if (previousStatus === LeaveStatus.APPROVED) {
          // Was approved: used += totalDays, pending -= totalDays → reverse
          const b = await tx.leaveBalance.update({
            where: { userId_year: { userId: application.userId, year } },
            data: {
              casualLeaveUsed: { decrement: application.totalDays },
              casualLeavePending: { increment: application.totalDays },
            },
          });
          await tx.leaveBalance.update({
            where: { userId_year: { userId: application.userId, year } },
            data: { casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, b.casualLeaveUsed, b.casualLeavePending) },
          });
        } else {
          // Was rejected: pending -= totalDays, available += totalDays → reverse
          const b = await tx.leaveBalance.update({
            where: { userId_year: { userId: application.userId, year } },
            data: {
              casualLeavePending: { increment: application.totalDays },
            },
          });
          await tx.leaveBalance.update({
            where: { userId_year: { userId: application.userId, year } },
            data: { casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, b.casualLeaveUsed, b.casualLeavePending) },
          });
        }
      }

      // If was approved, remove the attendance records that were created
      if (previousStatus === LeaveStatus.APPROVED) {
        const current = new Date(application.fromDate);
        const endDate = new Date(application.toDate);
        const leaveHolidays = await tx.holiday.findMany({
          where: { date: { gte: application.fromDate, lte: application.toDate } },
          select: { date: true },
        });
        const leaveHolidayKeys = new Set(leaveHolidays.map((h) => toDateOnlyKey(h.date)));

        while (current <= endDate) {
          const dayOfWeek = current.getUTCDay();
          const dateKey = toDateOnlyKey(current);
          if (dayOfWeek !== 0 && dayOfWeek !== 6 && !leaveHolidayKeys.has(dateKey)) {
            await tx.attendance.deleteMany({
              where: {
                userId: application.userId,
                date: new Date(current),
                manualOverride: true,
              },
            });
          }
          current.setUTCDate(current.getUTCDate() + 1);
        }
      }

      // Reset to PENDING
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: LeaveStatus.PENDING,
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        },
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: application.userId,
          type: 'LEAVE_REOPENED',
          title: 'Leave application reopened',
          body: `Your leave from ${application.fromDate.toISOString().slice(0, 10)} to ${application.toDate.toISOString().slice(0, 10)} has been reopened for review.`,
          data: {
            applicationId: application.id,
            totalDays: application.totalDays,
            leaveType: application.leaveType,
          },
        },
      });

      return tx.leaveApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: { select: { employeeId: true, name: true } },
          reviewer: { select: { name: true } },
        },
      });
    });
  }

  async cancelApplication(applicationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.leaveApplication.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new NotFoundException('Leave application not found');
      }

      if (application.userId !== userId) {
        throw new ForbiddenException('You can only cancel your own applications');
      }

      if (application.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending applications can be cancelled');
      }

      // Update status
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: LeaveStatus.CANCELLED,
        },
      });
      // Restore leave balance only for CASUAL_LEAVE
      if (application.leaveType === LeaveType.CASUAL_LEAVE) {
        const year = application.fromDate.getUTCFullYear();
        const { accrued: accruedUpToNow } = await this.getAccruedClForUserUpToCurrentMonth(tx, application.userId, year);
        const b = await tx.leaveBalance.update({
          where: {
            userId_year: {
              userId: application.userId,
              year,
            },
          },
          data: {
            casualLeavePending: {
              decrement: application.totalDays,
            },
          },
        });
        await tx.leaveBalance.update({
          where: { userId_year: { userId: application.userId, year } },
          data: { casualLeaveAvailable: this.computeAvailableCl(accruedUpToNow, b.casualLeaveUsed, b.casualLeavePending) },
        });
      }

      return { message: 'Leave application cancelled successfully' };
    });
  }

  async getClAppliedSummary(userId: string, year?: number) {
    const now = new Date();
    const y = year ?? now.getUTCFullYear();
    const { monthIndex } = this.getUtcMonthBoundsForNow(now);
    const yearStart = new Date(Date.UTC(y, 0, 1));
    const through = new Date(Date.UTC(y, monthIndex + 1, 1)); // start of next month

    const clApplications = await this.prisma.leaveApplication.findMany({
      where: {
        userId,
        leaveType: LeaveType.CASUAL_LEAVE,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        fromDate: { gte: yearStart, lt: through },
      },
      select: { id: true, totalDays: true },
    });

    const appliedDays = clApplications.reduce((sum, a) => sum + (a.totalDays ?? 0), 0);
    return {
      userId,
      year: y,
      throughMonth: monthIndex + 1, // 1-12
      appliedDays,
      applicationsCount: clApplications.length,
    };
  }
}
