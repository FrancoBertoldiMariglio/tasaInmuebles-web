import { describe, it, expect } from 'vitest';
import { buildSearchOr, INT4_MAX } from './buildSearchOr';

describe('buildSearchOr', () => {
  describe('término numérico', () => {
    it('numérico válido → numero_busqueda.ilike.%term%', () => {
      expect(buildSearchOr('23')).toBe('numero_busqueda.ilike.%23%');
    });

    it('numérico con ceros a la izquierda conserva el padded', () => {
      expect(buildSearchOr('0023')).toBe('numero_busqueda.ilike.%0023%');
    });

    it('numérico que desborda int4 → null', () => {
      const overflow = String(INT4_MAX + 1);
      expect(buildSearchOr(overflow)).toBeNull();
    });

    it('cero → null', () => {
      expect(buildSearchOr('0')).toBeNull();
      expect(buildSearchOr('0000')).toBeNull();
    });

    it('numérico fuera de rango seguro de JS → null', () => {
      expect(buildSearchOr('99999999999999999999')).toBeNull();
    });
  });

  describe('término de texto', () => {
    it('texto normal → domicilio.ilike.%term%', () => {
      expect(buildSearchOr('San Martín')).toBe('domicilio.ilike.%San Martín%');
    });

    it('texto con `_` queda saneado (no aparece como wildcard)', () => {
      const result = buildSearchOr('casa_1');
      expect(result).not.toContain('_');
      expect(result).toBe('domicilio.ilike.%casa 1%');
    });

    it('texto con `\\` queda saneado', () => {
      const result = buildSearchOr('casa\\1');
      expect(result).not.toContain('\\');
      expect(result).toBe('domicilio.ilike.%casa 1%');
    });

    it('texto con `%` queda saneado', () => {
      const result = buildSearchOr('100%casa');
      expect(result).not.toContain('%casa');
      expect(result).toBe('domicilio.ilike.%100 casa%');
    });

    it('texto con `(`, `)`, `,` queda saneado', () => {
      const result = buildSearchOr('Av (norte), 5');
      expect(result).not.toMatch(/[(),]/);
      expect(result).toBe('domicilio.ilike.%Av  norte   5%');
    });
  });

  describe('términos vacíos', () => {
    it('string vacío → null', () => {
      expect(buildSearchOr('')).toBeNull();
    });

    it('solo espacios → null', () => {
      expect(buildSearchOr('   ')).toBeNull();
    });

    it('solo caracteres saneables → null', () => {
      expect(buildSearchOr('%,()_\\')).toBeNull();
    });
  });
});
