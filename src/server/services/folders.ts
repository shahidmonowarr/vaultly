import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { files, folders, type FolderRecord } from '../db/schema';
import { badRequest, conflict, notFound } from '../lib/errors';
import { deleteObject } from './storage';

const UNIQUE_VIOLATION = '23505';
const MAX_DEPTH = 12;

export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Crumb {
  id: string;
  name: string;
}

export function toFolderDto(folder: FolderRecord): FolderDto {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.createdAt.toISOString(),
  };
}

export async function getOwnedFolder(userId: string, folderId: string) {
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.ownerId, userId), isNull(folders.deletedAt)))
    .limit(1);

  if (!folder) {
    throw notFound('Folder not found');
  }

  return folder;
}

export async function listChildFolders(userId: string, parentId: string | null) {
  return db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.ownerId, userId),
        isNull(folders.deletedAt),
        parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId),
      ),
    )
    .orderBy(asc(sql`lower(${folders.name})`));
}

/** Root first, the folder itself last. Used for the breadcrumb and for search results. */
export async function folderPath(userId: string, folderId: string | null): Promise<Crumb[]> {
  if (!folderId) return [];

  const result = await db.execute<{ id: string; name: string }>(sql`
    WITH RECURSIVE trail AS (
      SELECT id, name, parent_id, 0 AS depth
      FROM folders
      WHERE id = ${folderId} AND owner_id = ${userId} AND deleted_at IS NULL
      UNION ALL
      SELECT parent.id, parent.name, parent.parent_id, trail.depth + 1
      FROM folders parent
      JOIN trail ON parent.id = trail.parent_id
      WHERE parent.deleted_at IS NULL
    )
    SELECT id, name FROM trail ORDER BY depth DESC
  `);

  return result.rows.map((row) => ({ id: row.id, name: row.name }));
}

async function assertDepthWithin(userId: string, parentId: string | null) {
  const trail = await folderPath(userId, parentId);

  if (trail.length >= MAX_DEPTH) {
    throw badRequest(`Folders cannot be nested more than ${MAX_DEPTH} deep`);
  }
}

export async function createFolder(userId: string, name: string, parentId: string | null) {
  if (parentId) {
    await getOwnedFolder(userId, parentId);
  }

  await assertDepthWithin(userId, parentId);

  try {
    const [folder] = await db.insert(folders).values({ ownerId: userId, name, parentId }).returning();
    return folder!;
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict(`A folder called "${name}" is already here`);
    }
    throw error;
  }
}

/** Every folder at or below the given one, the folder itself included. */
async function descendantIds(userId: string, folderId: string) {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM folders
      WHERE id = ${folderId} AND owner_id = ${userId} AND deleted_at IS NULL
      UNION ALL
      SELECT child.id
      FROM folders child
      JOIN subtree ON child.parent_id = subtree.id
      WHERE child.deleted_at IS NULL
    )
    SELECT id FROM subtree
  `);

  return result.rows.map((row) => row.id);
}

export async function updateFolder(
  userId: string,
  folderId: string,
  changes: { name?: string; parentId?: string | null },
) {
  await getOwnedFolder(userId, folderId);

  const patch: Partial<typeof folders.$inferInsert> = { updatedAt: new Date() };

  if (changes.name) {
    patch.name = changes.name;
  }

  if (changes.parentId !== undefined) {
    if (changes.parentId === folderId) {
      throw badRequest('A folder cannot be moved into itself');
    }

    if (changes.parentId) {
      await getOwnedFolder(userId, changes.parentId);

      // Moving a folder inside its own subtree would detach that subtree from the root.
      const subtree = await descendantIds(userId, folderId);
      if (subtree.includes(changes.parentId)) {
        throw badRequest('A folder cannot be moved into one of its own folders');
      }

      await assertDepthWithin(userId, changes.parentId);
    }

    patch.parentId = changes.parentId;
  }

  try {
    const [updated] = await db
      .update(folders)
      .set(patch)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, userId)))
      .returning();

    return updated!;
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict('A folder with that name is already there');
    }
    throw error;
  }
}

export async function folderContents(userId: string, folderId: string) {
  const ids = await descendantIds(userId, folderId);

  const [row] = await db
    .select({ count: sql<string>`count(*)`, bytes: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` })
    .from(files)
    .where(
      and(eq(files.ownerId, userId), isNull(files.deletedAt), inArray(files.folderId, ids)),
    );

  return {
    folders: ids.length - 1,
    files: Number(row?.count ?? 0),
    bytes: Number(row?.bytes ?? 0),
  };
}

/**
 * Deletes the folder, everything nested inside it, and the stored objects for every file
 * it held. Rows are soft deleted so the history survives; the bytes are not.
 */
export async function deleteFolder(userId: string, folderId: string) {
  const ids = await descendantIds(userId, folderId);

  if (ids.length === 0) {
    throw notFound('Folder not found');
  }

  const doomed = await db
    .select({ id: files.id, storageKey: files.storageKey })
    .from(files)
    .where(
      and(eq(files.ownerId, userId), isNull(files.deletedAt), inArray(files.folderId, ids)),
    );

  const now = new Date();

  await db
    .update(files)
    .set({ deletedAt: now, shareSlug: null, updatedAt: now })
    .where(and(eq(files.ownerId, userId), inArray(files.folderId, ids)));

  await db
    .update(folders)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(folders.ownerId, userId), inArray(folders.id, ids)));

  await Promise.all(doomed.map((file) => deleteObject(file.storageKey).catch(() => undefined)));

  return { folders: ids.length, files: doomed.length };
}
