import { describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { jsonRequest, uniqueEmail } from '../helpers';

describe('rate limiting', () => {
  it('blocks a burst of registrations from one address', async () => {
    const ip = '203.0.113.7';
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

    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
    expect(statuses.slice(-1)[0]).toBe(429);
  }, 30_000);

  it('does not penalise a different address', async () => {
    const response = await register(
      jsonRequest('/api/v1/auth/register', {
        method: 'POST',
        ip: '198.51.100.4',
        body: { email: uniqueEmail(), password: 'a-long-enough-password' },
      }),
      undefined,
    );

    expect(response.status).toBe(201);
  });
});
