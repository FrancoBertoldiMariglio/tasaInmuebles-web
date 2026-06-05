'use client';

import { useActionState } from 'react';
import { agregarMiembro, type MiembrosActionState } from './actions';
import { ROLES_MIEMBRO, rolMiembroLabels } from '@/lib/labels';

const initialState: MiembrosActionState = {};

export default function AgregarMiembroForm() {
  const [state, formAction, pending] = useActionState(agregarMiembro, initialState);

  return (
    <form
      action={formAction}
      className="bg-surface-card border border-line-soft rounded-xl p-xl shadow-card space-y-lg"
    >
      <div>
        <h2 className="text-ds-xl font-semibold text-ink-primary">Agregar miembro</h2>
        <p className="text-ds-sm text-ink-muted2 mt-xs">
          Vinculá un usuario existente a tu organización por su email y asignale roles.
        </p>
      </div>

      {state.error && (
        <div className="px-md py-sm rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="px-md py-sm rounded-md bg-status-successSoft border border-status-success/30">
          <p className="text-ds-sm text-status-success font-medium">{state.ok}</p>
        </div>
      )}

      <label className="block">
        <span className="text-ds-md font-medium text-ink-secondary block mb-xs">
          Email del usuario<span className="text-status-danger ml-xs">*</span>
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="persona@organizacion.com"
          className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
        />
      </label>

      <fieldset>
        <legend className="text-ds-md font-medium text-ink-secondary mb-sm">
          Roles<span className="text-status-danger ml-xs">*</span>
        </legend>
        <div className="flex flex-wrap gap-md">
          {/* Alcance DS-02: el ABM solo da de alta tasadores y solicitantes.
              El rol admin no es asignable desde acá (enforce en la RPC). */}
          {ROLES_MIEMBRO.filter((rol) => rol !== 'admin').map((rol) => (
            <label
              key={rol}
              className="flex items-center gap-sm px-md py-sm border border-line rounded-md cursor-pointer hover:bg-surface-page transition-colors duration-fast"
            >
              <input
                type="checkbox"
                name="roles"
                value={rol}
                defaultChecked={rol === 'solicitante'}
                className="accent-brand-primary"
              />
              <span className="text-ds-sm text-ink-primary">{rolMiembroLabels[rol]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="py-md px-xl rounded-md bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? 'Agregando…' : 'Agregar miembro'}
      </button>
    </form>
  );
}
