import Link from 'next/link';

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-3xl py-xl flex items-center justify-between bg-surface-card border-b border-line-soft">
        <div className="flex items-center gap-sm">
          <div className="w-2xl h-2xl rounded-md bg-brand-primary" />
          <div className="text-ds-xl font-semibold text-ink-primary tracking-tight">
            Tasainmuebles
          </div>
        </div>
        <Link
          href="/login"
          className="text-ds-md font-medium text-brand-primaryDeep hover:text-brand-primaryDeeper transition-colors duration-fast"
        >
          Ingresar
        </Link>
      </header>

      <section className="flex-1 px-3xl py-6xl max-w-5xl mx-auto w-full">
        <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-brand-primaryBg border border-brand-primarySoft mb-xl">
          <span className="w-sm h-sm rounded-full bg-brand-primary" />
          <span className="text-ds-sm font-medium text-brand-primaryDeeper">
            Plataforma B2B de tasaciones inmobiliarias
          </span>
        </div>

        <h1 className="text-ds-6xl font-bold text-ink-primary leading-tight tracking-tight">
          Tasaciones para tu organización,{' '}
          <span className="text-brand-primary">en un solo lugar</span>
        </h1>
        <p className="mt-xl text-ds-xl text-ink-muted2 max-w-2xl leading-relaxed">
          Solicitá tasaciones a tasadores matriculados, seguí su estado en
          tiempo real y gestioná el portafolio completo de tu empresa desde un
          único dashboard.
        </p>

        <div className="mt-3xl flex flex-wrap gap-md">
          <Link
            href="/login"
            className="px-2xl py-md rounded-lg bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base"
          >
            Acceso B2B
          </Link>
          <a
            href="#features"
            className="px-2xl py-md rounded-lg bg-surface-card border border-line text-ink-secondary text-ds-md font-medium hover:border-line-dashed transition-colors duration-base"
          >
            Conocé la plataforma
          </a>
        </div>

        <div
          id="features"
          className="mt-6xl grid grid-cols-1 md:grid-cols-3 gap-lg"
        >
          {[
            {
              title: 'Listado en tiempo real',
              body: 'Todas las tasaciones de tu organización con filtros por estado, tasador y fecha.',
            },
            {
              title: 'Solicitudes en un click',
              body: 'Pedí una tasación y el sistema asigna automáticamente al tasador más cercano.',
            },
            {
              title: 'Métricas que importan',
              body: 'KPIs visuales: volumen, tiempos promedio y valor agregado tasado.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-surface-card border border-line-soft rounded-xl p-xl shadow-card"
            >
              <div className="w-xl h-xl rounded-md bg-brand-primarySoft mb-md" />
              <div className="text-ds-lg font-semibold text-ink-primary">
                {f.title}
              </div>
              <p className="mt-sm text-ds-md text-ink-muted2 leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-3xl py-xl border-t border-line-soft text-ds-sm text-ink-muted">
        © 2026 Tasainmuebles — Plataforma de tasaciones inmobiliarias
      </footer>
    </main>
  );
}
