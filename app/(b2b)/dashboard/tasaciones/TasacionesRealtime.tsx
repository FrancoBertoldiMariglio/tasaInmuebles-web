'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Props = {
  entidadId: string;
};

/**
 * Suscripción Realtime al listado de tasaciones.
 *
 * page.tsx es Server Component, así que la suscripción a postgres_changes
 * vive en este wrapper cliente. Cuando un tasador cambia el estado de una
 * tasación desde mobile, refrescamos el RSC con router.refresh() para que
 * el listado server-side se vuelva a ejecutar con los filtros vigentes.
 */
export default function TasacionesRealtime({ entidadId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tasaciones-entidad-${entidadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasaciones',
          filter: `entidad_id=eq.${entidadId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entidadId, router]);

  return null;
}
