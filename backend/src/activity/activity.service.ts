import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityFiltersDto } from './dto/activity-filters.dto';
import { Role, UserStatus } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  private isAdmin(role: Role): boolean {
    return role === Role.LAB_ADMIN || role === Role.SUPER_ADMIN;
  }

  async create(createDto: CreateActivityDto, currentUser: { id: string; role: Role }) {
    const targetUserId = createDto.userId ?? currentUser.id;

    if (targetUserId !== currentUser.id && !this.isAdmin(currentUser.role)) {
      throw new ForbiddenException('You can only create activities for yourself');
    }

    const data = {
      userId: targetUserId,
      date: new Date(createDto.date),
      userType: createDto.userType ?? 'SEED',
      project: createDto.project,
      task: createDto.task,
      subTask: createDto.subTask,
      unit: createDto.unit,
      nos: createDto.nos,
      percentage: createDto.percentage,
      productivity: createDto.productivity,
      weightage: createDto.weightage,
      createdById: currentUser.id,
    };

    return this.prisma.activityEntry.create({
      data,
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async findMyActivities(
    userId: string,
    filters: Pick<ActivityFiltersDto, 'startDate' | 'endDate'> & { date?: string },
  ) {
    const where: any = { userId };

    if (filters.date) {
      const date = new Date(filters.date);
      where.date = date;
    } else if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate) : undefined;
      const end = filters.endDate ? new Date(filters.endDate) : undefined;

      if (start && end && start > end) {
        throw new BadRequestException('startDate must be before or equal to endDate');
      }

      where.date = {};
      if (start) where.date.gte = start;
      if (end) where.date.lte = end;
    }

    return this.prisma.activityEntry.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async findForReport(filters: ActivityFiltersDto) {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate) : undefined;
      const end = filters.endDate ? new Date(filters.endDate) : undefined;

      if (start && end && start > end) {
        throw new BadRequestException('startDate must be before or equal to endDate');
      }

      where.date = {};
      if (start) where.date.gte = start;
      if (end) where.date.lte = end;
    }

    if (filters.project) {
      where.project = filters.project;
    }

    return this.prisma.activityEntry.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { user: { employeeNumber: 'asc' } },
      ],
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async update(id: string, updateDto: UpdateActivityDto, currentUser: { id: string; role: Role }) {
    const existing = await this.prisma.activityEntry.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Activity entry not found');
    }

    if (
      existing.userId !== currentUser.id &&
      existing.createdById !== currentUser.id &&
      !this.isAdmin(currentUser.role)
    ) {
      throw new ForbiddenException('You are not allowed to edit this entry');
    }

    const data: any = { ...updateDto };

    if (updateDto.date) {
      data.date = new Date(updateDto.date);
    }

    if (updateDto.userId && updateDto.userId !== existing.userId) {
      if (!this.isAdmin(currentUser.role)) {
        throw new ForbiddenException('Only admins can reassign activities to another user');
      }
      data.userId = updateDto.userId;
    }

    return this.prisma.activityEntry.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            employeeId: true,
            employeeNumber: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async remove(id: string, currentUser: { id: string; role: Role }) {
    const existing = await this.prisma.activityEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Activity entry not found');
    }

    if (
      existing.userId !== currentUser.id &&
      existing.createdById !== currentUser.id &&
      !this.isAdmin(currentUser.role)
    ) {
      throw new ForbiddenException('You are not allowed to delete this entry');
    }

    await this.prisma.activityEntry.delete({
      where: { id },
    });

    return { message: 'Activity entry deleted successfully' };
  }
}

