import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus } from '@prisma/client';
import { BiometricSyncService } from './biometric-sync.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BiometricSyncService', () => {
  let service: BiometricSyncService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    employeeId: 'E001',
    name: 'Test',
    email: 't@t.com',
    role: 'EMPLOYEE',
    designation: 'Annotator',
    status: 'ACTIVE',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    passwordHash: 'x',
    employeeNumber: 1,
    dateOfJoining: new Date(),
    baseSalary: 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: { findMany: jest.fn() },
      holiday: { findMany: jest.fn() },
      leaveApplication: { findMany: jest.fn() },
      attendance: { upsert: jest.fn() },
      biometricLog: { updateMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiometricSyncService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(BiometricSyncService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('processBiometricData', () => {
    it('computes PRESENT for >= 8h 30m work on a weekday', async () => {
      const tuesday = new Date('2025-06-03T10:00:00Z');
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.leaveApplication.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendance.upsert as jest.Mock).mockResolvedValue({});
      (prisma.biometricLog.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.biometricLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const entries = [
        {
          employeeId: 'E001',
          date: tuesday,
          inTime: new Date('2025-06-03T09:00:00Z'),
          outTime: new Date('2025-06-03T17:30:00Z'),
          inDoor: null,
          outDoor: null,
          duration: 510,
        },
      ];

      await service.processBiometricData(entries, { skipLogCreation: true });

      expect(prisma.attendance.upsert).toHaveBeenCalled();
      const upsertCall = (prisma.attendance.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.create.status).toBe(AttendanceStatus.PRESENT);
      expect(upsertCall.update.status).toBe(AttendanceStatus.PRESENT);
    });

    it('computes HALF_DAY for >= 3h 45m and < 8h 30m work', async () => {
      const wednesday = new Date('2025-06-04T10:00:00Z');
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.leaveApplication.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendance.upsert as jest.Mock).mockResolvedValue({});
      (prisma.biometricLog.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.biometricLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const entries = [
        {
          employeeId: 'E001',
          date: wednesday,
          inTime: new Date('2025-06-04T09:00:00Z'),
          outTime: new Date('2025-06-04T13:00:00Z'),
          inDoor: null,
          outDoor: null,
          duration: 240,
        },
      ];

      await service.processBiometricData(entries, { skipLogCreation: true });

      const upsertCall = (prisma.attendance.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.create.status).toBe(AttendanceStatus.HALF_DAY);
    });

    it('computes ABSENT for < 3h 45m work', async () => {
      const thursday = new Date('2025-06-05T10:00:00Z');
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.leaveApplication.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.attendance.upsert as jest.Mock).mockResolvedValue({});
      (prisma.biometricLog.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.biometricLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const entries = [
        {
          employeeId: 'E001',
          date: thursday,
          inTime: new Date('2025-06-05T09:00:00Z'),
          outTime: new Date('2025-06-05T11:00:00Z'),
          inDoor: null,
          outDoor: null,
          duration: 120,
        },
      ];

      await service.processBiometricData(entries, { skipLogCreation: true });

      const upsertCall = (prisma.attendance.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.create.status).toBe(AttendanceStatus.ABSENT);
    });
  });
});
