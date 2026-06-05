import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import AgregarMiembroForm from './AgregarMiembroForm';
import MiembroRow, { type MiembroView } from './MiembroRow';
import type { RolMiembro } from '@/lib/labels';

export default async function MiembrosPage() {
  const membresia = await getMembresiaActiva();

  if (!membresia) {
    return (
      <Panel
        titulo="Sin organización activa"
        cuerpo="Tu cuenta no tiene una entidad asociada todavía."
      />
    );
  }

  if (!membresia.roles.includes('admin')) {
    return (
      <Panel
        titulo="Acceso restringido"
        cuerpo="Solo el administrador de la organización puede gestionar los miembros (tasadores y solicitantes)."
      />
    );
  }

  const entidadId = membresia.entidad.id;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('listar_miembros_entidad', {
    _entidad: entidadId,
  });

  const miembros: MiembroView[] = (data ?? []).map((m) => ({
    userId: m.user_id,
    email: m.email,
    nombre: m.nombre,
    apellido: m.apellido,
    roles: m.roles as RolMiembro[],
    esActual: m.user_id === user?.id,
  }));

  return (
    <div className="max-w-5xl space-y-2xl">
      <div>
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          DS-02 · Administración de entidad
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Miembros
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          Gestioná los tasadores y solicitantes de{' '}
          <span className="font-medium text-ink-primary">{membresia.entidad.nombre}</span>.
        </p>
      </div>

      <AgregarMiembroForm />

      {error && (
        <div className="px-lg py-md rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">
            Error al cargar miembros: {error.message}
          </p>
        </div>
      )}

      <div className="bg-surface-card border border-line-soft rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-ds-md">
          <thead className="bg-surface-pageAlt">
            <tr>
              <th className="px-lg py-md text-left text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Usuario
              </th>
              <th className="px-lg py-md text-left text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Roles
              </th>
              <th className="px-lg py-md text-right text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {miembros.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-lg py-4xl text-center">
                  <div className="text-ds-md text-ink-muted2">
                    No hay miembros todavía.
                  </div>
                  <div className="text-ds-sm text-ink-muted mt-xs">
                    Agregá tasadores o solicitantes con el formulario de arriba.
                  </div>
                </td>
              </tr>
            ) : (
              miembros.map((m) => <MiembroRow key={m.userId} miembro={m} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Panel({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return (
    <div className="max-w-3xl">
      <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
        <h1 className="text-ds-2xl font-bold text-ink-primary">{titulo}</h1>
        <p className="text-ds-md text-ink-muted2 mt-sm">{cuerpo}</p>
      </div>
    </div>
  );
}
