import { requireUser } from '@/server/http/auth';
import { json, parseBody, route } from '@/server/http/response';
import { bulkFilesSchema } from '@/server/lib/schemas';
import { deleteFiles, moveFiles } from '@/server/services/files';
import { getOwnedFolder } from '@/server/services/folders';

export const POST = route(async (request) => {
  const { userId } = await requireUser(request);
  const input = await parseBody(request, bulkFilesSchema);

  if (input.action === 'delete') {
    return json({ data: { deleted: await deleteFiles(userId, input.ids) } });
  }

  if (input.folderId) {
    await getOwnedFolder(userId, input.folderId);
  }

  return json({ data: { moved: await moveFiles(userId, input.ids, input.folderId) } });
});
