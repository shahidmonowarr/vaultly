import { requireUser } from '@/server/http/auth';
import { getOrigin } from '@/server/http/origin';
import { requireUuid } from '@/server/http/params';
import { json, noContent, parseBody, route } from '@/server/http/response';
import { updateFileSchema } from '@/server/lib/schemas';
import { deleteFile, getOwnedFile, toFileDto, updateFile } from '@/server/services/files';
import { getOwnedFolder } from '@/server/services/folders';

type Context = { params: Promise<{ fileId: string }> };

export const GET = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'File not found');

  const file = await getOwnedFile(userId, fileId);

  return json({ data: toFileDto(file, getOrigin(request)) });
});

export const PATCH = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'File not found');
  const changes = await parseBody(request, updateFileSchema);

  if (changes.folderId) {
    await getOwnedFolder(userId, changes.folderId);
  }

  const file = await updateFile(userId, fileId, changes);

  return json({ data: toFileDto(file, getOrigin(request)) });
});

export const DELETE = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'File not found');

  await deleteFile(userId, fileId);

  return noContent();
});
