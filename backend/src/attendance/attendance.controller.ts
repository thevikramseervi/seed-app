import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role, AttendanceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('manual')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manual attendance entry (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Attendance created successfully' })
  @ApiResponse({ status: 409, description: 'Attendance already exists for this date' })
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(createAttendanceDto, true);
  }

  @Get('my-attendance')
  @ApiOperation({ summary: 'Get current user attendance' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Attendance retrieved successfully' })
  getMyAttendance(
    @CurrentUser() user: JwtUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.findMyAttendance(user.id, startDate, endDate);
  }

  @Get('monthly/:year/:month')
  @ApiOperation({ summary: 'Get monthly attendance for current user' })
  @ApiResponse({ status: 200, description: 'Monthly attendance retrieved successfully' })
  getMonthlyAttendance(
    @CurrentUser() user: JwtUser,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.attendanceService.findMonthlyAttendance(
      user.id,
      parseInt(year),
      parseInt(month),
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get attendance dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  getDashboardStats(@CurrentUser() user: JwtUser) {
    return this.attendanceService.getDashboardStats(user.id);
  }

  @Get('report')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get attendance report (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AttendanceStatus })
  @ApiResponse({ status: 200, description: 'Attendance report retrieved successfully' })
  getReport(
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: AttendanceStatus,
  ) {
    return this.attendanceService.findForReport(userId, startDate, endDate, status);
  }

  @Get()
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all attendance records (Admin only)' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AttendanceStatus })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  findAll(
    @Query('date') date?: string,
    @Query('status') status?: AttendanceStatus,
  ) {
    return this.attendanceService.findAll(date, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance by ID' })
  @ApiResponse({ status: 200, description: 'Attendance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Attendance not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const attendance = await this.attendanceService.findOne(id);
    const isAdmin = user.role === Role.LAB_ADMIN || user.role === Role.SUPER_ADMIN;
    if (!isAdmin && attendance.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attendance record');
    }
    return attendance;
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update attendance (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Attendance updated successfully' })
  @ApiResponse({ status: 404, description: 'Attendance not found' })
  update(@Param('id') id: string, @Body() updateAttendanceDto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }
}
