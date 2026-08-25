import { requireUser } from '@/server/http/auth';
import { getOrigin } from '@/server/http/origin';
import { requireUuid } from '@/server/http/params';
import { json, parseBody, route } from '@/server/http/response';
import { completeUploadSchema } from '@/server/lib/schemas';
import { toFileDto } from '@/server/services/files';
import { completeUpload } from '@/server/services/uploads';

type Context = { params: Promise<{ fileId: string }> };

export const POST = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'Upload not found');
  const { parts } = await parseBody(request, completeUploadSchema);

  const file = await completeUpload(userId, fileId, parts);

  return json({ data: toFileDto(file, getOrigin(request)) });
});
