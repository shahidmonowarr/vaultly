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
      {/* Chrome renders PDFs in an iframe but not in an <object>, which silently paints
          nothing. Mobile browsers generally render neither, hence the link below. */}
      <iframe
        src={url}
        title={`Preview of ${name}`}
        className={`w-full rounded-xl border border-[var(--color-line)] bg-gray-50 ${className}`}
      />

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
