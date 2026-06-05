'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { estadoLabels, tipoLabels } from '@/lib/labels';

export type FiltersState = {
  q?: string;
  estado?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
};

type Props = {
  initial: FiltersState;
};

export default function TasacionesFilters({ initial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Cualquier cambio de filtro resetea la paginación a la página 1.
  const apply = useCallback(
    (key: keyof FiltersState, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    apply('q', String(form.get('q') ?? '').trim());
  }

  function handleReset() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasAny = Boolean(
    initial.q || initial.estado || initial.tipo || initial.desde || initial.hasta,
  );

  return (
    <div className="mb-lg bg-surface-card border border-line-soft rounded-xl shadow-card p-lg">
      <div className="flex flex-wrap items-end gap-md">
        <form onSubmit={handleSubmit} className="flex-1 min-w-[240px]">
          <Label>Buscar</Label>
          {/* TSK-76: botón 'Filtrar' explícito + feedback de loading. El
              filtrado por URL sigue funcionando (Enter o click en Filtrar). */}
          <div className="mt-xs flex gap-sm">
            <input
              type="text"
              name="q"
              defaultValue={initial.q ?? ''}
              placeholder="Dirección o N° de tasación"
              disabled={pending}
              className="flex-1 px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={pending}
              className="px-md py-xs rounded-md text-ds-sm font-semibold text-ink-onDark bg-brand-primary hover:bg-brand-primaryDeep transition-colors duration-fast disabled:opacity-40 whitespace-nowrap"
            >
              {pending ? 'Filtrando…' : 'Filtrar'}
            </button>
          </div>
        </form>

        <label className="block min-w-[160px]">
          <Label>Estado</Label>
          <select
            value={initial.estado ?? ''}
            onChange={(e) => apply('estado', e.target.value)}
            disabled={pending}
            className="mt-xs w-full px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
          >
            <option value="">Todos</option>
            {Object.entries(estadoLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[160px]">
          <Label>Tipo</Label>
          <select
            value={initial.tipo ?? ''}
            onChange={(e) => apply('tipo', e.target.value)}
            disabled={pending}
            className="mt-xs w-full px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
          >
            <option value="">Todos</option>
            {Object.entries(tipoLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[140px]">
          <Label>Desde</Label>
          <input
            type="date"
            value={initial.desde ?? ''}
            onChange={(e) => apply('desde', e.target.value)}
            disabled={pending}
            className="mt-xs w-full px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
          />
        </label>

        <label className="block min-w-[140px]">
          <Label>Hasta</Label>
          <input
            type="date"
            value={initial.hasta ?? ''}
            onChange={(e) => apply('hasta', e.target.value)}
            disabled={pending}
            className="mt-xs w-full px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
          />
        </label>

        {hasAny && (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="px-md py-xs rounded-md text-ds-sm text-ink-primary bg-surface-card border border-line-soft hover:bg-surface-page transition-colors duration-fast disabled:opacity-40"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-ds-xs text-ink-muted uppercase tracking-wide">
      {children}
    </span>
  );
}
