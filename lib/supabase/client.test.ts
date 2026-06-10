import { describe, it, expect, vi, beforeEach } from 'vitest';

const createBrowserClientMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClientMock(...args),
}));

import { createClient } from './client';

describe('client createClient', () => {
  beforeEach(() => {
    createBrowserClientMock.mockReset();
  });

  it('construye el browser client con url y anon key', () => {
    const fake = { id: 'browser-client' };
    createBrowserClientMock.mockReturnValue(fake);

    const result = createClient();

    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
    );
    expect(result).toBe(fake);
  });
});
