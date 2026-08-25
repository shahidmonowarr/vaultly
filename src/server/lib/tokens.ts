import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS, env } from '../env';

const secret = new TextEncoder().encode(env.AUTH_SECRET);
const ISSUER = 'sfs';

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    if (!payload.sub || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

// Stored hashed so a database dump can't be replayed against the API.
export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
