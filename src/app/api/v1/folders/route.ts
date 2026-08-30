import { requireUser } from '@/server/http/auth';
import { json, parseBody, route } from '@/server/http/response';
import { sanitizeFileName } from '@/server/lib/files';
import { createFolderSchema } from '@/server/lib/schemas';
import { createFolder, toFolderDto } from '@/server/services/folders';

export const POST = route(async (request) => {
  const { userId } = await requireUser(request);
  const input = await parseBody(request, createFolderSchema);

  const folder = await createFolder(userId, sanitizeFileName(input.name), input.parentId ?? null);

  return json({ data: toFolderDto(folder) }, 201);
});
