import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/i18n/useI18n";

/**
 * Blaetterleiste fuer Listenseiten.
 *
 * Bis 2026-07-28 stand sie als lokale Komponente in Offerten.tsx. Sie wurde
 * herausgeloest, als die Kundenliste dieselbe Leiste brauchte — mit einem
 * Unterschied: dort blaettert der SERVER (search_customers liefert `gesamt`
 * mit), waehrend Offerten.tsx die 200 geladenen Zeilen im Browser aufteilt.
 * Die Leiste selbst kennt den Unterschied nicht; sie bekommt `total`, `page`
 * und `pageSize` und sagt Bescheid, wenn sich etwas aendert.
 */

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSizeOption = typeof PAGE_SIZE_OPTIONS[number];

interface PaginationBarProps {
  total: number;
  page: number;
  pageSize: PageSizeOption;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSizeOption) => void;
}

const PaginationBar = ({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationBarProps) => {
  const t = useT();
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | "...")[] = [];
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p); };
  addPage(1);
  if (page > 3) pages.push("...");
  if (page > 2) addPage(page - 1);
  addPage(page);
  if (page < totalPages - 1) addPage(page + 1);
  if (page < totalPages - 2) pages.push("...");
  if (totalPages > 1) addPage(totalPages);

  return (
    <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-folk-line pt-4 sm:flex-row">
      <div className="flex items-center gap-3 text-[12.5px] text-folk-ink3">
        <span className="font-mono">{t("common.pagination.range", { from, to, total })}</span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v) as PageSizeOption); onPageChange(1); }}>
          <SelectTrigger className="h-8 w-[110px] rounded-md border-folk-line bg-folk-card text-[14px] text-folk-ink2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-[14px]">
                {t("common.pagination.perPage", { count: s })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-folk-line bg-folk-card text-folk-ink3 transition-colors hover:bg-folk-bg-warm disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-1 text-[12.5px] text-folk-ink4">…</span>
            ) : (
              <button
                key={p}
                className={`flex h-8 w-8 items-center justify-center rounded-md border font-mono text-[14px] transition-colors ${
                  p === page
                    ? "border-folk-ink bg-folk-ink text-white"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-folk-line bg-folk-card text-folk-ink3 transition-colors hover:bg-folk-bg-warm disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export { PAGE_SIZE_OPTIONS, PaginationBar };
export type { PageSizeOption };
