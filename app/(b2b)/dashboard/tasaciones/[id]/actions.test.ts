import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { revalidatePath } from 'next/cache';
import { asignarTasador, type AsignarTasadorState } from './actions';

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
