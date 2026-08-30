import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const initiateUploadSchema = z.object({
  name: z.string().trim().min(1, 'File name is required').max(255),
  mimeType: z.string().trim().min(1).max(255),
  size: z.number().int().positive('File is empty'),
  folderId: z.union([z.string().uuid(), z.null()]).optional(),
});

export const completeUploadSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1),
      }),
    )
    .min(1, 'At least one uploaded part is required'),
});

const folderId = z.union([z.string().uuid(), z.null()]);

export const updateFileSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    visibility: z.enum(['private', 'public']).optional(),
    folderId: folderId.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.visibility !== undefined || value.folderId !== undefined,
    { message: 'Provide a name, a visibility or a folder to update' },
  );

export const listFilesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(400).optional(),
  search: z.string().trim().max(255).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  folder: z.string().uuid().optional(),
  scope: z.enum(['folder', 'all']).default('folder'),
  sort: z.enum(['created', 'name', 'size']).default('created'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder needs a name').max(255),
  parentId: folderId.optional(),
});

export const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    parentId: folderId.optional(),
  })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, {
    message: 'Provide a name or a parent folder to update',
  });

export const bulkFilesSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('delete'),
    ids: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal('move'),
    ids: z.array(z.string().uuid()).min(1).max(200),
    folderId,
  }),
]);
