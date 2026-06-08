/**
 * TSK-103 — Gate de viewport para el dashboard B2B.
 *
 * El dashboard B2B (app.tasainmuebles.com) está pensado para desktop: el layout
 * usa un `aside` fijo de w-64 + main, sin breakpoint mobile, por lo que en
 * celular/tablet chica se ve cortado y apretado.
 *
 * Solución CSS-first (sin JS de user-agent, sin riesgo de mismatch SSR): por
 * debajo del breakpoint `md` (768px) este componente se muestra (`md:hidden`)
 * y el dashboard se oculta (`hidden md:flex` en el layout). En >=768px pasa lo
 * inverso y el dashboard se ve normal, sin cambios.
 *
 * NOTA: los links de descarga (TestFlight / APK) todavía no están definidos.
 * No inventamos URLs reales: se muestran como "pronto disponible".
 */
export default function MobileGate() {
  return (
    <div className="md:hidden min-h-screen w-full bg-surface-page flex flex-col items-center justify-center px-xl py-3xl text-center">
      <div className="w-full max-w-sm flex flex-col items-center gap-xl">
        <div className="flex items-center gap-sm">
          <div className="w-2xl h-2xl rounded-md bg-brand-primary" />
          <div className="text-left">
            <div className="text-ds-lg font-semibold text-ink-primary leading-none">
              Tasainmuebles
            </div>
            <div className="text-ds-xs text-ink-muted2 mt-xs">Dashboard B2B</div>
          </div>
        </div>

        <div className="w-full bg-surface-card border border-line-soft rounded-lg shadow-card px-xl py-2xl flex flex-col items-center gap-lg">
          <h1 className="text-ds-2xl font-semibold text-ink-primary">
            Usá la app móvil
          </h1>
          <p className="text-ds-md text-ink-secondary leading-relaxed">
            El panel de gestión está optimizado para pantallas grandes. Para
            operar desde el celular, descargá la app de Tasainmuebles.
          </p>

          <div className="w-full flex flex-col gap-sm pt-sm">
            <span
              className="w-full rounded-md bg-line-soft text-ink-muted2 text-ds-sm font-medium px-lg py-md cursor-not-allowed select-none"
              aria-disabled="true"
            >
              iOS (TestFlight) · pronto disponible
            </span>
            <span
              className="w-full rounded-md bg-line-soft text-ink-muted2 text-ds-sm font-medium px-lg py-md cursor-not-allowed select-none"
              aria-disabled="true"
            >
              Android (APK) · pronto disponible
            </span>
          </div>
        </div>

        <p className="text-ds-xs text-ink-muted">
          ¿Necesitás el panel completo? Ingresá desde una computadora.
        </p>
      </div>
    </div>
  );
}
