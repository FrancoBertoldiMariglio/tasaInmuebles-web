import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getEntidadActivaId } from '@/lib/entidad-activa';
import {
  estadoLabels,
  estadoStyles,
  tipoLabels,
  type EstadoTasacion,
  type TipoInmueble,
} from '@/lib/labels';
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
};

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

// Construye un filtro OR para Supabase: busca por domicilio (ilike) o,
// si el término es numérico, por número de tasación exacto.
function buildSearchOr(term: string): string {
  const safe = term.replace(/[%,()]/g, ' ').trim();
  const clauses = [`domicilio.ilike.%${safe}%`];
  const asNum = Number(safe);
  if (Number.isInteger(asNum) && asNum > 0) {
    clauses.push(`numero.eq.${asNum}`);
  }
  return clauses.join(',');
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
    countQuery = countQuery.gte('created_at', `${desde}T00:00:00`);
    dataQuery = dataQuery.gte('created_at', `${desde}T00:00:00`);
  }
  if (hasta) {
    countQuery = countQuery.lte('created_at', `${hasta}T23:59:59.999`);
    dataQuery = dataQuery.lte('created_at', `${hasta}T23:59:59.999`);
  }
  if (q) {
    const orClause = buildSearchOr(q);
    countQuery = countQuery.or(orClause);
    dataQuery = dataQuery.or(orClause);
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery.order('created_at', { ascending: false }).range(from, to),
  ]);

  const items = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const hayFiltros = Boolean(q || estado || tipo || desde || hasta);

  // Conserva los filtros vigentes al paginar.
  const buildPageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    params.set('page', String(targetPage));
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
              <Th>N°</Th>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Dirección</Th>
              <Th>Estado</Th>
              <Th align="right">Valor USD</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-lg py-4xl text-center">
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
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-lg py-md text-ds-xs font-semibold text-ink-muted2 uppercase tracking-wide ${
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
