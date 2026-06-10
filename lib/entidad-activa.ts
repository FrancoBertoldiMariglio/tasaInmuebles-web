import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient, getUserCached } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

const COOKIE_NAME = 'entidad_activa';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

type EntidadRow = Database['public']['Tables']['entidades']['Row'];
type Rol = Database['public']['Enums']['rol_entidad_miembro'];

export type Membresia = {
  entidad: Pick<EntidadRow, 'id' | 'nombre' | 'tipo'>;
  roles: Rol[];
};

/**
 * Lista las entidades a las que pertenece el user autenticado, con sus roles.
 * Devuelve [] si no hay sesión o si no tiene membresías (caso edge).
 *
 * TSK-86: envuelta en React `cache()` para deduplicar por request. El layout
 * B2B y varias pages la invocan (directa o indirectamente vía
 * getEntidadActivaId/getMembresiaActiva); sin cache cada llamada disparaba un
 * getUser() + un SELECT a entidad_miembros (2 round-trips a Supabase c/u).
 */
export const listarMembresias = cache(
  async (): Promise<Membresia[]> => {
    const user = await getUserCached();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('entidad_miembros')
      .select('roles, entidad:entidades(id, nombre, tipo)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    // TSK-149: un fallo de RLS o de red acá dejaba [] silencioso y la UI
    // renderizaba "sin entidades" sin rastro. Logueamos antes de degradar el
    // retorno (seguimos devolviendo [] para no romper el render). console.error
    // porque el repo no tiene logger configurado y esto es un error real.
    if (error || !data) {
      console.error('[entidad-activa] listarMembresias falló', {
        code: error?.code,
        message: error?.message,
        userId: user.id,
      });
      return [];
    }

    return data
      .filter((m): m is typeof m & { entidad: NonNullable<typeof m.entidad> } =>
        m.entidad != null,
      )
      .map((m) => ({ entidad: m.entidad, roles: m.roles as Rol[] }));
  },
);

/**
 * Devuelve el id de entidad activa para el user actual.
 * Prioridad:
 *   1. Cookie `entidad_activa` si apunta a una entidad de la que es miembro.
 *   2. Primera entidad por orden de membresía (la más antigua).
 *   3. null si no tiene ninguna.
 */
export const getEntidadActivaId = cache(
  async (): Promise<string | null> => {
    const membresias = await listarMembresias();
    if (membresias.length === 0) return null;

    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
    if (cookieValue && membresias.some((m) => m.entidad.id === cookieValue)) {
      return cookieValue;
    }

    return membresias[0].entidad.id;
  },
);

/**
 * Devuelve la membresía activa completa (entidad + roles) para el user actual.
 * Útil para gating de UI: si tiene rol 'admin' o 'tasador' ve todo lo de la
 * entidad; 'solicitante' ve solo lo suyo (RLS BR-033 lo enforça server-side).
 */
export async function getMembresiaActiva(): Promise<Membresia | null> {
  const membresias = await listarMembresias();
  if (membresias.length === 0) return null;

  const activaId = await getEntidadActivaId();
  return membresias.find((m) => m.entidad.id === activaId) ?? membresias[0];
}

/**
 * Setea la entidad activa en cookie. Llamado por el selector (server action).
 * Valida que el user sea miembro antes de aceptar el cambio.
 */
export async function setEntidadActiva(entidadId: string): Promise<boolean> {
  const membresias = await listarMembresias();
  if (!membresias.some((m) => m.entidad.id === entidadId)) {
    // TSK-149: el rechazo de cambio de entidad activa también era silencioso.
    // Puede ser un intento legítimo fallido (membresía revocada) o un fallo
    // previo de listarMembresias que devolvió [] por RLS/red. Lo dejamos rastro
    // sin cambiar el retorno (sigue devolviendo false).
    const user = await getUserCached();
    console.error('[entidad-activa] setEntidadActiva rechazado: user no es miembro', {
      entidadId,
      userId: user?.id ?? null,
      membresiasCount: membresias.length,
    });
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, entidadId, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return true;
}
