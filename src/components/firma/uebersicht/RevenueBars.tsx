import { useI18n, useT } from "@/i18n/useI18n";
import { formatAmount } from "@/i18n/format";
import type { RevenueWeek } from "@/types/uebersicht";

/**
 * Umsatz der letzten Wochen als Balken.
 *
 * Bewusst `div`s statt einer Diagrammbibliothek: fünf Werte rechtfertigen
 * keine zusätzliche Abhängigkeit, und `recharts` ist ohnehin nicht auf die
 * folk-Tokens eingestellt.
 *
 * Jeder Balken trägt seinen Wert als `aria-label` — die Höhe allein ist für
 * Screenreader nichts.
 */
export const RevenueBars = ({ weeks }: { weeks: readonly RevenueWeek[] }) => {
  const t = useT();
  const { locale } = useI18n();

  const hoechst = Math.max(...weeks.map((week) => week.amountChf), 0);

  return (
    <section className="rounded-xl border border-folk-line bg-folk-card p-5">
      <h2 className="text-[13.5px] font-semibold tracking-tight text-folk-ink">
        {t("uebersicht.umsatz.title")}
      </h2>

      <div className="mt-4 flex h-16 items-end gap-2" role="list">
        {weeks.map((week) => (
          <div
            key={week.label}
            role="listitem"
            aria-label={`${week.label}: CHF ${formatAmount(week.amountChf, locale)}`}
            className={`flex-1 rounded-t ${week.current ? "bg-folk-mint" : "bg-folk-line-hard"}`}
            // Nullwerte bekommen eine sichtbare Restlinie, sonst sieht eine
            // umsatzlose Woche wie eine fehlende aus.
            style={{ height: hoechst > 0 ? `${Math.max((week.amountChf / hoechst) * 100, 3)}%` : "3%" }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex gap-2">
        {weeks.map((week) => (
          <div
            key={week.label}
            className={`flex-1 text-center text-[9.5px] ${
              week.current ? "font-bold text-folk-mint" : "text-folk-ink4"
            }`}
          >
            {week.label}
          </div>
        ))}
      </div>
    </section>
  );
};
