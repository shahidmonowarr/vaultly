import Link from 'next/link';

export default function ShareNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">This link is no longer available</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        It may have been made private, or the file was deleted.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium text-[var(--color-accent)]">
        Go to Vaultly
      </Link>
    </main>
  );
}
