/**
 * Traducción de errores de Supabase/PostgREST a mensajes de usuario
 * en español rioplatense.
 *
 * Convención de errcodes normalizada por el backend (SUP-11):
 *  - 28000 → no autorizado / sin permiso de rol
 *  - 42501 → RLS / insufficient_privilege
 *  - 23514 → check constraint violado (regla de negocio)
 *  - P0002 → raise exception custom de PL/pgSQL (ej. estado inválido)
 *  - 22023 → parámetro inválido
 */

export type ErrorUsuario = { titulo: string; mensaje: string }

const FALLBACK: ErrorUsuario = {
  titulo: 'Algo salió mal',
  mensaje: 'Ocurrió un error inesperado. Volvé a intentar en unos segundos.',
}

/**
 * Mapa de SQLSTATE conocidos a su mensaje de usuario base.
 * Para P0002 el mensaje se resuelve de forma especial (ver traducirError),
 * priorizando el texto del raise de negocio cuando viene limpio.
 */
export const ERRCODE_LABELS: Record<string, ErrorUsuario> = {
  '28000': {
    titulo: 'Sin permiso',
    mensaje: 'No tenés permiso para realizar esta acción con tu rol actual.',
  },
  '42501': {
    titulo: 'Sin permiso',
    mensaje:
      'No tenés permiso para acceder a estos datos. Si creés que es un error, contactá a un administrador.',
  },
  '23514': {
    titulo: 'Datos inválidos',
    mensaje: 'La operación viola una regla de negocio. Revisá los datos cargados e intentá de nuevo.',
  },
  P0002: {
    titulo: 'Acción no permitida',
    mensaje: 'No se puede completar la acción en el estado actual.',
  },
  '22023': {
    titulo: 'Datos inválidos',
    mensaje: 'Alguno de los datos enviados no es válido. Revisalos e intentá de nuevo.',
  },
}

type ErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

/**
 * Extrae de forma robusta los campos relevantes de un `unknown` que puede ser
 * un PostgrestError, un Error, un objeto plano, un string o null/undefined.
 */
function extraerCampos(e: unknown): { code?: string; message?: string } {
  if (e == null) return {}
  if (typeof e === 'string') return { message: e }

  if (typeof e === 'object') {
    const obj = e as ErrorLike
    const code = typeof obj.code === 'string' ? obj.code : undefined
    const message = typeof obj.message === 'string' ? obj.message : undefined
    return { code, message }
  }

  return {}
}

/**
 * Decide si el `message` de un raise de PL/pgSQL es texto legible apto para
 * mostrarle al usuario (mensaje de negocio), o si expone internals SQL.
 */
function esMensajeLegible(message: string | undefined): message is string {
  if (!message) return false
  const limpio = message.trim()
  if (limpio.length === 0) return false
  // Descartar prefijos crudos de Postgres / dumps que filtran internals.
  const sospechoso = /(^ERROR:)|(SQLSTATE)|(\bpg_)|(at character \d+)|(CONTEXT:)/i
  if (sospechoso.test(limpio)) return false
  return true
}

/**
 * Traduce un error de Supabase a un mensaje de usuario en español rioplatense.
 */
export function traducirError(e: unknown): ErrorUsuario {
  const { code, message } = extraerCampos(e)

  if (code && code in ERRCODE_LABELS) {
    const base = ERRCODE_LABELS[code]

    // P0002 trae el texto del raise de negocio: preferirlo si es legible.
    if (code === 'P0002' && esMensajeLegible(message)) {
      return { titulo: base.titulo, mensaje: message.trim() }
    }

    return base
  }

  return FALLBACK
}
