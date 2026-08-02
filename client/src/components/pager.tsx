import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/** Liste des numéros de page à afficher (avec ellipses pour les grands totaux). */
function pageItems(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) items.push("…");
  for (let p = lo; p <= hi; p++) items.push(p);
  if (hi < pageCount - 1) items.push("…");
  items.push(pageCount);
  return items;
}

type PagerProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * Pagination contrôlée réutilisable pour tous les listings (joueurs, matchs, stats…).
 * Évite les pages interminables : on affiche une tranche + les contrôles de navigation.
 */
export function Pager({ page, pageCount, onPageChange, className }: PagerProps) {
  if (pageCount <= 1) return null;
  const items = pageItems(page, pageCount);
  const go = (p: number) => {
    if (p >= 1 && p <= pageCount && p !== page) onPageChange(p);
  };
  return (
    <Pagination className={cn("mt-6", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            aria-label="Page précédente"
            size="default"
            className={cn("cursor-pointer gap-1 pl-2.5", page === 1 && "pointer-events-none opacity-50")}
            onClick={() => go(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Préc.</span>
          </PaginationLink>
        </PaginationItem>

        {items.map((it, i) => (
          <PaginationItem key={`${it}-${i}`}>
            {it === "…" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink isActive={it === page} className="cursor-pointer" onClick={() => go(it)}>
                {it}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationLink
            aria-label="Page suivante"
            size="default"
            className={cn("cursor-pointer gap-1 pr-2.5", page === pageCount && "pointer-events-none opacity-50")}
            onClick={() => go(page + 1)}
          >
            <span className="hidden sm:inline">Suiv.</span>
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default Pager;
