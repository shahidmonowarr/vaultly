'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { api, RequestError } from '@/lib/api';

interface Props {
  mode: 'login' | 'register';
}

const copy = {
  login: {
    title: 'Sign in',
    subtitle: 'Welcome back.',
    action: 'Sign in',
    footer: 'Need an account?',
    link: '/register',
    linkLabel: 'Create one',
  },
  register: {
    title: 'Create an account',
    subtitle: 'Ten characters or more for the password.',
    action: 'Create account',
    footer: 'Already registered?',
    link: '/login',
    linkLabel: 'Sign in',
  },
} as const;

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const text = copy[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    try {
      await api(`/api/v1/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      if (error instanceof RequestError) {
        setFieldErrors(
          Object.fromEntries(error.details?.map((item) => [item.field, item.message]) ?? []),
        );
        setMessage(error.details?.length ? null : error.message);
      } else {
        setMessage('Could not reach the server. Check your connection and try again.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-xl font-semibold">{text.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{text.subtitle}</p>

      <label className="mt-6 block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}

      <label className="mt-4 block text-sm font-medium" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}

      {message && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Working…' : text.action}
      </button>

      <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
        {text.footer}{' '}
        <Link href={text.link} className="font-medium text-[var(--color-accent)]">
          {text.linkLabel}
        </Link>
      </p>
    </form>
  );
}
