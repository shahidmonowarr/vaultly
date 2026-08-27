import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilePreview from '@/components/FilePreview';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/lib/preview';
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
    <div className="grid-ground flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Vaultly
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 content-center flex-col justify-center px-6 pb-16">
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(12,18,32,0.04),0_16px_40px_-20px_rgba(12,18,32,0.25)]">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Shared file</p>
          <h1 className="mt-2 break-words font-display text-2xl font-bold tracking-tight">
            {file.name}
          </h1>

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[13px] text-ink-3">
            <div className="flex gap-1.5">
              <dt className="sr-only">Size</dt>
              <dd className="tabular">{formatBytes(Number(file.sizeBytes))}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="sr-only">Type</dt>
              <dd>{file.mimeType}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="sr-only">Shared</dt>
              <dd>{formatDate(file.createdAt.toISOString())}</dd>
            </div>
          </dl>

          {preview && (
            <div className="mt-6">
              <FilePreview url={`${downloadUrl}?inline=1`} name={file.name} kind={preview} />
            </div>
          )}

          <a
            href={downloadUrl}
            className="mt-6 block rounded-xl bg-ink px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-accent"
          >
            Download
          </a>
        </div>

        <p className="mt-4 text-center text-[13px] text-ink-3">
          The owner can take this link away at any time.
        </p>
      </main>
    </div>
  );
}
