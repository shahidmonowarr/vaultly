import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="text-sm font-medium text-[var(--color-accent)]">
        Vaultly
      </Link>
      <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-white p-7 shadow-sm">
        {children}
      </div>
    </main>
  );
}
