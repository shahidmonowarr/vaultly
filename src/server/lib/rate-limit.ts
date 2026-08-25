import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { AppError } from './errors';

interface Limit {
  key: string;
  max: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter kept in Postgres rather than process memory, because the app
 * runs on serverless instances that do not share state.
 */
export async function enforceRateLimit({ key, max, windowSeconds }: Limit) {
  const interval = `${windowSeconds} seconds`;

  const result = await db.execute<{ count: number; window_start: Date }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - ${interval}::interval THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - ${interval}::interval THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count, window_start
  `);

  const row = result.rows[0];
  if (!row) return;

  if (Number(row.count) > max) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(row.window_start).getTime() + windowSeconds * 1000 - Date.now()) / 1000),
    );
    throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down', { retryAfter });
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || '127.0.0.1';
}
