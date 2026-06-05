import { createClient } from '@/lib/supabase/server';

const BUCKET = 'tasacion-fotos';
const SIGNED_URL_TTL_SEGUNDOS = 3600; // 1h

export type FotoTasacion = {
  id: string;
  orden: number;
  descripcion: string | null;
  url: string;
};

type FotoRow = {
  id: string;
  storage_path: string;
  orden: number;
  descripcion: string | null;
};

/**
 * Lee las fotos de una tasación y genera signed URLs (el bucket es privado).
 * Paridad con el mobile (`lib/queries/fotos.ts`): devuelve solo las fotos cuya
 * URL se pudo firmar, ordenadas por `orden`. RLS de `tasacion_fotos` ya acota
 * la lectura a las tasaciones que el user puede ver.
 */
export async function fetchFotosTasacion(
  tasacionId: string,
): Promise<FotoTasacion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tasacion_fotos')
    .select('id, storage_path, orden, descripcion')
    .eq('tasacion_id', tasacionId)
    .order('orden', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as FotoRow[];
  if (rows.length === 0) return [];

  const paths = rows.map((r) => r.storage_path);
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SEGUNDOS);
  if (signErr) throw signErr;

  const urlPorPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && !s.error) urlPorPath.set(s.path as string, s.signedUrl);
  }

  return rows
    .filter((r) => urlPorPath.has(r.storage_path))
    .map((r) => ({
      id: r.id,
      orden: r.orden,
      descripcion: r.descripcion,
      url: urlPorPath.get(r.storage_path) as string,
    }));
}
