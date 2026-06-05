import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getEntidadActivaId } from '@/lib/entidad-activa';
import {
  estadoLabels,
  estadoStyles,
  tipoLabels,
  tasadorNombreDisplay,
  esEsperandoAsignacion,
  type EstadoTasacion,
  type TipoInmueble,
  type TasadorDisplay,
} from '@/lib/labels';
import { startOfDayBusinessTz, endOfDayBusinessTz } from '@/lib/timezone';
import TasacionesFilters, { type FiltersState } from './TasacionesFilters';
import TasacionesRealtime from './TasacionesRealtime';

const PAGE_SIZE = 25;

type SearchParams = {
  page?: string;
  q?: string;
  estado?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  sort?: string;
  dir?: string;
};

// TSK-73: columnas ordenables. Mapea la clave de sort (searchParam) a la
// columna real de Supabase. Solo se permiten estas claves; cualquier otra
// cae al orden por defecto.
const SORT_COLUMNS = {
  numero: 'numero',
  fecha: 'created_at',
  tipo: 'tipo',
  direccion: 'domicilio',
  estado: 'estado',
  valor: 'valor_usd',
} as const;

type SortKey = keyof typeof SORT_COLUMNS;
type SortDir = 'asc' | 'desc';

const SORT_KEYS_VALIDOS = new Set(Object.keys(SORT_COLUMNS));

function parseSort(raw: string | undefined): SortKey | undefined {
  return raw && SORT_KEYS_VALIDOS.has(raw) ? (raw as SortKey) : undefined;
}

function parseDir(raw: string | undefined): SortDir {
  return raw === 'asc' ? 'asc' : 'desc';
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const ESTADOS_VALIDOS = new Set(Object.keys(estadoLabels));
const TIPOS_VALIDOS = new Set(Object.keys(tipoLabels));
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseEstado(raw: string | undefined): EstadoTasacion | undefined {
  return raw && ESTADOS_VALIDOS.has(raw) ? (raw as EstadoTasacion) : undefined;
}

function parseTipo(raw: string | undefined): TipoInmueble | undefined {
  return raw && TIPOS_VALIDOS.has(raw) ? (raw as TipoInmueble) : undefined;
}

function parseFecha(raw: string | undefined): string | undefined {
  return raw && FECHA_RE.test(raw) ? raw : undefined;
}

// Límite de int4 en Postgres (columna `numero`). Términos por encima de esto
// desbordarían el cast y harían fallar el filtro `numero.eq`.
const INT4_MAX = 2147483647;

// Construye un filtro OR para Supabase a partir del término de búsqueda.
//
// TSK-71 (mismo bug que TSK-63 en mobile): si el término es PURAMENTE
// NUMÉRICO se matchea SOLO por número de tasación — nunca por domicilio —
// para evitar matches "fantasma" (buscar "23" traía "Av. San Martín 1234" o
// "25 de Mayo 2300" por el domicilio). El criterio numérico del web es de
// IGUALDAD EXACTA sobre el entero: buscar "23" (o "0023") devuelve únicamente
// la tasación #23. Como `numero` es int4, "23" y "0023" colapsan al mismo
// entero tras quitar ceros a la izquierda, así que un único `numero.eq.<n>`
// cubre ambas formas.
//
// DIVERGENCIA CONSCIENTE CON MOBILE (TSK-63 vs TSK-71): el mobile
// (lib/estado-tasacion.ts:buscarTasaciones) hace búsqueda por SUBSTRING sobre
// el número crudo y el padded — ahí "23" matchea #23, #230, #1234 y #0023.
// Web NO replica ese substring: el número de tasación es un ID y la búsqueda
// exacta es el comportamiento esperado para un ID. La paridad real por
// substring no es expresable en un `.or()` de PostgREST sobre una columna int4
// sin una columna texto/generada en la BD (cambio de schema fuera de alcance
// de este worktree web-only). Pendiente: alinear mobile a igualdad exacta o,
// si se prioriza el substring, agregar `numero_texto` generado + migration.
//
// Si el término es texto, se matchea por domicilio (ilike) como antes.
//
// Devuelve `null` cuando el término es numérico pero inválido (desborda int4,
// notación científica, etc.): no hay cláusula posible, el caller no debe
// aplicar ningún `.or()` y el listado sale vacío en vez de explotar.
function buildSearchOr(term: string): string | null {
  const safe = term.replace(/[%,()]/g, ' ').trim();
  if (!safe) return null;

  // Puramente numérico: solo dígitos (con posibles ceros a la izquierda).
  const esNumerica = /^\d+$/.test(safe);
  if (esNumerica) {
    // Igualdad exacta: quitar ceros a la izquierda para colapsar "0023" y "23"
    // al mismo entero (no es substring — ver nota de divergencia con mobile).
    const sinCeros = safe.replace(/^0+/, '') || '0';
    const asNum = Number(sinCeros);
    // Validar overflow int4 / notación científica: el término ya pasó el
    // regex de solo-dígitos, pero igual chequeamos rango para no romper el
    // cast en Postgres.
    if (!Number.isSafeInteger(asNum) || asNum <= 0 || asNum > INT4_MAX) {
      return null;
    }
    return `numero.eq.${asNum}`;
  }

  // Término de texto: matchear domicilio.
  return `domicilio.ilike.%${safe}%`;
}

export default async function TasacionesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const q = sp.q?.trim() || undefined;
  const estado = parseEstado(sp.estado);
  const tipo = parseTipo(sp.tipo);
  const desde = parseFecha(sp.desde);
  const hasta = parseFecha(sp.hasta);
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);

  const filtros: FiltersState = { q, estado, tipo, desde, hasta };

  const supabase = await createClient();
  const entidadId = await getEntidadActivaId();

  if (!entidadId) {
    return (
      <div className="max-w-3xl">
        <div className="bg-surface-card border border-line-soft rounded-xl shadow-card p-xl">
          <h1 className="text-ds-2xl font-bold text-ink-primary">
            Sin organización activa
          </h1>
          <p className="text-ds-md text-ink-muted2 mt-sm">
            Tu cuenta no tiene una entidad asociada todavía. Pedile al
            administrador que te invite a una organización.
          </p>
        </div>
      </div>
    );
  }

  // Construye un query con los filtros vigentes (por searchParams) aplicados.
  // El mismo set de filtros se usa para el count y para la página de datos,
  // así la paginación server-side refleja el universo filtrado.
  let countQuery = supabase
    .from('tasaciones')
    .select('id', { count: 'exact', head: true })
    .eq('entidad_id', entidadId);
  let dataQuery = supabase
    .from('tasaciones')
    .select('id, numero, created_at, estado, tipo, domicilio, valor_usd, motivo')
    .eq('entidad_id', entidadId);

  if (estado) {
    countQuery = countQuery.eq('estado', estado);
    dataQuery = dataQuery.eq('estado', estado);
  }
  if (tipo) {
    countQuery = countQuery.eq('tipo', tipo);
    dataQuery = dataQuery.eq('tipo', tipo);
  }
  if (desde) {
    const desdeTs = startOfDayBusinessTz(desde);
    countQuery = countQuery.gte('created_at', desdeTs);
    dataQuery = dataQuery.gte('created_at', desdeTs);
  }
  if (hasta) {
    const hastaTs = endOfDayBusinessTz(hasta);
    countQuery = countQuery.lte('created_at', hastaTs);
    dataQuery = dataQuery.lte('created_at', hastaTs);
  }
  if (q) {
    const orClause = buildSearchOr(q);
    if (orClause) {
      countQuery = countQuery.or(orClause);
      dataQuery = dataQuery.or(orClause);
    } else {
      // Término numérico inválido (overflow int4 / notación científica):
      // no hay match posible. Forzamos resultado vacío sin pegarle a la BD
      // con un filtro que rompería el cast.
      const sinResultados = `numero.eq.0`;
      countQuery = countQuery.or(sinResultados);
      dataQuery = dataQuery.or(sinResultados);
    }
  }

  // Orden server-side (TSK-73). Por defecto: más reciente primero. Si hay
  // sort explícito, ordena por esa columna con `numero` como desempate
  // estable para que la paginación range() sea determinística.
  const ascending = dir === 'asc';
  const orderedDataQuery = sort
    ? dataQuery
        .order(SORT_COLUMNS[sort], { ascending })
        .order('numero', { ascending: false })
    : dataQuery.order('created_at', { ascending: false });

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    orderedDataQuery.range(from, to),
  ]);

  const items = data ?? [];
  const total = count ?? 0;

  // TSK-85: el tasador asignado no se puede leer con un join directo a profiles
  // (la RLS `profile_select` solo deja ver el propio profile). La RPC
  // SECURITY DEFINER `tasadores_de_entidad` valida que el caller sea miembro de
  // la entidad y devuelve el display del tasador por tasación. Construimos un
  // map id→tasador; las tasaciones ausentes (tasador_id NULL, DS-22) quedan
  // como "Sin asignar" / "Esperando asignación" en el render.
  const { data: tasadoresRaw } = await supabase.rpc('tasadores_de_entidad', {
    _entidad: entidadId,
  });
  const tasadorPorTasacion = new Map<string, TasadorDisplay>();
  for (const row of tasadoresRaw ?? []) {
    tasadorPorTasacion.set(row.tasacion_id, {
      user_id: row.user_id,
      nombre: row.nombre,
      apellido: row.apellido,
      email: row.email,
      matricula: row.matricula,
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const hayFiltros = Boolean(q || estado || tipo || desde || hasta);

  // Params base con los filtros + orden vigentes. Tanto la paginación como
  // los headers ordenables parten de acá para conservar todo el contexto.
  const baseParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return params;
  };

  // Conserva filtros + orden vigentes al paginar.
  const buildPageHref = (targetPage: number): string => {
    const params = baseParams();
    if (sort) {
      params.set('sort', sort);
      params.set('dir', dir);
    }
    params.set('page', String(targetPage));
    return `/dashboard/tasaciones?${params.toString()}`;
  };

  // Href de un header ordenable: 1er click DESC, 2do click ASC. Cambiar el
  // orden conserva los filtros y vuelve a la página 1.
  const buildSortHref = (key: SortKey): string => {
    const params = baseParams();
    const nextDir: SortDir = sort === key && dir === 'desc' ? 'asc' : 'desc';
    params.set('sort', key);
    params.set('dir', nextDir);
    return `/dashboard/tasaciones?${params.toString()}`;
  };

  return (
    <div className="max-w-6xl">
      <TasacionesRealtime entidadId={entidadId} />
      <div className="mb-3xl flex items-end justify-between">
        <div>
          <div className="text-ds-sm font-medium text-ink-muted uppercase tracking-wide">
            RF-021
          </div>
          <h1 className="text-ds-4xl font-bold text-ink-primary tracking-tight mt-xs">
            Tasaciones
          </h1>
          <p className="text-ds-lg text-ink-muted2 mt-sm">
            Listado de tasaciones de tu organización.
          </p>
        </div>
        <div className="flex items-center gap-md">
          <div className="text-ds-sm text-ink-muted2">
            {total} resultado{total === 1 ? '' : 's'}
          </div>
          <Link
            href="/dashboard/nueva"
            className="px-lg py-sm rounded-md bg-brand-primary text-ink-onDark text-ds-sm font-semibold shadow-card hover:bg-brand-primaryDeep transition-colors duration-base"
          >
            + Nueva
          </Link>
        </div>
      </div>

      <TasacionesFilters initial={filtros} />

      {error && (
        <div className="mb-lg px-lg py-md rounded-md bg-status-dangerSoft border border-status-danger/30">
          <p className="text-ds-sm text-status-danger font-medium">
            Error: {error.message}
          </p>
        </div>
      )}

      <div className="bg-surface-card border border-line-soft rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-ds-md">
          <thead className="bg-surface-pageAlt">
            <tr>
              <Th sortKey="numero" activeSort={sort} dir={dir} href={buildSortHref('numero')}>N°</Th>
              <Th sortKey="fecha" activeSort={sort} dir={dir} href={buildSortHref('fecha')}>Fecha</Th>
              <Th sortKey="tipo" activeSort={sort} dir={dir} href={buildSortHref('tipo')}>Tipo</Th>
              <Th sortKey="direccion" activeSort={sort} dir={dir} href={buildSortHref('direccion')}>Dirección</Th>
              <Th sortKey="estado" activeSort={sort} dir={dir} href={buildSortHref('estado')}>Estado</Th>
              <ThPlain>Tasador</ThPlain>
              <Th sortKey="valor" activeSort={sort} dir={dir} href={buildSortHref('valor')} align="right">Valor USD</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-lg py-4xl text-center">
                  <div className="text-ds-md text-ink-muted2">
                    {hayFiltros
                      ? 'No hay tasaciones que coincidan con los filtros.'
                      : 'No hay tasaciones todavía.'}
                  </div>
                  <div className="text-ds-sm text-ink-muted mt-xs">
                    {hayFiltros
                      ? 'Probá ajustar la búsqueda o limpiar los filtros.'
                      : 'Las tasaciones que tu equipo solicite aparecerán acá.'}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const estado = t.estado as EstadoTasacion;
                const tipo = t.tipo as TipoInmueble;
                const href = `/dashboard/tasaciones/${t.id}`;
                const tasador = tasadorPorTasacion.get(t.id) ?? null;
                const tasadorNombre = tasadorNombreDisplay(tasador);
                const esperando = esEsperandoAsignacion(estado, tasador);
                return (
                  <tr
                    key={t.id}
                    className="border-t border-line-soft hover:bg-surface-page transition-colors duration-fast cursor-pointer"
                  >
                    <Td href={href} className="text-ink-primary tabular-nums font-medium">
                      #{String(t.numero).padStart(4, '0')}
                    </Td>
                    <Td href={href} className="text-ink-muted2">
                      {new Date(t.created_at).toLocaleDateString('es-AR')}
                    </Td>
                    <Td href={href} className="text-ink-primary">
                      {tipoLabels[tipo] ?? tipo}
                    </Td>
                    <Td href={href} className="text-ink-primary">
                      {t.domicilio ?? '—'}
                    </Td>
                    <Td href={href}>
                      <span
                        className={`inline-block px-md py-xs rounded-full text-ds-xs font-medium ${
                          estadoStyles[estado] ?? 'bg-line-soft text-ink-muted2'
                        }`}
                      >
                        {estadoLabels[estado] ?? estado}
                      </span>
                    </Td>
                    <Td href={href}>
                      {tasadorNombre ? (
                        <span className="text-ink-primary">{tasadorNombre}</span>
                      ) : esperando ? (
                        <span className="inline-block px-md py-xs rounded-full text-ds-xs font-medium bg-status-warningSoft text-status-warningText">
                          Esperando asignación
                        </span>
                      ) : (
                        <span className="text-ink-muted2 italic">Sin asignar</span>
                      )}
                    </Td>
                    <Td
                      href={href}
                      className="text-right tabular-nums text-ink-primary font-medium"
                    >
                      {t.valor_usd != null && t.valor_usd > 0
                        ? `USD ${t.valor_usd.toLocaleString('es-AR')}`
                        : '—'}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {total > 0 && (
          <div className="flex items-center justify-between px-lg py-md border-t border-line-soft bg-surface-pageAlt">
            <div className="text-ds-sm text-ink-muted2">
              Página <span className="text-ink-primary font-medium">{page}</span> de{' '}
              <span className="text-ink-primary font-medium">{totalPages}</span>
            </div>
            <div className="flex gap-sm">
              <PageLink
                href={hasPrev ? buildPageHref(page - 1) : null}
                label="← Anterior"
              />
              <PageLink
                href={hasNext ? buildPageHref(page + 1) : null}
                label="Siguiente →"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  sortKey,
  activeSort,
  dir,
  href,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  sortKey: SortKey;
  activeSort: SortKey | undefined;
  dir: SortDir;
  href: string;
}) {
  const isActive = activeSort === sortKey;
  // Indicador visual de la columna/dirección activa.
  const arrow = isActive ? (dir === 'asc' ? '↑' : '↓') : '↕';
  return (
    <th
      className={`px-lg py-md text-ds-xs font-semibold uppercase tracking-wide ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${isActive ? 'text-brand-primary' : 'text-ink-muted2'}`}
    >
      <Link
        href={href}
        aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`inline-flex items-center gap-xs hover:text-brand-primary transition-colors duration-fast ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <span>{children}</span>
        <span className={`text-ds-xs ${isActive ? 'opacity-100' : 'opacity-40'}`}>
          {arrow}
        </span>
      </Link>
    </th>
  );
}

// Header de columna NO ordenable (TSK-85: el tasador asignado no es una columna
// de la query base, se resuelve por RPC aparte; no participa del sort server-side).
function ThPlain({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-lg py-md text-ds-xs font-semibold uppercase tracking-wide text-ink-muted2 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  href,
  className = '',
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <Link href={href} className={`block px-lg py-md ${className}`}>
        {children}
      </Link>
    </td>
  );
}

function PageLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="px-md py-xs rounded-md text-ds-sm text-ink-muted bg-surface-card border border-line-soft opacity-40 cursor-not-allowed">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-md py-xs rounded-md text-ds-sm text-ink-primary bg-surface-card border border-line-soft hover:bg-surface-page transition-colors duration-fast"
    >
      {label}
    </Link>
  );
}
