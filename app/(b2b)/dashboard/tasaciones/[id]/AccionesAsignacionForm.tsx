'use client';

import { useActionState } from 'react';
import {
  liberarAlPool,
  reasignarTasador,
  type AsignarTasadorState,
} from './actions';
import { type TasadorOption } from './AsignarTasadorForm';

const initialState: AsignarTasadorState = {};

/**
 * TSK-119: botón del admin para liberar al pool una solicitud B2B pendiente sin
 * asignar (modalidad manual → tomable=true), habilitando el self-claim DS-22.
 * Solo se renderiza desde el detalle (RSC) cuando el caller es admin de la
 * entidad y la solicitud está pendiente, sin tasador y sin liberar todavía.
 */
export function LiberarAlPoolForm({ tasacionId }: { tasacionId: string }) {
  const [state, formAction, pending] = useActionState(liberarAlPool, initialState);

  return (
    <form action={formAction} className="mt-md pt-md border-t border-line-soft space-y-sm">
      <input type="hidden" name="tasacionId" value={tasacionId} />
      <p className="text-ds-xs text-ink-muted2">
        En vez de asignar a mano, podés liberarla al pool para que cualquier
        tasador con la especialidad la tome.
      </p>

      {state.error && (
        <p className="text-ds-sm text-status-danger font-medium">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-ds-sm text-status-success font-medium">{state.ok}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="py-sm px-lg rounded-md border border-line bg-surface-card text-ink-primary text-ds-sm font-semibold hover:bg-surface-pageAlt transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? 'Liberando…' : 'Liberar al pool'}
      </button>
    </form>
  );
}

/**
 * TSK-120 / RF-027: form del admin para reasignar una tasación EN PROCESO a otro
 * tasador de la entidad. Se renderiza solo cuando el caller es admin y la
 * tasación está en proceso con un tasador asignado. La validación de
 * especialidad y el optimistic locking los hace la RPC reasignar_tasacion; los
 * errores (no apto, conflicto concurrente) llegan traducidos por la action.
 */
export function ReasignarTasadorForm({
  tasacionId,
  tasadores,
}: {
  tasacionId: string;
  tasadores: TasadorOption[];
}) {
  const [state, formAction, pending] = useActionState(reasignarTasador, initialState);

  return (
    <div className="mt-md pt-md border-t border-line-soft">
      {tasadores.length === 0 ? (
        <p className="text-ds-sm text-ink-muted2 italic">
          No hay otros tasadores en la entidad para reasignar.
        </p>
      ) : (
        <form action={formAction} className="space-y-sm">
          <input type="hidden" name="tasacionId" value={tasacionId} />
          <label className="block">
            <span className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide block mb-xs">
              Reasignar a otro tasador
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

          <label className="block">
            <span className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide block mb-xs">
              Motivo (opcional)
            </span>
            <input
              type="text"
              name="motivo"
              maxLength={500}
              placeholder="Ej: el tasador no puede continuar"
              className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
            />
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
            {pending ? 'Reasignando…' : 'Reasignar tasador'}
          </button>
        </form>
      )}
    </div>
  );
}
