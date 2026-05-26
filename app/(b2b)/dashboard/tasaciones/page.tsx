import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  estadoLabels,
  estadoStyles,
  tipoLabels,
  type EstadoTasacion,
  type TipoInmueble,
} from '@/lib/labels';

const PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function TasacionesPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ count }, { data, error }] = await Promise.all([
    supabase.from('tasaciones').select('id', { count: 'exact', head: true }),
    supabase
      .from('tasaciones')
      .select('id, numero, created_at, estado, tipo, domicilio, valor_usd, motivo')
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);

  const items = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="max-w-6xl">
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
                    No hay tasaciones todavía.
                  </div>
                  <div className="text-ds-sm text-ink-muted mt-xs">
                    Las tasaciones que tu equipo solicite aparecerán acá.
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
                href={hasPrev ? `/dashboard/tasaciones?page=${page - 1}` : null}
                label="← Anterior"
              />
              <PageLink
                href={hasNext ? `/dashboard/tasaciones?page=${page + 1}` : null}
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
