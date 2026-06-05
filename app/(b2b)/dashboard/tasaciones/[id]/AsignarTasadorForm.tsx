'use client';

import { useActionState } from 'react';
import { asignarTasador, type AsignarTasadorState } from './actions';

export type TasadorOption = {
  userId: string;
  nombre: string;
};

const initialState: AsignarTasadorState = {};

/**
 * TSK-91: acción del admin para asignar un tasador a una solicitud pendiente sin
 * tasador. Solo se renderiza desde el detalle cuando el caller es admin de la
 * entidad y la tasación está pendiente sin asignar (gating en el server). El
 * error de carrera (otro la tomó/asignó) llega como mensaje de la RPC.
 */
export default function AsignarTasadorForm({
  tasacionId,
  tasadores,
}: {
  tasacionId: string;
  tasadores: TasadorOption[];
}) {
  const [state, formAction, pending] = useActionState(asignarTasador, initialState);

  return (
    <div className="mt-md pt-md border-t border-line-soft">
      {tasadores.length === 0 ? (
        <p className="text-ds-sm text-ink-muted2 italic">
          No hay tasadores en la entidad para asignar. Agregalos desde Miembros.
        </p>
      ) : (
        <form action={formAction} className="space-y-sm">
          <input type="hidden" name="tasacionId" value={tasacionId} />
          <label className="block">
            <span className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide block mb-xs">
              Asignar tasador
            </span>
            <select
              name="tasadorId"
              required
              defaultValue=""
              className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
            >
              <option value="" disabled>
                Elegí un tasador…
              </option>
              {tasadores.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          {state.error && (
            <p className="text-ds-sm text-status-danger font-medium">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-ds-sm text-status-success font-medium">{state.ok}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="py-sm px-lg rounded-md bg-brand-primary text-ink-onDark text-ds-sm font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Asignando…' : 'Asignar tasador'}
          </button>
        </form>
      )}
    </div>
  );
}
