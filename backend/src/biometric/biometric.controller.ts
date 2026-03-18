import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BiometricSyncService } from './biometric-sync.service';
import { BiometricImportService } from './biometric-import.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Biometric')
@Controller('biometric')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BiometricController {
  constructor(
    private readonly biometricSyncService: BiometricSyncService,
    private readonly biometricImportService: BiometricImportService,
  ) {}

  @Post('sync')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger biometric sync (Super Admin only)' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Date to sync (YYYY-MM-DD). Defaults to yesterday.' })
  @ApiResponse({ status: 200, description: 'Biometric sync triggered successfully' })
  async syncBiometric(@Query('date') dateStr?: string) {
    let date: Date;
    if (dateStr) {
      date = new Date(dateStr);
    } else {
      const now = new Date();
      date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    }
    return this.biometricSyncService.syncBiometricDataForDate(date);
  }

  @Post('sync-range')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger biometric sync for a date range (Super Admin only)' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Biometric range sync triggered successfully' })
  async syncBiometricRange(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }
    if (start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }
    return this.biometricSyncService.syncBiometricDataForRange(start, end);
  }

  @Post('upload')
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }), // 10MB
  )
  @ApiOperation({ summary: 'Upload biometric Excel file (Super Admin only)' })
  @ApiQuery({
    name: 'confirmOverride',
    required: false,
    type: Boolean,
    description:
      'When true, allows replacing all biometric logs (and re-synced attendance) for the month contained in the uploaded file if data already exists.',
  })
  @ApiResponse({ status: 200, description: 'Biometric file imported and synced successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file (e.g. .xls not supported)' })
  async uploadBiometric(
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
    @Query('confirmOverride') confirmOverride?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use form field name "file".');
    }
    const ext = file.originalname?.toLowerCase().slice(-5);
    if (!ext?.includes('.xlsx')) {
      throw new BadRequestException(
        'Only .xlsx files are supported. Please convert .xls to .xlsx (e.g. open in Excel and Save As).',
      );
    }
    const allowOverride = String(confirmOverride).toLowerCase() === 'true';
    return this.biometricImportService.importFromBuffer(file.buffer, { confirmOverride: allowOverride });
  }

  @Post('recalculate-durations')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fix existing attendance durations using lastOutTime - firstInTime (Super Admin only)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  async recalculateDurations(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.biometricSyncService.recalculateAttendanceDurations(startDate, endDate);
  }

  @Get('has-data')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check whether any biometric logs exist in the database (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns { hasData: boolean }' })
  async hasData() {
    const count = await this.biometricImportService.getLogCount();
    return { hasData: count > 0 };
  }

  @Get('unprocessed')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get unprocessed biometric logs (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Unprocessed logs retrieved successfully' })
  getUnprocessedLogs() {
    return this.biometricSyncService.getUnprocessedLogs();
  }
}
