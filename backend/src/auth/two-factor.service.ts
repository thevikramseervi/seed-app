import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify } from 'otplib';

const ADMIN_ROLES = ['LAB_ADMIN', 'SUPER_ADMIN'];
const PENDING_SECRET_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;   // purge expired entries every 15 minutes

@Injectable()
export class TwoFactorService {
  private pendingSecrets = new Map<
    string,
    { secret: string; createdAt: number }
  >();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private configService: ConfigService) {
    this.cleanupTimer = setInterval(() => this.purgeExpired(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.pendingSecrets) {
      if (now - entry.createdAt > PENDING_SECRET_TTL_MS) {
        this.pendingSecrets.delete(key);
      }
    }
  }

  isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role);
  }

  generateSecretForUser(email: string): { secret: string; otpauthUrl: string } {
    const secret = generateSecret();
    const issuer =
      this.configService.get<string>('TWO_FACTOR_ISSUER') || 'Attend Ease';
    const otpauthUrl = generateURI({
      secret,
      label: email,
      issuer,
    });
    return { secret, otpauthUrl };
  }

  setPendingSecret(userId: string, secret: string): void {
    this.pendingSecrets.set(userId, { secret, createdAt: Date.now() });
  }

  getAndClearPendingSecret(userId: string): string | null {
    const entry = this.pendingSecrets.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > PENDING_SECRET_TTL_MS) {
      this.pendingSecrets.delete(userId);
      return null;
    }
    this.pendingSecrets.delete(userId);
    return entry.secret;
  }

  async verifyCode(secret: string, code: string): Promise<boolean> {
    if (!secret || !code || code.length !== 6) {
      return false;
    }
    const result = await verify({ secret, token: code });
    return result.valid;
  }
}
