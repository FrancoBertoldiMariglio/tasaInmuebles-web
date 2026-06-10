/**
 * Helpers de formateo de moneda centralizados (TSK-151 / WEB-07).
 *
 * FORMATO CANÓNICO elegido:
 *   `"<MONEDA> <número agrupado es-AR>"`  →  ej. `"USD 1.234.567"`, `"ARS 850.000"`
 *
 * Decisión:
 *   - Prefijo de moneda con código ISO en mayúsculas (`USD ` / `ARS `) + espacio,
 *     en vez del símbolo `$`. Motivo: en la app conviven USD y ARS y el símbolo `$`
 *     es ambiguo (se usa para ambos en distintos lugares). El código ISO desambigua.
 *     Esto generaliza el patrón ya existente del listado (`USD ${n.toLocaleString('es-AR')}`)
 *     y lo aplica también a ARS para consistencia.
 *   - Separador de miles es-AR (punto: `1.234.567`), vía `Intl.NumberFormat('es-AR')`.
 *   - SIN decimales: los montos de tasación son enteros grandes; los centavos no aportan.
 *   - value null/undefined/<=0 → fallback (`'—'` por defecto, configurable).
 *
 * La migración de call-sites a este helper la ejecuta una ola posterior; respetar
 * este formato exacto al migrar.
 */

type Currency = 'USD' | 'ARS';

type FormatMoneyOpts = {
  /** Texto a devolver cuando el valor es null/undefined/<=0. Default: '—'. */
  fallback?: string;
};

const numberFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

/**
 * Formatea un monto como `"<MONEDA> <número>"` (ej. `"USD 1.234.567"`).
 * Devuelve `opts.fallback` (default `'—'`) si el valor es null/undefined o <= 0.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: Currency,
  opts?: FormatMoneyOpts,
): string {
  const fallback = opts?.fallback ?? '—';
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return `${currency} ${numberFormatter.format(value)}`;
}

/**
 * Conveniencia para mostrar ambos valores (TSK-123): `"USD 100.000 / ARS 95.000.000"`.
 * Cada lado usa formatMoney, así que respeta el mismo fallback por moneda.
 */
export function formatUsdArs(
  usd: number | null | undefined,
  ars: number | null | undefined,
  opts?: FormatMoneyOpts,
): string {
  return `${formatMoney(usd, 'USD', opts)} / ${formatMoney(ars, 'ARS', opts)}`;
}
