import { describe, it, expect, afterEach } from 'vitest';
import {
  getUsdArsRate,
  usdToArs,
  USD_ARS_RATE_FALLBACK,
} from './cotizacion';

// `NEXT_PUBLIC_USD_ARS_RATE` se inlinea en build de Next, pero en runtime de
// tests (Node) `process.env` es mutable, así que la seteamos/limpiamos por caso.
const ENV_KEY = 'NEXT_PUBLIC_USD_ARS_RATE';

function setRate(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }
}

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('getUsdArsRate', () => {
  it('usa el fallback documentado cuando la env var no está definida', () => {
    setRate(undefined);
    expect(getUsdArsRate()).toBe(USD_ARS_RATE_FALLBACK);
  });

  it('usa el fallback cuando la env var está vacía o en blanco', () => {
    setRate('   ');
    expect(getUsdArsRate()).toBe(USD_ARS_RATE_FALLBACK);
  });

  it('usa el valor de la env var cuando es un número positivo', () => {
    setRate('1350');
    expect(getUsdArsRate()).toBe(1350);
  });

  it('soporta decimales en la env var', () => {
    setRate('1234.5');
    expect(getUsdArsRate()).toBe(1234.5);
  });

  it('cae al fallback si la env var no es numérica', () => {
    setRate('mil pesos');
    expect(getUsdArsRate()).toBe(USD_ARS_RATE_FALLBACK);
  });

  it('cae al fallback si la env var es cero o negativa', () => {
    setRate('0');
    expect(getUsdArsRate()).toBe(USD_ARS_RATE_FALLBACK);
    setRate('-500');
    expect(getUsdArsRate()).toBe(USD_ARS_RATE_FALLBACK);
  });
});

describe('usdToArs', () => {
  it('convierte USD a ARS con la cotización vigente', () => {
    setRate('1000');
    expect(usdToArs(100)).toBe(100_000);
  });

  it('redondea al peso entero', () => {
    setRate('1234.5');
    expect(usdToArs(3)).toBe(Math.round(3 * 1234.5));
  });

  it('devuelve null para usd null o undefined', () => {
    expect(usdToArs(null)).toBeNull();
    expect(usdToArs(undefined)).toBeNull();
  });

  it('devuelve null para usd <= 0 o no finito', () => {
    expect(usdToArs(0)).toBeNull();
    expect(usdToArs(-10)).toBeNull();
    expect(usdToArs(Number.NaN)).toBeNull();
    expect(usdToArs(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('usa el fallback cuando no hay env var configurada', () => {
    setRate(undefined);
    expect(usdToArs(1)).toBe(USD_ARS_RATE_FALLBACK);
  });
});
