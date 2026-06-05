'use client';

import { useActionState } from 'react';
import { invitarMiembro, type InvitarState } from './actions';

const initialState: InvitarState = {};

export default function InvitarPage() {
  const [state, formAction, pending] = useActionState(invitarMiembro, initialState);

  return (
    <div className="max-w-3xl">
      <div className="mb-3xl">
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          Invitación
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Invitar miembro
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          Invitá por email a un usuario para que acceda al dashboard de tu
          organización como cliente B2B.
        </p>
      </div>

      {state.error && (
        <div className="mb-lg px-lg py-md rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">{state.error}</p>
        </div>
      )}

      {state.ok && (
        <div className="mb-lg px-lg py-md rounded-md bg-status-successSoft border border-status-success/30">
          <p className="text-ds-sm text-status-success font-medium">
            Invitación enviada a {state.email}. Le llegará un email para
            establecer su contraseña y entrar.
          </p>
        </div>
      )}

      <form
        action={formAction}
        className="bg-surface-card border border-line-soft rounded-xl p-2xl shadow-card space-y-lg"
      >
        <label className="block">
          <span className="text-ds-md font-medium text-ink-secondary block mb-xs">
            Email del invitado
            <span className="text-status-danger ml-xs">*</span>
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="persona@empresa.com"
            className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-md rounded-md bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Enviando…' : 'Enviar invitación'}
        </button>

        <p className="text-ds-xs text-ink-muted text-center">
          El invitado recibe un email de Supabase Auth. Al aceptarlo define su
          contraseña y queda vinculado a tu entidad como cliente B2B.
        </p>
      </form>
    </div>
  );
}
