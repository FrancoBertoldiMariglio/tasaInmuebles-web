import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { supabaseUrl, supabaseAnonKey } from './env';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC context: setAll no-op; refresh happens in middleware.
          }
        },
      },
    },
  );
}

/**
 * Devuelve el user autenticado, deduplicado por request vía React `cache()`.
 *
 * TSK-86: en un mismo render RSC (layout + page + libs de sesión) varias
 * funciones necesitan el user. Sin cache, cada `supabase.auth.getUser()` es un
 * round-trip a Supabase (~150ms desde Argentina). `cache()` memoiza el
 * resultado por request, así el layout, las libs de membresía y las pages
 * reusan la misma lectura en vez de re-pegarle al servidor.
 *
 * No reemplaza el `getUser()` del middleware (ese refresca la sesión y reescribe
 * cookies; corre en otro contexto y no comparte este cache).
 */
export const getUserCached = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
