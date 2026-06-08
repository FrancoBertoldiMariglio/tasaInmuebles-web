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
 *
 * IMPORTANTE (TSK-36): la tabla `tasaciones` tiene RLS habilitada y su política
 * requiere `auth.uid()` (rol en la entidad). Supabase Realtime evalúa esa misma
 * RLS para decidir qué eventos de postgres_changes entrega a cada socket. El
 * websocket de Realtime NO hereda automáticamente el access token de la sesión
 * SSR (que vive en cookies), así que sin `realtime.setAuth(token)` el socket se
 * autentica como `anon` y la RLS lo deja sin ver ningún row → nunca llegan los
 * eventos de INSERT/UPDATE y el listado no se refresca en vivo. Acá tomamos el
 * token de la sesión del browser y se lo pasamos a Realtime antes de suscribir,
 * y lo refrescamos en cada cambio de auth (token refresh).
 */
export default function TasacionesRealtime({ entidadId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    async function subscribe() {
      // El access token de la sesión SSR (cookies) debe propagarse al socket de
      // Realtime para que la RLS de `tasaciones` lo reconozca como authenticated.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
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
    }

    void subscribe();

    // Si el token se refresca, reasignarlo al socket para no perder la sesión.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [entidadId, router]);

  return null;
}
