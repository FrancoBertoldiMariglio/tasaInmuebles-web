import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase con SERVICE-ROLE. Bypassa RLS y habilita la Admin API
 * (auth.admin.inviteUserByEmail, etc.). NUNCA debe importarse desde código
 * que llegue al cliente: el import de 'server-only' rompe el build si ocurre.
 *
 * La service-role key vive en SUPABASE_SERVICE_ROLE_KEY (server-only env var,
 * sin prefijo NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente admin.',
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
