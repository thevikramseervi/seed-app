import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceStatus } from '@prisma/client';
import { isWeekend, toDateOnlyKey } from '../common/date.utils';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Format a time-of-day Date (stored as TIME without time zone in DB)
   * to simple "HH:MM" string, using UTC fields so we don't apply any
   * server-local timezone offset.
   */
  private formatTimeOfDay(time?: Date | null): string | null {
    if (!time) return null;
    const hours = time.getUTCHours();
    const minutes = time.getUTCMinutes();
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  async create(createAttendanceDto: CreateAttendanceDto, manualOverride = true) {
    // Check if attendance already exists for this user and date
    const existing = await this.prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: createAttendanceDto.userId,
          date: new Date(createAttendanceDto.date),
        },
      },
    });

    if (existing) {
      throw new ConflictException('Attendance already exists for this date');
    }

    const data: any = {
      userId: createAttendanceDto.userId,
      date: new Date(createAttendanceDto.date),
      status: createAttendanceDto.status,
      manualOverride,
      notes: createAttendanceDto.notes,
    };

    if (createAttendanceDto.firstInTime) {
      data.firstInTime = createAttendanceDto.firstInTime;
    }

    if (createAttendanceDto.lastOutTime) {
      data.lastOutTime = createAttendanceDto.lastOutTime;
    }

    if (createAttendanceDto.totalDuration !== undefined) {
      data.totalDuration = createAttendanceDto.totalDuration;
    }

    return this.prisma.attendance.create({ data });
  }

  async findMyAttendance(
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = { userId };

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        where.date = { ...where.date, gte: start };
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        where.date = { ...where.date, lte: end };
      }
    }

    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
          },
        },
      },
    });

    // Return times as simple HH:MM strings so frontend can display exactly what was recorded.
    return records.map((record) => ({
      ...record,
      firstInTime: this.formatTimeOfDay(record.firstInTime),
      lastOutTime: this.formatTimeOfDay(record.lastOutTime),
    })) as any;
  }

  async findMonthlyAttendance(userId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const [attendance, holidays] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.holiday.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      }),
    ]);

    const holidayDateKeys = new Set(holidays.map((h) => toDateOnlyKey(h.date)));

    // Weekend count = Sat/Sun in month that are not also a holiday (no double-count)
    let weekendCount = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      if (isWeekend(cursor) && !holidayDateKeys.has(toDateOnlyKey(cursor))) {
        weekendCount++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const summary = {
      totalDays: endDate.getUTCDate(),
      present: 0,
      absent: 0,
      halfDay: 0,
      casualLeave: 0,
      weekend: weekendCount,
      holiday: holidays.length,
    };

    attendance.forEach((record) => {
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          summary.present++;
          break;
        case AttendanceStatus.ABSENT:
          summary.absent++;
          break;
        case AttendanceStatus.HALF_DAY:
          summary.halfDay++;
          break;
        case AttendanceStatus.CASUAL_LEAVE:
          summary.casualLeave++;
          break;
        case AttendanceStatus.WEEKEND:
        case AttendanceStatus.HOLIDAY:
          // weekend/holiday counts come from calendar + Holiday table above
          break;
      }
    });

    return {
      attendance,
      summary,
    };
  }

  async findAll(date?: string, status?: AttendanceStatus) {
    const where: any = {};

    if (date) {
      where.date = new Date(date);
    }

    if (status) {
      where.status = status;
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            designation: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { user: { employeeNumber: 'asc' } },
      ],
    });

    return records.map((record) => ({
      ...record,
      firstInTime: this.formatTimeOfDay(record.firstInTime),
      lastOutTime: this.formatTimeOfDay(record.lastOutTime),
    })) as any;
  }

  async findForReport(
    userId?: string,
    startDate?: string,
    endDate?: string,
    status?: AttendanceStatus,
  ) {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (start && end && start > end) {
        throw new BadRequestException('startDate must be before or equal to endDate');
      }

      where.date = {};
      if (start) {
        where.date.gte = start;
      }
      if (end) {
        where.date.lte = end;
      }
    }

    if (status) {
      where.status = status;
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            designation: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { user: { employeeNumber: 'asc' } },
      ],
    });

    return records.map((record) => ({
      ...record,
      firstInTime: this.formatTimeOfDay(record.firstInTime),
      lastOutTime: this.formatTimeOfDay(record.lastOutTime),
    })) as any;
  }

  async findOne(id: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
            designation: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    return {
      ...attendance,
      firstInTime: this.formatTimeOfDay(attendance.firstInTime),
      lastOutTime: this.formatTimeOfDay(attendance.lastOutTime),
    } as any;
  }

  async update(id: string, updateAttendanceDto: UpdateAttendanceDto) {
    await this.findOne(id);

    const data: any = {
      ...updateAttendanceDto,
      manualOverride: true,
    };

    return this.prisma.attendance.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
          },
        },
      },
    });
  }

  async getDashboardStats(userId: string) {
    const today = new Date();

    // Reuse the monthly attendance summary for the current month
    const monthlyAttendance = await this.findMonthlyAttendance(
      userId,
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
    );

    const summary = monthlyAttendance.summary;
    const totalWorkingDays =
      summary.totalDays - summary.weekend - summary.holiday;

    return {
      presentDays: summary.present,
      absentDays: summary.absent,
      halfDays: summary.halfDay,
      casualLeaves: summary.casualLeave,
      totalWorkingDays,
    };
  }
}
