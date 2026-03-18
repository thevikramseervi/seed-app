import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create announcement (Admin only)' })
  @ApiResponse({ status: 201, description: 'Announcement created successfully' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(createAnnouncementDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active announcements for current user' })
  @ApiResponse({ status: 200, description: 'Announcements retrieved successfully' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.announcementsService.findAllForUser(user.id);
  }

  @Get('all')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all announcements including inactive (Admin only)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'All announcements retrieved successfully' })
  getAllAnnouncements(@Query('includeInactive') includeInactive?: string) {
    return this.announcementsService.getAllAnnouncements(
      includeInactive === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread announcements count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  getUnreadCount(@CurrentUser() user: JwtUser) {
    return this.announcementsService.getUnreadCount(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get announcement by ID' })
  @ApiResponse({ status: 200, description: 'Announcement retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update announcement (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcement updated successfully' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, updateAnnouncementDto);
  }

  @Delete(':id')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete announcement (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcement deleted successfully' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }

  @Post(':id/mark-read')
  @ApiOperation({ summary: 'Mark announcement as read' })
  @ApiResponse({ status: 200, description: 'Announcement marked as read' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.announcementsService.markAsRead(id, user.id);
  }
}
