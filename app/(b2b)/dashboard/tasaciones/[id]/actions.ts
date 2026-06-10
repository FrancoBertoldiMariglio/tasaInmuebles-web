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
 * Puente de tipos para RPCs nuevas (TSK-119 liberar_al_pool, TSK-120
 * reasignar_tasacion). Las migraciones backend del 2026-06-10 agregaron estas
 * funciones, pero `types/database.ts` todavía no se regeneró (`pnpm gen:types`)
 * en este worktree, así que el overload tipado de `.rpc` no las conoce. En vez
 * de aflojar el tipado de todo el cliente, casteamos SOLO la firma de `.rpc` a
 * una versión laxa para estas llamadas puntuales. Cuando se regeneren los tipos,
 * este cast se puede borrar sin tocar la lógica.
 */
type RpcLaxo = (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;

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

/**
 * Gating de admin compartido por las acciones de asignación. Centraliza la
 * verificación temprana (membresía + rol admin) para dar mensajes claros antes
 * de pegarle a la RPC. El enforce real vive en las RPCs SECURITY DEFINER; esto
 * solo evita round-trips obvios. Devuelve un error de estado o `null` si pasa.
 */
async function gateAdmin(): Promise<AsignarTasadorState | null> {
  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  if (!membresia.roles.includes('admin')) {
    return { error: 'Solo el administrador de la entidad puede realizar esta acción.' };
  }
  return null;
}

/**
 * TSK-119 / BR-052: el admin libera al pool una solicitud B2B pendiente sin
 * asignar para habilitar el self-claim de los tasadores (DS-22). La transición
 * (flag `tomable=true`) y todas las validaciones duras (admin de entidad,
 * estado pendiente, sin tasador) las hace la RPC liberar_al_pool; acá gateamos
 * el rol admin para feedback temprano y traducimos el error crudo de Postgres.
 */
export async function liberarAlPool(
  _prev: AsignarTasadorState,
  formData: FormData,
): Promise<AsignarTasadorState> {
  const tasacionId = String(formData.get('tasacionId') ?? '').trim();
  if (!tasacionId) return { error: 'Tasación inválida.' };

  const gate = await gateAdmin();
  if (gate) return gate;

  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcLaxo;
  const { error } = await rpc('liberar_al_pool', {
    p_tasacion_id: tasacionId,
  });

  if (error) {
    const { titulo, mensaje } = traducirError(error);
    return { error: mensaje, errorTitulo: titulo };
  }

  revalidatePath(`/dashboard/tasaciones/${tasacionId}`);
  revalidatePath('/dashboard/tasaciones');
  return { ok: 'Solicitud liberada al pool. Los tasadores con la especialidad pueden tomarla.' };
}

/**
 * TSK-120 / RF-027: el admin reasigna una tasación EN PROCESO a otro tasador de
 * la misma entidad (motivo opcional). La RPC reasignar_tasacion valida admin,
 * estado en_proceso, pertenencia + especialidad del nuevo tasador (bloqueo duro,
 * errcode 23514), y usa optimistic locking contra el tasador actual: si la fila
 * cambió de forma concurrente lanza 40001. No pasamos el tasador anterior como
 * param (la RPC lo lee internamente y lo usa de guard); solo enviamos el nuevo.
 */
export async function reasignarTasador(
  _prev: AsignarTasadorState,
  formData: FormData,
): Promise<AsignarTasadorState> {
  const tasacionId = String(formData.get('tasacionId') ?? '').trim();
  const nuevoTasadorId = String(formData.get('tasadorId') ?? '').trim();
  const motivo = String(formData.get('motivo') ?? '').trim();

  if (!tasacionId) return { error: 'Tasación inválida.' };
  if (!nuevoTasadorId) return { error: 'Elegí el nuevo tasador para reasignar.' };

  const gate = await gateAdmin();
  if (gate) return gate;

  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcLaxo;
  const { error } = await rpc('reasignar_tasacion', {
    p_tasacion_id: tasacionId,
    p_nuevo_tasador_id: nuevoTasadorId,
    // Motivo opcional: enviamos null cuando viene vacío para no persistir '' en
    // el audit trail (tasacion_asignacion_log.motivo es nullable).
    p_motivo: motivo.length > 0 ? motivo : null,
  });

  if (error) {
    const { titulo, mensaje } = traducirError(error);
    return { error: mensaje, errorTitulo: titulo };
  }

  revalidatePath(`/dashboard/tasaciones/${tasacionId}`);
  revalidatePath('/dashboard/tasaciones');
  return { ok: 'Tasación reasignada al nuevo tasador.' };
}
