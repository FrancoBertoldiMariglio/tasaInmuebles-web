import Link from 'next/link';

const cards = [
  {
    href: '/dashboard/tasaciones',
    eyebrow: 'Listado',
    title: 'Ver tasaciones',
    body: 'Todas las tasaciones de tu organización con filtros y estados.',
    accent: 'bg-brand-primarySoft',
  },
  {
    href: '/dashboard/nueva',
    eyebrow: 'Acción rápida',
    title: 'Solicitar nueva',
    body: 'Generá una nueva solicitud de tasación en menos de un minuto.',
    accent: 'bg-status-successSoft',
  },
  {
    href: '/dashboard/metricas',
    eyebrow: 'KPIs',
    title: 'Ver métricas',
    body: 'Volumen, tiempos y valor agregado tasado en tiempo real.',
    accent: 'bg-status-infoSoft',
  },
];

export default function DashboardHome() {
  return (
    <div className="max-w-6xl">
      <div className="mb-3xl">
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          Panel B2B
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Resumen
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          Bienvenido al panel de control de tu organización.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group bg-surface-card border border-line-soft rounded-xl p-xl shadow-card hover:shadow-cardHover transition-shadow duration-base"
          >
            <div className={`w-3xl h-3xl rounded-lg ${c.accent} mb-lg`} />
            <div className="text-ds-xs font-medium text-ink-muted uppercase tracking-wide">
              {c.eyebrow}
            </div>
            <div className="text-ds-xl font-semibold text-ink-primary mt-xs group-hover:text-brand-primaryDeep transition-colors duration-fast">
              {c.title}
            </div>
            <p className="text-ds-md text-ink-muted2 mt-sm leading-relaxed">
              {c.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
