/** A short, honest label for the file type, used on the mark beside each row. */
export function fileLabel(name: string, mimeType: string) {
  const dot = name.lastIndexOf('.');
  const extension = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();

  if (extension && extension.length <= 4) {
    return extension.toUpperCase();
  }

  const subtype = mimeType.split('/')[1] ?? 'file';
  return subtype.slice(0, 4).toUpperCase();
}
