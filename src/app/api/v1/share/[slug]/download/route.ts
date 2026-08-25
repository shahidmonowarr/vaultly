import { NextResponse } from 'next/server';
import { route } from '@/server/http/response';
import { notFound } from '@/server/lib/errors';
import { contentDisposition, isInlineSafe } from '@/server/lib/files';
import { clientIp, enforceRateLimit } from '@/server/lib/rate-limit';
import { findSharedFile, incrementDownloadCount } from '@/server/services/files';
import { presignDownload } from '@/server/services/storage';

type Context = { params: Promise<{ slug: string }> };

export const GET = route<Context>(async (request, context) => {
  const { slug } = await context.params;
  await enforceRateLimit({ key: `share:${clientIp(request)}`, max: 120, windowSeconds: 3600 });

  const file = await findSharedFile(slug);
  if (!file) {
    throw notFound('This link is no longer available');
  }

  const wantsPreview = new URL(request.url).searchParams.get('inline') === '1';
  const inline = wantsPreview && isInlineSafe(file.mimeType);

  const url = await presignDownload(file.storageKey, {
    disposition: inline ? 'inline' : contentDisposition(file.name),
    contentType: file.mimeType,
  });

  // Inline previews on the share page are views, not downloads.
  if (!inline) {
    await incrementDownloadCount(file.id);
  }

  return NextResponse.redirect(url, 302);
});
