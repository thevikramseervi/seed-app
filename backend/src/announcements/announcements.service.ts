import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async create(createAnnouncementDto: CreateAnnouncementDto, createdBy: string) {
    const data: any = {
      title: createAnnouncementDto.title,
      content: createAnnouncementDto.content,
      priority: createAnnouncementDto.priority || 'MEDIUM',
      isPinned: createAnnouncementDto.isPinned || false,
      isActive: true,
      targetAudience: createAnnouncementDto.targetAudience || 'ALL',
      createdBy,
    };

    if (createAnnouncementDto.expiresAt) {
      data.expiresAt = new Date(createAnnouncementDto.expiresAt);
    }

    return this.prisma.announcement.create({
      data,
      include: {
        creator: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async findAllForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build filter based on target audience
    const targetFilter: any = {
      OR: [
        { targetAudience: 'ALL' },
      ],
    };

    // Employees can see EMPLOYEES and ALL
    if (user.role === 'EMPLOYEE') {
      targetFilter.OR.push({ targetAudience: 'EMPLOYEES' });
    }

    // Admins can see ADMINS and ALL
    if (user.role === 'LAB_ADMIN' || user.role === 'SUPER_ADMIN') {
      targetFilter.OR.push({ targetAudience: 'ADMINS' });
      targetFilter.OR.push({ targetAudience: 'EMPLOYEES' }); // Admins can also see employee announcements
    }

    const announcements = await this.prisma.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: targetFilter.OR },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      include: {
        creator: {
          select: {
            name: true,
            role: true,
          },
        },
        reads: {
          where: { userId },
          select: { readAt: true },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return announcements.map(({ reads, ...announcement }) => ({
      ...announcement,
      isRead: reads.length > 0,
      readAt: reads[0]?.readAt ?? null,
    }));
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }

  async update(id: string, updateAnnouncementDto: UpdateAnnouncementDto) {
    await this.findOne(id);

    const data: any = { ...updateAnnouncementDto };

    if (updateAnnouncementDto.expiresAt) {
      data.expiresAt = new Date(updateAnnouncementDto.expiresAt);
    }

    return this.prisma.announcement.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.announcement.delete({
      where: { id },
    });
  }

  async markAsRead(announcementId: string, userId: string) {
    await this.findOne(announcementId);
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: {},
    });
    return { announcementId, readAt: new Date() };
  }

  async getUnreadCount(userId: string) {
    const announcements = await this.findAllForUser(userId);
    const unreadCount = announcements.filter((a) => !a.isRead).length;
    return { unreadCount };
  }

  async getAllAnnouncements(includeInactive = false) {
    const where: any = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.announcement.findMany({
      where,
      include: {
        creator: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }
}
