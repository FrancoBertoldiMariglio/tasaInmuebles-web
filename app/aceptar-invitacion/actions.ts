'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { traducirError } from '@/lib/errors';

export type AceptarState = {
  error?: string;
  ok?: boolean;
};

/**
 * TSK-37 — Finaliza la aceptación de una invitación B2B.
 *
 * Precondición: el invitado ya verificó el token (verifyOtp en el cliente),
 * por lo que existe una sesión SSR válida. Acá:
 *  1. Crea el vínculo entidad_miembros (rol solicitante por default dentro de
 *     la entidad) usando el entidad_id que viajó en el metadata de la invitación.
 *  2. Recién después actualiza la contraseña del usuario.
 *
 * El orden importa: si el vínculo falla (entidad borrada, FK rota, transitorio
 * de red), NO confirmamos la contraseña, evitando dejar la cuenta a medio-aceptar
 * (con password seteada pero sin membresía).
 *
 * El profile (rol cliente_b2b) ya fue creado por el trigger handle_new_user
 * al confirmarse el usuario. El insert de membresía usa service-role porque
 * el invitado todavía no tiene permisos RLS sobre entidad_miembros.
 */
export async function finalizarInvitacion(
  password: string,
): Promise<AceptarState> {
  if (!password || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Invitación inválida o expirada. Pedí una nueva invitación.' };
  }

  const entidadId = user.user_metadata?.entidad_id as string | undefined;
  if (!entidadId) {
    return { error: 'La invitación no tiene una entidad asociada.' };
  }

  // 1) Vincular a la entidad PRIMERO: si falla, no confirmamos la contraseña
  //    y la cuenta no queda en estado inconsistente (password sin membresía).
  const admin = createAdminClient();
  const { error: miembroError } = await admin
    .from('entidad_miembros')
    .upsert(
      { entidad_id: entidadId, user_id: user.id, roles: ['solicitante'] },
      { onConflict: 'entidad_id,user_id' },
    );

  if (miembroError) {
    // No exponer el mensaje crudo de Postgres (nombres de constraint/columna).
    return { error: `No se pudo vincularte a la entidad: ${traducirError(miembroError).mensaje}` };
  }

  // 2) Recién con la membresía garantizada, seteamos la contraseña.
  const { error: pwError } = await supabase.auth.updateUser({ password });
  if (pwError) {
    return { error: `No se pudo establecer la contraseña: ${pwError.message}` };
  }

  return { ok: true };
}
