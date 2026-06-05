'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

type TipoEntidad = Database['public']['Enums']['tipo_entidad'];

export type InvitarState = {
  error?: string;
  ok?: boolean;
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * TSK-37 — El admin de una entidad invita por email a un nuevo miembro
 * cliente_b2b. Usa Supabase Auth inviteUserByEmail (requiere SERVICE-ROLE,
 * por eso corre en esta Server Action server-side; la key nunca llega al
 * cliente).
 *
 * Flujo:
 *  1. Verifica que el invitante esté autenticado y sea 'admin' de la entidad activa.
 *  2. Invita al email con metadata { rol: cliente_b2b, entidad_id }.
 *     - El trigger handle_new_user creará el profile con rol cliente_b2b
 *       cuando el invitado acepte.
 *     - El link de invitación redirige a /aceptar-invitacion, que finaliza
 *       la membresía (entidad_miembros) y el seteo de contraseña.
 */
export async function invitarMiembro(
  _prev: InvitarState,
  formData: FormData,
): Promise<InvitarState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sesión expirada. Volvé a iniciar sesión.' };

  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  if (!membresia.roles.includes('admin')) {
    return { error: 'Solo un administrador de la entidad puede invitar miembros.' };
  }

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { error: 'Ingresá un email válido.' };
  }

  const entidadId = membresia.entidad.id;
  const admin = createAdminClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      rol: 'cliente_b2b' satisfies Database['public']['Enums']['rol_usuario'],
      entidad_id: entidadId,
      entidad_nombre: membresia.entidad.nombre,
    },
    redirectTo: `${siteUrl}/aceptar-invitacion`,
  });

  if (error) {
    return { error: `No se pudo enviar la invitación: ${error.message}` };
  }

  revalidatePath('/dashboard/invitar');
  return { ok: true, email };
}

/**
 * Crea una entidad nueva (solo admin) y vincula al creador como admin.
 * Caso "entidad si no existe" del flujo de invitación: si el admin todavía
 * no tiene entidad, la crea acá antes de invitar a su equipo.
 */
export async function crearEntidad(
  _prev: InvitarState,
  formData: FormData,
): Promise<InvitarState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sesión expirada. Volvé a iniciar sesión.' };

  const nombre = (formData.get('nombre') as string)?.trim();
  const tipo = formData.get('tipo') as TipoEntidad;
  const cuit = (formData.get('cuit') as string)?.trim() || null;

  if (!nombre || nombre.length < 2) {
    return { error: 'Ingresá el nombre de la entidad.' };
  }

  const admin = createAdminClient();

  const { data: entidad, error: entidadError } = await admin
    .from('entidades')
    .insert({ nombre, tipo, cuit })
    .select('id')
    .single();

  if (entidadError || !entidad) {
    return { error: `No se pudo crear la entidad: ${entidadError?.message ?? 'desconocido'}` };
  }

  const { error: miembroError } = await admin
    .from('entidad_miembros')
    .insert({ entidad_id: entidad.id, user_id: user.id, roles: ['admin'] });

  if (miembroError) {
    return { error: `No se pudo vincularte a la entidad: ${miembroError.message}` };
  }

  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
