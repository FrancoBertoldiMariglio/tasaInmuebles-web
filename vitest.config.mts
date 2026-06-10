import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Config de Vitest para el dashboard B2B (TSK-154).
// - jsdom para componentes/server-actions que tocan DOM o Web APIs.
// - tsconfigPaths resuelve el alias `@/*` igual que Next.
// - coverage v8; el listado de `include` se enfoca en la lógica testeable
//   (libs, server actions, helpers de página) y excluye scaffolding/tipos.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` lanza si se importa fuera de un RSC; en tests lo aliaseamos
      // a un stub no-op para poder ejercer módulos server (ej. lib/supabase/admin).
      'server-only': new URL('./test/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'lib/**/*.{ts,tsx}',
        'app/**/actions.ts',
      ],
      exclude: [
        '**/*.d.ts',
        'types/**',
        'lib/supabase/middleware.ts',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
