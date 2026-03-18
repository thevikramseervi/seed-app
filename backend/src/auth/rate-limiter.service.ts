import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/** Purge stale entries every 10 minutes to prevent unbounded Map growth. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class RateLimiterService {
  private readonly attempts = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.purgeExpired(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  /**
   * Simple in-memory rate limiter.
   * Throws HttpException when the given key exceeds the allowed attempts
   * within the configured window.
   */
  checkLimit(key: string, limit: number, windowMs: number, message: string) {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (entry) {
      if (now - entry.windowStart > windowMs) {
        this.attempts.set(key, { count: 1, windowStart: now });
      } else if (entry.count >= limit) {
        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      } else {
        entry.count += 1;
      }
    } else {
      this.attempts.set(key, { count: 1, windowStart: now });
    }
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.attempts) {
      // Use the longest possible window (15 min) as a safe upper bound.
      if (now - entry.windowStart > 15 * 60 * 1000) {
        this.attempts.delete(key);
      }
    }
  }
}

