import { Controller, Get, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Res } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness probe: process is up and able to handle requests.
   * If this endpoint responds, the event loop is responsive.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness probe: database is reachable and basic Prisma migrations table exists.
   * Returns HTTP 200 when ready, 503 when not.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (DB + migrations)' })
  async ready(@Res() res: Response) {
    const details: Record<string, any> = {};
    let isHealthy = true;

    // Database connectivity check
    try {
      // Simple no-op query; will throw if the connection or database is not usable.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = await this.prisma.$queryRaw`SELECT 1`;
      details.database = { status: 'up' };
    } catch (error: any) {
      isHealthy = false;
      details.database = {
        status: 'down',
        error: error?.message ?? 'Database check failed',
      };
    }

    // Basic migrations check: prisma_migrations table exists and is queryable.
    try {
      // We don't care about rows, only that the table exists and is readable.
      await this.prisma.$queryRawUnsafe(
        'SELECT 1 FROM "prisma_migrations" LIMIT 1',
      );
      details.migrations = { status: 'up' };
    } catch (error: any) {
      const message = error?.message ?? 'Migrations table check failed';

      // If the migrations table does not exist at all, treat this as "unknown"
      // rather than failing readiness. This allows environments that use
      // `prisma db push` or manage migrations externally to still be ready.
      if (
        typeof message === 'string' &&
        message.includes('prisma_migrations') &&
        message.includes('does not exist')
      ) {
        details.migrations = {
          status: 'unknown',
          error: message,
        };
      } else {
        isHealthy = false;
        details.migrations = {
          status: 'down',
          error: message,
        };
      }
    }

    const statusCode = isHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'error',
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

