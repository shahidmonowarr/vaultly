import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { files, type FileRecord } from '../db/schema';
import { notFound } from '../lib/errors';
import { generateShareSlug } from '../lib/files';
import { deleteObject } from './storage';

export type SortField = 'created' | 'name' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface FileDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  visibility: 'private' | 'public';
  shareUrl: string | null;
  downloadCount: number;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListOptions {
  limit: number;
  cursor?: string;
  search?: string;
  visibility?: 'private' | 'public';
  folderId?: string | null;
  sort: SortField;
  order: SortOrder;
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
    folderId: file.folderId,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

// The cursor carries whichever value the list is ordered by, so sorting by name or size
// keeps the same keyset guarantees as sorting by date.
function sortValue(file: FileRecord, sort: SortField) {
  if (sort === 'name') return file.name.toLowerCase();
  if (sort === 'size') return Number(file.sizeBytes);
  return file.createdAt.toISOString();
}

function encodeCursor(file: FileRecord, sort: SortField) {
  return Buffer.from(JSON.stringify({ v: sortValue(file, sort), id: file.id })).toString('base64url');
}

function decodeCursor(cursor: string): { v: string | number; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.id !== 'string') return null;
    if (typeof parsed.v !== 'string' && typeof parsed.v !== 'number') return null;
    return { v: parsed.v, id: parsed.id };
  } catch {
    return null;
  }
}

function sortColumn(sort: SortField) {
  if (sort === 'name') return sql`lower(${files.name})`;
  if (sort === 'size') return sql`${files.sizeBytes}`;
  return sql`${files.createdAt}`;
}

function buildFilters(
  userId: string,
  options: Pick<ListOptions, 'search' | 'visibility' | 'folderId'>,
) {
  const conditions = [
    eq(files.ownerId, userId),
    eq(files.status, 'ready'),
    isNull(files.deletedAt),
  ];

  if (options.visibility) {
    conditions.push(eq(files.visibility, options.visibility));
  }

  if (options.search) {
    // Searching looks everywhere. Being told a file exists but not where it is would be
    // worse than useless, so results carry their folder path instead of being scoped out.
    const pattern = `%${options.search.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
    conditions.push(sql`${files.name} ILIKE ${pattern}`);
  } else if (options.folderId === null) {
    conditions.push(isNull(files.folderId));
  } else if (options.folderId !== undefined) {
    conditions.push(eq(files.folderId, options.folderId));
  }

  return conditions;
}

export async function countFiles(userId: string, options: Pick<ListOptions, 'search' | 'visibility'>) {
  const [row] = await db
    .select({ total: sql<string>`count(*)` })
    .from(files)
    .where(and(...buildFilters(userId, options)));

  return Number(row?.total ?? 0);
}

export async function listFiles(userId: string, options: ListOptions) {
  const conditions = buildFilters(userId, options);

  const column = sortColumn(options.sort);
  const ascending = options.order === 'asc';

  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (cursor) {
    // Keyset pagination: stable under inserts, unlike OFFSET.
    conditions.push(
      ascending
        ? sql`(${column}, ${files.id}) > (${cursor.v}, ${cursor.id}::uuid)`
        : sql`(${column}, ${files.id}) < (${cursor.v}, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(
      ascending ? sql`${column} asc` : sql`${column} desc`,
      ascending ? asc(files.id) : desc(files.id),
    )
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    items: page,
    nextCursor:
      hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!, options.sort) : null,
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
  changes: { name?: string; visibility?: 'private' | 'public'; folderId?: string | null },
) {
  const current = await getOwnedFile(userId, fileId);

  const patch: Partial<typeof files.$inferInsert> = { updatedAt: new Date() };

  if (changes.name) {
    patch.name = changes.name;
  }

  if (changes.folderId !== undefined) {
    patch.folderId = changes.folderId;
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

/** Folder trails for a batch of folders, resolved in one recursive pass. */
export async function pathsForFolders(userId: string, folderIds: string[]) {
  const unique = [...new Set(folderIds)];
  if (unique.length === 0) return new Map<string, { id: string; name: string }[]>();

  const result = await db.execute<{ leaf: string; id: string; name: string; depth: number }>(sql`
    WITH RECURSIVE trail AS (
      SELECT id AS leaf, id, name, parent_id, 0 AS depth
      FROM folders
      WHERE id IN (${sql.join(
        unique.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) AND owner_id = ${userId} AND deleted_at IS NULL
      UNION ALL
      SELECT trail.leaf, parent.id, parent.name, parent.parent_id, trail.depth + 1
      FROM folders parent
      JOIN trail ON parent.id = trail.parent_id
      WHERE parent.deleted_at IS NULL
    )
    SELECT leaf, id, name, depth FROM trail ORDER BY leaf, depth DESC
  `);

  const trails = new Map<string, { id: string; name: string }[]>();
  for (const row of result.rows) {
    const existing = trails.get(row.leaf) ?? [];
    existing.push({ id: row.id, name: row.name });
    trails.set(row.leaf, existing);
  }

  return trails;
}

export async function moveFiles(userId: string, fileIds: string[], folderId: string | null) {
  const moved = await db
    .update(files)
    .set({ folderId, updatedAt: new Date() })
    .where(and(eq(files.ownerId, userId), isNull(files.deletedAt), inArray(files.id, fileIds)))
    .returning({ id: files.id });

  return moved.length;
}

/** Bulk delete. Ownership is in the WHERE clause, so ids the caller does not own are ignored. */
export async function deleteFiles(userId: string, fileIds: string[]) {
  const doomed = await db
    .select({ id: files.id, storageKey: files.storageKey })
    .from(files)
    .where(and(eq(files.ownerId, userId), isNull(files.deletedAt), inArray(files.id, fileIds)));

  if (doomed.length === 0) return 0;

  const now = new Date();
  await db
    .update(files)
    .set({ deletedAt: now, shareSlug: null, updatedAt: now })
    .where(
      and(
        eq(files.ownerId, userId),
        inArray(
          files.id,
          doomed.map((file) => file.id),
        ),
      ),
    );

  await Promise.all(doomed.map((file) => deleteObject(file.storageKey).catch(() => undefined)));

  return doomed.length;
}
