'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { traducirError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

export type InvitarState = {
  error?: string;
  ok?: boolean;
  email?: string;
};

// TSK-150: validación de email con Zod en el borde, ANTES de pegarle al backend.
// Normalizamos a minúsculas y sin espacios para deduplicar invitaciones.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresá un email válido.');

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

  // TSK-150: validar con Zod ANTES de invitar. Si es inválido, cortamos acá
  // sin tocar el backend (evita un round-trip y un 422 evitable).
  const parsed = emailSchema.safeParse(formData.get('email') ?? '');
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ingresá un email válido.' };
  }
  const email = parsed.data;

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
    // TSK-150: el 422 de inviteUserByEmail típicamente significa que el email
    // ya tiene cuenta o invitación pendiente. Mensaje específico para ese caso.
    if (error.status === 422) {
      return { error: 'Ese email ya tiene una invitación o cuenta.' };
    }
    // Para el resto, traducimos vía helper compartido (RLS, errcodes conocidos);
    // si no matchea, cae al fallback genérico. Concatenamos al prefijo de acción.
    const { mensaje } = traducirError(error);
    return { error: `No se pudo enviar la invitación: ${mensaje}` };
  }

  revalidatePath('/dashboard/invitar');
  return { ok: true, email };
}
