import { Module } from '@nestjs/common';
import { BiometricSyncService } from './biometric-sync.service';
import { BiometricImportService } from './biometric-import.service';
import { BiometricController } from './biometric.controller';

@Module({
  controllers: [BiometricController],
  providers: [BiometricSyncService, BiometricImportService],
  exports: [BiometricSyncService, BiometricImportService],
})
export class BiometricModule {}
