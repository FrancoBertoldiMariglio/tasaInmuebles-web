'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import {
  actualizarRoles,
  quitarMiembro,
  type MiembrosActionState,
} from './actions';
import {
  ROLES_MIEMBRO,
  rolMiembroLabels,
  rolMiembroStyles,
  type RolMiembro,
} from '@/lib/labels';

const initialState: MiembrosActionState = {};

export type MiembroView = {
  userId: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  roles: RolMiembro[];
  esActual: boolean;
};

export default function MiembroRow({ miembro }: { miembro: MiembroView }) {
  const [editando, setEditando] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    actualizarRoles,
    initialState,
  );
  const [bajaState, bajaAction, bajaPending] = useActionState(
    quitarMiembro,
    initialState,
  );

  // TSK-102: al guardar con éxito, `actualizarRoles` devuelve `{ ok }`.
  // Colapsamos el form de edición cuando ese estado CAMBIA a uno con `ok`.
  // Comparamos contra la referencia previa de `editState`: como `useActionState`
  // conserva el estado entre aperturas, un `ok` heredado de un guardado anterior
  // NO debe colapsar el form al reabrirlo (eso pasaría si solo mirásemos la
  // verdad de `editState.ok`). Solo reaccionamos a una transición real de estado.
  const prevEditState = useRef(editState);
  useEffect(() => {
    if (editState !== prevEditState.current) {
      if (editState.ok) setEditando(false);
      prevEditState.current = editState;
    }
  }, [editState]);

  const nombre =
    [miembro.nombre, miembro.apellido].filter(Boolean).join(' ') || '—';

  return (
    <tr className="border-t border-line-soft align-top">
      <td className="px-lg py-md">
        <div className="text-ds-md text-ink-primary font-medium">{nombre}</div>
        <div className="text-ds-sm text-ink-muted2">{miembro.email}</div>
        {miembro.esActual && (
          <div className="text-ds-xs text-ink-muted mt-xs">(vos)</div>
        )}
      </td>
      <td className="px-lg py-md">
        {!editando ? (
          <div className="flex flex-wrap gap-xs">
            {miembro.roles.map((rol) => (
              <span
                key={rol}
                className={`inline-block px-md py-xs rounded-full text-ds-xs font-medium ${rolMiembroStyles[rol]}`}
              >
                {rolMiembroLabels[rol]}
              </span>
            ))}
          </div>
        ) : (
          <form action={editAction} id={`edit-${miembro.userId}`} className="space-y-sm">
            <input type="hidden" name="userId" value={miembro.userId} />
            {/* El admin no puede destildar su propio rol admin (checkbox
                disabled no postea valor): lo preservamos vía hidden. */}
            {miembro.esActual && miembro.roles.includes('admin') && (
              <input type="hidden" name="roles" value="admin" />
            )}
            <div className="flex flex-wrap gap-sm">
              {ROLES_MIEMBRO
                // El rol 'admin' no es asignable desde el ABM (alcance DS-02:
                // tasadores y solicitantes). Solo se muestra como editable si el
                // miembro YA es admin, y nunca se permite destildarlo en la propia
                // fila (anti-lockout). El enforce real vive en la RPC.
                .filter(
                  (rol) =>
                    rol !== 'admin' || miembro.roles.includes('admin'),
                )
                .map((rol) => {
                  const esAdminPropio = rol === 'admin' && miembro.esActual;
                  return (
                    <label
                      key={rol}
                      className={`flex items-center gap-xs px-sm py-xs border border-line rounded-md text-ds-sm ${
                        esAdminPropio
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={rol}
                        defaultChecked={miembro.roles.includes(rol)}
                        disabled={esAdminPropio}
                        className="accent-brand-primary"
                      />
                      {rolMiembroLabels[rol]}
                    </label>
                  );
                })}
            </div>
            {editState.error && (
              <p className="text-ds-xs text-status-danger">{editState.error}</p>
            )}
          </form>
        )}
        {bajaState.error && (
          <p className="text-ds-xs text-status-danger mt-xs">{bajaState.error}</p>
        )}
      </td>
      <td className="px-lg py-md text-right whitespace-nowrap">
        {!editando ? (
          <div className="flex justify-end gap-sm">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="px-md py-xs rounded-md text-ds-sm text-ink-primary border border-line-soft hover:bg-surface-page transition-colors duration-fast"
            >
              Editar roles
            </button>
            {!miembro.esActual && (
              <form action={bajaAction}>
                <input type="hidden" name="userId" value={miembro.userId} />
                <button
                  type="submit"
                  disabled={bajaPending}
                  className="px-md py-xs rounded-md text-ds-sm text-status-danger border border-status-danger/30 hover:bg-status-dangerSoft transition-colors duration-fast disabled:opacity-40"
                >
                  {bajaPending ? 'Quitando…' : 'Quitar'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex justify-end gap-sm">
            <button
              type="submit"
              form={`edit-${miembro.userId}`}
              disabled={editPending}
              className="px-md py-xs rounded-md text-ds-sm font-semibold text-ink-onDark bg-brand-primary hover:bg-brand-primaryDeep transition-colors duration-fast disabled:opacity-40"
            >
              {editPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="px-md py-xs rounded-md text-ds-sm text-ink-muted2 border border-line-soft hover:bg-surface-page transition-colors duration-fast"
            >
              Cancelar
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
