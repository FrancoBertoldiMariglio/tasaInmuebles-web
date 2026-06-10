/**
 * Cotización USD→ARS (Q-19, RG-012).
 *
 * RG-012 exige que TODO valor monetario se muestre siempre con su unidad de
 * medida (moneda). Como las tasaciones se cargan/almacenan en USD pero deben
 * mostrarse también en ARS, necesitamos un tipo de cambio para derivar ARS.
 *
 * PLACEHOLDER — la fuente oficial del tipo de cambio es el Banco Nación (Q-19),
 * pero esa integración está EXTERNAMENTE BLOQUEADA (TSK-112: API Banco Nación).
 * Hasta que TSK-112 se desbloquee, la cotización se resuelve por la env var
 * `NEXT_PUBLIC_USD_ARS_RATE` (configurable por entorno), con fallback a una
 * constante documentada. NO usar este valor para liquidaciones reales: es solo
 * para display referencial en el MVP.
 */

/**
 * Cotización de fallback (ARS por 1 USD) cuando no hay env var configurada.
 * Valor de referencia documentado; reemplazar por el de Banco Nación (TSK-112).
 */
export const USD_ARS_RATE_FALLBACK = 1000;

/**
 * Devuelve la cotización USD→ARS vigente (ARS por 1 USD).
 *
 * Lee `NEXT_PUBLIC_USD_ARS_RATE`. Si está ausente, vacía o no es un número
 * positivo finito, cae al fallback documentado. PLACEHOLDER hasta TSK-112.
 */
export function getUsdArsRate(): number {
  const raw = process.env.NEXT_PUBLIC_USD_ARS_RATE;
  if (raw == null || raw.trim() === '') {
    return USD_ARS_RATE_FALLBACK;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return USD_ARS_RATE_FALLBACK;
  }
  return parsed;
}

/**
 * Convierte un monto en USD a ARS usando la cotización vigente.
 *
 * - `usd` null/undefined/no-finito/<=0 → devuelve null (no hay valor a mostrar).
 * - Caso contrario, redondea al peso entero (los montos de tasación son enteros
 *   grandes; los centavos no aportan y `formatMoney` no muestra decimales).
 */
export function usdToArs(usd: number | null | undefined): number | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) {
    return null;
  }
  return Math.round(usd * getUsdArsRate());
}
