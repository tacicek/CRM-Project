/**
 * Shared Rate Limiter for Edge Functions
 * 
 * In-memory rate limiting that resets on function cold starts.
 * For production, consider using a persistent store (Redis, DB).
 * This provides basic protection against abuse/flooding.
 * 
 * Usage:
 *   import { createRateLimiter } from "../_shared/rateLimit.ts";
 *   
 *   const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 10 });
 *   
 *   if (limiter.isLimited(clientKey)) {
 *     return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
 *   }
 */

interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  maxRequests: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimiter {
  /** Check if a key is rate limited. Increments the counter. */
  isLimited: (key: string) => boolean;
  /** Get remaining requests for a key */
  remaining: (key: string) => number;
  /** Clean up expired entries (call periodically for long-lived functions) */
  cleanup: () => void;
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const records = new Map<string, RateLimitRecord>();

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      const record = records.get(key);

      // Window expired or first request
      if (!record || now > record.resetTime) {
        records.set(key, { count: 1, resetTime: now + config.windowMs });
        return false;
      }

      // Within window
      record.count++;
      return record.count > config.maxRequests;
    },

    remaining(key: string): number {
      const now = Date.now();
      const record = records.get(key);

      if (!record || now > record.resetTime) {
        return config.maxRequests;
      }

      return Math.max(0, config.maxRequests - record.count);
    },

    cleanup(): void {
      const now = Date.now();
      for (const [key, record] of records) {
        if (now > record.resetTime) {
          records.delete(key);
        }
      }
    },
  };
}
