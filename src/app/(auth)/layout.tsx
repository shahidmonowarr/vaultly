import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid-ground flex min-h-dvh w-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[26rem]">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Vaultly
        </Link>

        <div className="mt-5 rounded-2xl border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(12,18,32,0.04),0_16px_40px_-20px_rgba(12,18,32,0.25)]">
          {children}
        </div>
      </div>
    </main>
  );
}
