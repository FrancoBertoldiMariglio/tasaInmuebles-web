import { describe, it, expect } from 'vitest';
import {
  tasadorNombreDisplay,
  esEsperandoAsignacion,
  estadoLabels,
  tipoLabels,
  ROLES_MIEMBRO,
  TIPOS_SIN_AMBIENTES,
  type TasadorDisplay,
} from './labels';

const tasador = (over: Partial<TasadorDisplay> = {}): TasadorDisplay => ({
  user_id: 'u1',
  nombre: 'Ada',
  apellido: 'Lovelace',
  email: 'ada@x.com',
  matricula: 'M-1',
  ...over,
});

describe('tasadorNombreDisplay', () => {
  it('combina nombre y apellido', () => {
    expect(tasadorNombreDisplay(tasador())).toBe('Ada Lovelace');
  });

  it('cae al email cuando no hay nombre ni apellido', () => {
    expect(tasadorNombreDisplay(tasador({ nombre: null, apellido: null }))).toBe('ada@x.com');
  });

  it('devuelve string vacío sin datos utilizables', () => {
    expect(tasadorNombreDisplay(tasador({ nombre: null, apellido: null, email: null }))).toBe('');
    expect(tasadorNombreDisplay(null)).toBe('');
    expect(tasadorNombreDisplay(undefined)).toBe('');
  });

  it('usa solo el campo presente cuando falta el otro', () => {
    expect(tasadorNombreDisplay(tasador({ apellido: null }))).toBe('Ada');
    expect(tasadorNombreDisplay(tasador({ nombre: null }))).toBe('Lovelace');
  });
});

describe('esEsperandoAsignacion (TSK-83 / DS-22)', () => {
  it('true solo si pendiente y sin tasador', () => {
    expect(esEsperandoAsignacion('pendiente', null)).toBe(true);
  });

  it('false si pendiente pero ya tiene tasador', () => {
    expect(esEsperandoAsignacion('pendiente', tasador())).toBe(false);
  });

  it('false para estados que no son pendiente', () => {
    expect(esEsperandoAsignacion('en_proceso', null)).toBe(false);
    expect(esEsperandoAsignacion('completada', null)).toBe(false);
  });
});

describe('catálogos de labels', () => {
  it('los 4 estados Q02 están mapeados', () => {
    expect(Object.keys(estadoLabels).sort()).toEqual(
      ['completada', 'en_comite', 'en_proceso', 'pendiente'],
    );
  });

  it('todos los tipos tienen label legible', () => {
    for (const label of Object.values(tipoLabels)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('ROLES_MIEMBRO contiene los 3 roles internos B2B', () => {
    expect([...ROLES_MIEMBRO].sort()).toEqual(['admin', 'solicitante', 'tasador']);
  });

  it('TIPOS_SIN_AMBIENTES no incluye casa ni depto', () => {
    expect(TIPOS_SIN_AMBIENTES.has('casa')).toBe(false);
    expect(TIPOS_SIN_AMBIENTES.has('terreno')).toBe(true);
  });
});
