'use client';

import { useActionState } from 'react';
import { crearTasacion, type CrearTasacionState } from './actions';

const TIPOS = [
  { value: 'depto',   label: 'Departamento' },
  { value: 'casa',    label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'galpon',  label: 'Galpón' },
  { value: 'local',   label: 'Local comercial' },
  { value: 'oficina', label: 'Oficina' },
] as const;

const MOTIVOS = [
  { value: 'venta',     label: 'Venta' },
  { value: 'alquiler',  label: 'Alquiler' },
  { value: 'garantia',  label: 'Garantía hipotecaria' },
  { value: 'sucesion',  label: 'Sucesión' },
  { value: 'divorcio',  label: 'Divorcio' },
  { value: 'judicial',  label: 'Judicial' },
  { value: 'contable',  label: 'Contable' },
  { value: 'seguro',    label: 'Seguro' },
  { value: 'donacion',  label: 'Donación' },
  { value: 'otro',      label: 'Otro' },
] as const;

const initialState: CrearTasacionState = {};

export default function NuevaPage() {
  const [state, formAction, pending] = useActionState(crearTasacion, initialState);

  return (
    <div className="max-w-3xl">
      <div className="mb-3xl">
        <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
          RF-022
        </div>
        <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
          Solicitar nueva tasación
        </h1>
        <p className="text-ds-lg text-ink-muted2 mt-sm">
          Completá los datos básicos. Un tasador de la red recibirá la solicitud.
        </p>
      </div>

      {state.error && (
        <div className="mb-lg px-lg py-md rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">{state.error}</p>
        </div>
      )}

      <form
        action={formAction}
        className="bg-surface-card border border-line-soft rounded-xl p-2xl shadow-card space-y-lg"
      >
        <Field label="Dirección" required>
          <input
            name="domicilio"
            type="text"
            required
            minLength={5}
            placeholder="Av. Corrientes 1234, CABA"
            className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <Field label="Tipo de inmueble" required>
            <select
              name="tipo"
              required
              defaultValue="depto"
              className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Motivo" required>
            <select
              name="motivo"
              required
              defaultValue="venta"
              className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
            >
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notas para el tasador">
          <textarea
            name="notas"
            rows={3}
            placeholder="Acceso, horarios, contacto del solicitante..."
            className="w-full px-md py-sm border border-line rounded-md text-ds-md text-ink-primary placeholder:text-ink-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast"
          />
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-md rounded-md bg-brand-primary text-ink-onDark text-ds-md font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Solicitando…' : 'Solicitar tasación'}
        </button>

        <p className="text-ds-xs text-ink-muted text-center">
          Al solicitar, se crea una tasación en estado <b>borrador</b> visible para
          el equipo asignador.
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ds-md font-medium text-ink-secondary block mb-xs">
        {label}
        {required && <span className="text-status-danger ml-xs">*</span>}
      </span>
      {children}
    </label>
  );
}
