import { formatMoney } from '@/lib/format';

/**
 * TSK-122 / AC-016 / DS-12 — Trazabilidad del valor.
 *
 * Muestra de forma clara y auditable los 4 insumos que alimentan el valor final
 * de una tasación, para que el comité (y un auditor) pueda ver de dónde sale cada
 * número:
 *
 *   (a) Valor técnico (Fitt-Servini): `tasaciones.valor_fitt_servini_ars`.
 *       Determinístico (manual del Colegio). En MVP puede venir null/placeholder
 *       → se muestra "Pendiente".
 *   (b) Valor Robotomus (mock): `tasaciones.valor_robotomus_ars`. Motor IA de
 *       mercado, hoy mock (DS-11). Puede venir null → "Pendiente".
 *   (c) Propuestas del comité: filas de `comite_propuestas` (valor ARS/USD +
 *       nota + autor + firma, según TSK-110/BR-038). Cada una es la postura
 *       individual de un tasador (Planning Poker, DS-12).
 *   (d) Valor final definido: `tasaciones.valor_ars` / `valor_usd` una vez que el
 *       comité cerró (`cierre_at`). Si todavía no se cerró → "Pendiente".
 *
 * Es DISPLAY puro (sub-render de un RSC). La lógica de armado del modelo se extrae
 * a `construirTrazabilidad` (pura) para poder testearla sin renderizar.
 */

/** Una propuesta individual del comité, ya proyectada a lo que necesita la vista. */
export type PropuestaTrazabilidad = {
  id: string;
  autor: string;
  valorArs: number | null;
  valorUsd: number | null;
  /** Nota justificativa (TSK-110) o las notas libres de la propuesta. */
  nota: string | null;
  /** true si la propuesta quedó firmada al cerrar el comité (RG-009). */
  firmada: boolean;
};

/** Entradas crudas (lo que ya tiene la page del RSC) para armar el modelo. */
export type TrazabilidadInput = {
  valorFittServiniArs: number | null;
  valorRobotomusArs: number | null;
  valorFinalArs: number | null;
  valorFinalUsd: number | null;
  cierreAt: string | null;
  propuestas: ReadonlyArray<{
    id: string;
    valor_ars: number | null;
    valor_usd: number | null;
    notas?: string | null;
    nota_justificativa?: string | null;
    firmado_en?: string | null;
    tasador?: { nombre?: string | null; apellido?: string | null } | null;
  }>;
};

/** Modelo de los 4 componentes, listo para render. */
export type TrazabilidadModel = {
  valorTecnicoArs: number | null;
  valorRobotomusArs: number | null;
  propuestas: ReadonlyArray<PropuestaTrazabilidad>;
  valorFinalArs: number | null;
  valorFinalUsd: number | null;
  cerrado: boolean;
};

/** Nombre visible de una propuesta a partir de su tasador (fallback genérico). */
function nombreAutor(
  tasador?: { nombre?: string | null; apellido?: string | null } | null,
): string {
  const nombre = [tasador?.nombre, tasador?.apellido].filter(Boolean).join(' ').trim();
  return nombre || 'Miembro del comité';
}

/**
 * Arma el modelo de trazabilidad (los 4 componentes) a partir de los datos
 * crudos del RSC. Función PURA: no toca red ni cache, así se testea aislada.
 */
export function construirTrazabilidad(input: TrazabilidadInput): TrazabilidadModel {
  return {
    valorTecnicoArs: input.valorFittServiniArs,
    valorRobotomusArs: input.valorRobotomusArs,
    propuestas: input.propuestas.map((p) => ({
      id: p.id,
      autor: nombreAutor(p.tasador),
      valorArs: p.valor_ars,
      valorUsd: p.valor_usd,
      // La nota justificativa (BR-038) prima sobre las notas libres si existe.
      nota: p.nota_justificativa?.trim() || p.notas?.trim() || null,
      firmada: p.firmado_en != null,
    })),
    valorFinalArs: input.valorFinalArs,
    valorFinalUsd: input.valorFinalUsd,
    cerrado: input.cierreAt != null,
  };
}

/** Render de una fila "insumo → valor" con fallback "Pendiente" cuando es null. */
function FilaInsumo({
  etiqueta,
  origen,
  valorArs,
}: {
  etiqueta: string;
  origen: string;
  valorArs: number | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-md py-sm border-b border-line-soft last:border-b-0">
      <div>
        <div className="text-ds-sm font-medium text-ink-primary">{etiqueta}</div>
        <div className="text-ds-xs text-ink-muted2">{origen}</div>
      </div>
      <div
        className={`text-ds-sm tabular-nums ${
          valorArs != null ? 'font-medium text-ink-primary' : 'text-ink-muted2 italic'
        }`}
      >
        {valorArs != null ? formatMoney(valorArs, 'ARS') : 'Pendiente'}
      </div>
    </div>
  );
}

/**
 * Componente de display de la trazabilidad del valor (4 componentes). Recibe el
 * modelo ya armado; se renderiza como sub-bloque del RSC de detalle.
 */
export default function TrazabilidadValor({ model }: { model: TrazabilidadModel }) {
  return (
    <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
      <h2 className="text-ds-lg font-semibold text-ink-primary mb-xs">
        Trazabilidad del valor
      </h2>
      <p className="text-ds-xs text-ink-muted2 mb-lg">
        Insumos que alimentan el valor final de la tasación (AC-016 / DS-12).
      </p>

      {/* (a) y (b): los dos índices automáticos. */}
      <div className="mb-lg">
        <FilaInsumo
          etiqueta="Valor técnico (Fitt-Servini)"
          origen="Cálculo determinístico del Colegio"
          valorArs={model.valorTecnicoArs}
        />
        <FilaInsumo
          etiqueta="Valor Robotomus"
          origen="Motor IA de mercado · mock (DS-11)"
          valorArs={model.valorRobotomusArs}
        />
      </div>

      {/* (c): propuestas individuales del comité (Planning Poker, DS-12). */}
      <div className="mb-lg">
        <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide mb-sm">
          Propuestas del comité ({model.propuestas.length})
        </div>
        {model.propuestas.length > 0 ? (
          <ul className="space-y-sm">
            {model.propuestas.map((p) => (
              <li
                key={p.id}
                className="border border-line-soft rounded-md p-md bg-surface-pageAlt"
              >
                <div className="flex items-baseline justify-between gap-md">
                  <span className="text-ds-sm font-medium text-ink-primary">
                    {p.autor}
                    {p.firmada && (
                      <span className="text-ds-xs text-status-successText ml-sm">
                        ✓ firmada
                      </span>
                    )}
                  </span>
                  <span className="text-ds-sm text-ink-primary tabular-nums">
                    {formatMoney(p.valorArs, 'ARS')} · {formatMoney(p.valorUsd, 'USD')}
                  </span>
                </div>
                {p.nota && (
                  <p className="text-ds-xs text-ink-muted2 mt-xs whitespace-pre-wrap">
                    {p.nota}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ds-sm text-ink-muted2 italic">
            Sin propuestas registradas todavía.
          </p>
        )}
      </div>

      {/* (d): valor final definido al cerrar el comité. */}
      <div className="pt-lg border-t border-line-soft">
        <div className="flex items-baseline justify-between gap-md">
          <div>
            <div className="text-ds-sm font-semibold text-ink-primary">Valor final definido</div>
            <div className="text-ds-xs text-ink-muted2">
              {model.cerrado ? 'Cerrado por el comité' : 'El comité todavía no cerró el valor'}
            </div>
          </div>
          <div
            className={`text-ds-md tabular-nums ${
              model.cerrado ? 'font-bold text-ink-primary' : 'text-ink-muted2 italic'
            }`}
          >
            {model.cerrado
              ? `${formatMoney(model.valorFinalArs, 'ARS')} · ${formatMoney(model.valorFinalUsd, 'USD')}`
              : 'Pendiente'}
          </div>
        </div>
      </div>
    </section>
  );
}
