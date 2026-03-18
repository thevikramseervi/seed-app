import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role, LeaveStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Leave')
@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply for leave' })
  @ApiResponse({ status: 201, description: 'Leave application submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient leave balance' })
  applyLeave(@CurrentUser() user: JwtUser, @Body() applyLeaveDto: ApplyLeaveDto) {
    return this.leaveService.applyLeave(user.id, applyLeaveDto);
  }

  @Get('my-applications')
  @ApiOperation({ summary: 'Get current user leave applications' })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiResponse({ status: 200, description: 'Leave applications retrieved successfully' })
  getMyApplications(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: LeaveStatus,
  ) {
    return this.leaveService.getMyApplications(user.id, status);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get current user leave balance' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Leave balance retrieved successfully' })
  getMyLeaveBalance(
    @CurrentUser() user: JwtUser,
    @Query('year') year?: string,
  ) {
    const parsed = year ? parseInt(year, 10) : NaN;
    const currentYear = Number.isFinite(parsed) ? parsed : new Date().getUTCFullYear();
    return this.leaveService.getMyLeaveBalance(user.id, currentYear);
  }

  @Get('cl-usage')
  @ApiOperation({ summary: 'Get applied Casual Leave usage (current year up to current month)' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Admin-only: userId to query. If omitted, returns current user usage.' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns CL applied summary' })
  clUsage(
    @CurrentUser() user: JwtUser,
    @Query('userId') userId?: string,
    @Query('year') year?: string,
  ) {
    const targetUserId = userId ?? user.id;
    const isAdmin = user.role === Role.LAB_ADMIN || user.role === Role.SUPER_ADMIN;
    if (targetUserId !== user.id && !isAdmin) {
      throw new BadRequestException('You are not allowed to view CL usage for other users');
    }
    const parsedYear = year ? parseInt(year, 10) : NaN;
    const y = Number.isFinite(parsedYear) ? parsedYear : undefined;
    return this.leaveService.getClAppliedSummary(targetUserId, y);
  }

  @Get('pending')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all pending leave applications (Admin only)' })
  @ApiResponse({ status: 200, description: 'Pending applications retrieved successfully' })
  getPendingApplications() {
    return this.leaveService.getPendingApplications();
  }

  @Get('report')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get leave report (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Leave report retrieved successfully' })
  getReport(
    @Query('userId') userId?: string,
    @Query('status') status?: LeaveStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.leaveService.getReport(userId, status, fromDate, toDate);
  }

  @Patch(':id/approve')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve leave application (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave approved successfully' })
  @ApiResponse({ status: 404, description: 'Leave application not found' })
  approveLeave(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() reviewLeaveDto: ReviewLeaveDto,
  ) {
    return this.leaveService.approveLeave(id, user.id, reviewLeaveDto);
  }

  @Patch(':id/reject')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject leave application (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave rejected successfully' })
  @ApiResponse({ status: 404, description: 'Leave application not found' })
  rejectLeave(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() reviewLeaveDto: ReviewLeaveDto,
  ) {
    return this.leaveService.rejectLeave(id, user.id, reviewLeaveDto);
  }

  @Patch(':id/reopen')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reopen an approved or rejected leave application (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave reopened successfully' })
  @ApiResponse({ status: 404, description: 'Leave application not found' })
  reopenLeave(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.leaveService.reopenLeave(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel leave application' })
  @ApiResponse({ status: 200, description: 'Leave application cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Leave application not found' })
  cancelApplication(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.leaveService.cancelApplication(id, user.id);
  }
}
