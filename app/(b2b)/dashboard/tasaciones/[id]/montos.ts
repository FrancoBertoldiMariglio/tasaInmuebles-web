/**
 * Parsea un monto que llega como `FormDataEntryValue` (string) a `number | null`.
 * Acepta separadores de miles es-AR (puntos) y coma decimal; vacío / no numérico
 * / <= 0 → `null` (ausencia de valor). Pura → testeable.
 *
 * Vive en su propio módulo (no en `actions.ts`) porque un archivo `'use server'`
 * solo puede exportar funciones async; este helper síncrono rompía el build de
 * Next si se exportaba desde el módulo de Server Actions.
 */
export function parseMonto(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const texto = String(raw).trim();
  if (texto === '') return null;
  // Normaliza formato es-AR: quita puntos de miles, coma decimal → punto.
  const normalizado = texto.replace(/\./g, '').replace(',', '.');
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
