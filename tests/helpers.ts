import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';

export const BASE_URL = 'http://localhost:3000';

/**
 * Each request gets its own client address unless one is pinned. The rate limiter keys on
 * the address, so without this a test would fail based on how many tests ran before it.
 * It has to be random rather than a counter: test files run in separate workers, and a
 * counter would hand every file the same first address.
 */
function randomAddress() {
  const octet = () => Math.floor(Math.random() * 256);
  return `10.${octet()}.${octet()}.${octet()}`;
}

export function jsonRequest(
  path: string,
  options: { method?: string; body?: unknown; cookies?: string; ip?: string } = {},
) {
  return new Request(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': options.ip ?? randomAddress(),
      ...(options.cookies ? { cookie: options.cookies } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

/** Turns Set-Cookie headers from a handler response into a Cookie request header. */
export function collectCookies(response: Response, existing = '') {
  const jar = new Map<string, string>();

  for (const entry of existing.split(';')) {
    const [name, ...rest] = entry.split('=');
    if (name?.trim()) jar.set(name.trim(), rest.join('='));
  }

  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [name, ...rest] = pair!.split('=');
    if (name) jar.set(name.trim(), rest.join('='));
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function uniqueEmail() {
  return `test-${randomUUID()}@example.test`;
}

export async function removeUser(email: string) {
  await db.delete(users).where(eq(users.email, email));
}

export function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}
