import { env } from '@/server/env';
import { requireUser } from '@/server/http/auth';
import { getOrigin } from '@/server/http/origin';
import { json, parseQuery, route } from '@/server/http/response';
import { listFilesSchema } from '@/server/lib/schemas';
import { getStorageUsage, listFiles, toFileDto } from '@/server/services/files';

export const GET = route(async (request) => {
  const { userId } = await requireUser(request);
  const options = parseQuery(request, listFilesSchema);

  const [page, used] = await Promise.all([listFiles(userId, options), getStorageUsage(userId)]);
  const origin = getOrigin(request);

  return json({
    data: page.items.map((file) => toFileDto(file, origin)),
    pagination: { nextCursor: page.nextCursor, limit: options.limit },
    storage: { used, quota: env.USER_QUOTA_BYTES, maxFileSize: env.MAX_FILE_SIZE_BYTES },
  });
});
