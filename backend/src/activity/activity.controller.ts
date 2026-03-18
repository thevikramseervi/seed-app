import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityFiltersDto } from './dto/activity-filters.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Activity')
@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @ApiOperation({ summary: 'Create daily activity entry' })
  @ApiResponse({ status: 201, description: 'Activity entry created successfully' })
  create(@CurrentUser() user: JwtUser, @Body() createDto: CreateActivityDto) {
    return this.activityService.create(createDto, { id: user.id, role: user.role as Role });
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user activity entries' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Activities retrieved successfully' })
  getMyActivities(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activityService.findMyActivities(user.id, { date, startDate, endDate });
  }

  @Get()
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get activity report (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'project', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Activity report retrieved successfully' })
  getReport(@Query() filters: ActivityFiltersDto) {
    return this.activityService.findForReport(filters);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an activity entry' })
  @ApiResponse({ status: 200, description: 'Activity entry updated successfully' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() updateDto: UpdateActivityDto,
  ) {
    return this.activityService.update(id, updateDto, { id: user.id, role: user.role as Role });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an activity entry' })
  @ApiResponse({ status: 200, description: 'Activity entry deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.activityService.remove(id, { id: user.id, role: user.role as Role });
  }
}

