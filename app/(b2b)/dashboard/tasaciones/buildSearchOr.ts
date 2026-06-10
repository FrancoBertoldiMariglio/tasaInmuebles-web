// Límite de int4 en Postgres (columna `numero`). Términos por encima de esto
// desbordarían el cast y harían fallar el filtro `numero.eq`.
export const INT4_MAX = 2147483647;

// Construye un filtro OR para Supabase a partir del término de búsqueda.
//
// TSK-71 (mismo bug que TSK-63 en mobile): si el término es PURAMENTE
// NUMÉRICO se matchea SOLO por número de tasación — nunca por domicilio —
// para evitar matches "fantasma" (buscar "23" traía "Av. San Martín 1234" o
// "25 de Mayo 2300" por el domicilio).
//
// TSK-78 — PARIDAD CON MOBILE: el criterio numérico es ahora SUBSTRING (antes
// era igualdad exacta `numero.eq`). El mobile
// (lib/estado-tasacion.ts:buscarTasaciones) hace substring sobre el número
// crudo Y el padded; el web lo replica sobre la columna generada de texto
// `numero_busqueda` (= lpad(numero::text, 4, '0'), el mismo formato #0023 que
// muestra la UI) vía `numero_busqueda.ilike.%term%`. PostgREST `.or()` no
// admite cast/función sobre `numero` (int4), por eso se introdujo esa columna
// generada (migration 20260605170000).
//
// ⚠️ ORDEN DE DESPLIEGUE: la columna `numero_busqueda` solo existe tras aplicar
// la migración 20260605170000 en la BD remota. Esa migración DEBE correrse
// ANTES de deployar este código web en Vercel; si no, toda búsqueda numérica
// rompe el listado (PostgREST 42703, columna inexistente). Ver banner de orden
// obligatorio en el header de la migración.
//
// Así:
//   - "23"   matchea #0023, #0230, #1234
//   - "0023" matchea #0023
// que es la paridad práctica con el substring del mobile.
//
// Si el término es texto, se matchea por domicilio (ilike) como antes.
//
// Devuelve `null` cuando el término es numérico pero inválido (desborda int4,
// etc.): no hay cláusula posible, el caller fuerza listado vacío.
//
// TSK-153 (WEB-09) — SANEADO DE WILDCARDS LIKE: además de `%,()` (que rompen la
// sintaxis del `.or()` de PostgREST), se sanean `_` y `\` porque son
// metacaracteres del patrón LIKE/ILIKE de Postgres:
//   - `_` es wildcard de UN carácter cualquiera → sin sanearlo, "casa_1"
//     matchearía "casaX1", "casa-1", etc. (resultados fantasma).
//   - `\` es el carácter de escape de LIKE → sin sanearlo puede consumir el
//     carácter siguiente o dejar un patrón inválido.
// Se reemplazan por espacio igual que `%,()` (lo más simple y seguro): se
// pierde el carácter literal de búsqueda pero nunca se interpreta como wildcard.
export function buildSearchOr(term: string): string | null {
  const safe = term.replace(/[%,()\\_]/g, ' ').trim();
  if (!safe) return null;

  // Puramente numérico: solo dígitos (con posibles ceros a la izquierda).
  const esNumerica = /^\d+$/.test(safe);
  if (esNumerica) {
    // Validar overflow int4: aunque el match es substring sobre la columna
    // texto generada, un término que ni siquiera puede ser un `numero` válido
    // (desborda int4) nunca tendrá match real; lo descartamos para no devolver
    // ruido y para conservar la semántica de "buscar un N° de tasación".
    const sinCeros = safe.replace(/^0+/, '') || '0';
    const asNum = Number(sinCeros);
    if (!Number.isSafeInteger(asNum) || asNum <= 0 || asNum > INT4_MAX) {
      return null;
    }
    // SUBSTRING sobre el padded (ver nota TSK-78). `safe` ya está saneado de
    // `%,()_\` arriba (y acá es solo dígitos), así que es seguro interpolarlo
    // en el patrón ilike.
    return `numero_busqueda.ilike.%${safe}%`;
  }

  // Término de texto: matchear domicilio. `safe` ya viene saneado de los
  // wildcards de LIKE (`_`, `\`) y de los caracteres que rompen el `.or()`
  // (`%`, `,`, `(`, `)`), así que es seguro interpolarlo en el patrón ilike.
  return `domicilio.ilike.%${safe}%`;
}
