/**
 * Validación de variables de entorno de Supabase.
 *
 * TSK-145 (WEB-01): antes los clientes usaban `process.env.X!` (non-null
 * assertion). El problema: si en K8s un Secret está mal montado, `process.env.X`
 * queda `undefined` y el `!` lo silencia en tiempo de compilación. El cliente
 * Supabase recibe `undefined` y falla recién en runtime con un error críptico
 * (típicamente "Invalid URL" o un 401 sin contexto), difícil de diagnosticar.
 *
 * Acá validamos explícitamente y, si falta, tiramos un Error descriptivo que
 * apunta directo a la causa probable (Secret mal montado en K8s).
 */

/**
 * Lee `process.env[name]` y tira un Error claro si está vacía o `undefined`.
 *
 * Nota sobre inline de Next: las vars `NEXT_PUBLIC_*` necesitan referenciarse
 * de forma ESTÁTICA (`process.env.NEXT_PUBLIC_FOO`) para que Next las reemplace
 * en build. Por eso los helpers de abajo NO usan `requireEnv` con el nombre por
 * índice dinámico, sino que referencian la env var literalmente y delegan acá
 * solo la validación del valor ya resuelto.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `Verificá que esté definida; en K8s suele deberse a un Secret mal montado ` +
        `o a un nombre de clave incorrecto en el manifiesto del Deployment.`,
    );
  }
  return value;
}

/**
 * URL del proyecto Supabase. Pública (prefijo NEXT_PUBLIC_), referenciada
 * estáticamente para que Next la inline en bundles del cliente.
 */
export function supabaseUrl(): string {
  return requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/**
 * Anon key de Supabase. Pública (prefijo NEXT_PUBLIC_), referenciada
 * estáticamente para el inline de Next.
 */
export function supabaseAnonKey(): string {
  return requireEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Service-role key de Supabase. Server-only (sin prefijo NEXT_PUBLIC_): nunca
 * debe llegar al bundle del cliente.
 */
export function supabaseServiceRoleKey(): string {
  return requireEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
