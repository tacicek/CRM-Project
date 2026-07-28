import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatAmount, formatNumber } from "@/i18n/format";
import type { Kpi, KpiKey } from "@/types/uebersicht";
import type { MessageKey } from "@/i18n/translator";

const LABEL_KEY: Record<KpiKey, MessageKey> = {
  anfragen: "uebersicht.kpi.anfragen",
  offerten: "uebersicht.kpi.offerten",
  auftraege: "uebersicht.kpi.auftraege",
  umsatz: "uebersicht.kpi.umsatz",
};

/**
 * Der Pfeil einer Kennzahl.
 *
 * `deltaPct === null` heisst: keine Vergleichsbasis. Dann steht hier nichts —
 * eine erfundene Prozentzahl wäre schlimmer als eine fehlende. Die Richtung
 * allein sagt zudem nichts: mehr unbeantwortete Anfragen ist eine schlechte
 * Nachricht, mehr Umsatz eine gute. Deshalb entscheidet `risingIsGood` über
 * die Farbe, nicht das Vorzeichen.
 */
const Delta = ({ kpi }: { kpi: Kpi }) => {
  const t = useT();
  const { locale } = useI18n();

  if (kpi.deltaPct === null) {
    return (
      <span className="text-[11px] text-folk-ink4" title={t("uebersicht.kpi.noBase")}>
        —
      </span>
    );
  }

  const flat = kpi.deltaPct === 0;
  const rising = kpi.deltaPct > 0;
  const good = flat ? null : rising === kpi.risingIsGood;
  const Icon = flat ? Minus : rising ? ArrowUp : ArrowDown;
  const tone = good === null ? "text-folk-ink3" : good ? "text-folk-mint" : "text-folk-coral";

  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${tone}`}>
      <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
      {formatNumber(Math.abs(kpi.deltaPct), locale)}%
    </span>
  );
};

const Value = ({ kpi }: { kpi: Kpi }) => {
  const { locale } = useI18n();
  return kpi.format === "chf"
    ? `CHF ${formatAmount(kpi.value, locale)}`
    : formatNumber(kpi.value, locale);
};

/**
 * Die Kennzahlen.
 *
 * Ab 820px **ein** umrandeter Behälter mit geteilten Trennlinien; darunter
 * waagrecht scrollende Kacheln. Beides dieselbe Komponente, weil es dieselben
 * Daten sind — nur die Anordnung wechselt, und die entscheidet CSS, nicht JS.
 *
 * `box-sizing: border-box` ist auf den Kacheln nicht verhandelbar: mit
 * content-box addiert sich die Polsterung auf die Breite und die dritte Kachel
 * wird auf einem 390px-Gerät abgeschnitten.
 */
export const KpiStrip = ({ kpis }: { kpis: readonly Kpi[] }) => {
  const t = useT();

  return (
    <div
      className="
        flex snap-x snap-proximity gap-2.5 overflow-x-auto overscroll-x-contain pb-1
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
        shell-tablet:grid shell-tablet:grid-cols-4 shell-tablet:gap-0
        shell-tablet:overflow-visible shell-tablet:rounded-xl shell-tablet:border
        shell-tablet:border-folk-line shell-tablet:pb-0
      "
    >
      {kpis.map((kpi, index) => (
        <div
          key={kpi.key}
          className={`
            box-border w-[105px] flex-none snap-start rounded-xl border border-folk-line
            bg-folk-card px-3.5 py-3
            shell-tablet:w-auto shell-tablet:rounded-none shell-tablet:border-0
            shell-tablet:bg-transparent shell-tablet:px-5 shell-tablet:py-4
            ${index < kpis.length - 1 ? "shell-tablet:border-r shell-tablet:border-folk-line" : ""}
          `}
        >
          {/* Zwei Zeilen statt abschneiden: "Neue Anfragen" und "Offene
              Offerten" passen auf einem Telefon nicht in eine Zeile, und
              "Neue Anfrag…" ist keine Beschriftung. */}
          <div className="line-clamp-2 min-h-[2.2em] text-[11px] leading-tight text-folk-ink3 shell-tablet:line-clamp-none shell-tablet:min-h-0 shell-tablet:truncate shell-tablet:text-[11.5px]">
            {t(LABEL_KEY[kpi.key])}
          </div>
          {/* `min-w-0` und Umbruch: ein Betrag wie CHF 13'475.80 sprengt sonst
              die Kachel — der Wert lief ueber den Rand hinaus. */}
          <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span
              className={`min-w-0 font-bold tracking-tight text-folk-ink ${
                kpi.format === "chf"
                  ? "text-[13px] shell-tablet:text-[22px]"
                  : "text-[24px] shell-tablet:text-[26px]"
              }`}
            >
              <Value kpi={kpi} />
            </span>
            <Delta kpi={kpi} />
          </div>
        </div>
      ))}
    </div>
  );
};
