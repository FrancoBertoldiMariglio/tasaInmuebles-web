'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-lg bg-surface-page">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="flex items-center gap-sm mb-xl text-ink-muted2 hover:text-ink-primary transition-colors duration-fast"
        >
          <div className="w-xl h-xl rounded-md bg-brand-primary" />
          <span className="text-ds-lg font-semibold text-ink-primary">
            Tasainmuebles
          </span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-card border border-line-soft rounded-xl p-2xl shadow-card space-y-lg"
        >
          <div>
            <h1 className="text-ds-2xl font-bold text-ink-primary">Ingresar</h1>
            <p className="text-ds-md text-ink-muted2 mt-xs">
              Acceso para clientes B2B y administradores.
            </p>
          </div>

          <label className="block">
            <span className="text-ds-md font-medium text-ink-secondary">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-xs w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
              placeholder="tu@empresa.com"
            />
          </label>

          <label className="block">
            <span className="text-ds-md font-medium text-ink-secondary">
              Contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-xs w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="px-md py-sm rounded-md bg-status-dangerSoft border border-status-danger/30">
              <p className="text-ds-sm text-status-danger font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-md rounded-md bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-lg text-ds-sm text-ink-muted text-center">
          ¿Sos tasador? Descargá la app mobile.
        </p>
      </div>
    </main>
  );
}
