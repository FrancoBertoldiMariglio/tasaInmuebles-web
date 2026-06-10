import type { Database } from '@/types/database';

export type EstadoTasacion = Database['public']['Enums']['estado_tasacion'];
export type TipoInmueble = Database['public']['Enums']['tipo_inmueble'];
export type MotivoTasacion = Database['public']['Enums']['motivo_tasacion'];
export type EstadoConservacion = Database['public']['Enums']['estado_conservacion'];
export type RolMiembro = Database['public']['Enums']['rol_entidad_miembro'];

export const rolMiembroLabels: Record<RolMiembro, string> = {
  admin:       'Administrador',
  tasador:     'Tasador',
  solicitante: 'Solicitante',
};

export const rolMiembroStyles: Record<RolMiembro, string> = {
  admin:       'bg-status-infoSoft text-status-info',
  tasador:     'bg-status-successSoft text-status-success',
  solicitante: 'bg-line-soft text-ink-muted2',
};

export const ROLES_MIEMBRO: readonly RolMiembro[] = ['admin', 'tasador', 'solicitante'];

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

// TSK-85 / TSK-83 — display del tasador asignado a una tasación.
// La RPC `tasadores_de_entidad` (SECURITY DEFINER) devuelve estos campos por
// tasación; el join directo a profiles devolvería null bajo la RLS de profiles.
export type TasadorDisplay = {
  user_id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  matricula: string | null;
};

// Nombre legible del tasador (nombre + apellido, fallback a email). Devuelve
// '' cuando no hay datos utilizables.
export function tasadorNombreDisplay(t: TasadorDisplay | null | undefined): string {
  if (!t) return '';
  const nombre = [t.nombre, t.apellido].filter(Boolean).join(' ').trim();
  return nombre || (t.email ?? '').trim();
}

// TSK-83 — una solicitud B2B pendiente sin tasador (DS-22) está "esperando
// asignación": a la espera de que un tasador la tome.
export function esEsperandoAsignacion(
  estado: EstadoTasacion,
  tasador: TasadorDisplay | null | undefined,
): boolean {
  return estado === 'pendiente' && !tasador;
}

export const tipoLabels: Record<TipoInmueble, string> = {
  casa:    'Casa',
  depto:   'Departamento',
  terreno: 'Terreno',
  galpon:  'Galpón',
  local:   'Local',
  oficina: 'Oficina',
  finca:   'Finca',
};

export const motivoLabels: Record<MotivoTasacion, string> = {
  venta:                        'Venta',
  alquiler:                     'Alquiler',
  asesoramiento_particulares:   'Asesoramiento de valores para particulares',
  empresas:                     'Tasación para empresas',
  expropiaciones:               'Expropiaciones',
  divisiones_fraccionamientos:  'Divisiones / fraccionamientos',
  sucesion:                     'Sucesión',
  judicial:                     'Tasación judicial',
  extrajudicial:                'Tasación extrajudicial',
  hipoteca:                     'Hipoteca',
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
  'finca',
]);
