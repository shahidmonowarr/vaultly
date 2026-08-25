import { NextResponse } from 'next/server';
import { requireUser } from '@/server/http/auth';
import { requireUuid } from '@/server/http/params';
import { route } from '@/server/http/response';
import { contentDisposition, isInlineSafe } from '@/server/lib/files';
import { getOwnedFile, incrementDownloadCount } from '@/server/services/files';
import { presignDownload } from '@/server/services/storage';

type Context = { params: Promise<{ fileId: string }> };

export const GET = route<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const fileId = requireUuid((await context.params).fileId, 'File not found');

  const file = await getOwnedFile(userId, fileId);

  const wantsPreview = new URL(request.url).searchParams.get('inline') === '1';
  const inline = wantsPreview && isInlineSafe(file.mimeType);

  // The object itself is never public. Access is granted as a URL that expires in
  // five minutes and is signed only after ownership has been confirmed.
  const url = await presignDownload(file.storageKey, {
    disposition: inline ? 'inline' : contentDisposition(file.name),
    contentType: file.mimeType,
  });

  // Previewing your own file in the dashboard is not a download.
  if (!inline) {
    await incrementDownloadCount(file.id);
  }

  return NextResponse.redirect(url, 302);
});
