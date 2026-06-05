// Zona horaria del negocio (Córdoba, Argentina). Argentina no observa DST
// desde 2009, por lo que el offset es fijo en -03:00.
export const BUSINESS_TZ = 'America/Argentina/Cordoba';
export const BUSINESS_TZ_OFFSET = '-03:00';

// Convierte una fecha local (YYYY-MM-DD de un <input type="date">) en el
// límite inferior del rango (inicio del día) como literal timestamptz con el
// offset del negocio. Evita el skew de 3h al comparar contra columnas
// timestamptz interpretadas en UTC por Postgres.
export function startOfDayBusinessTz(fecha: string): string {
  return `${fecha}T00:00:00${BUSINESS_TZ_OFFSET}`;
}

// Ídem para el límite superior (fin del día) inclusivo.
export function endOfDayBusinessTz(fecha: string): string {
  return `${fecha}T23:59:59.999${BUSINESS_TZ_OFFSET}`;
}
