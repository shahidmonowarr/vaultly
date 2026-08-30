import { env } from '@/server/env';
import { requireUser } from '@/server/http/auth';
import { getOrigin } from '@/server/http/origin';
import { json, parseQuery, route } from '@/server/http/response';
import { listFilesSchema } from '@/server/lib/schemas';
import {
  countFiles,
  getStorageUsage,
  listFiles,
  pathsForFolders,
  toFileDto,
} from '@/server/services/files';
import { folderPath, listChildFolders, toFolderDto } from '@/server/services/folders';

export const GET = route(async (request) => {
  const { userId } = await requireUser(request);
  const query = parseQuery(request, listFilesSchema);

  // Searching, and the flat views, both look across the whole tree rather than one folder.
  const flat = Boolean(query.search) || query.scope === 'all';
  const searching = flat;
  const folderId = query.folder ?? null;

  const options = {
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
    visibility: query.visibility,
    // A search looks across every folder; browsing stays inside the current one.
    folderId: searching ? undefined : folderId,
    sort: query.sort,
    order: query.order,
  };

  const [page, total, used, childFolders, breadcrumb] = await Promise.all([
    listFiles(userId, options),
    countFiles(userId, options),
    getStorageUsage(userId),
    searching ? Promise.resolve([]) : listChildFolders(userId, folderId),
    searching ? Promise.resolve([]) : folderPath(userId, folderId),
  ]);

  const origin = getOrigin(request);

  // Search results are useless without telling people where the file lives.
  const trails = searching
    ? await pathsForFolders(
        userId,
        page.items.map((file) => file.folderId).filter((id): id is string => id !== null),
      )
    : new Map();

  return json({
    data: page.items.map((file) => ({
      ...toFileDto(file, origin),
      path: searching ? (trails.get(file.folderId ?? '') ?? []) : undefined,
    })),
    folders: childFolders.map(toFolderDto),
    breadcrumb,
    pagination: { nextCursor: page.nextCursor, limit: query.limit, total },
    storage: { used, quota: env.USER_QUOTA_BYTES, maxFileSize: env.MAX_FILE_SIZE_BYTES },
  });
});
