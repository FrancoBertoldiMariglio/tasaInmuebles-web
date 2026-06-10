import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, getUserCached } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getUserCached: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

// React `cache()` es identidad en runtime de test (no hay request scope), así que
// cada llamada re-ejecuta la función — perfecto para aislar casos.

type QueryResult = { data: unknown; error: unknown };

/**
 * Mock chainable de supabase: `.from().select().eq().order()` resuelve al result.
 * `.order()` es el thenable final (devuelve la promesa con {data, error}).
 */
function mockSupabase(result: QueryResult) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, spies: { from, select, eq, order } };
}

function mockCookieStore(getValue?: string) {
  const set = vi.fn();
  return {
    store: { get: vi.fn(() => (getValue ? { value: getValue } : undefined)), set },
    set,
  };
}

const mockCreateClient = vi.mocked(createClient);
const mockGetUserCached = vi.mocked(getUserCached);
const mockCookies = vi.mocked(cookies);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function importModule() {
  return import('./entidad-activa');
}

describe('listarMembresias', () => {
  it('sin user → [] y no loguea error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUserCached.mockResolvedValue(null as never);

    const { listarMembresias } = await importModule();
    const res = await listarMembresias();

    expect(res).toEqual([]);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('error de query → [] y loguea code/message/userId', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: null,
      error: { code: '42501', message: 'RLS denied' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const { listarMembresias } = await importModule();
    const res = await listarMembresias();

    expect(res).toEqual([]);
    expect(errSpy).toHaveBeenCalledWith(
      '[entidad-activa] listarMembresias falló',
      { code: '42501', message: 'RLS denied', userId: 'user-1' },
    );
  });

  it('happy path → mapea entidades y filtra las que tienen entidad null', async () => {
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: [
        { roles: ['admin'], entidad: { id: 'e1', nombre: 'Colegio', tipo: 'colegio' } },
        { roles: ['tasador'], entidad: null },
        { roles: ['solicitante'], entidad: { id: 'e2', nombre: 'Banco', tipo: 'banco' } },
      ],
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);

    const { listarMembresias } = await importModule();
    const res = await listarMembresias();

    expect(res).toEqual([
      { entidad: { id: 'e1', nombre: 'Colegio', tipo: 'colegio' }, roles: ['admin'] },
      { entidad: { id: 'e2', nombre: 'Banco', tipo: 'banco' }, roles: ['solicitante'] },
    ]);
  });
});

describe('getEntidadActivaId', () => {
  function wireMembresias() {
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: [
        { roles: ['admin'], entidad: { id: 'e1', nombre: 'A', tipo: 'colegio' } },
        { roles: ['admin'], entidad: { id: 'e2', nombre: 'B', tipo: 'banco' } },
      ],
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);
  }

  it('respeta cookie válida', async () => {
    wireMembresias();
    mockCookies.mockResolvedValue(mockCookieStore('e2').store as never);

    const { getEntidadActivaId } = await importModule();
    expect(await getEntidadActivaId()).toBe('e2');
  });

  it('cae a la primera membresía si la cookie no corresponde', async () => {
    wireMembresias();
    mockCookies.mockResolvedValue(mockCookieStore('inexistente').store as never);

    const { getEntidadActivaId } = await importModule();
    expect(await getEntidadActivaId()).toBe('e1');
  });

  it('null si no hay membresías', async () => {
    mockGetUserCached.mockResolvedValue(null as never);

    const { getEntidadActivaId } = await importModule();
    expect(await getEntidadActivaId()).toBeNull();
  });
});

describe('getMembresiaActiva', () => {
  it('devuelve la membresía que matchea la entidad activa', async () => {
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: [
        { roles: ['admin'], entidad: { id: 'e1', nombre: 'A', tipo: 'colegio' } },
        { roles: ['tasador'], entidad: { id: 'e2', nombre: 'B', tipo: 'banco' } },
      ],
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);
    mockCookies.mockResolvedValue(mockCookieStore('e2').store as never);

    const { getMembresiaActiva } = await importModule();
    const res = await getMembresiaActiva();
    expect(res?.entidad.id).toBe('e2');
  });

  it('null si no hay membresías', async () => {
    mockGetUserCached.mockResolvedValue(null as never);
    const { getMembresiaActiva } = await importModule();
    expect(await getMembresiaActiva()).toBeNull();
  });
});

describe('setEntidadActiva', () => {
  it('setea cookie y devuelve true si es miembro', async () => {
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: [{ roles: ['admin'], entidad: { id: 'e1', nombre: 'A', tipo: 'colegio' } }],
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);
    const { store, set } = mockCookieStore();
    mockCookies.mockResolvedValue(store as never);

    const { setEntidadActiva } = await importModule();
    const ok = await setEntidadActiva('e1');

    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith('entidad_activa', 'e1', expect.objectContaining({ httpOnly: true }));
  });

  it('rechaza y loguea si el user no es miembro', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUserCached.mockResolvedValue({ id: 'user-1' } as never);
    const { client } = mockSupabase({
      data: [{ roles: ['admin'], entidad: { id: 'e1', nombre: 'A', tipo: 'colegio' } }],
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);

    const { setEntidadActiva } = await importModule();
    const ok = await setEntidadActiva('otra');

    expect(ok).toBe(false);
    expect(errSpy).toHaveBeenCalledWith(
      '[entidad-activa] setEntidadActiva rechazado: user no es miembro',
      { entidadId: 'otra', userId: 'user-1', membresiasCount: 1 },
    );
  });
});
