import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { REFRESH_TOKEN_TTL_SECONDS } from '../env';
import { db } from '../db/client';
import { sessions, users, type User } from '../db/schema';
import { conflict, unauthorized } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/tokens';

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const UNIQUE_VIOLATION = '23505';

// Verified against when the email does not exist, so a failed login is not measurably
// faster than a successful one.
let decoyHash: Promise<string> | null = null;
function getDecoyHash() {
  decoyHash ??= hashPassword(randomUUID());
  return decoyHash;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

async function issueSession(userId: string, familyId: string, userAgent: string | null) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      userAgent: userAgent?.slice(0, 255) ?? null,
      expiresAt,
    })
    .returning();

  const accessToken = await signAccessToken({ userId, sessionId: session!.id });

  return { accessToken, refreshToken };
}

export async function registerUser(
  email: string,
  password: string,
  userAgent: string | null,
): Promise<AuthResult> {
  const passwordHash = await hashPassword(password);

  let user: User;
  try {
    const inserted = await db.insert(users).values({ email, passwordHash }).returning();
    user = inserted[0]!;
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict('An account with this email already exists');
    }
    throw error;
  }

  const tokens = await issueSession(user.id, randomUUID(), userAgent);
  return { user: toPublicUser(user), ...tokens };
}

export async function loginUser(
  email: string,
  password: string,
  userAgent: string | null,
): Promise<AuthResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);

  const valid = await verifyPassword(user?.passwordHash ?? (await getDecoyHash()), password);

  if (!user || !valid) {
    throw unauthorized('Invalid email or password');
  }

  const tokens = await issueSession(user.id, randomUUID(), userAgent);
  return { user: toPublicUser(user), ...tokens };
}

export async function rotateSession(
  refreshToken: string,
  userAgent: string | null,
): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(refreshToken);

  const [session] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);

  if (!session) {
    throw unauthorized('Session is no longer valid');
  }

  // A revoked token being presented again means someone replayed it. Drop the whole
  // family so both the attacker and the legitimate client have to log in again.
  if (session.revokedAt) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.familyId, session.familyId), sql`${sessions.revokedAt} IS NULL`));

    throw unauthorized('Session is no longer valid');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Session has expired');
  }

  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) {
    throw unauthorized('Session is no longer valid');
  }

  const tokens = await issueSession(user.id, session.familyId, userAgent);
  return { user: toPublicUser(user), ...tokens };
}

export async function revokeSession(refreshToken: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, hashRefreshToken(refreshToken)));
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
