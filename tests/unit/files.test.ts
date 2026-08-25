import { describe, expect, it } from 'vitest';
import { AppError } from '@/server/lib/errors';
import {
  assertUploadableFile,
  contentDisposition,
  isInlineSafe,
  previewKind,
  sanitizeFileName,
} from '@/server/lib/files';

describe('sanitizeFileName', () => {
  it('strips directory components', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\me\\report.pdf')).toBe('report.pdf');
  });

  it('removes leading dots so files cannot be hidden', () => {
    expect(sanitizeFileName('...bashrc')).toBe('bashrc');
  });

  it('rejects a name that is empty once cleaned', () => {
    expect(() => sanitizeFileName('   ')).toThrow(AppError);
  });

  it('caps the length at 255 characters', () => {
    expect(sanitizeFileName(`${'a'.repeat(400)}.txt`)).toHaveLength(255);
  });
});

describe('assertUploadableFile', () => {
  it('accepts an ordinary document', () => {
    expect(() => assertUploadableFile('notes.pdf', 'application/pdf')).not.toThrow();
  });

  it('rejects executables by extension', () => {
    expect(() => assertUploadableFile('setup.exe', 'application/octet-stream')).toThrow(AppError);
    expect(() => assertUploadableFile('payload.sh', 'text/plain')).toThrow(AppError);
  });

  it('rejects a malformed content type', () => {
    expect(() => assertUploadableFile('notes.pdf', 'not a mime type')).toThrow(AppError);
  });
});

describe('contentDisposition', () => {
  it('always forces a download and escapes quotes', () => {
    const header = contentDisposition('quarterly "final".pdf');
    expect(header.startsWith('attachment;')).toBe(true);
    expect(header).not.toContain('"final"');
  });

  it('encodes non-ascii names for clients that support RFC 5987', () => {
    expect(contentDisposition('rapport-été.pdf')).toContain("filename*=UTF-8''");
  });
});

describe('isInlineSafe', () => {
  it('does not allow html or svg to render inline', () => {
    expect(isInlineSafe('text/html')).toBe(false);
    expect(isInlineSafe('image/svg+xml')).toBe(false);
    expect(isInlineSafe('image/png')).toBe(true);
  });
});

describe('previewKind', () => {
  it('previews images and pdfs', () => {
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('application/pdf')).toBe('pdf');
  });

  it('refuses to preview anything that could execute in our origin', () => {
    expect(previewKind('text/html')).toBeNull();
    expect(previewKind('image/svg+xml')).toBeNull();
  });

  it('returns null for formats with no viewer', () => {
    expect(previewKind('application/zip')).toBeNull();
  });
});
