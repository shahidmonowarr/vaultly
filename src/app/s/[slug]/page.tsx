import { notFound } from 'next/navigation';
import { formatBytes, formatDate } from '@/lib/format';
import { isInlineSafe } from '@/server/lib/files';
import { findSharedFile } from '@/server/services/files';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const file = await findSharedFile((await params).slug);
  return { title: file ? `${file.name} · Vaultly` : 'Link unavailable · Vaultly' };
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  const file = await findSharedFile(slug);

  if (!file) {
    notFound();
  }

  const downloadUrl = `/api/v1/share/${slug}/download`;
  const showPreview = isInlineSafe(file.mimeType) && file.mimeType.startsWith('image/');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-7 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Shared file
        </p>
        <h1 className="mt-2 break-words text-xl font-semibold">{file.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {formatBytes(Number(file.sizeBytes))} · {file.mimeType} · shared{' '}
          {formatDate(file.createdAt.toISOString())}
        </p>

        {showPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${downloadUrl}?inline=1`}
            alt={file.name}
            className="mt-6 max-h-80 w-full rounded-xl border border-[var(--color-line)] object-contain"
          />
        )}

        <a
          href={downloadUrl}
          className="mt-6 block rounded-lg bg-[var(--color-ink)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:opacity-90"
        >
          Download
        </a>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        The owner can revoke this link at any time.
      </p>
    </main>
  );
}
