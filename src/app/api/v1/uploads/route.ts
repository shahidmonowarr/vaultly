import { requireUser } from '@/server/http/auth';
import { json, parseBody, route } from '@/server/http/response';
import { clientIp, enforceRateLimit } from '@/server/lib/rate-limit';
import { initiateUploadSchema } from '@/server/lib/schemas';
import { getOwnedFolder } from '@/server/services/folders';
import { initiateUpload } from '@/server/services/uploads';

export const POST = route(async (request) => {
  const { userId } = await requireUser(request);
  await enforceRateLimit({ key: `upload:${userId}:${clientIp(request)}`, max: 60, windowSeconds: 3600 });

  const input = await parseBody(request, initiateUploadSchema);

  if (input.folderId) {
    await getOwnedFolder(userId, input.folderId);
  }

  const ticket = await initiateUpload(userId, input);

  return json({ data: ticket }, 201);
});
