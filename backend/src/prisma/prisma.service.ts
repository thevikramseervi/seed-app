import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    super({
      log: isProd ? ['error', 'warn'] : ['query', 'error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    try {
      const existing = await this.user.findUnique({
        where: { email: 'admin@cambridge.edu.in' },
        select: { id: true },
      });

      if (existing) {
        return;
      }

      const passwordHash = await bcrypt.hash('admin123', 10);
      await this.user.create({
        data: {
          employeeId: 'CITADMIN001',
          employeeNumber: 9999,
          name: 'Super Admin',
          email: 'admin@cambridge.edu.in',
          passwordHash,
          designation: 'Administrator',
          role: 'SUPER_ADMIN',
          dateOfJoining: new Date('2026-01-01'),
          baseSalary: 50000,
          status: 'ACTIVE',
        },
      });

      this.logger.log('Created default admin user for login');
    } catch (error) {
      this.logger.warn(`Unable to ensure default admin user: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    // For testing purposes
    if (process.env.NODE_ENV === 'production') return;

    const models = Reflect.ownKeys(this).filter((key) => key[0] !== '_');

    return Promise.all(models.map((modelKey) => this[modelKey].deleteMany()));
  }
}
