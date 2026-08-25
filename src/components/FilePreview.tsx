interface Props {
  url: string;
  name: string;
  kind: 'image' | 'pdf';
  className?: string;
}

export default function FilePreview({ url, name, kind, className = 'h-96' }: Props) {
  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`w-full rounded-xl border border-[var(--color-line)] object-contain ${className}`}
      />
    );
  }

  return (
    <div>
      {/* <object> rather than <iframe> so a browser with no inline PDF viewer, which is
          most mobile ones, falls through to the message below instead of a blank frame. */}
      <object
        data={url}
        type="application/pdf"
        aria-label={`Preview of ${name}`}
        className={`w-full rounded-xl border border-[var(--color-line)] bg-gray-50 ${className}`}
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">This browser cannot show PDFs inline.</p>
        </div>
      </object>

      {/* Always offered, because an embedded viewer can fail silently. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-medium text-[var(--color-accent)]"
      >
        Open in a new tab
      </a>
    </div>
  );
}
