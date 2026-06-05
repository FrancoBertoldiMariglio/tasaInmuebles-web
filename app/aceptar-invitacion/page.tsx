'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { finalizarInvitacion } from './actions';

export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={null}>
      <AceptarInvitacion />
    </Suspense>
  );
}

type Estado = 'verificando' | 'listo' | 'invalido' | 'hecho';

function AceptarInvitacion() {
  const router = useRouter();
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verifica el token de invitación (token_hash + type=invite) para
  // establecer la sesión SSR antes de pedir la contraseña.
  useEffect(() => {
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || type !== 'invite') {
      setEstado('invalido');
      return;
    }
    const supabase = createClient();
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'invite' })
      .then(({ error }) => {
        if (error) {
          setError(error.message);
          setEstado('invalido');
        } else {
          setEstado('listo');
        }
      });
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await finalizarInvitacion(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEstado('hecho');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-lg bg-surface-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-sm mb-xl">
          <div className="w-xl h-xl rounded-md bg-brand-primary" />
          <span className="text-ds-lg font-semibold text-ink-primary">
            Tasainmuebles
          </span>
        </div>

        <div className="bg-surface-card border border-line-soft rounded-xl p-2xl shadow-card space-y-lg">
          {estado === 'verificando' && (
            <p className="text-ds-md text-ink-muted2">Verificando invitación…</p>
          )}

          {estado === 'invalido' && (
            <div className="space-y-sm">
              <h1 className="text-ds-2xl font-bold text-ink-primary">
                Invitación inválida
              </h1>
              <p className="text-ds-md text-ink-muted2">
                El enlace expiró o ya fue usado. Pedile a tu administrador una
                nueva invitación.
              </p>
              {error && (
                <p className="text-ds-sm text-status-danger">{error}</p>
              )}
              <Link
                href="/login"
                className="inline-block text-ds-sm text-brand-primary hover:underline"
              >
                Ir a ingresar
              </Link>
            </div>
          )}

          {estado === 'hecho' && (
            <div className="space-y-md">
              <h1 className="text-ds-2xl font-bold text-ink-primary">
                ¡Listo!
              </h1>
              <p className="text-ds-md text-ink-muted2">
                Tu cuenta quedó activa. Ya podés entrar al dashboard.
              </p>
              <Link
                href="/dashboard"
                className="inline-block w-full text-center py-md rounded-md bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base"
              >
                Ir al dashboard
              </Link>
            </div>
          )}

          {estado === 'listo' && (
            <form onSubmit={handleSubmit} className="space-y-lg">
              <div>
                <h1 className="text-ds-2xl font-bold text-ink-primary">
                  Activá tu cuenta
                </h1>
                <p className="text-ds-md text-ink-muted2 mt-xs">
                  Elegí una contraseña para entrar al dashboard.
                </p>
              </div>

              <label className="block">
                <span className="text-ds-md font-medium text-ink-secondary">
                  Contraseña
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-xs w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
                  placeholder="Mínimo 8 caracteres"
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
                {loading ? 'Activando…' : 'Activar cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
