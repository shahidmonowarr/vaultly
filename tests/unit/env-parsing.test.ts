import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Mirrors the filter applied in src/server/env.ts. A variable that a hosting dashboard
 * created but left blank arrives as an empty string, which would otherwise fail
 * validation for an optional URL instead of falling back to its default.
 */
function readEnv(source: Record<string, string | undefined>) {
  const schema = z.object({
    S3_ENDPOINT: z.string().url().optional(),
    S3_PUBLIC_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
  });

  return schema.safeParse(
    Object.fromEntries(
      Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
    ),
  );
}

describe('environment parsing', () => {
  it('treats a blank optional variable as unset', () => {
    const result = readEnv({ S3_PUBLIC_ENDPOINT: '', S3_REGION: 'auto' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.S3_PUBLIC_ENDPOINT).toBeUndefined();
  });

  it('falls back to a default when the variable is blank', () => {
    const result = readEnv({ S3_REGION: '' });

    expect(result.success && result.data.S3_REGION).toBe('auto');
  });

  it('still rejects a value that is present but malformed', () => {
    expect(readEnv({ S3_ENDPOINT: 'not-a-url' }).success).toBe(false);
  });
});
