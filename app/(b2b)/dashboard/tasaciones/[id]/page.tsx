import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  estadoLabels,
  estadoStyles,
  tipoLabels,
  motivoLabels,
  estadoConservacionLabels,
  TIPOS_SIN_AMBIENTES,
  type EstadoTasacion,
  type TipoInmueble,
  type MotivoTasacion,
  type EstadoConservacion,
} from '@/lib/labels';

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatArs(value: number | null): string {
  if (value == null || value <= 0) return '$ 0';
  return `$ ${value.toLocaleString('es-AR')}`;
}

function formatUsd(value: number | null): string {
  if (value == null || value <= 0) return 'USD 0';
  return `USD ${value.toLocaleString('es-AR')}`;
}

function formatArsMuestra(value: number | null): string {
  const n = value ?? 0;
  return `$${n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUsdMuestra(value: number | null): string {
  const n = value ?? 0;
  return `USD ${n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function TasacionDetallePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tasacion, error } = await supabase
    .from('tasaciones')
    .select(`
      *,
      solicitante:solicitantes(*),
      tasador:profiles!tasaciones_tasador_id_fkey(nombre, apellido, email, matricula),
      entidad:entidades(nombre, tipo)
    `)
    .eq('id', id)
    .single();

  if (error || !tasacion) {
    return (
      <div className="max-w-3xl">
        <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h1 className="text-ds-2xl font-bold text-ink-primary">
            Tasación no encontrada
          </h1>
          <p className="text-ds-md text-ink-muted2 mt-sm">
            No pudimos encontrar la tasación solicitada, o no tenés permisos para verla.
          </p>
          <Link
            href="/dashboard/tasaciones"
            className="inline-block mt-lg px-lg py-sm rounded-md bg-brand-primary text-ink-onDark text-ds-sm font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base"
          >
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const estado = tasacion.estado as EstadoTasacion;
  const tipo = tasacion.tipo as TipoInmueble;
  const motivo = tasacion.motivo as MotivoTasacion;
  const conservacion = tasacion.estado_conservacion as EstadoConservacion | null;
  const numero = String(tasacion.numero).padStart(4, '0');
  const muestraAmbientes = !TIPOS_SIN_AMBIENTES.has(tipo);

  const tasadorNombre = tasacion.tasador
    ? [tasacion.tasador.nombre, tasacion.tasador.apellido].filter(Boolean).join(' ').trim()
    : '';
  const solicitanteNombre = tasacion.solicitante
    ? [tasacion.solicitante.nombre, tasacion.solicitante.apellido].filter(Boolean).join(' ').trim()
    : '';

  return (
    <div className="max-w-5xl space-y-xl">
      <nav className="text-ds-sm text-ink-muted2">
        <Link href="/dashboard/tasaciones" className="hover:text-ink-primary">
          Tasaciones
        </Link>
        <span className="mx-xs">›</span>
        <span className="text-ink-primary">#{numero}</span>
      </nav>

      <header className="flex items-start justify-between gap-lg">
        <div>
          <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight">
            Tasación #{numero}
          </h1>
          <p className="text-ds-lg text-ink-muted2 mt-sm">
            {tasacion.domicilio ?? 'Sin domicilio cargado'}
          </p>
        </div>
        <span
          className={`inline-block px-md py-xs rounded-full text-ds-xs font-medium whitespace-nowrap ${
            estadoStyles[estado] ?? 'bg-line-soft text-ink-muted2'
          }`}
        >
          {estadoLabels[estado] ?? estado}
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
        <section className="lg:col-span-2 bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">Detalles</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
            <Field
              label="Fecha alta"
              value={new Date(tasacion.created_at).toLocaleDateString('es-AR')}
            />
            <Field label="Tipo de inmueble" value={tipoLabels[tipo] ?? tipo} />
            <Field label="Motivo" value={motivoLabels[motivo] ?? motivo} />
            <Field label="Domicilio" value={tasacion.domicilio ?? '—'} />
            <Field
              label="Tasador asignado"
              value={tasadorNombre || 'Sin asignar'}
              muted={!tasadorNombre}
            />
            <Field
              label="Solicitante"
              value={solicitanteNombre || '—'}
              muted={!solicitanteNombre}
            />
          </dl>
        </section>

        <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">Valoración</h2>
          <div className="grid grid-cols-2 gap-lg">
            <div>
              <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Valor AR$
              </div>
              <div className="text-ds-xl font-bold text-ink-primary tabular-nums mt-xs">
                {formatArs(tasacion.valor_ars)}
              </div>
            </div>
            <div>
              <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Valor USD
              </div>
              <div className="text-ds-xl font-bold text-ink-primary tabular-nums mt-xs">
                {formatUsd(tasacion.valor_usd)}
              </div>
            </div>
          </div>
          {(tasacion.valor_fitt_servini_ars != null ||
            tasacion.valor_robotomus_ars != null) && (
            <>
              <hr className="my-lg border-line-soft" />
              <dl className="space-y-sm">
                {tasacion.valor_fitt_servini_ars != null && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ds-sm text-ink-muted2">Valor técnico (Fitt-Servini)</dt>
                    <dd className="text-ds-sm font-medium text-ink-primary tabular-nums">
                      {formatArs(tasacion.valor_fitt_servini_ars)}
                    </dd>
                  </div>
                )}
                {tasacion.valor_robotomus_ars != null && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ds-sm text-ink-muted2">Valor Robotomus</dt>
                    <dd className="text-ds-sm font-medium text-ink-primary tabular-nums">
                      {formatArs(tasacion.valor_robotomus_ars)}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </section>
      </div>

      <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">Inmueble</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-lg">
          <Field
            label="Sup. total m²"
            value={tasacion.sup_total != null ? `${tasacion.sup_total} m²` : '—'}
            muted={tasacion.sup_total == null}
          />
          <Field
            label="Sup. cubierta m²"
            value={tasacion.sup_cubierta != null ? `${tasacion.sup_cubierta} m²` : '—'}
            muted={tasacion.sup_cubierta == null}
          />
          <Field
            label="Antigüedad"
            value={
              tasacion.antiguedad_anios != null
                ? `${tasacion.antiguedad_anios} año${tasacion.antiguedad_anios === 1 ? '' : 's'}`
                : '—'
            }
            muted={tasacion.antiguedad_anios == null}
          />
          {muestraAmbientes && (
            <>
              <Field
                label="Dormitorios"
                value={tasacion.dormitorios != null ? String(tasacion.dormitorios) : '—'}
                muted={tasacion.dormitorios == null}
              />
              <Field
                label="Baños"
                value={tasacion.banios != null ? String(tasacion.banios) : '—'}
                muted={tasacion.banios == null}
              />
            </>
          )}
          <Field
            label="Estado de conservación"
            value={
              conservacion
                ? estadoConservacionLabels[conservacion] ?? conservacion
                : '—'
            }
            muted={!conservacion}
          />
        </dl>

        {tasacion.amenities && tasacion.amenities.length > 0 && (
          <div className="mt-lg pt-lg border-t border-line-soft">
            <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide mb-sm">
              Amenities
            </div>
            <div className="flex flex-wrap gap-xs">
              {tasacion.amenities.map((a) => (
                <span
                  key={a}
                  className="inline-block px-md py-xs rounded-full bg-surface-pageAlt text-ds-xs text-ink-primary border border-line-soft"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">Descripción</h2>
        {tasacion.descripcion ? (
          <p className="text-ds-md text-ink-primary whitespace-pre-wrap leading-relaxed">
            {tasacion.descripcion}
          </p>
        ) : (
          <p className="text-ds-md text-ink-muted2 italic">Sin descripción</p>
        )}
      </section>

      <section className="bg-status-successSoft border border-status-success/30 rounded-xl p-xl">
        <div className="flex items-center gap-sm mb-md">
          <span className="text-ds-2xl" aria-hidden>🤖</span>
          <div>
            <h2 className="text-ds-lg font-semibold text-ink-primary">Robotomus</h2>
            <p className="text-ds-xs text-ink-muted2">en desarrollo · valor de muestra</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-lg">
          <div className="border border-dashed border-status-success/50 rounded-md p-md bg-surface-card/50">
            <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
              AR$
            </div>
            <div className="text-ds-lg font-bold text-ink-primary tabular-nums mt-xs">
              {formatArsMuestra(tasacion.valor_robotomus_ars)}
            </div>
          </div>
          <div className="border border-dashed border-status-success/50 rounded-md p-md bg-surface-card/50">
            <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
              USD
            </div>
            <div className="text-ds-lg font-bold text-ink-primary tabular-nums mt-xs">
              {formatUsdMuestra(null)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">PDF / Compartir</h2>
        {tasacion.pdf_url ? (
          <a
            href={tasacion.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-lg py-sm rounded-md bg-brand-primary text-ink-onDark text-ds-sm font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base"
          >
            Descargar PDF
          </a>
        ) : (
          <p className="text-ds-md text-ink-muted2 italic">PDF no generado todavía</p>
        )}
      </section>

      <div className="pt-lg">
        <Link
          href="/dashboard/tasaciones"
          className="inline-block px-lg py-sm rounded-md border border-line-soft bg-surface-card text-ink-primary text-ds-sm font-semibold hover:bg-surface-pageAlt transition-colors duration-base"
        >
          ← Volver al listado
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
        {label}
      </dt>
      <dd className={`text-ds-md mt-xs ${muted ? 'text-ink-muted2 italic' : 'text-ink-primary'}`}>
        {value}
      </dd>
    </div>
  );
}
