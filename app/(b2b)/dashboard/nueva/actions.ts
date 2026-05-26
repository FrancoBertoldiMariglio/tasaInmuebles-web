'use server';

import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva, setEntidadActiva } from '@/lib/entidad-activa';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

type TipoInmueble = Database['public']['Enums']['tipo_inmueble'];
type MotivoTasacion = Database['public']['Enums']['motivo_tasacion'];

export type CrearTasacionState = {
  error?: string;
  ok?: boolean;
};

const TIPOS_VALIDOS: TipoInmueble[] = [
  'casa', 'depto', 'terreno', 'galpon', 'local', 'oficina',
];
const MOTIVOS_VALIDOS: MotivoTasacion[] = [
  'venta', 'alquiler', 'sucesion', 'divorcio', 'judicial',
  'garantia', 'contable', 'seguro', 'donacion', 'otro',
];

export async function crearTasacion(
  _prev: CrearTasacionState,
  formData: FormData,
): Promise<CrearTasacionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sesión expirada. Volvé a iniciar sesión.' };

  const membresia = await getMembresiaActiva();
  if (!membresia) {
    return { error: 'Tu cuenta no está vinculada a ninguna organización.' };
  }
  const entidadId = membresia.entidad.id;

  // Solo Admin o Solicitante pueden crear desde el dashboard B2B.
  // Tasador crea desde mobile en el flujo de campo.
  const puedeCrear =
    membresia.roles.includes('admin') ||
    membresia.roles.includes('solicitante');
  if (!puedeCrear) {
    return { error: 'No tenés permisos para solicitar tasaciones en esta entidad.' };
  }

  const tipo = formData.get('tipo') as string;
  const motivo = formData.get('motivo') as string;
  const domicilio = (formData.get('domicilio') as string)?.trim();
  const notas = (formData.get('notas') as string)?.trim() || null;

  if (!TIPOS_VALIDOS.includes(tipo as TipoInmueble)) {
    return { error: 'Tipo de inmueble inválido.' };
  }
  if (!MOTIVOS_VALIDOS.includes(motivo as MotivoTasacion)) {
    return { error: 'Motivo de tasación inválido.' };
  }
  if (!domicilio || domicilio.length < 5) {
    return { error: 'Ingresá una dirección válida.' };
  }

  const { data, error } = await supabase
    .from('tasaciones')
    .insert({
      entidad_id: entidadId,
      creado_por: user.id,
      tipo: tipo as TipoInmueble,
      motivo: motivo as MotivoTasacion,
      domicilio,
      descripcion: notas,
      estado: 'borrador',
      es_referencial: false,
    })
    .select('id, numero')
    .single();

  if (error) return { error: `Error al guardar: ${error.message}` };

  revalidatePath('/dashboard/tasaciones');
  redirect(`/dashboard/tasaciones?creada=${data.numero}`);
}

/**
 * Cambia la entidad activa del user (cookie). Llamada desde el selector
 * en el sidebar B2B. Valida membresía server-side.
 */
export async function cambiarEntidadActiva(entidadId: string): Promise<void> {
  await setEntidadActiva(entidadId);
  revalidatePath('/dashboard', 'layout');
}
