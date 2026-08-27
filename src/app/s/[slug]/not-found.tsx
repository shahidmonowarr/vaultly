import Link from 'next/link';

export default function ShareNotFound() {
  return (
    <main className="grid-ground flex min-h-dvh w-full flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
        This link is no longer available
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-3">
        The owner made the file private again, or deleted it. Links cannot be restored once
        they are taken away.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent"
      >
        Go to Vaultly
      </Link>
    </main>
  );
}
