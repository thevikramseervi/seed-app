import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TwoFactorService } from './two-factor.service';
import { AuthPasswordService } from './auth-password.service';
import { RateLimiterService } from './rate-limiter.service';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const FORGOT_PASSWORD_RATE_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const LOGIN_RATE_LIMIT = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes per IP/email combo

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
    private twoFactorService: TwoFactorService,
    private passwordService: AuthPasswordService,
    private rateLimiter: RateLimiterService,
  ) {}

  async login(
    loginDto: LoginDto,
    ip?: string,
  ): Promise<
    | AuthResponseDto
    | { requires2fa: true; twoFactorToken: string }
  > {
    const key = `${loginDto.email.toLowerCase().trim()}:${ip || 'unknown'}`;
    this.rateLimiter.checkLimit(
      `login:${key}`,
      LOGIN_RATE_LIMIT,
      LOGIN_WINDOW_MS,
      'Too many login attempts. Please try again later.',
    );

    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        passwordHash: true,
        status: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await this.passwordService.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isAdmin = this.twoFactorService.isAdminRole(user.role);
    if (isAdmin && user.twoFactorEnabled) {
      const twoFactorToken = this.jwtService.sign(
        { sub: user.id, purpose: '2fa' },
        { expiresIn: '5m' },
      );
      return { requires2fa: true, twoFactorToken };
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async setup2fa(userId: string): Promise<{ otpauthUrl: string; secret: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, twoFactorEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!this.twoFactorService.isAdminRole(user.role)) {
      throw new BadRequestException('Two-factor authentication is only available for admins');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    const { secret, otpauthUrl } = this.twoFactorService.generateSecretForUser(user.email);
    this.twoFactorService.setPendingSecret(userId, secret);
    return { otpauthUrl, secret };
  }

  async enable2fa(userId: string, dto: Enable2faDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, twoFactorEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!this.twoFactorService.isAdminRole(user.role)) {
      throw new BadRequestException('Two-factor authentication is only available for admins');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    const secret = this.twoFactorService.getAndClearPendingSecret(userId);
    if (!secret) {
      throw new BadRequestException('2FA setup expired or not started. Please run setup again.');
    }
    const valid = await this.twoFactorService.verifyCode(secret, dto.code);
    if (!valid) {
      throw new BadRequestException('Invalid verification code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret },
    });
  }

  async verify2fa(dto: Verify2faDto): Promise<AuthResponseDto> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(dto.token, { ignoreExpiration: false }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session. Please sign in again.');
    }
    if (payload.purpose !== '2fa' || !payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        status: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled for this account');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive');
    }
    const valid = await this.twoFactorService.verifyCode(user.twoFactorSecret, dto.code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(jwtPayload);
    return {
      access_token: accessToken,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async disable2fa(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, twoFactorEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!this.twoFactorService.isAdminRole(user.role)) {
      throw new BadRequestException('Two-factor authentication is only available for admins');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        dateOfJoining: true,
        baseSalary: true,
        status: true,
        twoFactorEnabled: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isCurrentValid = await this.passwordService.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const key = email.toLowerCase().trim();
    this.rateLimiter.checkLimit(
      `forgot-password:${key}`,
      FORGOT_PASSWORD_RATE_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS,
      'Too many reset requests. Please try again later.',
    );

    const user = await this.prisma.user.findUnique({
      where: { email: key },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return {
        message:
          'If an account exists for this email, you will receive a reset link.',
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store a SHA-256 hash of the token so a DB read alone cannot be used to
    // reset accounts — only the bearer of the raw token can authenticate.
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordReset(key, resetLink);

    return {
      message:
        'If an account exists for this email, you will receive a reset link.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { id: true } } },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link.');
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);
  }
}
