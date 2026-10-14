import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateMyAssetDto } from './dto/update-my-asset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role } from '@prisma/client';

@ApiTags('Assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create asset' })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: JwtUser) {
    return this.assetsService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all assets, optionally filter by userId' })
  findAll(@Query('userId') userId?: string) {
    return this.assetsService.findAll(userId);
  }

  @Get('reference-list')
  @ApiOperation({ summary: 'Get asset number reference lists from Excel' })
  getReferenceList() {
    return this.assetsService.getReferenceList();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get assets assigned to the currently logged-in user' })
  findMine(@CurrentUser() user: JwtUser) {
    return this.assetsService.findMyAssets(user.id);
  }

  @Post('my')
  @ApiOperation({ summary: 'Employee self-registers an asset' })
  createMine(
    @CurrentUser() user: JwtUser,
    @Body() body: { assetType: string; assetNumber: string; serialNumber?: string },
  ) {
    return this.assetsService.createMyAsset(user.id, body);
  }

  @Patch('my/:id')
  @ApiOperation({ summary: 'Update serial number of own assigned asset' })
  updateMine(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() dto: UpdateMyAssetDto) {
    return this.assetsService.updateMyAsset(id, user.id, dto);
  }

  @Get('history')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get asset history with optional filters (Admin only)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'assetType', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  getHistory(
    @Query('userId') userId?: string,
    @Query('assetType') assetType?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.assetsService.getHistory({ userId, assetType, action, from, to, search });
  }

  @Get('history/employee/:userId')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get asset history for a specific employee (Admin only)' })
  getEmployeeHistory(@Param('userId') userId: string) {
    return this.assetsService.getEmployeeHistory(userId);
  }

  @Get('my-history')
  @ApiOperation({ summary: 'Get current employee own asset history' })
  getMyHistory(@CurrentUser() user: JwtUser) {
    return this.assetsService.getMyHistory(user.id);
  }

  @Get(':id')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get asset by ID' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.LAB_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update asset' })
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: JwtUser) {
    return this.assetsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete asset (Super Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.assetsService.remove(id, user.id);
  }
}
