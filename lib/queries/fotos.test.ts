import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFotosTasacion } from './fotos';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);

/**
 * Arma un mock del client de Supabase para fetchFotosTasacion.
 * - `select` resuelve a { data: rows, error: rowsError } tras la cadena
 *   .from().select().eq().order().
 * - storage.from().createSignedUrls() resuelve a { data: signed, error: signErr }.
 */
function mockClient(opts: {
  rows?: unknown;
  rowsError?: unknown;
  signed?: unknown;
  signErr?: unknown;
}) {
  const order = vi.fn().mockResolvedValue({
    data: opts.rows ?? null,
    error: opts.rowsError ?? null,
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const createSignedUrls = vi.fn().mockResolvedValue({
    data: opts.signed ?? null,
    error: opts.signErr ?? null,
  });
  const storageFrom = vi.fn().mockReturnValue({ createSignedUrls });

  return {
    client: { from, storage: { from: storageFrom } },
    from,
    select,
    eq,
    order,
    storageFrom,
    createSignedUrls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchFotosTasacion', () => {
  it('mapea las fotos a signed URLs ordenadas', async () => {
    const m = mockClient({
      rows: [
        { id: 'f1', storage_path: 'p/1.jpg', orden: 0, descripcion: 'frente' },
        { id: 'f2', storage_path: 'p/2.jpg', orden: 1, descripcion: null },
      ],
      signed: [
        { path: 'p/1.jpg', signedUrl: 'https://signed/1', error: null },
        { path: 'p/2.jpg', signedUrl: 'https://signed/2', error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await fetchFotosTasacion('tas-1');

    expect(m.from).toHaveBeenCalledWith('tasacion_fotos');
    expect(m.eq).toHaveBeenCalledWith('tasacion_id', 'tas-1');
    expect(m.storageFrom).toHaveBeenCalledWith('tasacion-fotos');
    expect(m.createSignedUrls).toHaveBeenCalledWith(['p/1.jpg', 'p/2.jpg'], 3600);
    expect(res).toEqual([
      { id: 'f1', orden: 0, descripcion: 'frente', url: 'https://signed/1' },
      { id: 'f2', orden: 1, descripcion: null, url: 'https://signed/2' },
    ]);
  });

  it('descarta fotos cuya URL no se pudo firmar', async () => {
    const m = mockClient({
      rows: [
        { id: 'f1', storage_path: 'p/1.jpg', orden: 0, descripcion: null },
        { id: 'f2', storage_path: 'p/2.jpg', orden: 1, descripcion: null },
      ],
      signed: [
        { path: 'p/1.jpg', signedUrl: 'https://signed/1', error: null },
        { path: 'p/2.jpg', signedUrl: null, error: { message: 'not found' } },
      ],
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await fetchFotosTasacion('tas-1');

    expect(res).toEqual([
      { id: 'f1', orden: 0, descripcion: null, url: 'https://signed/1' },
    ]);
  });

  it('sin fotos → devuelve [] sin llamar a storage', async () => {
    const m = mockClient({ rows: [] });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await fetchFotosTasacion('tas-1');

    expect(res).toEqual([]);
    expect(m.storageFrom).not.toHaveBeenCalled();
  });

  it('data null → devuelve []', async () => {
    const m = mockClient({ rows: null });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await fetchFotosTasacion('tas-1');

    expect(res).toEqual([]);
  });

  it('error al leer filas → propaga el error', async () => {
    const m = mockClient({ rowsError: new Error('rls denied') });
    mockCreateClient.mockResolvedValue(m.client as never);

    await expect(fetchFotosTasacion('tas-1')).rejects.toThrow('rls denied');
  });

  it('error en createSignedUrls → propaga el error', async () => {
    const m = mockClient({
      rows: [{ id: 'f1', storage_path: 'p/1.jpg', orden: 0, descripcion: null }],
      signErr: new Error('signing failed'),
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    await expect(fetchFotosTasacion('tas-1')).rejects.toThrow('signing failed');
  });

  it('signed null → todas las fotos descartadas (devuelve [])', async () => {
    const m = mockClient({
      rows: [{ id: 'f1', storage_path: 'p/1.jpg', orden: 0, descripcion: null }],
      signed: null,
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await fetchFotosTasacion('tas-1');

    expect(res).toEqual([]);
  });
});
