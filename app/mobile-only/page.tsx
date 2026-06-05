import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

// Pantalla a la que se redirige a usuarios con rol 'tasador' (TSK-33).
// El dashboard web es solo para cliente_b2b / admin / comite; el tasador
// trabaja desde la app mobile (flujo de campo).
export default function MobileOnlyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-lg bg-surface-page">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-sm mb-xl">
          <div className="w-xl h-xl rounded-md bg-brand-primary" />
          <span className="text-ds-lg font-semibold text-ink-primary">
            Tasainmuebles
          </span>
        </div>

        <div className="bg-surface-card border border-line-soft rounded-xl p-2xl shadow-card space-y-lg">
          <h1 className="text-ds-2xl font-bold text-ink-primary">
            Usá la app mobile
          </h1>
          <p className="text-ds-md text-ink-muted2">
            El dashboard web es para clientes, administradores y el comité de
            tasación. Como tasador, tu trabajo de campo se hace desde la app
            mobile de Tasainmuebles.
          </p>
          <p className="text-ds-sm text-ink-muted">
            Descargá la app e ingresá con las mismas credenciales.
          </p>

          <div className="pt-sm">
            <LogoutButton />
          </div>
        </div>

        <p className="mt-lg text-ds-sm text-ink-muted text-center">
          <Link
            href="/login"
            className="hover:text-ink-primary transition-colors duration-fast"
          >
            Ingresar con otra cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}
