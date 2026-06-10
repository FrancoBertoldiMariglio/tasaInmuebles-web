import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * TSK-152 (WEB-08) — Health / readiness check.
 *
 * Problema: la app arranca en K8s aunque las migrations no estén aplicadas
 * (ej. falta la columna generada `numero_busqueda` de 20260605170000) y recién
 * rompe cuando un usuario busca. Este probe ejerce el schema esperado al
 * arrancar, así K8s no enruta tráfico a un pod con drift.
 *
 * Decisión de cliente: usamos el ADMIN client (service-role), no el de sesión.
 *  - Un readiness probe NO debe requerir login: no hay cookies en la request
 *    del kubelet.
 *  - El admin client bypassa RLS, así el SELECT de validación nunca queda
 *    enmascarado por una policy y refleja fielmente el estado del schema.
 *
 * Configuración en K8s: esto va como **readinessProbe** del Deployment
 * (`GET /api/health`), NO como livenessProbe. Un drift transitorio o una DB
 * momentáneamente caída debe sacar el pod de rotación (readiness), pero NO
 * matarlo/reiniciarlo en loop (liveness) — eso solo amplifica el incidente.
 */

// Forzamos ejecución dinámica: el probe debe pegarle a la DB en cada request,
// nunca servir una respuesta cacheada en build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // SELECT liviano que valida tabla + columna generada sin traer filas
    // (limit 0). Si `numero_busqueda` o `tasaciones` no existen por drift de
    // migrations, PostgREST devuelve error y caemos al catch.
    const { error } = await supabase
      .from('tasaciones')
      .select('numero_busqueda')
      .limit(0);

    if (error) {
      // Saneamos: exponemos solo code/message, sin stack ni detalles internos.
      const detalle = error.code
        ? `${error.code}: ${error.message}`
        : error.message;
      console.error('[health] schema/DB check falló:', detalle);
      return NextResponse.json(
        { status: 'unhealthy', error: detalle },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (e) {
    // Errores no-PostgREST: DB caída, env var faltante (Secret mal montado), etc.
    const mensaje = e instanceof Error ? e.message : 'error desconocido';
    console.error('[health] probe lanzó excepción:', mensaje);
    return NextResponse.json(
      { status: 'unhealthy', error: mensaje },
      { status: 503 },
    );
  }
}
