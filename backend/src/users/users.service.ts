import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { getProRataCasualLeaveForYear } from '../leave/leave.utils';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email.toLowerCase().trim();

    return this.prisma.$transaction(async (tx) => {
      // Check if email already exists
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      // Check if employee ID already exists
      const existingEmployeeId = await tx.user.findUnique({
        where: { employeeId: createUserDto.employeeId },
      });

      if (existingEmployeeId) {
        throw new ConflictException('Employee ID already exists');
      }

      // Check if employee number already exists
      const existingEmployeeNumber = await tx.user.findUnique({
        where: { employeeNumber: createUserDto.employeeNumber },
      });

      if (existingEmployeeNumber) {
        throw new ConflictException('Employee number already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // Create user
      const user = await tx.user.create({
        data: {
          employeeId: createUserDto.employeeId,
          employeeNumber: createUserDto.employeeNumber,
          name: createUserDto.name,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          designation: createUserDto.designation || 'Annotator',
          role: createUserDto.role,
          dateOfJoining: new Date(createUserDto.dateOfJoining),
          baseSalary: createUserDto.baseSalary || 22000,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          employeeId: true,
          employeeNumber: true,
          name: true,
          email: true,
          designation: true,
          role: true,
          dateOfJoining: true,
          baseSalary: true,
          status: true,
          createdAt: true,
        },
      });

      // Create initial leave balance for current year (pro-rata if joined mid-year)
      const currentYear = new Date().getFullYear();
      const proRataTotal = getProRataCasualLeaveForYear(user.dateOfJoining, currentYear);
      await tx.leaveBalance.create({
        data: {
          userId: user.id,
          year: currentYear,
          casualLeaveTotal: proRataTotal,
          casualLeaveUsed: 0,
          casualLeavePending: 0,
          casualLeaveAvailable: proRataTotal,
        },
      });

      return user;
    });
  }

  async findAll(page = 1, limit = 50, search?: string, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          employeeId: true,
          employeeNumber: true,
          name: true,
          email: true,
          designation: true,
          role: true,
          dateOfJoining: true,
          dateOfLeaving: true,
          baseSalary: true,
          status: true,
          createdAt: true,
        },
        orderBy: { employeeNumber: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        employeeNumber: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        dateOfJoining: true,
        dateOfLeaving: true,
        baseSalary: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    // Check email uniqueness if changing email
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    const updateData: any = { ...updateUserDto };

    // Hash password if provided
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete updateData.password;
    }

    // Convert date strings to Date objects
    if (updateUserDto.dateOfLeaving) {
      updateData.dateOfLeaving = new Date(updateUserDto.dateOfLeaving);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        employeeNumber: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        dateOfJoining: true,
        dateOfLeaving: true,
        baseSalary: true,
        status: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);

    if (user.status === 'INACTIVE') {
      throw new BadRequestException('User is already inactive');
    }

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return this.prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        dateOfLeaving: todayUTC,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
        dateOfLeaving: true,
      },
    });
  }

  async activate(id: string) {
    const user = await this.findOne(id);

    if (user.status === 'ACTIVE') {
      throw new BadRequestException('User is already active');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        dateOfLeaving: null,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
      },
    });
  }
}
