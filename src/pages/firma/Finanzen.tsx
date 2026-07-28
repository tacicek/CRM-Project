import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useFinanzen, type OffenerPosten } from "@/hooks/useFinanzen";
import { ZahlungErfassenDialog } from "@/components/firma/ZahlungErfassenDialog";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";

type Reiter = "offen" | "zahlungen";

const WEG_LABEL: Record<string, MessageKey> = {
  bank: "finanz.method.bank",
  qr: "finanz.method.qr",
  cash: "finanz.method.cash",
  twint: "finanz.method.twint",
  card: "finanz.method.card",
  other: "finanz.method.other",
};

/**
 * Finanzen: eine Umsatzzahl statt zweier.
 *
 * Bis zum Zahlungsbuch rechnete die Rechnungsliste ihre eigene Summe und die
 * Quittungsliste eine zweite; wer sie addierte, zaehlte dasselbe Geld doppelt.
 * Hier steht nur noch, was `payments` hergibt.
 */
export default function FirmaFinanzen() {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const { companyId } = useCachedCompany();
  const { uebersicht, posten, zahlungen, loading, laden, stornieren } = useFinanzen(companyId);

  const [reiter, setReiter] = useState<Reiter>("offen");
  const [erfassen, setErfassen] = useState<OffenerPosten | null>(null);

  const geld = (n: number) => formatCurrency(n, locale);
  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)) : "—";

  const kpis: { labelKey: MessageKey; wert: string; ton?: string }[] = [
    { labelKey: "finanz.kpi.kassiert", wert: geld(uebersicht.kassiert_total) },
    { labelKey: "finanz.kpi.kassiert30", wert: geld(uebersicht.kassiert_30t) },
    { labelKey: "finanz.kpi.offen", wert: geld(uebersicht.offen_total) },
    {
      labelKey: "finanz.kpi.ueberfaellig",
      wert: geld(uebersicht.ueberfaellig_total),
      ton: uebersicht.ueberfaellig_total > 0 ? "text-folk-coral" : undefined,
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t("finanz.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">💰</span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("finanz.title")}
            </h1>
            <span className="text-[15px] text-folk-ink3">{t("finanz.subtitle")}</span>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.labelKey}
              className="rounded-xl border border-folk-line bg-folk-card p-4"
            >
              <p className="text-[13px] text-folk-ink3">{t(k.labelKey)}</p>
              <p
                className={`mt-1 font-mono text-[19px] font-semibold ${
                  k.ton ?? "text-folk-ink"
                }`}
              >
                {k.wert}
              </p>
            </div>
          ))}
        </section>

        {uebersicht.nicht_abgeglichen > 0 && (
          <p className="rounded-lg border border-folk-line bg-folk-bg-warm px-3 py-2 text-[13px] text-folk-ink3">
            {t("finanz.kpi.nichtAbgeglichen")}: {uebersicht.nicht_abgeglichen}
          </p>
        )}

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {(["offen", "zahlungen"] as Reiter[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReiter(r)}
                className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                  reiter === r
                    ? "border-folk-ink bg-folk-ink text-white"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
              >
                {t(r === "offen" ? "finanz.tab.offen" : "finanz.tab.zahlungen")}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
            </div>
          ) : reiter === "offen" ? (
            posten.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-semibold text-folk-ink">{t("finanz.offen.empty")}</p>
                <p className="mt-1 text-[14px] text-folk-ink3">{t("finanz.offen.emptyHint")}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {posten.map((p) => (
                  <article
                    key={p.rechnung_id}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/firma/rechnungen/${p.rechnung_id}`)}
                          className="text-[15px] font-semibold tracking-tight text-folk-ink hover:underline"
                        >
                          {p.rechnung_nr}
                        </button>
                        <span className="text-[14px] text-folk-ink3">{p.customer_name}</span>
                        {p.mahnstufe > 0 && (
                          <span className="rounded bg-folk-coral-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-coral">
                            {t("finanz.offen.mahnstufe", { level: p.mahnstufe })}
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-0.5 text-[12.5px] ${
                          p.tage_ueberfaellig > 0
                            ? "font-medium text-folk-coral"
                            : "text-folk-ink4"
                        }`}
                      >
                        {p.tage_ueberfaellig > 0
                          ? t("finanz.offen.tageUeberfaellig", { days: p.tage_ueberfaellig })
                          : t("finanz.offen.faellig", { date: datum(p.faellig_am) })}
                        {p.bezahlt > 0 && (
                          <>
                            {" · "}
                            {t("finanz.offen.teilbezahlt", {
                              paid: geld(p.bezahlt),
                              total: geld(p.gesamt),
                            })}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[15px] font-semibold text-folk-ink">
                        {geld(p.offen)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[13px]"
                        onClick={() => setErfassen(p)}
                      >
                        {t("finanz.offen.zahlungErfassen")}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : zahlungen.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-folk-ink">{t("finanz.zahlungen.empty")}</p>
              <p className="mt-1 text-[14px] text-folk-ink3">
                {t("finanz.zahlungen.emptyHint")}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {zahlungen.map((z) => {
                const storno = z.reverses_payment_id !== null;
                return (
                  <article
                    key={z.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-semibold text-folk-ink">
                          {datum(z.payment_date)}
                        </span>
                        <span className="rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink3">
                          {t(WEG_LABEL[z.method] ?? "finanz.method.other")}
                        </span>
                        {storno && (
                          <span className="rounded bg-folk-coral-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-coral">
                            {t("finanz.zahlungen.storno")}
                          </span>
                        )}
                      </div>
                      {z.note && (
                        <p className="mt-0.5 text-[13px] text-folk-ink3">{z.note}</p>
                      )}
                      <p className="mt-0.5 text-[12.5px] text-folk-ink4">
                        {z.reconciliation_status === "reconciled"
                          ? t("finanz.zahlungen.abgeglichen")
                          : t("finanz.zahlungen.offenerAbgleich")}
                        {z.reference ? ` · ${z.reference}` : ""}
                      </p>
                    </div>

                    <span
                      className={`font-mono text-[15px] font-semibold ${
                        z.amount < 0 ? "text-folk-coral" : "text-folk-ink"
                      }`}
                    >
                      {geld(z.amount)}
                    </span>

                    {!storno &&
                      !zahlungen.some((x) => x.reverses_payment_id === z.id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-[13px]"
                          onClick={() => {
                            if (window.confirm(t("finanz.zahlungen.stornoFrage"))) {
                              stornieren(z.id);
                            }
                          }}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          {t("finanz.zahlungen.stornieren")}
                        </Button>
                      )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {erfassen && companyId && (
        <ZahlungErfassenDialog
          open
          onOpenChange={(o) => !o && setErfassen(null)}
          companyId={companyId}
          rechnung={{
            id: erfassen.rechnung_id,
            nr: erfassen.rechnung_nr,
            offen: erfassen.offen,
            customerId: erfassen.customer_id,
          }}
          onDone={() => {
            setErfassen(null);
            laden();
          }}
        />
      )}
    </>
  );
}
