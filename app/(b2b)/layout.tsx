import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';
import NavLink from '@/components/NavLink';

const navItems = [
  { href: '/dashboard', label: 'Resumen', icon: '◇' },
  { href: '/dashboard/tasaciones', label: 'Tasaciones', icon: '▤' },
  { href: '/dashboard/nueva', label: 'Solicitar', icon: '＋' },
  { href: '/dashboard/metricas', label: 'Métricas', icon: '▦' },
];

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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

        <nav className="flex-1 space-y-xs">
          {navItems.map((item) => (
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
