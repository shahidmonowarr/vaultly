import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { files, type FileRecord } from '../db/schema';
import { notFound } from '../lib/errors';
import { generateShareSlug } from '../lib/files';
import { deleteObject } from './storage';

export interface FileDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  visibility: 'private' | 'public';
  shareUrl: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListOptions {
  limit: number;
  cursor?: string;
  search?: string;
  visibility?: 'private' | 'public';
}

export function toFileDto(file: FileRecord, origin: string): FileDto {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.sizeBytes),
    visibility: file.visibility,
    shareUrl: file.shareSlug ? `${origin}/s/${file.shareSlug}` : null,
    downloadCount: file.downloadCount,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

function encodeCursor(file: FileRecord) {
  return Buffer.from(`${file.createdAt.toISOString()}|${file.id}`).toString('base64url');
}

function decodeCursor(cursor: string) {
  const [timestamp, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const date = timestamp ? new Date(timestamp) : null;

  if (!date || Number.isNaN(date.getTime()) || !id) return null;
  return { date, id };
}

export async function listFiles(userId: string, options: ListOptions) {
  const conditions = [
    eq(files.ownerId, userId),
    eq(files.status, 'ready'),
    isNull(files.deletedAt),
  ];

  if (options.visibility) {
    conditions.push(eq(files.visibility, options.visibility));
  }

  if (options.search) {
    const pattern = `%${options.search.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
    conditions.push(sql`${files.name} ILIKE ${pattern}`);
  }

  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (cursor) {
    // Keyset pagination: stable under inserts, unlike OFFSET.
    conditions.push(sql`(${files.createdAt}, ${files.id}) < (${cursor.date}, ${cursor.id}::uuid)`);
  }

  const rows = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt), desc(files.id))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    items: page,
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
  };
}

/**
 * Ownership is part of the WHERE clause rather than a check after the fetch, so there
 * is no code path where another user's row is loaded at all. Missing and forbidden
 * both return 404 so the endpoint cannot be used to probe for file ids.
 */
export async function getOwnedFile(userId: string, fileId: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.ownerId, userId), isNull(files.deletedAt)))
    .limit(1);

  if (!file) {
    throw notFound('File not found');
  }

  return file;
}

export async function updateFile(
  userId: string,
  fileId: string,
  changes: { name?: string; visibility?: 'private' | 'public' },
) {
  const current = await getOwnedFile(userId, fileId);

  const patch: Partial<typeof files.$inferInsert> = { updatedAt: new Date() };

  if (changes.name) {
    patch.name = changes.name;
  }

  if (changes.visibility && changes.visibility !== current.visibility) {
    patch.visibility = changes.visibility;
    // Going private drops the slug, which permanently kills any link already shared.
    patch.shareSlug = changes.visibility === 'public' ? generateShareSlug() : null;
  }

  const [updated] = await db
    .update(files)
    .set(patch)
    .where(and(eq(files.id, fileId), eq(files.ownerId, userId)))
    .returning();

  return updated!;
}

export async function deleteFile(userId: string, fileId: string) {
  const file = await getOwnedFile(userId, fileId);

  await db
    .update(files)
    .set({ deletedAt: new Date(), shareSlug: null, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.ownerId, userId)));

  await deleteObject(file.storageKey);
}

export async function getStorageUsage(userId: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` })
    .from(files)
    .where(and(eq(files.ownerId, userId), isNull(files.deletedAt)));

  return Number(row?.total ?? 0);
}

export async function findSharedFile(slug: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.shareSlug, slug),
        eq(files.visibility, 'public'),
        eq(files.status, 'ready'),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  return file ?? null;
}

export async function incrementDownloadCount(fileId: string) {
  await db
    .update(files)
    .set({ downloadCount: sql`${files.downloadCount} + 1` })
    .where(eq(files.id, fileId));
}
