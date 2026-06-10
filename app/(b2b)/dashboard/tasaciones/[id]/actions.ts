'use server';

import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { traducirError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import { parseMonto } from './montos';

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

/**
 * Gating compartido por las acciones de comité (revelar / cerrar). A diferencia
 * de la asignación B2B (admin-only), el comité lo opera un tasador del comité o
 * un admin (modelo DS-12 / DP-010, sin videoconferencia). El enforce duro vive
 * en las RPCs SECURITY DEFINER `_es_tasador_de_tasacion`; acá gateamos temprano
 * para feedback claro y evitar round-trips. Devuelve error de estado o `null`.
 */
async function gateComite(): Promise<AsignarTasadorState | null> {
  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  if (!membresia.roles.includes('admin') && !membresia.roles.includes('tasador')) {
    return { error: 'Solo un tasador del comité o un administrador puede operar el comité.' };
  }
  return null;
}

/**
 * TSK-171 / SUP-04 / DS-12: revela el Planning Poker del comité (setea
 * `comite_revelado_at` para que los miembros vean las propuestas ajenas). Antes
 * el reveal iba por UPDATE directo a `tasaciones` (la policy del solicitante lo
 * permitía indebidamente); ahora va por la RPC SECURITY DEFINER que valida rol
 * tasador/admin. La RPC recibe un único param `_tasacion_id`.
 *
 * TODO(deploy): depende del batch backend 2026-06-10 (migración
 * 20260610100500_sup04_rpcs_revelar_cerrar_comite.sql) todavía NO aplicado al
 * remoto, y de la decisión de UX DP-010 (modelo DS-12 sin VC, ya decidida).
 * El RPC tampoco está en `types/database.ts` regenerado → cast `RpcLaxo`.
 */
export async function revelarPlanningPoker(
  _prev: AsignarTasadorState,
  formData: FormData,
): Promise<AsignarTasadorState> {
  const tasacionId = String(formData.get('tasacionId') ?? '').trim();
  if (!tasacionId) return { error: 'Tasación inválida.' };

  const gate = await gateComite();
  if (gate) return gate;

  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcLaxo;
  const { error } = await rpc('revelar_planning_poker', {
    _tasacion_id: tasacionId,
  });

  if (error) {
    const { titulo, mensaje } = traducirError(error);
    return { error: mensaje, errorTitulo: titulo };
  }

  revalidatePath(`/dashboard/tasaciones/${tasacionId}`);
  return { ok: 'Planning Poker revelado. Las propuestas del comité ya son visibles.' };
}

/**
 * TSK-171 / SUP-04 + TSK-110 / BR-038 / DS-12: cierra el valor del comité
 * (define valor final ARS/USD + nota + firma → estado `completada`). La RPC
 * `cerrar_valor_comite(_tasacion_id, _valor_ars, _valor_usd, _nota)` valida rol
 * tasador/admin, exige al menos un valor > 0, y EXIGE la nota justificativa
 * cuando el valor de cierre diverge del rango [min,max] de las propuestas
 * (BR-038). La firma de la propuesta del tasador que cierra la hace la RPC
 * internamente (RG-009). Mandamos `null` cuando un valor o la nota vienen vacíos.
 *
 * TODO(deploy): depende del batch backend 2026-06-10 (migraciones
 * 20260610100500 + 20260610110300_tsk110_nota_firma_comite.sql) todavía NO
 * aplicadas al remoto, y de DP-010 (modelo DS-12 sin VC, ya decidida). El RPC
 * no está en `types/database.ts` regenerado → cast `RpcLaxo`.
 */
export async function cerrarValorComite(
  _prev: AsignarTasadorState,
  formData: FormData,
): Promise<AsignarTasadorState> {
  const tasacionId = String(formData.get('tasacionId') ?? '').trim();
  if (!tasacionId) return { error: 'Tasación inválida.' };

  // Los montos llegan como string desde el form; los parseamos a number y
  // tratamos vacío/0/NaN como ausencia (la RPC exige al menos uno > 0).
  const valorArs = parseMonto(formData.get('valorArs'));
  const valorUsd = parseMonto(formData.get('valorUsd'));
  if (valorArs == null && valorUsd == null) {
    return { error: 'Ingresá un valor de cierre en ARS o USD.' };
  }

  const nota = String(formData.get('nota') ?? '').trim();

  const gate = await gateComite();
  if (gate) return gate;

  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcLaxo;
  const { error } = await rpc('cerrar_valor_comite', {
    _tasacion_id: tasacionId,
    _valor_ars: valorArs,
    _valor_usd: valorUsd,
    // Nota opcional a nivel API: la RPC la vuelve obligatoria (BR-038) solo si
    // el valor diverge del rango. '' → null para no persistir vacío.
    _nota: nota.length > 0 ? nota : null,
  });

  if (error) {
    const { titulo, mensaje } = traducirError(error);
    return { error: mensaje, errorTitulo: titulo };
  }

  revalidatePath(`/dashboard/tasaciones/${tasacionId}`);
  revalidatePath('/dashboard/tasaciones');
  return { ok: 'Valor del comité cerrado. La tasación pasó a Completada.' };
}
