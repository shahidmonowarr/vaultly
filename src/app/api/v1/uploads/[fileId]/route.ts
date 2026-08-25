import { requireUser } from '@/server/http/auth';
import { requireUuid } from '@/server/http/params';
import { noContent, route } from '@/server/http/response';
import { abortUpload } from '@/server/services/uploads';

type Context = { params: Promise<{ fileId: string }> };

export const DELETE = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'Upload not found');

  await abortUpload(userId, fileId);

  return noContent();
});
