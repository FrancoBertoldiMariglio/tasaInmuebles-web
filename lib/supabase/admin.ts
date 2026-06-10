import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { supabaseUrl, supabaseServiceRoleKey } from './env';

/**
 * Cliente Supabase con SERVICE-ROLE. Bypassa RLS y habilita la Admin API
 * (auth.admin.inviteUserByEmail, etc.). NUNCA debe importarse desde código
 * que llegue al cliente: el import de 'server-only' rompe el build si ocurre.
 *
 * La service-role key vive en SUPABASE_SERVICE_ROLE_KEY (server-only env var,
 * sin prefijo NEXT_PUBLIC_).
 */
export function createAdminClient() {
  // Validación centralizada en ./env: tira Error descriptivo (apuntando a
  // Secret mal montado en K8s) si la URL o la service-role key faltan.
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
