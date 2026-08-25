import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { and, eq } from 'drizzle-orm';
import { env } from '../env';
import { db } from '../db/client';
import { files } from '../db/schema';
import { badRequest, notFound, payloadTooLarge, quotaExceeded, unsupportedMediaType } from '../lib/errors';
import { assertUploadableFile, getExtension, sanitizeFileName } from '../lib/files';
import { getStorageUsage } from './files';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteObject,
  headObject,
  presignUploadPart,
  readObjectHead,
  type CompletedPart,
} from './storage';

// S3 requires every part except the last to be at least 5 MiB, and allows 10k parts.
// 8 MiB keeps a 512 MB upload at 64 parts while staying comfortably within both limits.
const PART_SIZE = 8 * 1024 * 1024;
const MAX_PARTS = 10_000;
const SNIFF_BYTES = 4_100;

const EXECUTABLE_SIGNATURES = new Set([
  'application/x-msdownload',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-executable',
  'application/x-mach-binary',
  'application/x-elf',
  'application/java-archive',
]);

export interface UploadTicket {
  fileId: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}

function buildStorageKey(userId: string, fileId: string, name: string) {
  const extension = getExtension(name).replace(/[^a-z0-9]/g, '').slice(0, 10);
  // The original name is kept in the database and reapplied through Content-Disposition,
  // so nothing user-controlled ever becomes part of an object key.
  return extension ? `users/${userId}/${fileId}.${extension}` : `users/${userId}/${fileId}`;
}

export async function initiateUpload(
  userId: string,
  input: { name: string; mimeType: string; size: number },
): Promise<UploadTicket> {
  const name = sanitizeFileName(input.name);
  assertUploadableFile(name, input.mimeType);

  if (input.size > env.MAX_FILE_SIZE_BYTES) {
    throw payloadTooLarge(
      `File exceeds the maximum size of ${Math.floor(env.MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB`,
    );
  }

  if (Math.ceil(input.size / PART_SIZE) > MAX_PARTS) {
    throw payloadTooLarge('File requires more parts than the storage backend allows');
  }

  const used = await getStorageUsage(userId);
  if (used + input.size > env.USER_QUOTA_BYTES) {
    throw quotaExceeded('This upload would exceed your storage quota');
  }

  const fileId = randomUUID();
  const storageKey = buildStorageKey(userId, fileId, name);
  const uploadId = await createMultipartUpload(storageKey, input.mimeType);

  await db.insert(files).values({
    id: fileId,
    ownerId: userId,
    storageKey,
    uploadId,
    name,
    mimeType: input.mimeType,
    sizeBytes: input.size,
    status: 'pending',
  });

  const partCount = Math.max(1, Math.ceil(input.size / PART_SIZE));
  const parts = await Promise.all(
    Array.from({ length: partCount }, async (_, index) => ({
      partNumber: index + 1,
      url: await presignUploadPart(storageKey, uploadId, index + 1),
    })),
  );

  return { fileId, partSize: PART_SIZE, parts };
}

async function getPendingUpload(userId: string, fileId: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.ownerId, userId), eq(files.status, 'pending')))
    .limit(1);

  if (!file || !file.uploadId) {
    throw notFound('Upload not found');
  }

  return file;
}

async function discard(storageKey: string, fileId: string) {
  await deleteObject(storageKey).catch(() => undefined);
  await db.delete(files).where(eq(files.id, fileId));
}

export async function completeUpload(userId: string, fileId: string, parts: CompletedPart[]) {
  const file = await getPendingUpload(userId, fileId);
  const declaredSize = Number(file.sizeBytes);

  await completeMultipartUpload(file.storageKey, file.uploadId!, parts);

  // The browser told us the size before the upload started; confirm against the object
  // that actually landed, otherwise a client could under-report to dodge the quota.
  const object = await headObject(file.storageKey);
  if (object.size !== declaredSize) {
    await discard(file.storageKey, fileId);
    throw badRequest('Uploaded file does not match the size declared when the upload started');
  }

  const signature = await fileTypeFromBuffer(await readObjectHead(file.storageKey, SNIFF_BYTES));

  if (signature && EXECUTABLE_SIGNATURES.has(signature.mime)) {
    await discard(file.storageKey, fileId);
    throw unsupportedMediaType('Executable files are not accepted');
  }

  const [updated] = await db
    .update(files)
    .set({
      status: 'ready',
      uploadId: null,
      checksum: object.etag,
      // Trust the bytes over the header the client sent.
      mimeType: signature?.mime ?? file.mimeType,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId))
    .returning();

  return updated!;
}

export async function abortUpload(userId: string, fileId: string) {
  const file = await getPendingUpload(userId, fileId);

  await abortMultipartUpload(file.storageKey, file.uploadId!);
  await db.delete(files).where(eq(files.id, fileId));
}
