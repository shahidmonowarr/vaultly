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
    subtitle: 'Your files are where you left them.',
    action: 'Sign in',
    footer: 'No account yet?',
    link: '/register',
    linkLabel: 'Create one',
  },
  register: {
    title: 'Create an account',
    subtitle: 'Ten characters or more for the password.',
    action: 'Create account',
    footer: 'Already have an account?',
    link: '/login',
    linkLabel: 'Sign in',
  },
} as const;

const field =
  'mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent';

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
      <h1 className="font-display text-xl font-bold tracking-tight">{text.title}</h1>
      <p className="mt-1 text-sm text-ink-3">{text.subtitle}</p>

      <label className="mt-7 block text-[13px] font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={field}
      />
      {fieldErrors.email && <p className="mt-1.5 text-xs text-danger">{fieldErrors.email}</p>}

      <label className="mt-4 block text-[13px] font-medium" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className={field}
      />
      {fieldErrors.password && <p className="mt-1.5 text-xs text-danger">{fieldErrors.password}</p>}

      {message && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#f2c8c4] bg-[#fdf2f1] px-3.5 py-2.5 text-sm text-danger"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
      >
        {pending ? 'Working' : text.action}
      </button>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        {text.footer}{' '}
        <Link href={text.link} className="font-medium text-accent underline-offset-4 hover:underline">
          {text.linkLabel}
        </Link>
      </p>
    </form>
  );
}
