import { createClient } from '@/lib/supabase/server';
import { getEntidadActivaId } from '@/lib/entidad-activa';

export default async function MetricasPage() {
  const supabase = await createClient();
  const entidadId = await getEntidadActivaId();

  if (!entidadId) {
    return (
      <div className="max-w-3xl">
        <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h1 className="text-ds-2xl font-bold text-ink-primary">
            Sin organización activa
          </h1>
          <p className="text-ds-md text-ink-muted2 mt-sm">
            No hay métricas que mostrar hasta que tu cuenta esté vinculada a
            una organización.
          </p>
        </div>
      </div>
    );
  }

  const { data: tasaciones } = await supabase
    .from('tasaciones')
    .select('estado, valor_usd, created_at')
    .eq('entidad_id', entidadId);

  const items = tasaciones ?? [];
  const total = items.length;
  const porEstado = items.reduce<Record<string, number>>((acc, t) => {
    const k = String(t.estado ?? 'sin_estado');
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const valorAgregadoUsd = items.reduce((acc, t) => acc + (t.valor_usd ?? 0), 0);
  const tasadas = porEstado['tasada'] ?? 0;
  const pctCierre = total > 0 ? Math.round((tasadas / total) * 100) : 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-3xl">
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          RF-023
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Métricas
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          KPIs del portafolio de tu organización.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-3xl">
        <Kpi
          label="Tasaciones totales"
          value={total.toString()}
          accent="bg-brand-primarySoft"
        />
        <Kpi
          label="Valor agregado"
          value={`USD ${valorAgregadoUsd.toLocaleString('es-AR')}`}
          accent="bg-status-successSoft"
        />
        <Kpi
          label="Tasa de cierre"
          value={`${pctCierre}%`}
          sub={`${tasadas} de ${total} tasadas`}
          accent="bg-status-infoSoft"
        />
      </div>

      <div className="bg-surface-card border border-line-soft rounded-xl p-xl shadow-card">
        <div className="text-ds-xs font-medium text-ink-muted uppercase tracking-wide mb-md">
          Distribución por estado
        </div>
        {Object.keys(porEstado).length === 0 ? (
          <div className="text-ds-md text-ink-muted2 py-lg">
            Sin datos todavía.
          </div>
        ) : (
          <div className="space-y-md">
            {Object.entries(porEstado).map(([estado, count]) => {
              const pct = (count / total) * 100;
              return (
                <div key={estado}>
                  <div className="flex justify-between text-ds-sm mb-xs">
                    <span className="text-ink-secondary capitalize">
                      {estado.replace(/_/g, ' ')}
                    </span>
                    <span className="text-ink-muted2 tabular-nums">
                      {count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-sm rounded-full bg-surface-pageAlt overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all duration-slow"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-surface-card border border-line-soft rounded-xl p-xl shadow-card">
      <div className="flex items-start justify-between">
        <div className="text-ds-xs font-medium text-ink-muted uppercase tracking-wide">
          {label}
        </div>
        <div className={`w-lg h-lg rounded-md ${accent}`} />
      </div>
      <div className="text-ds-3xl font-bold text-ink-primary mt-md tracking-tight">
        {value}
      </div>
      {sub && <div className="text-ds-sm text-ink-muted2 mt-xs">{sub}</div>}
    </div>
  );
}
