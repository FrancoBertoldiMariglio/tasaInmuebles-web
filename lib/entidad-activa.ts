import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
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
 */
export async function listarMembresias(): Promise<Membresia[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('entidad_miembros')
    .select('roles, entidad:entidades(id, nombre, tipo)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data
    .filter((m): m is typeof m & { entidad: NonNullable<typeof m.entidad> } =>
      m.entidad != null,
    )
    .map((m) => ({ entidad: m.entidad, roles: m.roles as Rol[] }));
}

/**
 * Devuelve el id de entidad activa para el user actual.
 * Prioridad:
 *   1. Cookie `entidad_activa` si apunta a una entidad de la que es miembro.
 *   2. Primera entidad por orden de membresía (la más antigua).
 *   3. null si no tiene ninguna.
 */
export async function getEntidadActivaId(): Promise<string | null> {
  const membresias = await listarMembresias();
  if (membresias.length === 0) return null;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieValue && membresias.some((m) => m.entidad.id === cookieValue)) {
    return cookieValue;
  }

  return membresias[0].entidad.id;
}

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
  if (!membresias.some((m) => m.entidad.id === entidadId)) return false;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, entidadId, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return true;
}
