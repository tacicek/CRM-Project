import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { KundeZusammenfassung } from "@/hooks/useKunde";
import type { MessageKey } from "@/i18n/translator";

/**
 * Die Zahlen zu diesem Kunden.
 *
 * Drei Groessen stehen oben und gross, weil sie die Frage beantworten:
 * fakturiert, bezahlt, offen. Der offene Betrag ist der einzige, der kritisch
 * werden kann — und nur, wenn eine Frist verstrichen ist. "Offen" allein ist
 * der Normalfall einer laufenden Rechnung.
 *
 * `Davon Quittungen` steht ABSICHTLICH eingerueckt unter `Bezahlt`: seit dem
 * Zahlungsbuch (20260729160000) ist es ein Ausschnitt und kein zweiter Topf.
 * Der frueher noetige Warnsatz wird dadurch kuerzer — die Einrueckung sagt das
 * Meiste schon.
 */
export const KundeFinanzen = ({
  finanzen,
}: {
  finanzen: KundeZusammenfassung["finanzen"];
}) => {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  const offen = Number(finanzen.offen);
  const ueberfaellig = Number(finanzen.ueberfaellig);

  const gross: { key: MessageKey; wert: number; kritisch?: boolean }[] = [
    { key: "kunde.finance.invoiced", wert: Number(finanzen.fakturiert) },
    { key: "kunde.finance.paid", wert: Number(finanzen.bezahlt) },
    { key: "kunde.finance.open", wert: offen, kritisch: ueberfaellig > 0 },
  ];

  return (
    <section className="rounded-xl border border-folk-line bg-folk-card p-4">
      <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
        {t("kunde.section.finance")}
      </h2>

      <div className="grid gap-2 sm:grid-cols-3">
        {gross.map((g) => (
          <div
            key={g.key}
            className={`rounded-lg border p-3 ${
              g.kritisch
                ? "border-folk-coral/50 bg-folk-coral-bg"
                : "border-folk-line bg-folk-bg-warm"
            }`}
          >
            <div className="text-[12px] font-medium uppercase tracking-wide text-folk-ink3">
              {t(g.key)}
            </div>
            <div
              className={`mt-1 font-mono text-[19px] font-semibold ${
                g.kritisch ? "text-folk-coral" : "text-folk-ink"
              }`}
            >
              {formatCurrency(g.wert, locale)}
            </div>
            {g.kritisch && (
              <div className="mt-0.5 text-[12.5px] font-medium text-folk-coral">
                {formatCurrency(ueberfaellig, locale)} {t("kunde.attention.overdue")}
              </div>
            )}
          </div>
        ))}
      </div>

      <dl className="mt-3 space-y-1.5 text-[14px]">
        <div className="flex justify-between gap-3 pl-4">
          {/* Eingerueckt unter „Bezahlt“: Ausschnitt, kein zweiter Betrag. */}
          <dt className="text-folk-ink2">↳ {t("kunde.finance.receipts")}</dt>
          <dd className="font-mono text-folk-ink2">
            {formatCurrency(Number(finanzen.davon_quittungen), locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-folk-ink2">{t("kunde.finance.credits")}</dt>
          <dd className="font-mono text-folk-ink">
            {formatCurrency(Number(finanzen.gutschriften), locale)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[12.5px] leading-snug text-folk-ink2">
        {t("kunde.finance.hint")}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => navigate("/firma/rechnungen")}
        >
          {t("kunde.finance.toInvoices")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => navigate("/firma/finanzen")}
        >
          {t("kunde.finance.toPayments")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
};
