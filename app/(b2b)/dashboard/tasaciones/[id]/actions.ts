'use server';

import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { traducirError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export type AsignarTasadorState = {
  /** Mensaje de error ya traducido a español (listo para render). */
  error?: string;
  /** Título corto del error traducido (para destacar el motivo). */
  errorTitulo?: string;
  ok?: string;
};

/**
 * TSK-91 / BR-026: el admin de la entidad asigna un tasador a una solicitud B2B
 * pendiente. El enforce real (admin de entidad, tasador de la misma entidad,
 * claim atómico) vive en la RPC SECURITY DEFINER asignar_tasador_a_tasacion;
 * acá hacemos gating temprano para mensajes claros y evitar round-trips.
 * Complementa el self-claim DS-22 — no prioriza un camino sobre el otro.
 */
export async function asignarTasador(
  _prev: AsignarTasadorState,
  formData: FormData,
): Promise<AsignarTasadorState> {
  const tasacionId = String(formData.get('tasacionId') ?? '').trim();
  const tasadorId = String(formData.get('tasadorId') ?? '').trim();

  if (!tasacionId) return { error: 'Tasación inválida.' };
  if (!tasadorId) return { error: 'Elegí un tasador para asignar.' };

  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  if (!membresia.roles.includes('admin')) {
    return { error: 'Solo el administrador de la entidad puede asignar tasadores.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('asignar_tasador_a_tasacion', {
    p_tasacion_id: tasacionId,
    p_tasador_id: tasadorId,
  });

  // El error crudo de la RPC (SQLSTATE de RLS/check/raise) se traduce a un
  // mensaje de usuario en español rioplatense en vez de exponer internals de
  // Postgres. La race "otro la tomó/asignó" llega como raise P0002 legible.
  if (error) {
    const { titulo, mensaje } = traducirError(error);
    return { error: mensaje, errorTitulo: titulo };
  }

  revalidatePath(`/dashboard/tasaciones/${tasacionId}`);
  revalidatePath('/dashboard/tasaciones');
  return { ok: 'Tasador asignado. La tasación pasó a En proceso.' };
}
