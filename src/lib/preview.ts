// Shared by the server (deciding Content-Disposition) and the client (deciding whether to
// offer a preview), so the two can never disagree about what is safe to render in place.
const INLINE_SAFE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
]);

export function isInlineSafe(mimeType: string) {
  return INLINE_SAFE_MIME_TYPES.has(mimeType);
}

/**
 * What may be rendered in place, if anything. Previews load from the storage host rather
 * than this origin, so a document carrying scripts executes against the bucket, not us.
 */
export function previewKind(mimeType: string): 'image' | 'pdf' | null {
  if (!isInlineSafe(mimeType)) return null;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';

  return null;
}
