'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarEntidadActiva } from '@/app/(b2b)/dashboard/nueva/actions';
import type { Membresia } from '@/lib/entidad-activa';

type Props = {
  membresias: Membresia[];
  activaId: string;
};

export default function EntidadSelector({ membresias, activaId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Si tiene una sola entidad, no mostramos selector — solo el nombre.
  if (membresias.length <= 1) {
    const m = membresias[0];
    if (!m) return null;
    return (
      <div className="px-sm py-xs">
        <div className="text-ds-xs text-ink-muted uppercase tracking-wide">
          Organización
        </div>
        <div className="text-ds-sm text-ink-primary font-medium truncate mt-xs">
          {m.entidad.nombre}
        </div>
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevo = e.target.value;
    if (nuevo === activaId) return;
    startTransition(async () => {
      await cambiarEntidadActiva(nuevo);
      router.refresh();
    });
  }

  return (
    <div className="px-sm py-xs">
      <label className="block">
        <span className="text-ds-xs text-ink-muted uppercase tracking-wide">
          Organización
        </span>
        <select
          value={activaId}
          onChange={handleChange}
          disabled={pending}
          className="mt-xs w-full px-sm py-xs border border-line rounded-md text-ds-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow duration-fast disabled:opacity-40"
        >
          {membresias.map((m) => (
            <option key={m.entidad.id} value={m.entidad.id}>
              {m.entidad.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
