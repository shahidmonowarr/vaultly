import { notFound } from 'next/navigation';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/server/lib/files';
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
  const preview = previewKind(file.mimeType);

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

        {preview === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${downloadUrl}?inline=1`}
            alt={file.name}
            className="mt-6 max-h-80 w-full rounded-xl border border-[var(--color-line)] object-contain"
          />
        )}

        {preview === 'pdf' && (
          // <object> rather than <iframe> so browsers without an inline PDF viewer, which
          // includes most mobile ones, get the fallback below instead of a blank frame.
          <object
            data={`${downloadUrl}?inline=1`}
            type="application/pdf"
            aria-label={`Preview of ${file.name}`}
            className="mt-6 h-96 w-full rounded-xl border border-[var(--color-line)] bg-gray-50"
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-[var(--color-muted)]">
                This browser cannot show PDFs inline.
              </p>
              <a
                href={`${downloadUrl}?inline=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--color-accent)]"
              >
                Open it in a new tab
              </a>
            </div>
          </object>
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
