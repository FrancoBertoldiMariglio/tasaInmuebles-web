import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createSupabaseClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createSupabaseClientMock(...args),
}));

describe('admin createAdminClient', () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('construye el client service-role con opciones de auth', async () => {
    const fake = { id: 'admin-client' };
    createSupabaseClientMock.mockReturnValue(fake);

    const { createAdminClient } = await import('./admin');
    const result = createAdminClient();

    expect(result).toBe(fake);
    expect(createSupabaseClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-role-key',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it('tira Error si falta la service-role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const { createAdminClient } = await import('./admin');

    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });
});
