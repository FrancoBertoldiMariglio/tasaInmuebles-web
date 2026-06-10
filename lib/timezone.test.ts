import { describe, it, expect } from 'vitest';
import {
  BUSINESS_TZ_OFFSET,
  startOfDayBusinessTz,
  endOfDayBusinessTz,
} from './timezone';

describe('timezone (zona horaria del negocio)', () => {
  it('startOfDayBusinessTz devuelve el inicio de día con offset -03:00', () => {
    expect(startOfDayBusinessTz('2026-06-10')).toBe('2026-06-10T00:00:00-03:00');
  });

  it('endOfDayBusinessTz devuelve el fin de día inclusivo con milisegundos', () => {
    expect(endOfDayBusinessTz('2026-06-10')).toBe('2026-06-10T23:59:59.999-03:00');
  });

  it('el offset del negocio es fijo (Argentina sin DST)', () => {
    expect(BUSINESS_TZ_OFFSET).toBe('-03:00');
  });

  it('un rango día evita el skew: inicio < fin para la misma fecha', () => {
    const inicio = startOfDayBusinessTz('2026-01-01');
    const fin = endOfDayBusinessTz('2026-01-01');
    expect(new Date(inicio).getTime()).toBeLessThan(new Date(fin).getTime());
  });
});
