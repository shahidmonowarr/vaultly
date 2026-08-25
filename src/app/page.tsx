import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-[var(--color-accent)]">Vaultly</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Store your files. Share only what you choose.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-[var(--color-muted)]">
        Uploads go straight to object storage in parallel chunks, so a 500 MB file is no
        different from a 500 KB one. Everything is private until you publish a link.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Create an account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[var(--color-line)] bg-white px-5 py-2.5 text-sm font-medium transition hover:border-gray-300"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
