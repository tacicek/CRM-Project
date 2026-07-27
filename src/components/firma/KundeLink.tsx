import { Link } from "react-router-dom";
import { useT } from "@/i18n/useI18n";

/**
 * Verweis auf die Kundenkarte.
 *
 * Rendert NICHTS, wenn der Datensatz keinem Kunden zugeordnet ist: die
 * Verknuepfung entsteht beim Anlegen per Trigger (20260728130000), aeltere
 * Zeilen bekommen sie erst durch den Backfill — und zwei davon gar nicht, weil
 * sie weder E-Mail noch Telefon tragen. Ein toter Link waere dort schlimmer als
 * gar keiner.
 */
export const KundeLink = ({
  customerId,
  className,
}: {
  customerId: string | null | undefined;
  className?: string;
}) => {
  const t = useT();
  if (!customerId) return null;
  return (
    <Link
      to={`/firma/kunden/${customerId}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-[13px] font-medium text-folk-ink3 transition-colors hover:text-folk-coral ${className ?? ""}`}
    >
      <span aria-hidden>🧑</span> {t("kunde.link.open")}
    </Link>
  );
};
