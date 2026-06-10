import { describe, it, expect, vi, beforeEach } from 'vitest';

const createServerClientMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}));

import { createClient, getUserCached } from './server';

type CookieEntry = { name: string; value: string };

function makeCookieStore() {
  const set = vi.fn();
  const store: CookieEntry[] = [{ name: 'sb', value: 'token' }];
  return {
    getAll: vi.fn(() => store),
    set,
  };
}

describe('server createClient', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    cookiesMock.mockReset();
  });

  it('construye el server client con url, anon key y config de cookies', async () => {
    const cookieStore = makeCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    const fakeClient = { id: 'server-client' };
    createServerClientMock.mockReturnValue(fakeClient);

    const result = await createClient();

    expect(result).toBe(fakeClient);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);

    const [url, key, opts] = createServerClientMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co');
    expect(key).toBe('test-anon-key');
    expect(opts.cookies.getAll()).toBe(cookieStore.getAll.mock.results[0].value);
    expect(cookieStore.getAll).toHaveBeenCalled();
  });

  it('setAll escribe cada cookie en el store', async () => {
    const cookieStore = makeCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    createServerClientMock.mockReturnValue({});

    await createClient();
    const { setAll } = createServerClientMock.mock.calls[0][2].cookies;

    setAll([
      { name: 'a', value: '1', options: { path: '/' } },
      { name: 'b', value: '2', options: {} },
    ]);

    expect(cookieStore.set).toHaveBeenCalledTimes(2);
    expect(cookieStore.set).toHaveBeenCalledWith('a', '1', { path: '/' });
    expect(cookieStore.set).toHaveBeenCalledWith('b', '2', {});
  });

  it('setAll traga el error en contexto RSC (cookieStore.set tira)', async () => {
    const cookieStore = makeCookieStore();
    cookieStore.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action');
    });
    cookiesMock.mockResolvedValue(cookieStore);
    createServerClientMock.mockReturnValue({});

    await createClient();
    const { setAll } = createServerClientMock.mock.calls[0][2].cookies;

    expect(() =>
      setAll([{ name: 'a', value: '1', options: {} }]),
    ).not.toThrow();
  });
});

describe('getUserCached', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue(makeCookieStore());
  });

  it('devuelve el user cuando auth.getUser lo trae', async () => {
    const user = { id: 'user-1', email: 'a@b.com' };
    createServerClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    });

    const result = await getUserCached();
    expect(result).toEqual(user);
  });

  it('devuelve null cuando no hay user', async () => {
    createServerClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const result = await getUserCached();
    expect(result).toBeNull();
  });
});
