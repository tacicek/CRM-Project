import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useKunde } from "@/hooks/useKunde";
import { useKundeTimeline } from "@/hooks/useKundeTimeline";
import { KundeMergeDialog } from "@/components/firma/KundeMergeDialog";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";

const EREIGNIS_LABEL: Record<string, MessageKey> = {
  anfrage: "kunde.event.anfrage",
  offerte: "kunde.event.offerte",
  auftrag: "kunde.event.auftrag",
  termin: "kunde.event.termin",
  rechnung: "kunde.event.rechnung",
  quittung: "kunde.event.quittung",
  email: "kunde.event.email",
};

const EREIGNIS_EMOJI: Record<string, string> = {
  anfrage: "📨",
  offerte: "📄",
  auftrag: "✅",
  termin: "📅",
  rechnung: "💳",
  quittung: "🧾",
  email: "✉️",
};

const GRUND_LABEL: Record<string, MessageKey> = {
  same_phone: "kunde.duplicate.reason.same_phone",
  same_phone_and_name: "kunde.duplicate.reason.same_phone_and_name",
};

export default function FirmaKundeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { locale, dateLocale } = useI18n();
  const { companyId } = useCachedCompany();
  const { role } = useCompanyContext();

  const { kunde, zusammenfassung, duplikate, loading, nichtGefunden, speichern, zusammenfuehren, vorschau } =
    useKunde(id, companyId);
  const { ereignisse, loading: verlaufLaedt, mehrDa, mehrLaden } = useKundeTimeline(id);

  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [mergeMit, setMergeMit] = useState<{ id: string; display_name: string } | null>(null);
  const [entwurf, setEntwurf] = useState<{ notes: string } | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-folk-coral" />
      </div>
    );
  }

  if (nichtGefunden || !kunde) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold text-folk-ink">{t("kunde.detail.notFound")}</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate("/firma/kunden")}>
          {t("kunde.detail.back")}
        </Button>
      </div>
    );
  }

  const zahlen = zusammenfassung?.anzahl;
  const finanzen = zusammenfassung?.finanzen;
  const aktivitaet = zusammenfassung?.aktivitaet;
  const notizen = entwurf?.notes ?? kunde.notes ?? "";
  const darfMergen = role === "owner" || role === "admin";

  const datum = (iso: string | null | undefined) =>
    iso ? format(new Date(iso), "dd. MMM yyyy", { locale: dateLocale }) : t("kunde.field.none");

  return (
    <>
      <Helmet>
        <title>{`${kunde.display_name} · CRM`}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-folk-ink3"
            onClick={() => navigate("/firma/kunden")}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("kunde.detail.back")}
          </Button>
          <span className="text-3xl leading-none">🧑</span>
          <h1 className="min-w-0 flex-1 truncate text-[24px] font-semibold tracking-tight text-folk-ink">
            {kunde.display_name}
          </h1>
        </header>

        {/* Weiterleitung: dieser Kunde wurde in einen anderen ueberfuehrt. Die
            Quellzeile bleibt bestehen, damit alte Links aufloesen. */}
        {kunde.merged_into_customer_id && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-folk-line bg-folk-bg-warm p-4">
            <span className="text-xl leading-none" aria-hidden>
              ↪️
            </span>
            <p className="min-w-0 flex-1 font-medium text-folk-ink">
              {t("kunde.merged.banner.title")}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/firma/kunden/${kunde.merged_into_customer_id}`)}
            >
              {t("kunde.merged.banner.action")}
            </Button>
          </div>
        )}

        {duplikate.length > 0 && !kunde.merged_into_customer_id && (
          <div className="rounded-xl border border-folk-coral/40 bg-folk-coral-bg p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none" aria-hidden>
                ⚠️
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-folk-ink">{t("kunde.duplicate.banner.title")}</p>
                <p className="mt-0.5 text-[14px] text-folk-ink2">
                  {t("kunde.duplicate.banner.description", { count: duplikate.length })}
                </p>
                <div className="mt-2 space-y-1.5">
                  {duplikate.map((d) => (
                    <div key={d.customer_b_id} className="flex flex-wrap items-center gap-2 text-[14px]">
                      <button
                        type="button"
                        className="font-medium text-folk-ink underline-offset-2 hover:underline"
                        onClick={() => navigate(`/firma/kunden/${d.customer_b_id}`)}
                      >
                        {d.customer_b_name}
                      </button>
                      <span className="text-folk-ink3">
                        · {t(GRUND_LABEL[d.match_reason] ?? "kunde.duplicate.reason.same_phone")}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7"
                        onClick={() =>
                          setMergeMit({ id: d.customer_b_id, display_name: d.customer_b_name })
                        }
                      >
                        {t("kunde.duplicate.banner.action")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "overview" | "history")}>
          <TabsList>
            <TabsTrigger value="overview">{t("kunde.tab.overview")}</TabsTrigger>
            <TabsTrigger value="history">{t("kunde.tab.history")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-folk-line bg-folk-card p-4">
              <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
                {t("kunde.section.contact")}
              </h2>
              <dl className="space-y-2 text-[14px]">
                {[
                  { k: "kunde.field.email" as MessageKey, v: kunde.primary_email },
                  { k: "kunde.field.phone" as MessageKey, v: kunde.primary_phone },
                  { k: "kunde.field.language" as MessageKey, v: kunde.language.toUpperCase() },
                  { k: "kunde.field.customerNumber" as MessageKey, v: kunde.external_customer_number },
                  { k: "kunde.field.source" as MessageKey, v: kunde.source },
                ].map((z) => (
                  <div key={z.k} className="flex justify-between gap-3">
                    <dt className="text-folk-ink3">{t(z.k)}</dt>
                    <dd className="truncate text-folk-ink">{z.v || t("kunde.field.none")}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="kunde-notizen" className="text-[13px] text-folk-ink2">
                  {t("kunde.field.notes")}
                </Label>
                <Textarea
                  id="kunde-notizen"
                  value={notizen}
                  placeholder={t("kunde.field.notesPlaceholder")}
                  onChange={(e) => setEntwurf({ notes: e.target.value })}
                  rows={3}
                />
                {entwurf !== null && (
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={async () => {
                      const ok = await speichern({ notes: entwurf.notes || null });
                      if (ok) setEntwurf(null);
                    }}
                  >
                    {t("kunde.save")}
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-folk-line bg-folk-card p-4">
              <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
                {t("kunde.section.numbers")}
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
                {(
                  [
                    ["kunde.count.anfragen", zahlen?.anfragen],
                    ["kunde.count.offerten", zahlen?.offerten],
                    ["kunde.count.auftraege", zahlen?.auftraege],
                    ["kunde.count.termine", zahlen?.termine],
                    ["kunde.count.rechnungen", zahlen?.rechnungen],
                    ["kunde.count.quittungen", zahlen?.quittungen],
                    ["kunde.count.emails", zahlen?.emails],
                  ] as [MessageKey, number | undefined][]
                ).map(([k, n]) => (
                  <div key={k} className="rounded-lg bg-folk-bg-warm p-2">
                    <div className="font-mono text-[18px] font-semibold text-folk-ink">{n ?? 0}</div>
                    <div className="text-[11.5px] text-folk-ink3">{t(k)}</div>
                  </div>
                ))}
              </div>

              <h2 className="mb-2 mt-4 text-[15px] font-semibold text-folk-ink">
                {t("kunde.section.finance")}
              </h2>
              <dl className="space-y-1.5 text-[14px]">
                {(
                  [
                    ["kunde.finance.invoiced", finanzen?.fakturiert],
                    ["kunde.finance.paid", finanzen?.bezahlt],
                    ["kunde.finance.open", finanzen?.offen],
                    ["kunde.finance.receipts", finanzen?.quittungen],
                  ] as [MessageKey, number | undefined][]
                ).map(([k, betrag]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-folk-ink3">{t(k)}</dt>
                    <dd className="font-mono text-folk-ink">
                      {formatCurrency(Number(betrag ?? 0), locale)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[12px] leading-snug text-folk-ink4">
                {t("kunde.finance.hint")}
              </p>

              <h2 className="mb-2 mt-4 text-[15px] font-semibold text-folk-ink">
                {t("kunde.section.activity")}
              </h2>
              <dl className="space-y-1.5 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-folk-ink3">{t("kunde.activity.first")}</dt>
                  <dd className="text-folk-ink">{datum(aktivitaet?.erster_kontakt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-folk-ink3">{t("kunde.activity.last")}</dt>
                  <dd className="text-folk-ink">{datum(aktivitaet?.letzte_aktion)}</dd>
                </div>
                {aktivitaet?.naechster_termin && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-folk-ink3">{t("kunde.activity.next")}</dt>
                    <dd className="text-folk-ink">
                      {datum(aktivitaet.naechster_termin.datum)} · {aktivitaet.naechster_termin.titel}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        ) : (
          <section className="rounded-xl border border-folk-line bg-folk-card p-4">
            {verlaufLaedt ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-folk-coral" />
              </div>
            ) : ereignisse.length === 0 ? (
              <p className="py-12 text-center text-folk-ink3">{t("kunde.history.empty")}</p>
            ) : (
              <>
                <ol className="space-y-2">
                  {ereignisse.map((e) => (
                    <li
                      key={`${e.entitaet}-${e.entitaet_id}`}
                      className="flex items-center gap-3 rounded-lg border border-folk-line p-3"
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {EREIGNIS_EMOJI[e.ereignis_art] ?? "•"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] text-folk-ink3">
                            {t(EREIGNIS_LABEL[e.ereignis_art] ?? "kunde.event.anfrage")}
                          </span>
                          <span className="truncate text-[14px] font-medium text-folk-ink">
                            {e.titel}
                          </span>
                        </div>
                        {e.untertitel && (
                          <div className="truncate text-[12.5px] text-folk-ink4">{e.untertitel}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {e.betrag !== null && (
                          <div className="font-mono text-[13px] text-folk-ink2">
                            {formatCurrency(Number(e.betrag), locale)}
                          </div>
                        )}
                        <div className="text-[12px] text-folk-ink4">{datum(e.ereignis_am)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                {mehrDa && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" onClick={mehrLaden}>
                      {t("kunde.history.more")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {mergeMit && (
        <KundeMergeDialog
          offen
          onOpenChange={(o) => !o && setMergeMit(null)}
          aktuell={kunde}
          kandidat={mergeMit}
          darfZusammenfuehren={darfMergen}
          vorschauLaden={vorschau}
          ausfuehren={zusammenfuehren}
          onFertig={(zielId) => {
            setMergeMit(null);
            navigate(`/firma/kunden/${zielId}`, { replace: true });
          }}
        />
      )}
    </>
  );
}
