import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

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

    const announcement = await this.prisma.announcement.create({
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

    // Build user filter for audience
    const audienceWhere = this.buildAudienceWhere(createAnnouncementDto.targetAudience || 'ALL');

    // Fetch target users for in-app notifications + emails (fire-and-forget)
    this.prisma.user
      .findMany({ where: { status: 'ACTIVE', ...audienceWhere }, select: { id: true, name: true, email: true } })
      .then(async (users) => {
        console.log(`[Announcement] Sending to ${users.length} users (audience: ${createAnnouncementDto.targetAudience || 'ALL'})`);

        // In-app notifications
        await this.prisma.notification.createMany({
          data: users.map((u) => ({
            userId: u.id,
            type: 'ANNOUNCEMENT',
            title: `New announcement: ${announcement.title}`,
            body: announcement.content.length > 120
              ? announcement.content.slice(0, 120) + '…'
              : announcement.content,
            data: { announcementId: announcement.id },
          })),
          skipDuplicates: true,
        });

        // Emails — sequential with delay + 1 retry to respect Gmail rate limits
        const postedBy = announcement.creator?.name ?? 'Admin';
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

        for (const u of users) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              await this.emailService.sendAnnouncement({
                to: u.email,
                recipientName: u.name,
                title: announcement.title,
                content: announcement.content,
                priority: announcement.priority,
                postedBy,
                postedAt: announcement.createdAt,
              });
              console.log(`[Announcement email] Sent to ${u.email}`);
              break;
            } catch (err) {
              const msg = (err as Error).message;
              if (attempt === 1 && msg.includes('421')) {
                // Gmail temporary throttle — wait 5 s and retry once
                await delay(5000);
              } else {
                console.error(`[Announcement email] Failed for ${u.email}:`, msg);
                break;
              }
            }
          }
          await delay(300); // 300 ms gap between each email
        }
      })
      .catch((err) => console.error('[Announcement] Background task failed:', err));

    return announcement;
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

  async remove(id: string, deletedBy: string) {
    const announcement = await this.findOne(id);

    // 1. Create a history record in the history table
    await this.prisma.announcementHistory.create({
      data: {
        originalId: announcement.id,
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        targetAudience: announcement.targetAudience,
        createdBy: announcement.createdBy,
        deletedBy,
        createdAt: announcement.createdAt,
      },
    });

    // 2. Perform actual deletion from the active announcements table
    return this.prisma.announcement.delete({
      where: { id },
    });
  }

  async getHistory() {
    const histories = await this.prisma.announcementHistory.findMany({
      orderBy: { deletedAt: 'desc' },
    });

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return histories.map((h) => ({
      ...h,
      creatorName: userMap.get(h.createdBy) || 'Unknown',
      deleterName: userMap.get(h.deletedBy) || 'Unknown',
    }));
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

  private buildAudienceWhere(targetAudience: string): object {
    if (targetAudience === 'EMPLOYEES') {
      return { role: 'EMPLOYEE' };
    }
    if (targetAudience === 'ADMINS') {
      return { role: { in: ['LAB_ADMIN', 'SUPER_ADMIN'] } };
    }
    return {}; // ALL
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
