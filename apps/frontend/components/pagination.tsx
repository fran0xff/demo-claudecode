import Link from "next/link";
import { paginationItems } from "@/lib/pagination";

type Props = {
  basePath: string;
  page: number;
  totalPages: number;
  /** Otros parámetros a conservar al cambiar de página, p. ej. la búsqueda (`q`). */
  extraParams?: Record<string, string | undefined>;
};

/**
 * Server Component a propósito: son enlaces normales (`?page=`), así que no
 * hace falta estado de cliente ni JavaScript para que funcione.
 */
export function Pagination({ basePath, page, totalPages, extraParams }: Props) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params}`;
  };

  return (
    <nav aria-label="Paginación de facturas" className="no-print flex items-center justify-center gap-1 text-sm">
      <PageLink href={href(1)} disabled={page === 1} label="« Primera" />
      <PageLink href={href(page - 1)} disabled={page === 1} label="‹ Anterior" />

      <ul className="flex items-center gap-1">
        {paginationItems(page, totalPages).map((item, index) =>
          typeof item === "number" ? (
            <li key={item}>
              <PageNumberLink href={href(item)} number={item} current={item === page} />
            </li>
          ) : (
            <li key={item + String(index)} aria-hidden="true" className="tabular px-1 text-[var(--muted)]">
              …
            </li>
          ),
        )}
      </ul>

      <PageLink href={href(page + 1)} disabled={page === totalPages} label="Siguiente ›" />
      <PageLink href={href(totalPages)} disabled={page === totalPages} label="Última »" />
    </nav>
  );
}

function PageNumberLink({
  href,
  number,
  current,
}: {
  href: string;
  number: number;
  current: boolean;
}) {
  if (current) {
    return (
      <span
        aria-current="page"
        className="tabular flex h-8 min-w-8 items-center justify-center rounded-[2px] border border-[var(--accent)] bg-[var(--accent)] px-2 font-medium text-[var(--surface)]"
      >
        {number}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="tabular flex h-8 min-w-8 items-center justify-center rounded-[2px] border border-[var(--border)] px-2 text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {number}
    </Link>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return <span className="px-2 py-1 text-[var(--muted)] opacity-40">{label}</span>;
  }

  return (
    <Link
      href={href}
      className="px-2 py-1 text-[var(--muted)] transition hover:text-[var(--accent)]"
    >
      {label}
    </Link>
  );
}
