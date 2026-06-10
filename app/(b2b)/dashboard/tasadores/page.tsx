import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { tipoLabels } from '@/lib/labels';
import {
  listarTasadoresDeEntidad,
  TasadoresQueryError,
  type TasadorFicha,
} from './queries';

/**
 * TSK-121 (RF-026, BR-039) — vista de tasadores de la entidad activa con su
 * especialidad y ficha, para que el admin decida asignaciones.
 *
 * Gating: solo el rol 'admin' de la entidad ve esta vista (la RPC
 * `listar_miembros_entidad` ya es admin-gated server-side; acá replicamos el
 * gate en UI para no exponer la pantalla a tasadores/solicitantes).
 */
export default async function TasadoresPage() {
  const membresia = await getMembresiaActiva();

  if (!membresia) {
    return (
      <Panel
        titulo="Sin organización activa"
        cuerpo="Tu cuenta no tiene una entidad asociada todavía."
      />
    );
  }

  if (!membresia.roles.includes('admin')) {
    return (
      <Panel
        titulo="Acceso restringido"
        cuerpo="Solo el administrador de la organización puede ver el panel de tasadores y sus especialidades."
      />
    );
  }

  const supabase = await createClient();

  let tasadores: TasadorFicha[] = [];
  let errorMsg: string | null = null;
  try {
    tasadores = await listarTasadoresDeEntidad(supabase, membresia.entidad.id);
  } catch (e) {
    errorMsg =
      e instanceof TasadoresQueryError
        ? e.message
        : 'Ocurrió un error al cargar los tasadores.';
  }

  return (
    <div className="max-w-5xl space-y-2xl">
      <div>
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          Administración de entidad
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Tasadores
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          Tasadores de{' '}
          <span className="font-medium text-ink-primary">
            {membresia.entidad.nombre}
          </span>{' '}
          con su matrícula y especialidades, para decidir asignaciones.
        </p>
      </div>

      {errorMsg && (
        <div className="px-lg py-md rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && tasadores.length === 0 ? (
        <div className="bg-surface-card border border-line-soft rounded-xl shadow-card px-lg py-4xl text-center">
          <div className="text-ds-md text-ink-muted2">
            No hay tasadores en esta entidad todavía.
          </div>
          <div className="text-ds-sm text-ink-muted mt-xs">
            Agregá tasadores desde la sección de miembros.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          {tasadores.map((t) => (
            <TasadorCard key={t.userId} tasador={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TasadorCard({ tasador }: { tasador: TasadorFicha }) {
  const nombre =
    [tasador.nombre, tasador.apellido].filter(Boolean).join(' ').trim() ||
    tasador.email ||
    'Tasador sin nombre';

  return (
    <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-lg space-y-md">
      <div>
        <div className="text-ds-lg font-semibold text-ink-primary">{nombre}</div>
        {tasador.email && (
          <div className="text-ds-sm text-ink-muted2">{tasador.email}</div>
        )}
      </div>

      <div className="flex items-center gap-xs text-ds-sm">
        <span className="text-ink-muted2">Matrícula:</span>
        <span className="font-medium text-ink-primary">
          {tasador.matricula ?? 'Sin matrícula'}
        </span>
      </div>

      <div>
        <div className="text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide mb-xs">
          Especialidades
        </div>
        {tasador.especialidades.length === 0 ? (
          <span className="text-ds-sm text-ink-muted">
            Sin especialidades cargadas
          </span>
        ) : (
          <div className="flex flex-wrap gap-xs">
            {tasador.especialidades.map((tipo) => (
              <span
                key={tipo}
                className="px-sm py-xs rounded-md bg-status-successSoft text-status-success text-ds-xs font-medium"
              >
                {tipoLabels[tipo]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return (
    <div className="max-w-3xl">
      <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h1 className="text-ds-2xl font-bold text-ink-primary">{titulo}</h1>
        <p className="text-ds-md text-ink-muted2 mt-sm">{cuerpo}</p>
      </div>
    </div>
  );
}
