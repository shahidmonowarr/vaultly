import type { NextResponse } from 'next/server';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, env } from '@/server/env';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/constants';
import { unauthorized } from '@/server/lib/errors';
import { verifyAccessToken, type AccessClaims } from '@/server/lib/tokens';

const isProduction = env.NODE_ENV === 'production';

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return null;
}

export async function requireUser(request: Request): Promise<AccessClaims> {
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) {
    throw unauthorized();
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    throw unauthorized('Your session has expired');
  }

  return claims;
}

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  // Scoped to the auth routes so it is never attached to file or upload requests.
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { path: '/api/v1/auth', maxAge: 0 });
  return response;
}
