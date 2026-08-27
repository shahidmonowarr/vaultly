import Link from 'next/link';
import { cookies } from 'next/headers';
import TransferDemo from '@/components/TransferDemo';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/constants';

const FACTS = [
  ['512 MB', 'largest single file'],
  ['0 bytes', 'pass through our server'],
  ['1 click', 'to take a shared link back'],
];

export default async function HomePage() {
  const jar = await cookies();
  // Presence is enough to change the call to action; every real check happens server side
  // on the routes themselves.
  const signedIn = jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);

  return (
    <div className="grid-ground flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold tracking-tight">Vaultly</span>

        {signedIn ? (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Your files
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-14 px-6 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-20 lg:pb-24">
        <div>
          <h1 className="max-w-[16ch] text-balance font-display text-[2.6rem] font-bold leading-[1.03] tracking-[-0.03em] sm:text-[3.6rem]">
            Send a 500 MB file like it&rsquo;s a 500 KB one.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
            Vaultly splits an upload into parts and sends them to object storage in
            parallel. Every file stays private until you publish a link, and one click
            takes that link away again.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-accent"
              >
                Go to your files
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-xl bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-accent"
                >
                  Create an account
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-line-strong bg-surface px-6 py-3 text-sm font-medium transition hover:border-ink"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-line pt-6">
            {FACTS.map(([value, label]) => (
              <div key={label}>
                <dt className="tabular font-mono text-xl text-ink">{value}</dt>
                <dd className="mt-0.5 text-[13px] text-ink-3">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <TransferDemo />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-8">
        <a
          href="https://github.com/shahidmonowarr/vaultly"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
