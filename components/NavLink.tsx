'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-md px-md py-sm rounded-md text-ds-md transition-colors duration-fast ${
        active
          ? 'bg-brand-primaryBg text-brand-primaryDeeper font-semibold'
          : 'text-ink-secondary hover:bg-surface-pageAlt'
      }`}
    >
      <span className={`text-ds-lg ${active ? 'text-brand-primary' : 'text-ink-muted'}`}>
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}
