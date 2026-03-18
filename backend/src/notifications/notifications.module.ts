import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AbsenceReminderService } from './absence-reminder.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AbsenceReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

