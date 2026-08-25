import { describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { jsonRequest, randomAddress, uniqueEmail } from '../helpers';

describe('rate limiting', () => {
  // Fresh addresses per run: the limiter keeps its counters in the database, so reusing
  // a fixed address would make the result depend on how recently the suite last ran.
  it('blocks a burst of registrations from one address', async () => {
    const ip = randomAddress();
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await register(
        jsonRequest('/api/v1/auth/register', {
          method: 'POST',
          ip,
          body: { email: uniqueEmail(), password: 'a-long-enough-password' },
        }),
        undefined,
      );

      statuses.push(response.status);

      if (response.status === 429) {
        const body = await response.json();
        expect(body.error.code).toBe('RATE_LIMITED');
        expect(body.error.details.retryAfter).toBeGreaterThan(0);
      }
    }

    expect(statuses[0]).toBe(201);
    expect(statuses.at(-1)).toBe(429);
  }, 30_000);

  it('does not penalise a different address', async () => {
    const blocked = randomAddress();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await register(
        jsonRequest('/api/v1/auth/register', {
          method: 'POST',
          ip: blocked,
          body: { email: uniqueEmail(), password: 'a-long-enough-password' },
        }),
        undefined,
      );
    }

    const other = await register(
      jsonRequest('/api/v1/auth/register', {
        method: 'POST',
        ip: randomAddress(),
        body: { email: uniqueEmail(), password: 'a-long-enough-password' },
      }),
      undefined,
    );

    expect(other.status).toBe(201);
  }, 30_000);
});
