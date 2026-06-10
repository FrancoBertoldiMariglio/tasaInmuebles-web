import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { TipoInmueble } from '@/lib/labels';

/**
 * TSK-121 (RF-026, BR-039) — datos para la vista de tasadores de la entidad.
 *
 * Esta capa es una función pura testeable: recibe el client de Supabase + el id
 * de entidad activa y devuelve los tasadores de esa entidad con su ficha y sus
 * especialidades, listos para que el admin decida asignaciones.
 *
 * Fuentes de datos (contratos backend que NO se modifican):
 *   - RPC `listar_miembros_entidad(_entidad)` (TSK-43, SECURITY DEFINER,
 *     admin-gated): roster de miembros con nombre/apellido/email/matrícula/roles.
 *     Se filtra al rol 'tasador'. La RLS de `profiles` impide al admin de
 *     entidad leer esos profiles por join directo; por eso pasa por la RPC.
 *   - Tabla `tasador_especialidades` (TSK-108, Q-18): N:M user ↔ tipo_inmueble.
 *     Su policy `tasador_especialidades_read` autoriza al admin de la entidad a
 *     leer las filas de sus miembros, así que se consulta directo (no por RPC).
 */

export type TasadorFicha = {
  userId: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  matricula: string | null;
  especialidades: TipoInmueble[];
};

type Client = SupabaseClient<Database>;

type MiembroRow =
  Database['public']['Functions']['listar_miembros_entidad']['Returns'][number];

type EspecialidadRow = { user_id: string; tipo: TipoInmueble };

export class TasadoresQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TasadoresQueryError';
  }
}

/**
 * Devuelve los tasadores de la entidad con ficha + especialidades, ordenados
 * por apellido/nombre. Lanza `TasadoresQueryError` ante cualquier fallo de las
 * fuentes (RPC o tabla) para que la RSC pueda mostrar un error explícito en vez
 * de degradar silenciosamente a "lista vacía".
 */
export async function listarTasadoresDeEntidad(
  supabase: Client,
  entidadId: string,
): Promise<TasadorFicha[]> {
  const { data: miembros, error: errMiembros } = await supabase.rpc(
    'listar_miembros_entidad',
    { _entidad: entidadId },
  );

  if (errMiembros) {
    throw new TasadoresQueryError(
      `No se pudieron cargar los miembros: ${errMiembros.message}`,
    );
  }

  const tasadores = (miembros ?? []).filter((m: MiembroRow) =>
    (m.roles ?? []).includes('tasador'),
  );

  if (tasadores.length === 0) return [];

  const userIds = tasadores.map((m) => m.user_id);

  // `tasador_especialidades` (TSK-108): la RLS `tasador_especialidades_read`
  // autoriza al admin de la entidad a leer las filas de sus miembros.
  const { data: especialidades, error: errEsp } = await supabase
    .from('tasador_especialidades')
    .select('user_id, tipo')
    .in('user_id', userIds);

  if (errEsp) {
    throw new TasadoresQueryError(
      `No se pudieron cargar las especialidades: ${errEsp.message}`,
    );
  }

  // Agrupar especialidades por tasador (inmutable: se arma un Map nuevo).
  const porTasador = new Map<string, TipoInmueble[]>();
  for (const fila of especialidades ?? []) {
    const previas = porTasador.get(fila.user_id) ?? [];
    porTasador.set(fila.user_id, [...previas, fila.tipo]);
  }

  const fichas: TasadorFicha[] = tasadores.map((m) => ({
    userId: m.user_id,
    nombre: m.nombre,
    apellido: m.apellido,
    email: m.email,
    matricula: m.matricula,
    especialidades: porTasador.get(m.user_id) ?? [],
  }));

  return [...fichas].sort((a, b) => {
    const claveA = `${a.apellido ?? ''} ${a.nombre ?? ''}`.trim().toLowerCase();
    const claveB = `${b.apellido ?? ''} ${b.nombre ?? ''}`.trim().toLowerCase();
    return claveA.localeCompare(claveB, 'es');
  });
}
