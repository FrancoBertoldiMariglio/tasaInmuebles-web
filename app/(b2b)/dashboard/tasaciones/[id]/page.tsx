import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getEntidadActivaId, getMembresiaActiva } from '@/lib/entidad-activa';
import { fetchFotosTasacion } from '@/lib/queries/fotos';
import { formatMoney } from '@/lib/format';
import AsignarTasadorForm, { type TasadorOption } from './AsignarTasadorForm';
import {
  LiberarAlPoolForm,
  ReasignarTasadorForm,
} from './AccionesAsignacionForm';
import {
  estadoLabels,
  estadoStyles,
  tipoLabels,
  motivoLabels,
  estadoConservacionLabels,
  TIPOS_SIN_AMBIENTES,
  tasadorNombreDisplay,
  esEsperandoAsignacion,
  type EstadoTasacion,
  type TipoInmueble,
  type MotivoTasacion,
  type EstadoConservacion,
} from '@/lib/labels';

type PageProps = {
  params: Promise<{ id: string }>;
};

const cierreMetodoLabels: Record<string, string> = {
  fitt_servini: 'Valor técnico (Fitt-Servini)',
  override: 'Override manual',
  comite: 'Consenso del comité',
};

export default async function TasacionDetallePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const entidadId = await getEntidadActivaId();

  const { data: tasacion, error } = entidadId
    ? await supabase
        .from('tasaciones')
        .select(`
          *,
          solicitante:solicitantes(*),
          entidad:entidades(nombre, tipo)
        `)
        .eq('id', id)
        .eq('entidad_id', entidadId)
        .single()
    : { data: null, error: null };

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

  // TSK-146/WEB-02: Fotos, propuestas del comité (DS-12) y tasador asignado
  // (TSK-85) se cargan TODO en paralelo. Las tres consultas solo dependen de
  // `id`/`entidadId` (ya disponibles), no entre sí, así que no hay razón para
  // serializar: antes la RPC `tasadores_de_entidad` colgaba un round-trip extra
  // detrás del Promise.all. Un fallo de fotos no debe tumbar la página.
  //
  // TSK-85: el tasador asignado no se puede leer con join directo a profiles
  // (la RLS `profile_select` solo deja ver el propio profile). Lo resolvemos con
  // la RPC SECURITY DEFINER `tasadores_de_entidad`, que valida membresía en la
  // entidad y devuelve el display por tasación. Si la tasación no aparece
  // (tasador_id NULL, DS-22) → sin asignar.
  const [fotos, { data: propuestasRaw }, tasador] = await Promise.all([
    fetchFotosTasacion(id).catch(() => []),
    supabase
      .from('comite_propuestas')
      .select(`
        id, valor_ars, valor_usd, notas, created_at,
        tasador:profiles!comite_propuestas_tasador_id_fkey(nombre, apellido, matricula)
      `)
      .eq('tasacion_id', id)
      .order('created_at', { ascending: true }),
    entidadId
      ? supabase
          .rpc('tasadores_de_entidad', { _entidad: entidadId })
          .then(({ data }) => {
            const row = (data ?? []).find((r) => r.tasacion_id === id);
            return row
              ? {
                  user_id: row.user_id,
                  nombre: row.nombre,
                  apellido: row.apellido,
                  email: row.email,
                  matricula: row.matricula,
                }
              : null;
          })
      : Promise.resolve(null),
  ]);

  const propuestas = propuestasRaw ?? [];

  // TSK-91/BR-026: el admin de la entidad puede asignar un tasador a una
  // solicitud pendiente sin asignar (complementa el self-claim DS-22). Solo
  // visible para admin (mismo patrón de visibilidad que Miembros/Invitar). Los
  // tasadores del dropdown salen de listar_miembros_entidad (admin-gated).
  const membresia = await getMembresiaActiva();
  const esAdminEntidad = membresia?.roles.includes('admin') ?? false;

  // Una solicitud pendiente sin asignar admite dos caminos del admin: asignar a
  // mano (TSK-91) o liberar al pool (TSK-119, solo si todavía no está tomable —
  // la modalidad 'pool' la marca tomable al nacer, ahí no tiene sentido el botón).
  const pendienteSinAsignar =
    esAdminEntidad &&
    entidadId != null &&
    tasacion.estado === 'pendiente' &&
    tasacion.tasador_id == null;
  const puedeAsignar = pendienteSinAsignar;
  // `tomable` (TSK-107) todavía no está en `types/database.ts` regenerado en este
  // worktree; lo leemos con un cast puntual hasta el próximo gen:types.
  const tasacionTomable = (tasacion as { tomable?: boolean }).tomable === true;
  const puedeLiberar = pendienteSinAsignar && !tasacionTomable;

  // TSK-120/RF-027: la reasignación solo aplica a tasaciones EN PROCESO con un
  // tasador ya asignado (la RPC rechaza otros estados). Es un camino distinto al
  // de asignar/liberar (esos son sobre pendientes).
  const puedeReasignar =
    esAdminEntidad &&
    entidadId != null &&
    tasacion.estado === 'en_proceso' &&
    tasacion.tasador_id != null;

  // El dropdown de tasadores se necesita tanto para asignar como para reasignar.
  // listar_miembros_entidad NO expone la especialidad (BR-039), así que mostramos
  // todos los tasadores de la entidad y dejamos que la RPC rechace por
  // especialidad (errcode 23514, traducido por la action) — TSK-119.
  const necesitaTasadores = puedeAsignar || puedeReasignar;
  const tasadoresEntidad: TasadorOption[] = necesitaTasadores
    ? await (async () => {
        const { data } = await supabase.rpc('listar_miembros_entidad', {
          _entidad: entidadId as string,
        });
        return (data ?? [])
          .filter((m) => (m.roles as string[]).includes('tasador'))
          // En reasignación excluimos al tasador actual del dropdown (la RPC
          // igual rechaza "mismo tasador", pero no tiene sentido ofrecerlo).
          .filter((m) => m.user_id !== tasacion.tasador_id)
          .map((m) => ({
            userId: m.user_id,
            nombre:
              [m.nombre, m.apellido].filter(Boolean).join(' ').trim() || m.email,
          }));
      })()
    : [];

  const estado = tasacion.estado as EstadoTasacion;
  const tipo = tasacion.tipo as TipoInmueble;
  const motivo = tasacion.motivo as MotivoTasacion;
  const conservacion = tasacion.estado_conservacion as EstadoConservacion | null;
  const numero = String(tasacion.numero).padStart(4, '0');
  const muestraAmbientes = !TIPOS_SIN_AMBIENTES.has(tipo);

  const tasadorNombre = tasadorNombreDisplay(tasador);
  const tasadorMatricula = tasador?.matricula ?? null;
  const esperandoAsignacion = esEsperandoAsignacion(estado, tasador);
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

      {fotos.length > 0 && (
        <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">
            Fotos <span className="text-ink-muted2 font-normal">({fotos.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
            {fotos.map((foto) => (
              // TSK-148/WEB-04: next/image con `fill` sobre un contenedor
              // `relative aspect-square` reproduce el mismo cuadro que el <img>
              // anterior (w-full + aspect-square + object-cover). `sizes` cubre
              // el grid responsive (2/3/4 columnas) para servir el ancho justo.
              <div
                key={foto.id}
                className="relative w-full aspect-square rounded-md border border-line-soft bg-surface-pageAlt overflow-hidden"
              >
                <Image
                  src={foto.url}
                  alt={foto.descripcion ?? 'Foto del inmueble'}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

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
              label="Padrón inmobiliario"
              value={tasacion.padron_inmobiliario ?? '—'}
              muted={!tasacion.padron_inmobiliario}
            />
            <Field
              label="Coordenadas"
              value={
                tasacion.lat != null && tasacion.lng != null
                  ? `${tasacion.lat}, ${tasacion.lng}`
                  : '—'
              }
              muted={tasacion.lat == null || tasacion.lng == null}
            />
            <div>
              <dt className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Tasador asignado
              </dt>
              <dd className="text-ds-md mt-xs">
                {tasadorNombre ? (
                  <span className="text-ink-primary">
                    {tasadorNombre}
                    {tasadorMatricula && (
                      <span className="text-ds-xs text-ink-muted2 ml-sm">
                        Mat. {tasadorMatricula}
                      </span>
                    )}
                  </span>
                ) : esperandoAsignacion ? (
                  <span className="inline-block px-md py-xs rounded-full text-ds-xs font-medium bg-status-warningSoft text-status-warningText">
                    Esperando asignación
                  </span>
                ) : (
                  <span className="text-ink-muted2 italic">Sin asignar</span>
                )}
              </dd>
              {puedeAsignar && (
                <AsignarTasadorForm tasacionId={id} tasadores={tasadoresEntidad} />
              )}
              {puedeLiberar && <LiberarAlPoolForm tasacionId={id} />}
              {puedeReasignar && (
                <ReasignarTasadorForm tasacionId={id} tasadores={tasadoresEntidad} />
              )}
            </div>
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
                {formatMoney(tasacion.valor_ars, 'ARS')}
              </div>
            </div>
            <div>
              <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Valor USD
              </div>
              <div className="text-ds-xl font-bold text-ink-primary tabular-nums mt-xs">
                {formatMoney(tasacion.valor_usd, 'USD')}
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
                      {formatMoney(tasacion.valor_fitt_servini_ars, 'ARS')}
                    </dd>
                  </div>
                )}
                {tasacion.valor_robotomus_ars != null && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ds-sm text-ink-muted2">Valor Robotomus</dt>
                    <dd className="text-ds-sm font-medium text-ink-primary tabular-nums">
                      {formatMoney(tasacion.valor_robotomus_ars, 'ARS')}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
          {tasacion.cierre_at != null && (
            <>
              <hr className="my-lg border-line-soft" />
              <dl className="space-y-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-ds-sm text-ink-muted2">Cierre del comité</dt>
                  <dd className="text-ds-sm font-medium text-ink-primary">
                    {new Date(tasacion.cierre_at).toLocaleDateString('es-AR')}
                  </dd>
                </div>
                {tasacion.cierre_metodo && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ds-sm text-ink-muted2">Método</dt>
                    <dd className="text-ds-sm font-medium text-ink-primary">
                      {cierreMetodoLabels[tasacion.cierre_metodo] ?? tasacion.cierre_metodo}
                    </dd>
                  </div>
                )}
                {tasacion.cierre_motivo && (
                  <p className="text-ds-xs text-ink-muted2 italic pt-xs">
                    {tasacion.cierre_motivo}
                  </p>
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

      <section className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h2 className="text-ds-lg font-semibold text-ink-primary mb-lg">
          Comité de tasación{' '}
          <span className="text-ink-muted2 font-normal">
            ({propuestas.length} propuesta{propuestas.length === 1 ? '' : 's'})
          </span>
        </h2>
        {propuestas.length > 0 ? (
          <ul className="space-y-md">
            {propuestas.map((p) => {
              const nombre = [p.tasador?.nombre, p.tasador?.apellido]
                .filter(Boolean)
                .join(' ')
                .trim();
              return (
                <li
                  key={p.id}
                  className="border border-line-soft rounded-md p-lg bg-surface-pageAlt"
                >
                  <div className="flex items-baseline justify-between gap-md">
                    <div className="text-ds-md font-medium text-ink-primary">
                      {nombre || 'Miembro del comité'}
                      {p.tasador?.matricula && (
                        <span className="text-ds-xs text-ink-muted2 ml-sm">
                          Mat. {p.tasador.matricula}
                        </span>
                      )}
                    </div>
                    <div className="text-ds-xs text-ink-muted2">
                      {new Date(p.created_at).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <div className="flex gap-xl mt-sm">
                    <span className="text-ds-sm text-ink-primary tabular-nums">
                      {formatMoney(p.valor_ars, 'ARS')}
                    </span>
                    <span className="text-ds-sm text-ink-primary tabular-nums">
                      {formatMoney(p.valor_usd, 'USD')}
                    </span>
                  </div>
                  {p.notas && (
                    <p className="text-ds-sm text-ink-muted2 mt-sm whitespace-pre-wrap">
                      {p.notas}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ds-md text-ink-muted2 italic">
            Sin propuestas registradas todavía.
          </p>
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
              {formatMoney(tasacion.valor_robotomus_ars, 'ARS')}
            </div>
          </div>
          <div className="border border-dashed border-status-success/50 rounded-md p-md bg-surface-card/50">
            <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
              USD
            </div>
            <div className="text-ds-lg font-bold text-ink-primary tabular-nums mt-xs">
              {formatMoney(null, 'USD')}
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
