import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { GET } from './route';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const mockCreateAdminClient = vi.mocked(createAdminClient);

/**
 * Mock del admin client: `.from().select().limit()` resuelve al `result`.
 * `.limit()` es el thenable final que devuelve { error }.
 */
function mockAdmin(result: { error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  return { from, select, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/health', () => {
  it('devuelve 200 { status: ok } cuando el schema está sano', async () => {
    const spies = mockAdmin({ error: null });
    mockCreateAdminClient.mockReturnValue({ from: spies.from } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
    // Ejerce tabla + columna generada sin traer filas.
    expect(spies.from).toHaveBeenCalledWith('tasaciones');
    expect(spies.select).toHaveBeenCalledWith('numero_busqueda');
    expect(spies.limit).toHaveBeenCalledWith(0);
  });

  it('devuelve 503 unhealthy cuando la query da error de schema (drift)', async () => {
    const spies = mockAdmin({
      error: { code: '42703', message: 'column tasaciones.numero_busqueda does not exist' },
    });
    mockCreateAdminClient.mockReturnValue({ from: spies.from } as never);

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.error).toContain('42703');
    expect(body.error).toContain('numero_busqueda');
  });

  it('devuelve 503 con error de mensaje cuando el error no trae code', async () => {
    const spies = mockAdmin({ error: { message: 'connection refused' } });
    mockCreateAdminClient.mockReturnValue({ from: spies.from } as never);

    const res = await GET();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      status: 'unhealthy',
      error: 'connection refused',
    });
  });

  it('devuelve 503 cuando crear el cliente lanza excepción (env faltante / DB caída)', async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
    });

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
