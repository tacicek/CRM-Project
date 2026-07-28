import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";

/**
 * Kennzahlen des Kundenlebenszyklus.
 *
 * Jede Zahl kommt aus `lifecycle_kpis()` — einer company-scoped RPC mit
 * Zeitraum —, nicht aus `.length` auf einer geladenen Liste. Der Unterschied
 * ist nicht kosmetisch: `Offerten.tsx` lädt mit einem stillen `.limit(200)`,
 * eine Zählung darauf wäre schlicht falsch.
 *
 * Quoten stehen immer als „x von y" da. Eine Annahmequote ohne Nenner ist
 * keine Kennzahl.
 */
type Kpis = {
  zeitraum: { von: string; bis: string };
  trichter: {
    anfragen: number; anfragen_mit_offerte: number;
    serien_versendet: number; serien_angenommen: number;
  };
  dauer_tage: Record<
    "erste_reaktion" | "bis_offerte" | "ansicht_bis_annahme" | "bis_tilgung",
    number | null
  >;
  verlustgruende: Record<string, number>;
  kunden: Record<"gesamt" | "ltv_schnitt" | "ltv_summe" | "wiederkehrend" | "cross_sell", number | null>;
  geld: Record<"kassiert" | "offen" | "gutschriften", number>;
  qualitaet: Record<
    "auftraege_abgeschlossen" | "faelle" | "schaeden" | "reklamationen" | "nachreinigungen",
    number
  >;
  posteingang: Record<"faeden_offen" | "unbeantwortet" | "aeltester_unbeantwortet_tage", number | null>;
};

const ZEITRAEUME: { key: Filter; labelKey: MessageKey; tage: number | null }[] = [
  { key: "90", labelKey: "kpi.range.90", tage: 90 },
  { key: "365", labelKey: "kpi.range.365", tage: 365 },
  { key: "all", labelKey: "kpi.range.all", tage: null },
];
type Filter = "90" | "365" | "all";

export default function FirmaKennzahlen() {
  const t = useT();
  const { locale } = useI18n();
  const { companyId } = useCachedCompany();
  const { toast } = useToast();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [zeitraum, setZeitraum] = useState<Filter>("365");
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const tage = ZEITRAEUME.find((z) => z.key === zeitraum)?.tage ?? null;
    const von = tage
      ? new Date(Date.now() - tage * 86_400_000).toISOString().slice(0, 10)
      : "2000-01-01";

    const { data, error } = await supabase.rpc("lifecycle_kpis", {
      p_company_id: companyId,
      p_von: von,
      p_bis: new Date().toISOString().slice(0, 10),
    });
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setKpis(data as unknown as Kpis);
    setLoading(false);
  }, [companyId, zeitraum, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const geld = (n: number | null) => formatCurrency(Number(n ?? 0), locale);
  const zahl = (n: number | null) => (n === null || n === undefined ? "—" : String(n));

  const block = (titelKey: MessageKey, zeilen: [MessageKey, string][], fussnote?: string) => (
    <section className="rounded-xl border border-folk-line bg-folk-card p-4">
      <h2 className="mb-2 text-[15px] font-semibold text-folk-ink">{t(titelKey)}</h2>
      <dl className="space-y-1.5 text-[14px]">
        {zeilen.map(([k, wert]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-folk-ink3">{t(k)}</dt>
            <dd className="font-mono text-folk-ink">{wert}</dd>
          </div>
        ))}
      </dl>
      {fussnote && <p className="mt-2 text-[12px] leading-snug text-folk-ink4">{fussnote}</p>}
    </section>
  );

  return (
    <>
      <Helmet>
        <title>{t("kpi.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">📈</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("kpi.title")}
            </h1>
            <span className="text-[15px] text-folk-ink3">{t("kpi.subtitle")}</span>
          </div>
        </header>

        <div className="flex flex-wrap gap-1.5">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.key}
              type="button"
              onClick={() => setZeitraum(z.key)}
              className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                zeitraum === z.key
                  ? "border-folk-ink bg-folk-ink text-folk-bg"
                  : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
              }`}
            >
              {t(z.labelKey)}
            </button>
          ))}
        </div>

        {loading || !kpis ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {block(
              "kpi.section.funnel",
              [
                ["kpi.funnel.leads", zahl(kpis.trichter.anfragen)],
                [
                  "kpi.funnel.withOffer",
                  `${kpis.trichter.anfragen_mit_offerte} / ${kpis.trichter.anfragen}`,
                ],
                ["kpi.funnel.sent", zahl(kpis.trichter.serien_versendet)],
                [
                  "kpi.funnel.accepted",
                  `${kpis.trichter.serien_angenommen} / ${kpis.trichter.serien_versendet}`,
                ],
              ],
              t("kpi.funnel.note"),
            )}

            {block("kpi.section.duration", [
              ["kpi.duration.firstResponse", zahl(kpis.dauer_tage.erste_reaktion)],
              ["kpi.duration.toOffer", zahl(kpis.dauer_tage.bis_offerte)],
              ["kpi.duration.viewToAccept", zahl(kpis.dauer_tage.ansicht_bis_annahme)],
              ["kpi.duration.toPayment", zahl(kpis.dauer_tage.bis_tilgung)],
            ])}

            {block("kpi.section.customers", [
              ["kpi.customers.total", zahl(kpis.kunden.gesamt)],
              ["kpi.customers.ltvAvg", geld(kpis.kunden.ltv_schnitt)],
              ["kpi.customers.ltvSum", geld(kpis.kunden.ltv_summe)],
              ["kpi.customers.repeat", zahl(kpis.kunden.wiederkehrend)],
              ["kpi.customers.crossSell", zahl(kpis.kunden.cross_sell)],
            ])}

            {block("kpi.section.money", [
              ["kpi.money.received", geld(kpis.geld.kassiert)],
              ["kpi.money.open", geld(kpis.geld.offen)],
              ["kpi.money.credits", geld(kpis.geld.gutschriften)],
            ])}

            {block("kpi.section.quality", [
              ["kpi.quality.completed", zahl(kpis.qualitaet.auftraege_abgeschlossen)],
              [
                "kpi.quality.cases",
                `${kpis.qualitaet.faelle} / ${kpis.qualitaet.auftraege_abgeschlossen}`,
              ],
              ["kpi.quality.damages", zahl(kpis.qualitaet.schaeden)],
              ["kpi.quality.complaints", zahl(kpis.qualitaet.reklamationen)],
            ])}

            {block("kpi.section.inbox", [
              ["kpi.inbox.open", zahl(kpis.posteingang.faeden_offen)],
              ["kpi.inbox.unanswered", zahl(kpis.posteingang.unbeantwortet)],
              ["kpi.inbox.oldest", zahl(kpis.posteingang.aeltester_unbeantwortet_tage)],
            ])}

            <section className="rounded-xl border border-folk-line bg-folk-card p-4">
              <h2 className="mb-2 text-[15px] font-semibold text-folk-ink">
                {t("kpi.section.lost")}
              </h2>
              {Object.keys(kpis.verlustgruende).length === 0 ? (
                <p className="text-[14px] text-folk-ink3">{t("kpi.lost.none")}</p>
              ) : (
                <dl className="space-y-1.5 text-[14px]">
                  {Object.entries(kpis.verlustgruende).map(([grund, n]) => (
                    <div key={grund} className="flex justify-between gap-3">
                      <dt className="text-folk-ink3">{t(`kpi.lost.${grund}` as MessageKey)}</dt>
                      <dd className="font-mono text-folk-ink">{n}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="rounded-xl border border-folk-line bg-folk-bg-warm p-4">
              <h2 className="mb-2 text-[15px] font-semibold text-folk-ink">
                {t("kpi.notMeasured")}
              </h2>
              <p className="text-[12.5px] leading-snug text-folk-ink3">
                {t("kpi.notMeasured.hint")}
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
