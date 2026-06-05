import { redirect } from 'next/navigation';
import { getUserCached } from '@/lib/supabase/server';
import { listarMembresias, getEntidadActivaId } from '@/lib/entidad-activa';
import LogoutButton from '@/components/LogoutButton';
import NavLink from '@/components/NavLink';
import EntidadSelector from '@/components/EntidadSelector';

const navItems = [
  { href: '/dashboard', label: 'Resumen', icon: '◇' },
  { href: '/dashboard/tasaciones', label: 'Tasaciones', icon: '▤' },
  { href: '/dashboard/nueva', label: 'Solicitar', icon: '＋', solicitarRoles: true },
  { href: '/dashboard/metricas', label: 'Métricas', icon: '▦' },
  { href: '/dashboard/miembros', label: 'Miembros', icon: '◍', adminOnly: true },
  { href: '/dashboard/invitar', label: 'Invitar', icon: '✉', adminOnly: true },
] as const;

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  // TSK-86: getUserCached() comparte la lectura del user con listarMembresias /
  // getEntidadActivaId (mismo cache de request), evitando el segundo getUser()
  // que antes hacía el layout además del que ya corre el middleware.
  const [user, membresias, entidadActivaId] = await Promise.all([
    getUserCached(),
    listarMembresias(),
    getEntidadActivaId(),
  ]);
  if (!user) redirect('/login');

  const membresiaActiva =
    membresias.find((m) => m.entidad.id === entidadActivaId) ?? membresias[0] ?? null;
  const roles = membresiaActiva?.roles ?? [];
  const esAdminEntidad = roles.includes('admin');
  // TSK-72: 'Solicitar' solo para quien solicita tasaciones. Un miembro con
  // rol de entidad 'tasador' NO solicita, así que no debe ver el item.
  // admin (ve todo) y solicitante sí; un tasador puro no.
  const puedeSolicitar = esAdminEntidad || roles.includes('solicitante');
  const visibleNav = navItems.filter((item) => {
    if ('adminOnly' in item && item.adminOnly && !esAdminEntidad) return false;
    if ('solicitarRoles' in item && item.solicitarRoles && !puedeSolicitar) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex bg-surface-page">
      <aside className="w-64 bg-surface-card border-r border-line-soft px-lg py-xl flex flex-col">
        <div className="px-sm mb-2xl flex items-center gap-sm">
          <div className="w-2xl h-2xl rounded-md bg-brand-primary" />
          <div>
            <div className="text-ds-lg font-semibold text-ink-primary leading-none">
              Tasainmuebles
            </div>
            <div className="text-ds-xs text-ink-muted2 mt-xs">Dashboard B2B</div>
          </div>
        </div>

        {entidadActivaId && (
          <div className="mb-lg pb-lg border-b border-line-soft">
            <EntidadSelector
              membresias={membresias}
              activaId={entidadActivaId}
            />
          </div>
        )}

        <nav className="flex-1 space-y-xs">
          {visibleNav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line-soft pt-lg mt-lg">
          <div className="px-sm py-xs">
            <div className="text-ds-xs text-ink-muted uppercase tracking-wide">
              Sesión
            </div>
            <div className="text-ds-sm text-ink-secondary truncate mt-xs">
              {user.email}
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 px-4xl py-3xl overflow-auto">{children}</main>
    </div>
  );
}
