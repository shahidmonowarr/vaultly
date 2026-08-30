import { requireUser } from '@/server/http/auth';
import { requireUuid } from '@/server/http/params';
import { json, parseBody, route } from '@/server/http/response';
import { sanitizeFileName } from '@/server/lib/files';
import { updateFolderSchema } from '@/server/lib/schemas';
import { deleteFolder, folderContents, toFolderDto, updateFolder } from '@/server/services/folders';

type Context = { params: Promise<{ folderId: string }> };

export const GET = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const folderId = requireUuid((await context.params).folderId, 'Folder not found');

  // What deleting this folder would take with it, so the confirmation can say so.
  return json({ data: await folderContents(userId, folderId) });
});

export const PATCH = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const folderId = requireUuid((await context.params).folderId, 'Folder not found');
  const changes = await parseBody(request, updateFolderSchema);

  const folder = await updateFolder(userId, folderId, {
    ...changes,
    name: changes.name ? sanitizeFileName(changes.name) : undefined,
  });

  return json({ data: toFolderDto(folder) });
});

export const DELETE = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const folderId = requireUuid((await context.params).folderId, 'Folder not found');

  return json({ data: await deleteFolder(userId, folderId) });
});
