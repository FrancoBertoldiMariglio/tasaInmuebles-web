import type { Database } from '@/types/database';

export type EstadoTasacion = Database['public']['Enums']['estado_tasacion'];
export type TipoInmueble = Database['public']['Enums']['tipo_inmueble'];
export type MotivoTasacion = Database['public']['Enums']['motivo_tasacion'];
export type EstadoConservacion = Database['public']['Enums']['estado_conservacion'];

export const estadoLabels: Record<EstadoTasacion, string> = {
  pendiente:  'Pendiente',
  en_proceso: 'En proceso',
  en_comite:  'En comité',
  completada: 'Completada',
};

export const estadoStyles: Record<EstadoTasacion, string> = {
  pendiente:  'bg-line-soft text-ink-muted2',
  en_proceso: 'bg-status-warningSoft text-status-warningText',
  en_comite:  'bg-status-infoSoft text-status-info',
  completada: 'bg-status-successSoft text-status-success',
};

export const tipoLabels: Record<TipoInmueble, string> = {
  casa:    'Casa',
  depto:   'Departamento',
  terreno: 'Terreno',
  galpon:  'Galpón',
  local:   'Local',
  oficina: 'Oficina',
};

export const motivoLabels: Record<MotivoTasacion, string> = {
  venta:    'Venta',
  alquiler: 'Alquiler',
  sucesion: 'Sucesión',
  divorcio: 'Divorcio',
  judicial: 'Judicial',
  garantia: 'Garantía',
  contable: 'Contable',
  seguro:   'Seguro',
  donacion: 'Donación',
  otro:     'Otro',
};

export const estadoConservacionLabels: Record<EstadoConservacion, string> = {
  muy_bueno:  'Muy bueno',
  bueno:      'Bueno',
  regular:    'Regular',
  a_reciclar: 'A reciclar',
};

export const TIPOS_SIN_AMBIENTES: ReadonlySet<TipoInmueble> = new Set<TipoInmueble>([
  'terreno',
  'local',
  'oficina',
  'galpon',
]);
