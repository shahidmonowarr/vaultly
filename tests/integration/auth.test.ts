import { afterAll, describe, expect, it } from 'vitest';
import { POST as login } from '@/app/api/v1/auth/login/route';
import { GET as me } from '@/app/api/v1/auth/me/route';
import { POST as refresh } from '@/app/api/v1/auth/refresh/route';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { collectCookies, jsonRequest, removeUser, uniqueEmail } from '../helpers';

const email = uniqueEmail();
const password = 'a-long-enough-password';

afterAll(() => removeUser(email));

describe('registration', () => {
  it('creates an account and starts a session', async () => {
    const response = await register(
      jsonRequest('/api/v1/auth/register', { method: 'POST', body: { email, password } }),
      undefined,
    );

    expect(response.status).toBe(201);
    expect(collectCookies(response)).toContain('sfs_access=');
    expect(collectCookies(response)).toContain('sfs_refresh=');
  });

  it('refuses a duplicate email', async () => {
    const response = await register(
      jsonRequest('/api/v1/auth/register', { method: 'POST', body: { email, password } }),
      undefined,
    );

    expect(response.status).toBe(409);
  });

  it('refuses a password that is too short', async () => {
    const response = await register(
      jsonRequest('/api/v1/auth/register', {
        method: 'POST',
        body: { email: uniqueEmail(), password: 'short' },
      }),
      undefined,
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.details[0].field).toBe('password');
  });
});

describe('login', () => {
  it('rejects a wrong password without revealing whether the email exists', async () => {
    const wrongPassword = await login(
      jsonRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password: 'not-the-password' },
      }),
      undefined,
    );

    const unknownEmail = await login(
      jsonRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: uniqueEmail(), password },
      }),
      undefined,
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect((await wrongPassword.json()).error.message).toBe(
      (await unknownEmail.json()).error.message,
    );
  });

  it('issues a session for valid credentials', async () => {
    const response = await login(
      jsonRequest('/api/v1/auth/login', { method: 'POST', body: { email, password } }),
      undefined,
    );

    expect(response.status).toBe(200);

    const authenticated = await me(
      jsonRequest('/api/v1/auth/me', { cookies: collectCookies(response) }),
      undefined,
    );

    expect(authenticated.status).toBe(200);
    expect((await authenticated.json()).user.email).toBe(email);
  });
});

describe('session rotation', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await me(jsonRequest('/api/v1/auth/me'), undefined);
    expect(response.status).toBe(401);
  });

  it('rotates the refresh token and invalidates the whole family when one is replayed', async () => {
    const session = await login(
      jsonRequest('/api/v1/auth/login', { method: 'POST', body: { email, password } }),
      undefined,
    );

    const firstCookies = collectCookies(session);

    const rotated = await refresh(
      jsonRequest('/api/v1/auth/refresh', { method: 'POST', cookies: firstCookies }),
      undefined,
    );
    expect(rotated.status).toBe(200);

    const rotatedCookies = collectCookies(rotated, firstCookies);
    expect(rotatedCookies).not.toBe(firstCookies);

    // Replaying the token that was already exchanged looks like theft.
    const replay = await refresh(
      jsonRequest('/api/v1/auth/refresh', { method: 'POST', cookies: firstCookies }),
      undefined,
    );
    expect(replay.status).toBe(401);

    // ...so the rotated token is burned too, not just the replayed one.
    const afterBreach = await refresh(
      jsonRequest('/api/v1/auth/refresh', { method: 'POST', cookies: rotatedCookies }),
      undefined,
    );
    expect(afterBreach.status).toBe(401);
  });
});
