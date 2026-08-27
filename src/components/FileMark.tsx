import { fileLabel } from '@/lib/fileKind';

interface Props {
  name: string;
  mimeType: string;
  thumbnailUrl?: string;
}

export default function FileMark({ name, mimeType, thumbnailUrl }: Props) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ground font-mono text-[10px] font-medium tracking-tight text-ink-3"
    >
      {fileLabel(name, mimeType)}
    </span>
  );
}
