import { describe, it, expect } from 'vitest';
import { formatMoney, formatUsdArs } from './format';

describe('formatMoney', () => {
  it('formatea montos USD normales con prefijo y agrupación es-AR', () => {
    expect(formatMoney(1234567, 'USD')).toBe('USD 1.234.567');
  });

  it('formatea montos ARS normales con prefijo y agrupación es-AR', () => {
    expect(formatMoney(850000, 'ARS')).toBe('ARS 850.000');
  });

  it('agrupa miles con punto (separador es-AR)', () => {
    expect(formatMoney(1000, 'USD')).toBe('USD 1.000');
    expect(formatMoney(12345, 'ARS')).toBe('ARS 12.345');
  });

  it('redondea/omite decimales para enteros grandes', () => {
    expect(formatMoney(1234567.89, 'USD')).toBe('USD 1.234.568');
  });

  it('maneja números muy grandes', () => {
    expect(formatMoney(95000000000, 'ARS')).toBe('ARS 95.000.000.000');
  });

  it('devuelve fallback por defecto (—) cuando value es null', () => {
    expect(formatMoney(null, 'USD')).toBe('—');
  });

  it('devuelve fallback por defecto cuando value es undefined', () => {
    expect(formatMoney(undefined, 'ARS')).toBe('—');
  });

  it('devuelve fallback por defecto cuando value es 0', () => {
    expect(formatMoney(0, 'USD')).toBe('—');
  });

  it('devuelve fallback por defecto cuando value es negativo', () => {
    expect(formatMoney(-500, 'ARS')).toBe('—');
  });

  it('devuelve fallback por defecto cuando value es NaN', () => {
    expect(formatMoney(NaN, 'USD')).toBe('—');
  });

  it('respeta un fallback custom', () => {
    expect(formatMoney(null, 'USD', { fallback: 'Sin valor' })).toBe('Sin valor');
    expect(formatMoney(0, 'ARS', { fallback: 'N/D' })).toBe('N/D');
  });

  it('usa el fallback custom solo en el caso inválido, no en montos válidos', () => {
    expect(formatMoney(100, 'USD', { fallback: 'Sin valor' })).toBe('USD 100');
  });
});

describe('formatUsdArs', () => {
  it('combina ambos montos con separador " / "', () => {
    expect(formatUsdArs(100000, 95000000)).toBe('USD 100.000 / ARS 95.000.000');
  });

  it('aplica fallback por lado cuando uno falta', () => {
    expect(formatUsdArs(100000, null)).toBe('USD 100.000 / —');
    expect(formatUsdArs(null, 95000000)).toBe('— / ARS 95.000.000');
  });

  it('respeta fallback custom en ambos lados', () => {
    expect(formatUsdArs(null, null, { fallback: 'N/D' })).toBe('N/D / N/D');
  });
});
