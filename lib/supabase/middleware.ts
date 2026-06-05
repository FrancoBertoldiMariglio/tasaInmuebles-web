import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

type RolUsuario = Database['public']['Enums']['rol_usuario'];

// Roles habilitados para el dashboard web B2B. El rol 'tasador' opera
// exclusivamente desde la app mobile (flujo de campo), por eso se lo
// redirige a /mobile-only en vez de dejarlo entrar al dashboard.
const ROLES_WEB: ReadonlySet<RolUsuario> = new Set<RolUsuario>([
  'cliente_b2b',
  'admin',
  'comite',
]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() refresca la sesión SSR y reescribe cookies vía setAll.
  // No mover ni envolver en condicionales que lo salteen.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith('/dashboard');

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Rol guard (TSK-33): el dashboard web es solo para cliente_b2b / admin / comite.
  // Un tasador autenticado se redirige a /mobile-only.
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile && !ROLES_WEB.has(profile.rol)) {
      const url = request.nextUrl.clone();
      url.pathname = '/mobile-only';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
