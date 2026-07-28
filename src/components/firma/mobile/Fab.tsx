import { Plus } from "lucide-react";
import { useT } from "@/i18n/useI18n";

/**
 * Die Hauptaktion der Mobilansicht.
 *
 * Sitzt über der Tab-Leiste: `82px` sind deren Höhe plus Abstand, dazu der
 * sichere Bereich, sonst klebt der Knopf auf iPhones am Home-Indikator.
 *
 * `text-folk-bg` statt `text-white`: die Palette bleibt konsistent, und der
 * Testlauf (`themeGuard`) verbietet feste Vordergrundfarben auf Tokens, die
 * mit dem Theme kippen.
 */
export const Fab = ({ onClick }: { onClick: () => void }) => {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("nav.mobile.newAnfrage")}
      className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-folk-mint text-folk-bg shadow-lg transition-transform active:scale-95 shell-tablet:hidden print:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 82px)" }}
    >
      <Plus className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
};
