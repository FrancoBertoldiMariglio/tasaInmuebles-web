'use server';

import { createClient } from '@/lib/supabase/server';
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

  // Profile + entidad del user
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('entidad_id, rol')
    .eq('id', user.id)
    .single();

  if (profileErr) return { error: 'No se pudo cargar tu perfil.' };
  if (profile.rol !== 'cliente_b2b' && profile.rol !== 'admin') {
    return { error: 'Solo clientes B2B o admin pueden crear solicitudes desde el dashboard.' };
  }
  if (!profile.entidad_id && profile.rol !== 'admin') {
    return { error: 'Tu cuenta no está vinculada a una organización.' };
  }

  // Validar input
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

  // INSERT
  const { data, error } = await supabase
    .from('tasaciones')
    .insert({
      entidad_id: profile.entidad_id,
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
