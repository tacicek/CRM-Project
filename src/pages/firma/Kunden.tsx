import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useKunden, type KundenFilter } from "@/hooks/useKunden";
import { PaginationBar, type PageSizeOption } from "@/components/firma/PaginationBar";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";

const FILTER: { wert: KundenFilter; labelKey: MessageKey }[] = [
  { wert: "alle", labelKey: "kunde.filter.alle" },
  { wert: "person", labelKey: "kunde.filter.person" },
  { wert: "firma", labelKey: "kunde.filter.firma" },
  { wert: "duplikate", labelKey: "kunde.filter.duplikate" },
];

/** Initialen fuer das Avatarfeld — dieselbe Idee wie in Anfragen.tsx. */
const initialen = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0]?.toUpperCase() ?? "")
    .join("") || "?";

const relativ = (iso: string | null, locale: string): string | null => {
  if (!iso) return null;
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (tage <= 0) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (tage < 31) return rtf.format(-tage, "day");
  if (tage < 365) return rtf.format(-Math.round(tage / 30), "month");
  return rtf.format(-Math.round(tage / 365), "year");
};

export default function FirmaKunden() {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const { companyId } = useCachedCompany();

  const [sucheEingabe, setSucheEingabe] = useState("");
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<KundenFilter>("alle");
  const [seite, setSeite] = useState(1);
  const [proSeite, setProSeite] = useState<PageSizeOption>(25);

  // Entprellt, damit nicht jeder Tastendruck eine Abfrage ausloest
  // (Muster: AppointmentModal.tsx).
  useEffect(() => {
    const id = setTimeout(() => {
      setSuche(sucheEingabe);
      setSeite(1);
    }, 250);
    return () => clearTimeout(id);
  }, [sucheEingabe]);

  const { kunden, gesamt, kennzahlen, loading } = useKunden({
    companyId,
    suche,
    filter,
    seite,
    proSeite,
  });

  // `kennzahlen` ist null, wenn die RPC nicht geantwortet hat. Dann bleiben die
  // Kacheln weg — vier Nullen waeren eine Auskunft ueber den Bestand, die
  // niemand geprueft hat.
  const kacheln = useMemo(
    () =>
      kennzahlen
        ? [
            { schluessel: "gesamt", labelKey: "kunde.kpi.total" as MessageKey, wert: kennzahlen.gesamt },
            { schluessel: "neu", labelKey: "kunde.kpi.neu" as MessageKey, wert: kennzahlen.neu30 },
            {
              schluessel: "duplikate",
              labelKey: "kunde.kpi.duplikate" as MessageKey,
              wert: kennzahlen.duplikate,
              filter: "duplikate" as KundenFilter,
            },
            {
              schluessel: "inaktiv",
              labelKey: "kunde.kpi.inaktiv" as MessageKey,
              wert: kennzahlen.inaktiv90,
            },
          ]
        : [],
    [kennzahlen],
  );

  return (
    <>
      <Helmet>
        <title>{t("kunde.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">🧑</span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("kunde.title")}
            </h1>
            {kennzahlen && (
              <span className="text-[15px] text-folk-ink2">
                {t("kunde.count", { count: kennzahlen.gesamt })}
              </span>
            )}
          </div>
        </header>

        {kacheln.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kacheln.map((k) => (
              <button
                key={k.schluessel}
                type="button"
                disabled={!k.filter}
                onClick={() => {
                  if (k.filter) {
                    setFilter(k.filter);
                    setSeite(1);
                  }
                }}
                className={`rounded-xl border border-folk-line bg-folk-card p-3.5 text-left ${
                  k.filter ? "transition-colors hover:bg-folk-bg-warm" : "cursor-default"
                }`}
              >
                <div className="font-mono text-[22px] font-semibold text-folk-ink">
                  {k.wert}
                </div>
                <div className="text-[13px] text-folk-ink2">{t(k.labelKey)}</div>
              </button>
            ))}
          </div>
        )}

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-folk-ink4" />
              <Input
                value={sucheEingabe}
                onChange={(e) => setSucheEingabe(e.target.value)}
                placeholder={t("kunde.search.placeholder")}
                className="h-9 rounded-lg border-folk-line pl-9 pr-8 text-[15px]"
              />
              {sucheEingabe && (
                <button
                  type="button"
                  aria-label={t("kunde.search.clear")}
                  onClick={() => setSucheEingabe("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-folk-ink4 hover:text-folk-ink2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTER.map((f) => (
                <button
                  key={f.wert}
                  type="button"
                  onClick={() => {
                    setFilter(f.wert);
                    setSeite(1);
                  }}
                  className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                    filter === f.wert
                      ? "border-folk-ink bg-folk-ink text-folk-bg"
                      : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
            </div>
          ) : kunden.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">
                🧑
              </div>
              <p className="font-semibold text-folk-ink">
                {kennzahlen?.gesamt === 0 ? t("kunde.empty.none") : t("kunde.empty.noMatch")}
              </p>
              {kennzahlen?.gesamt === 0 && (
                <p className="mt-1 text-[14px] text-folk-ink2">{t("kunde.empty.noneHint")}</p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {kunden.map((k) => {
                  const zuletzt = relativ(k.letzte_aktion, locale);
                  return (
                    <article
                      key={k.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/firma/kunden/${k.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/firma/kunden/${k.id}`);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5 transition-colors hover:bg-folk-bg-warm"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-folk-bg-warm font-mono text-[13px] font-semibold text-folk-ink2">
                        {initialen(k.display_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold tracking-tight text-folk-ink">
                            {k.display_name}
                          </span>
                          {k.customer_type === "company" && (
                            <span className="rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink2">
                              {t("kunde.badge.firma")}
                            </span>
                          )}
                          {/* Sprachmarke nur, wenn sie vom Standard abweicht — sonst
                              steht sie auf jeder Karte und sagt nichts. */}
                          {k.language !== "de" && (
                            <span className="rounded bg-folk-sky-bg px-1.5 py-0.5 text-[11px] font-medium uppercase text-folk-sky">
                              {k.language}
                            </span>
                          )}
                          {k.status === "blocked" && (
                            <span className="rounded bg-folk-coral-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-coral ring-1 ring-folk-coral/50">
                              {t("kunde.status.blocked")}
                            </span>
                          )}
                          {k.possible_duplicate && (
                            <span className="rounded bg-folk-coral-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-coral">
                              {t("kunde.badge.duplicate")}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-folk-ink2">
                          <span className="truncate">{k.primary_email ?? t("kunde.field.none")}</span>
                          {k.primary_phone && <span className="font-mono">· {k.primary_phone}</span>}
                          {/* Der Ort wird BENANNT. Ohne kanonische Anschrift ist
                              er der letzte Einsatzort — bei einem Umzug also
                              genau die Adresse, an der der Kunde nicht mehr
                              wohnt. Unbeschriftet las er sich als Wohnort. */}
                          {k.ort && (
                            <span
                              // Ohne bekannte Quelle KEIN Kurzhinweis: eine
                              // aeltere Datenbank liefert `ort_quelle` nicht,
                              // und "Letzter Einsatzort" waere dort geraten.
                              title={
                                k.ort_quelle === "adresse"
                                  ? t("kunde.list.ortSource.adresse")
                                  : k.ort_quelle === "einsatzort"
                                    ? t("kunde.list.ortSource.einsatzort")
                                    : undefined
                              }
                            >
                              ·{" "}
                              {k.ort_quelle === "einsatzort" && (
                                <span className="text-folk-ink3">
                                  {t("kunde.list.ortSource.einsatzort")}:{" "}
                                </span>
                              )}
                              {k.ort}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        {Number(k.offener_betrag) > 0 && (
                          <div className="font-mono text-[14px] font-semibold text-folk-coral">
                            {formatCurrency(Number(k.offener_betrag), locale)}
                            <span className="ml-1 text-[11px] font-normal text-folk-ink3">
                              {t("kunde.card.openAmount")}
                            </span>
                          </div>
                        )}
                        <div className="text-[12.5px] text-folk-ink2">
                          {zuletzt ?? t("kunde.card.noActivity")}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <PaginationBar
                total={gesamt}
                page={seite}
                pageSize={proSeite}
                onPageChange={setSeite}
                onPageSizeChange={setProSeite}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}
