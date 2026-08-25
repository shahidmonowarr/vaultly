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

export const updateFileSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    visibility: z.enum(['private', 'public']).optional(),
  })
  .refine((value) => value.name !== undefined || value.visibility !== undefined, {
    message: 'Provide a name or a visibility to update',
  });

export const listFilesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
  search: z.string().trim().max(255).optional(),
  visibility: z.enum(['private', 'public']).optional(),
});
