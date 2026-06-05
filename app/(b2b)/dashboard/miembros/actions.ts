'use server';

import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

type RolMiembro = Database['public']['Enums']['rol_entidad_miembro'];

export type MiembrosActionState = {
  error?: string;
  ok?: string;
};

const ROLES_VALIDOS: RolMiembro[] = ['admin', 'tasador', 'solicitante'];

/**
 * Gating común: devuelve la entidad activa solo si el caller es admin de ella.
 * El enforce real vive en las RPCs SECURITY DEFINER; esto es defensa temprana
 * para evitar round-trips y dar mensajes claros en la UI.
 */
async function requireAdminEntidad(): Promise<
  { entidadId: string } | { error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sesión expirada. Volvé a iniciar sesión.' };

  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  if (!membresia.roles.includes('admin')) {
    return { error: 'Solo el administrador de la entidad puede gestionar miembros.' };
  }
  return { entidadId: membresia.entidad.id };
}

function parseRoles(formData: FormData): RolMiembro[] {
  return formData
    .getAll('roles')
    .map((r) => String(r))
    .filter((r): r is RolMiembro => ROLES_VALIDOS.includes(r as RolMiembro));
}

export async function agregarMiembro(
  _prev: MiembrosActionState,
  formData: FormData,
): Promise<MiembrosActionState> {
  const gate = await requireAdminEntidad();
  if ('error' in gate) return { error: gate.error };

  const email = String(formData.get('email') ?? '').trim();
  const roles = parseRoles(formData);

  if (!email || !email.includes('@')) return { error: 'Ingresá un email válido.' };
  if (roles.length === 0) return { error: 'Asigná al menos un rol.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('agregar_miembro_por_email', {
    _entidad: gate.entidadId,
    _email: email,
    _roles: roles,
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard/miembros');
  return { ok: `Miembro ${email} agregado.` };
}

export async function actualizarRoles(
  _prev: MiembrosActionState,
  formData: FormData,
): Promise<MiembrosActionState> {
  const gate = await requireAdminEntidad();
  if ('error' in gate) return { error: gate.error };

  const userId = String(formData.get('userId') ?? '');
  const roles = parseRoles(formData);

  if (!userId) return { error: 'Miembro inválido.' };
  if (roles.length === 0) return { error: 'Asigná al menos un rol.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('actualizar_roles_miembro', {
    _entidad: gate.entidadId,
    _user: userId,
    _roles: roles,
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard/miembros');
  return { ok: 'Roles actualizados.' };
}

export async function quitarMiembro(
  _prev: MiembrosActionState,
  formData: FormData,
): Promise<MiembrosActionState> {
  const gate = await requireAdminEntidad();
  if ('error' in gate) return { error: gate.error };

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { error: 'Miembro inválido.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('quitar_miembro_entidad', {
    _entidad: gate.entidadId,
    _user: userId,
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard/miembros');
  return { ok: 'Miembro dado de baja.' };
}
