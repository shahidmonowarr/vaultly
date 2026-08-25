import { customAlphabet } from 'nanoid';
import { badRequest, unsupportedMediaType } from './errors';

const MAX_NAME_LENGTH = 255;

// Executables and scripts are rejected outright: they carry no benefit for a file
// locker and turn a shareable link into a malware distribution endpoint.
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'bat', 'cmd', 'com', 'cpl', 'msi', 'msp', 'scr', 'hta', 'jar',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'app',
  'dmg', 'pkg', 'deb', 'rpm', 'apk', 'php', 'phtml', 'asp', 'aspx', 'jsp',
]);

// Everything else is served as an attachment. Only these render inline, which keeps
// stored HTML/SVG from executing under our origin.
const INLINE_SAFE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf',
  'text/plain', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav',
]);

const slugId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 22);

export function generateShareSlug() {
  return slugId();
}

export function sanitizeFileName(input: string) {
  const base = input.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^\.+/, '')
    .trim();

  if (!cleaned) {
    throw badRequest('File name is not valid');
  }

  return cleaned.slice(0, MAX_NAME_LENGTH);
}

export function getExtension(name: string) {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index + 1).toLowerCase();
}

export function assertUploadableFile(name: string, mimeType: string) {
  const extension = getExtension(name);

  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw unsupportedMediaType(`Files of type .${extension} are not accepted`);
  }

  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) {
    throw badRequest('Content type is not a valid MIME type');
  }
}

export function isInlineSafe(mimeType: string) {
  return INLINE_SAFE_MIME_TYPES.has(mimeType);
}

export function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
