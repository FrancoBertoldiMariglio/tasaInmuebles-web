import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpia el DOM montado entre tests para aislamiento.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Env vars que varias libs (cliente Supabase) leen al importarse. En tests no
// pegamos contra Supabase real: los clientes se mockean por test, pero estas
// vars evitan que el throw de validación (TSK-145) dispare en imports legítimos.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
