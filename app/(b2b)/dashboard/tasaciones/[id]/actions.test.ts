import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { revalidatePath } from 'next/cache';
import {
  asignarTasador,
  liberarAlPool,
  reasignarTasador,
  revelarPlanningPoker,
  cerrarValorComite,
  type AsignarTasadorState,
} from './actions';
import { parseMonto } from './montos';
import { construirTrazabilidad } from './TrazabilidadValor';

// Mockeamos el cliente de Supabase, la membresía activa y revalidatePath para
// aislar la server action de la red/cache y testear su lógica de gating + la
// traducción de errores de la RPC (TSK-91 + wire de traducirError).
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/entidad-activa', () => ({ getMembresiaActiva: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockGetMembresia = vi.mocked(getMembresiaActiva);
const mockRevalidatePath = vi.mocked(revalidatePath);

const INITIAL: AsignarTasadorState = {};

/** Arma un FormData con los campos que lee la action. */
function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Membresía admin de una entidad (forma que devuelve getMembresiaActiva). */
function membresiaAdmin() {
  return { entidad_id: 'ent-1', roles: ['admin'] } as never;
}

/** Mock del cliente Supabase cuyo `.rpc()` resuelve a {error}. */
function mockSupabase(error: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { client: { rpc } as never, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('asignarTasador', () => {
  it('rechaza si falta el id de tasación', async () => {
    const res = await asignarTasador(INITIAL, formData({ tasadorId: 't-1' }));
    expect(res).toEqual({ error: 'Tasación inválida.' });
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si no se eligió tasador', async () => {
    const res = await asignarTasador(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res).toEqual({ error: 'Elegí un tasador para asignar.' });
  });

  it('rechaza si la cuenta no tiene membresía', async () => {
    mockGetMembresia.mockResolvedValue(null);
    const res = await asignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-1' }),
    );
    expect(res.error).toMatch(/no está vinculada/);
  });

  it('rechaza si el rol no es admin', async () => {
    mockGetMembresia.mockResolvedValue({ entidad_id: 'ent-1', roles: ['tasador'] } as never);
    const res = await asignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-1' }),
    );
    expect(res.error).toMatch(/administrador/);
  });

  it('happy path: asigna, revalida y devuelve ok', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    const res = await asignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-1' }),
    );

    expect(rpc).toHaveBeenCalledWith('asignar_tasador_a_tasacion', {
      p_tasacion_id: 'tas-1',
      p_tasador_id: 't-1',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones/tas-1');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones');
    expect(res.ok).toMatch(/En proceso/);
    expect(res.error).toBeUndefined();
  });

  it('traduce el error de la RPC vía traducirError (RLS 42501)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client } = mockSupabase({ code: '42501', message: 'permission denied for table' });
    mockCreateClient.mockResolvedValue(client);

    const res = await asignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-1' }),
    );

    // No expone el mensaje crudo de Postgres; usa el mapeo de errcodes.
    expect(res.error).not.toContain('permission denied');
    expect(res.errorTitulo).toBe('Sin permiso');
    expect(res.error).toMatch(/No tenés permiso/);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('preserva el mensaje de negocio de un raise P0002 legible', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client } = mockSupabase({
      code: 'P0002',
      message: 'La tasación ya fue tomada por otro tasador.',
    });
    mockCreateClient.mockResolvedValue(client);

    const res = await asignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-1' }),
    );

    expect(res.errorTitulo).toBe('Acción no permitida');
    expect(res.error).toBe('La tasación ya fue tomada por otro tasador.');
  });
});

describe('liberarAlPool (TSK-119)', () => {
  it('rechaza si falta el id de tasación', async () => {
    const res = await liberarAlPool(INITIAL, formData({}));
    expect(res).toEqual({ error: 'Tasación inválida.' });
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si la cuenta no tiene membresía', async () => {
    mockGetMembresia.mockResolvedValue(null);
    const res = await liberarAlPool(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/no está vinculada/);
  });

  it('rechaza si el rol no es admin', async () => {
    mockGetMembresia.mockResolvedValue({ entidad_id: 'ent-1', roles: ['tasador'] } as never);
    const res = await liberarAlPool(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/administrador/);
  });

  it('happy path: libera, revalida y devuelve ok', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    const res = await liberarAlPool(INITIAL, formData({ tasacionId: 'tas-1' }));

    expect(rpc).toHaveBeenCalledWith('liberar_al_pool', { p_tasacion_id: 'tas-1' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones/tas-1');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones');
    expect(res.ok).toMatch(/pool/);
    expect(res.error).toBeUndefined();
  });

  it('traduce el error de la RPC (no liberable, 22023)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client } = mockSupabase({ code: '22023', message: 'no está pendiente' });
    mockCreateClient.mockResolvedValue(client);

    const res = await liberarAlPool(INITIAL, formData({ tasacionId: 'tas-1' }));

    expect(res.errorTitulo).toBe('Datos inválidos');
    expect(res.error).toBeDefined();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('reasignarTasador (TSK-120)', () => {
  it('rechaza si falta el id de tasación', async () => {
    const res = await reasignarTasador(INITIAL, formData({ tasadorId: 't-2' }));
    expect(res).toEqual({ error: 'Tasación inválida.' });
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si no se eligió el nuevo tasador', async () => {
    const res = await reasignarTasador(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/nuevo tasador/);
  });

  it('rechaza si el rol no es admin', async () => {
    mockGetMembresia.mockResolvedValue({ entidad_id: 'ent-1', roles: ['tasador'] } as never);
    const res = await reasignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-2' }),
    );
    expect(res.error).toMatch(/administrador/);
  });

  it('happy path con motivo: reasigna, pasa params, revalida y devuelve ok', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    const res = await reasignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-2', motivo: 'no puede seguir' }),
    );

    expect(rpc).toHaveBeenCalledWith('reasignar_tasacion', {
      p_tasacion_id: 'tas-1',
      p_nuevo_tasador_id: 't-2',
      p_motivo: 'no puede seguir',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones/tas-1');
    expect(res.ok).toMatch(/reasignada/);
  });

  it('sin motivo: omite p_motivo (la RPC lo defaultea a null)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    await reasignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-2' }),
    );

    expect(rpc).toHaveBeenCalledWith('reasignar_tasacion', {
      p_tasacion_id: 'tas-1',
      p_nuevo_tasador_id: 't-2',
    });
  });

  it('traduce el error de especialidad de la RPC (check 23514)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client } = mockSupabase({ code: '23514', message: 'sin especialidad' });
    mockCreateClient.mockResolvedValue(client);

    const res = await reasignarTasador(
      INITIAL,
      formData({ tasacionId: 'tas-1', tasadorId: 't-2' }),
    );

    expect(res.errorTitulo).toBe('Datos inválidos');
    expect(res.error).not.toContain('sin especialidad');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

/** Membresía de un tasador del comité (rol tasador, no admin). */
function membresiaTasador() {
  return { entidad_id: 'ent-1', roles: ['tasador'] } as never;
}

describe('revelarPlanningPoker (TSK-171/SUP-04)', () => {
  it('rechaza si falta el id de tasación', async () => {
    const res = await revelarPlanningPoker(INITIAL, formData({}));
    expect(res).toEqual({ error: 'Tasación inválida.' });
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si la cuenta no tiene membresía', async () => {
    mockGetMembresia.mockResolvedValue(null);
    const res = await revelarPlanningPoker(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/no está vinculada/);
  });

  it('rechaza si el rol no es tasador ni admin (solicitante)', async () => {
    mockGetMembresia.mockResolvedValue({ entidad_id: 'ent-1', roles: ['solicitante'] } as never);
    const res = await revelarPlanningPoker(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/tasador del comité o un administrador/);
  });

  it('happy path como tasador: llama la RPC con _tasacion_id, revalida y devuelve ok', async () => {
    mockGetMembresia.mockResolvedValue(membresiaTasador());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    const res = await revelarPlanningPoker(INITIAL, formData({ tasacionId: 'tas-1' }));

    expect(rpc).toHaveBeenCalledWith('revelar_planning_poker', { _tasacion_id: 'tas-1' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones/tas-1');
    expect(res.ok).toMatch(/revelado/);
    expect(res.error).toBeUndefined();
  });

  it('traduce el error de la RPC (no autorizado 42501)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaTasador());
    const { client } = mockSupabase({ code: '42501', message: 'permission denied' });
    mockCreateClient.mockResolvedValue(client);

    const res = await revelarPlanningPoker(INITIAL, formData({ tasacionId: 'tas-1' }));

    expect(res.errorTitulo).toBe('Sin permiso');
    expect(res.error).not.toContain('permission denied');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('cerrarValorComite (TSK-171/TSK-110/BR-038)', () => {
  it('rechaza si falta el id de tasación', async () => {
    const res = await cerrarValorComite(INITIAL, formData({}));
    expect(res).toEqual({ error: 'Tasación inválida.' });
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si no hay ningún valor (ARS ni USD)', async () => {
    const res = await cerrarValorComite(INITIAL, formData({ tasacionId: 'tas-1' }));
    expect(res.error).toMatch(/valor de cierre en ARS o USD/);
    expect(mockGetMembresia).not.toHaveBeenCalled();
  });

  it('rechaza si el rol no es tasador ni admin', async () => {
    mockGetMembresia.mockResolvedValue({ entidad_id: 'ent-1', roles: ['solicitante'] } as never);
    const res = await cerrarValorComite(
      INITIAL,
      formData({ tasacionId: 'tas-1', valorArs: '1000000' }),
    );
    expect(res.error).toMatch(/tasador del comité o un administrador/);
  });

  it('happy path con nota: parsea montos es-AR, manda los 4 params, revalida y devuelve ok', async () => {
    mockGetMembresia.mockResolvedValue(membresiaAdmin());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    const res = await cerrarValorComite(
      INITIAL,
      formData({
        tasacionId: 'tas-1',
        valorArs: '95.000.000',
        valorUsd: '100000',
        nota: 'Promedio del comité',
      }),
    );

    expect(rpc).toHaveBeenCalledWith('cerrar_valor_comite', {
      _tasacion_id: 'tas-1',
      _valor_ars: 95000000,
      _valor_usd: 100000,
      _nota: 'Promedio del comité',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones/tas-1');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones');
    expect(res.ok).toMatch(/Completada/);
  });

  it('sin nota y solo USD: manda _valor_ars null y _nota null', async () => {
    mockGetMembresia.mockResolvedValue(membresiaTasador());
    const { client, rpc } = mockSupabase(null);
    mockCreateClient.mockResolvedValue(client);

    await cerrarValorComite(INITIAL, formData({ tasacionId: 'tas-1', valorUsd: '120000' }));

    expect(rpc).toHaveBeenCalledWith('cerrar_valor_comite', {
      _tasacion_id: 'tas-1',
      _valor_ars: null,
      _valor_usd: 120000,
      _nota: null,
    });
  });

  it('traduce el error BR-038 de la RPC (nota obligatoria, check 23514)', async () => {
    mockGetMembresia.mockResolvedValue(membresiaTasador());
    const { client } = mockSupabase({ code: '23514', message: 'BR-038: nota obligatoria' });
    mockCreateClient.mockResolvedValue(client);

    const res = await cerrarValorComite(
      INITIAL,
      formData({ tasacionId: 'tas-1', valorArs: '500000000' }),
    );

    expect(res.errorTitulo).toBe('Datos inválidos');
    expect(res.error).not.toContain('BR-038');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('parseMonto', () => {
  it('devuelve null para vacío, null, no numérico y <= 0', () => {
    expect(parseMonto(null)).toBeNull();
    expect(parseMonto('')).toBeNull();
    expect(parseMonto('  ')).toBeNull();
    expect(parseMonto('abc')).toBeNull();
    expect(parseMonto('0')).toBeNull();
    expect(parseMonto('-5')).toBeNull();
  });

  it('parsea enteros y formato es-AR (puntos de miles, coma decimal)', () => {
    expect(parseMonto('1000')).toBe(1000);
    expect(parseMonto('95.000.000')).toBe(95000000);
    expect(parseMonto('1.234,5')).toBe(1234.5);
  });
});

describe('construirTrazabilidad (TSK-122/AC-016)', () => {
  const base = {
    valorFittServiniArs: null,
    valorRobotomusArs: null,
    valorFinalArs: null,
    valorFinalUsd: null,
    cierreAt: null,
    propuestas: [],
  };

  it('mapea los 4 componentes y marca no-cerrado sin cierre_at', () => {
    const m = construirTrazabilidad({
      ...base,
      valorFittServiniArs: 80000000,
      valorRobotomusArs: 90000000,
    });
    expect(m.valorTecnicoArs).toBe(80000000);
    expect(m.valorRobotomusArs).toBe(90000000);
    expect(m.cerrado).toBe(false);
    expect(m.propuestas).toEqual([]);
  });

  it('marca cerrado cuando hay cierre_at y proyecta el valor final', () => {
    const m = construirTrazabilidad({
      ...base,
      cierreAt: '2026-06-10T00:00:00Z',
      valorFinalArs: 95000000,
      valorFinalUsd: 100000,
    });
    expect(m.cerrado).toBe(true);
    expect(m.valorFinalArs).toBe(95000000);
    expect(m.valorFinalUsd).toBe(100000);
  });

  it('proyecta propuestas: autor, prioriza nota_justificativa, detecta firma', () => {
    const m = construirTrazabilidad({
      ...base,
      propuestas: [
        {
          id: 'p1',
          valor_ars: 95000000,
          valor_usd: 100000,
          notas: 'nota libre',
          nota_justificativa: 'justificación BR-038',
          firmado_en: '2026-06-10T00:00:00Z',
          tasador: { nombre: 'Ana', apellido: 'Pérez' },
        },
        {
          id: 'p2',
          valor_ars: null,
          valor_usd: null,
          notas: null,
          nota_justificativa: null,
          firmado_en: null,
          tasador: null,
        },
      ],
    });
    expect(m.propuestas[0]).toEqual({
      id: 'p1',
      autor: 'Ana Pérez',
      valorArs: 95000000,
      valorUsd: 100000,
      nota: 'justificación BR-038',
      firmada: true,
    });
    expect(m.propuestas[1]).toEqual({
      id: 'p2',
      autor: 'Miembro del comité',
      valorArs: null,
      valorUsd: null,
      nota: null,
      firmada: false,
    });
  });
});
