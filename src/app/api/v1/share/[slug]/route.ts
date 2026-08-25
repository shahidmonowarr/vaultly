import { json, route } from '@/server/http/response';
import { notFound } from '@/server/lib/errors';
import { findSharedFile } from '@/server/services/files';

type Context = { params: Promise<{ slug: string }> };

export const GET = route<Context>(async (request, context) => {
  const { slug } = await context.params;
  const file = await findSharedFile(slug);

  if (!file) {
    throw notFound('This link is no longer available');
  }

  // Deliberately narrower than the owner's view: no file id, no owner, no counters.
  return json({
    data: {
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.sizeBytes),
      createdAt: file.createdAt.toISOString(),
      downloadUrl: `/api/v1/share/${slug}/download`,
    },
  });
});
