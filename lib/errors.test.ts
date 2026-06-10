import { describe, it, expect } from 'vitest'
import { traducirError, ERRCODE_LABELS, type ErrorUsuario } from './errors'

function pgError(code: string, extra: Record<string, unknown> = {}) {
  return { code, message: '', details: '', hint: '', ...extra }
}

function assertValido(r: ErrorUsuario) {
  expect(r.titulo.length).toBeGreaterThan(0)
  expect(r.mensaje.length).toBeGreaterThan(0)
}

describe('traducirError — codes conocidos', () => {
  it('28000 → Sin permiso (rol)', () => {
    const r = traducirError(pgError('28000'))
    expect(r.titulo).toBe('Sin permiso')
    assertValido(r)
  })

  it('42501 → Sin permiso (RLS)', () => {
    const r = traducirError(pgError('42501'))
    expect(r.titulo).toBe('Sin permiso')
    assertValido(r)
  })

  it('23514 → Datos inválidos (check constraint)', () => {
    const r = traducirError(pgError('23514'))
    expect(r.titulo).toBe('Datos inválidos')
    expect(r.mensaje).toContain('regla de negocio')
    assertValido(r)
  })

  it('P0002 → Acción no permitida (fallback genérico sin message)', () => {
    const r = traducirError(pgError('P0002'))
    expect(r.titulo).toBe('Acción no permitida')
    assertValido(r)
    expect(r.mensaje).toBe(ERRCODE_LABELS['P0002'].mensaje)
  })

  it('22023 → Datos inválidos (parámetro inválido)', () => {
    const r = traducirError(pgError('22023'))
    expect(r.titulo).toBe('Datos inválidos')
    assertValido(r)
  })
})

describe('traducirError — P0002 con message de negocio', () => {
  it('usa el message del raise cuando es legible', () => {
    const msg = 'La tasación ya está en comité y no se puede volver a borrador'
    const r = traducirError(pgError('P0002', { message: msg }))
    expect(r.titulo).toBe('Acción no permitida')
    expect(r.mensaje).toBe(msg)
  })

  it('recorta espacios del message de negocio', () => {
    const r = traducirError(pgError('P0002', { message: '  Estado inválido  ' }))
    expect(r.mensaje).toBe('Estado inválido')
  })

  it('ignora message crudo de Postgres (prefijo ERROR:) y usa fallback genérico', () => {
    const r = traducirError(pgError('P0002', { message: 'ERROR: internal qux pg_class' }))
    expect(r.mensaje).toBe(ERRCODE_LABELS['P0002'].mensaje)
  })

  it('ignora message que filtra SQLSTATE/internals', () => {
    const r = traducirError(pgError('P0002', { message: 'fallo SQLSTATE P0002 en pg_catalog' }))
    expect(r.mensaje).toBe(ERRCODE_LABELS['P0002'].mensaje)
  })

  it('ignora message vacío y usa fallback genérico', () => {
    const r = traducirError(pgError('P0002', { message: '   ' }))
    expect(r.mensaje).toBe(ERRCODE_LABELS['P0002'].mensaje)
  })
})

describe('traducirError — fallback y robustez', () => {
  it('code desconocido → fallback genérico', () => {
    const r = traducirError(pgError('XX999'))
    expect(r.titulo).toBe('Algo salió mal')
    assertValido(r)
  })

  it('null → fallback', () => {
    const r = traducirError(null)
    expect(r.titulo).toBe('Algo salió mal')
    assertValido(r)
  })

  it('undefined → fallback', () => {
    const r = traducirError(undefined)
    expect(r.titulo).toBe('Algo salió mal')
  })

  it('string → fallback (sin code)', () => {
    const r = traducirError('algo explotó')
    expect(r.titulo).toBe('Algo salió mal')
    assertValido(r)
  })

  it('Error sin code → fallback', () => {
    const r = traducirError(new Error('boom'))
    expect(r.titulo).toBe('Algo salió mal')
  })

  it('objeto vacío → fallback', () => {
    const r = traducirError({})
    expect(r.titulo).toBe('Algo salió mal')
  })

  it('objeto con code no-string → fallback', () => {
    const r = traducirError({ code: 28000 })
    expect(r.titulo).toBe('Algo salió mal')
  })

  it('number → fallback', () => {
    const r = traducirError(42)
    expect(r.titulo).toBe('Algo salió mal')
  })
})
