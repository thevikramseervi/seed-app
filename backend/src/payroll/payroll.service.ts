import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { defaultPayDayOfMonth } from './slip-config';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private payrollCalculator: PayrollCalculatorService,
  ) {}

  async generatePayroll(
    generatePayrollDto: GeneratePayrollDto,
    generatedBy: string,
    prefetchedHolidayKeys?: Set<string>,
  ) {
    const { year, month, userId, paymentDate } = generatePayrollDto;

    // Check if payroll already exists
    const existing = await this.prisma.payroll.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Payroll already generated for this month');
    }

    // Calculate salary
    const calculation = await this.payrollCalculator.calculateSalary(userId, year, month, prefetchedHolidayKeys);

    // Use provided payment date, or fall back to the Nth of the following month
    let resolvedPaymentDate: Date;
    if (paymentDate) {
      resolvedPaymentDate = new Date(paymentDate);
    } else {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const lastDayOfNext = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
      const payDay = Math.min(defaultPayDayOfMonth, lastDayOfNext);
      resolvedPaymentDate = new Date(Date.UTC(nextYear, nextMonth - 1, payDay));
    }

    // Create payroll record
    return this.prisma.payroll.create({
      data: {
        userId,
        month,
        year,
        baseSalary: calculation.baseSalary,
        workingDays: calculation.workingDays,
        weekendDays: calculation.weekendDays,
        holidayDays: calculation.holidayDays,
        presentDays: calculation.presentDays,
        casualLeaveDays: calculation.casualLeaveDays,
        halfDays: calculation.halfDays,
        lossOfPayDays: calculation.lossOfPayDays,
        totalPayDays: calculation.totalPayDays,
        grossEarnings: calculation.grossEarnings,
        deductions: calculation.deductions,
        reimbursements: calculation.reimbursements,
        netSalary: calculation.netSalary,
        paymentStatus: 'DRAFT',
        generatedBy,
        paymentDate: resolvedPaymentDate,
      },
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            designation: true,
            dateOfJoining: true,
          },
        },
      },
    });
  }

  async generatePayrollForAllEmployees(year: number, month: number, generatedBy: string, paymentDate?: string) {
    // Fetch holidays and already-generated payrolls for the month once,
    // shared across all employees to avoid N+1 DB queries.
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const [users, holidaysInMonth, existingPayrolls] = await Promise.all([
      this.prisma.user.findMany({ where: { status: 'ACTIVE' } }),
      this.prisma.holiday.findMany({ where: { date: { gte: startDate, lte: endDate } } }),
      this.prisma.payroll.findMany({
        where: { month, year },
        select: { userId: true },
      }),
    ]);

    const { toDateOnlyKey } = await import('../common/date.utils');
    const holidayKeys = new Set(holidaysInMonth.map((h) => toDateOnlyKey(h.date)));
    const alreadyGeneratedUserIds = new Set(existingPayrolls.map((p) => p.userId));

    const results = [];
    const errors = [];

    for (const user of users) {
      try {
        if (alreadyGeneratedUserIds.has(user.id)) {
          errors.push({
            userId: user.id,
            employeeId: user.employeeId,
            error: 'Payroll already exists',
          });
          continue;
        }

        const payroll = await this.generatePayroll(
          { year, month, userId: user.id, paymentDate },
          generatedBy,
          holidayKeys,
        );
        results.push(payroll);
      } catch (error) {
        errors.push({
          userId: user.id,
          employeeId: user.employeeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  async getMySalarySlips(userId: string) {
    return this.prisma.payroll.findMany({
      where: { userId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      select: {
        id: true,
        month: true,
        year: true,
        grossEarnings: true,
        netSalary: true,
        paymentStatus: true,
        paymentDate: true,
        generatedAt: true,
      },
    });
  }

  async getPayrollById(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            email: true,
            designation: true,
            dateOfJoining: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    return payroll;
  }

  async markAsPaid(id: string) {
    const payroll = await this.getPayrollById(id);

    if (payroll.paymentStatus === 'PAID') {
      throw new ConflictException('Payroll has already been marked as paid');
    }

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.prisma.payroll.update({
      where: { id },
      data: {
        paymentStatus: 'PAID',
        paymentDate: todayUTC,
      },
    });
  }

  async getAllPayroll(year?: number, month?: number, userId?: string) {
    const where: any = {};

    if (year) {
      where.year = year;
    }

    if (month) {
      where.month = month;
    }

    if (userId) {
      where.userId = userId;
    }

    return this.prisma.payroll.findMany({
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
        { year: 'desc' },
        { month: 'desc' },
        { user: { employeeNumber: 'asc' } },
      ],
    });
  }
}
