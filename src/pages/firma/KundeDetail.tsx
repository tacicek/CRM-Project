import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Loader2, Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useKunde } from "@/hooks/useKunde";
import { useKundeOrte } from "@/hooks/useKundeOrte";
import { useKundeTimeline } from "@/hooks/useKundeTimeline";
import { useKundeVorgaenge } from "@/hooks/useKundeVorgaenge";
import { PortalZugangPanel } from "@/components/firma/PortalZugangPanel";
import { KundeMergeDialog } from "@/components/firma/KundeMergeDialog";
import { AbschnittFehler } from "@/components/firma/kunde/AbschnittFehler";
import { KundeAchtung } from "@/components/firma/kunde/KundeAchtung";
import { KundeBearbeitenDialog } from "@/components/firma/kunde/KundeBearbeitenDialog";
import { KundeFinanzen } from "@/components/firma/kunde/KundeFinanzen";
import { KundeKopf } from "@/components/firma/kunde/KundeKopf";
import { KundeOrte } from "@/components/firma/kunde/KundeOrte";
import { KundeVerlauf } from "@/components/firma/kunde/KundeVerlauf";
import { KundeVorgaengeListe } from "@/components/firma/kunde/KundeVorgaengeListe";
import { useI18n, useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

const GRUND_LABEL: Record<string, MessageKey> = {
  same_phone: "kunde.duplicate.reason.same_phone",
  same_phone_and_name: "kunde.duplicate.reason.same_phone_and_name",
};

const AKTION_LABEL: Record<string, MessageKey> = {
  anfrage: "kunde.event.anfrage",
  offerte: "kunde.event.offerte",
  auftrag: "kunde.event.auftrag",
  termin: "kunde.event.termin",
  rechnung: "kunde.event.rechnung",
  quittung: "kunde.event.quittung",
  email: "kunde.event.email",
  zahlung: "kunde.finance.paid",
  fall: "kunde.attention.openCases",
};

/**
 * Die Kundenkarte.
 *
 * Diese Datei ORCHESTRIERT nur: sie holt vier voneinander unabhaengige
 * Datenquellen und verteilt sie auf fuenf Reiter. Die Bloecke selbst stehen in
 * src/components/firma/kunde/ — vorher lag alles in dieser Datei, und ein
 * Adressblock haette sie auf das Doppelte gebracht.
 *
 * Die vier Quellen laden GETRENNT und scheitern getrennt. Faellt die
 * Zusammenfassung aus, arbeiten Verlauf, Orte und Vorgaenge weiter — und der
 * Finanzblock zeigt einen Fehlerkasten statt CHF 0.00.
 */
export default function FirmaKundeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { dateLocale } = useI18n();
  const { companyId } = useCachedCompany();
  const { role } = useCompanyContext();

  const {
    kunde,
    zustand,
    stammFehler,
    zusammenfassung,
    zusammenfassungFehler,
    zusammenfassungLaedt,
    duplikate,
    laden,
    zusammenfassungLaden,
    speichern,
    zusammenfuehren,
    vorschau,
  } = useKunde(id, companyId);

  const orte = useKundeOrte(id, companyId);
  const verlauf = useKundeTimeline(id);
  const vorgaenge = useKundeVorgaenge(id);

  const [tab, setTab] = useState("overview");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [mergeMit, setMergeMit] = useState<{ id: string; display_name: string } | null>(null);

  if (zustand === "laedt") {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-folk-coral" aria-hidden />
      </div>
    );
  }

  // Vier verschiedene Antworten statt einer. Vorher lief alles in
  // "Kunde nicht gefunden" zusammen — auch ein abgerissenes Netz.
  if (zustand !== "da" || !kunde) {
    const titelKey: MessageKey =
      zustand === "kein_zugriff" ? "kunde.error.noAccess" : "kunde.detail.notFound";
    const hinweisKey: MessageKey =
      zustand === "kein_zugriff" ? "kunde.error.noAccessHint" : "kunde.detail.notFoundHint";

    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        {zustand === "fehler" && stammFehler ? (
          <AbschnittFehler
            titelKey="kunde.error.load"
            fehler={stammFehler}
            onRetry={laden}
          />
        ) : (
          <>
            <p className="font-semibold text-folk-ink">{t(titelKey)}</p>
            <p className="text-[14px] text-folk-ink2">{t(hinweisKey)}</p>
          </>
        )}
        <Button variant="outline" onClick={() => navigate("/firma/kunden")}>
          {t("kunde.detail.back")}
        </Button>
      </div>
    );
  }

  const darfMergen = role === "owner" || role === "admin";
  const darfLoeschen = role === "owner" || role === "admin";
  const hauptanschrift = orte.haupt("correspondence") ?? orte.haupt("billing");
  const rechnungsanschrift = orte.haupt("billing");
  const aktivitaet = zusammenfassung?.aktivitaet;
  const zahlen = zusammenfassung?.anzahl;

  const datum = (iso: string | null | undefined) =>
    iso ? format(new Date(iso), "dd. MMM yyyy", { locale: dateLocale }) : null;

  return (
    <>
      <Helmet>
        <title>{`${kunde.display_name} · CRM`}</title>
      </Helmet>

      <div className="space-y-4">
        <KundeKopf
          kunde={kunde}
          anschrift={hauptanschrift?.address_raw ?? null}
          letzteAnfrageId={zusammenfassung?.aktionen?.letzte_anfrage_id ?? null}
          onBearbeiten={() => setBearbeiten(true)}
        />

        {/* Weiterleitung: dieser Kunde wurde in einen anderen ueberfuehrt. Die
            Quellzeile bleibt bestehen, damit alte Links aufloesen. */}
        {kunde.merged_into_customer_id && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-folk-line bg-folk-bg-warm p-4">
            <ArrowRight className="h-5 w-5 shrink-0 text-folk-ink3" aria-hidden />
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
            <p className="font-semibold text-folk-ink">{t("kunde.duplicate.banner.title")}</p>
            <p className="mt-0.5 text-[14px] text-folk-ink2">
              {t("kunde.duplicate.banner.description", { count: duplikate.length })}
            </p>
            <div className="mt-2 space-y-1.5">
              {duplikate.map((d) => (
                <div
                  key={d.customer_b_id}
                  className="flex flex-wrap items-center gap-2 text-[14px]"
                >
                  <button
                    type="button"
                    className="font-medium text-folk-ink underline-offset-2 hover:underline"
                    onClick={() => navigate(`/firma/kunden/${d.customer_b_id}`)}
                  >
                    {d.customer_b_name}
                  </button>
                  <span className="text-folk-ink2">
                    · {t(GRUND_LABEL[d.match_reason] ?? "kunde.duplicate.reason.same_phone")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
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
        )}

        {/* Achtungsstreifen. Bei einem Fehlschlag steht hier ein Fehlerkasten
            und KEINE Kacheln mit Nullen — "nichts Offenes" waere eine Auskunft,
            die niemand geprueft hat. */}
        {zusammenfassungFehler ? (
          <AbschnittFehler
            titelKey="kunde.error.summary"
            hinweisKey="kunde.error.summaryHint"
            fehler={zusammenfassungFehler}
            laedt={zusammenfassungLaedt}
            onRetry={zusammenfassungLaden}
          />
        ) : zusammenfassung ? (
          <KundeAchtung zusammenfassung={zusammenfassung} customerId={kunde.id} />
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="overview">{t("kunde.tab.overview")}</TabsTrigger>
            <TabsTrigger value="history">{t("kunde.tab.history")}</TabsTrigger>
            <TabsTrigger value="documents">{t("kunde.tab.documents")}</TabsTrigger>
            <TabsTrigger value="finance">{t("kunde.tab.finance")}</TabsTrigger>
            <TabsTrigger value="locations">{t("kunde.tab.locations")}</TabsTrigger>
          </TabsList>

          {/* Echte TabsContent-Panels: Radix verknuepft sie ueber aria-controls /
              aria-labelledby mit dem jeweiligen Trigger. Vorher stand der Inhalt
              ausserhalb der Tabs und war fuer eine Sprachausgabe kein Panel. */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <section className="rounded-xl border border-folk-line bg-folk-card p-4">
                  <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
                    {t("kunde.section.contact")}
                  </h2>
                  <dl className="space-y-2.5 text-[14px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <dt className="text-folk-ink2">{t("kunde.field.email")}</dt>
                      <dd className="min-w-0 max-w-full">
                        {kunde.primary_email ? (
                          <a
                            href={`mailto:${kunde.primary_email}`}
                            className="inline-flex items-center gap-1.5 break-all text-folk-ink underline-offset-2 hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {kunde.primary_email}
                          </a>
                        ) : (
                          // Kein „—": ein Leerzustand mit Handlung ist eine
                          // Auskunft, ein Gedankenstrich ist eine Sackgasse.
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2 text-folk-ink2"
                            onClick={() => setBearbeiten(true)}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            {t("kunde.empty.addEmail")}
                          </Button>
                        )}
                      </dd>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <dt className="text-folk-ink2">{t("kunde.field.phone")}</dt>
                      <dd className="min-w-0 max-w-full">
                        {kunde.primary_phone ? (
                          <a
                            href={`tel:${kunde.primary_phone.replace(/[^\d+]/g, "")}`}
                            className="inline-flex items-center gap-1.5 font-mono text-folk-ink underline-offset-2 hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {kunde.primary_phone}
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2 text-folk-ink2"
                            onClick={() => setBearbeiten(true)}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            {t("kunde.empty.addPhone")}
                          </Button>
                        )}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-3">
                      <dt className="text-folk-ink2">{t("kunde.field.language")}</dt>
                      <dd className="text-folk-ink">{kunde.language.toUpperCase()}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-folk-ink2">{t("kunde.field.source")}</dt>
                      <dd className="text-folk-ink">{kunde.source || t("kunde.field.none")}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-folk-line pt-3">
                    <h3 className="mb-1.5 text-[13px] font-medium text-folk-ink2">
                      {t("kunde.address.section")}
                    </h3>
                    {hauptanschrift ? (
                      <>
                        <p className="break-words text-[14px] text-folk-ink">
                          {hauptanschrift.address_raw}
                        </p>
                        {rechnungsanschrift &&
                          rechnungsanschrift.id !== hauptanschrift.id && (
                            <p className="mt-1.5 break-words text-[13px] text-folk-ink2">
                              <span className="font-medium">
                                {t("kunde.address.billing")}:{" "}
                              </span>
                              {rechnungsanschrift.address_raw}
                            </p>
                          )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setTab("locations")}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        {t("kunde.empty.addAddress")}
                      </Button>
                    )}
                  </div>

                  {kunde.notes && (
                    <div className="mt-4 border-t border-folk-line pt-3">
                      <h3 className="mb-1 text-[13px] font-medium text-folk-ink2">
                        {t("kunde.field.notes")}
                      </h3>
                      <p className="whitespace-pre-wrap break-words text-[13.5px] text-folk-ink">
                        {kunde.notes}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-folk-line bg-folk-card p-4">
                  <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
                    {t("kunde.section.activity")}
                  </h2>
                  {zusammenfassungFehler ? (
                    <p className="text-[13.5px] text-folk-ink2">
                      {t("kunde.error.summaryHint")}
                    </p>
                  ) : (
                    <dl className="space-y-2 text-[14px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-folk-ink2">{t("kunde.activity.first")}</dt>
                        <dd className="text-folk-ink">
                          {datum(aktivitaet?.erster_kontakt) ?? t("kunde.field.none")}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-folk-ink2">{t("kunde.activity.last")}</dt>
                        <dd className="text-folk-ink">
                          {aktivitaet?.letzte_aktion ? (
                            <>
                              {datum(aktivitaet.letzte_aktion)}
                              {aktivitaet.letzte_aktion_art && (
                                <span className="ml-1.5 text-folk-ink2">
                                  ·{" "}
                                  {t(
                                    AKTION_LABEL[aktivitaet.letzte_aktion_art] ??
                                      "kunde.event.anfrage",
                                  )}
                                </span>
                              )}
                            </>
                          ) : (
                            t("kunde.activity.never")
                          )}
                        </dd>
                      </div>
                      {aktivitaet?.naechster_termin && (
                        <div className="flex flex-wrap justify-between gap-x-3">
                          <dt className="text-folk-ink2">{t("kunde.activity.next")}</dt>
                          <dd className="text-folk-ink">
                            {datum(aktivitaet.naechster_termin.datum)}
                            {aktivitaet.naechster_termin.start &&
                              !aktivitaet.naechster_termin.ganztags && (
                                <> · {aktivitaet.naechster_termin.start.slice(0, 5)}</>
                              )}
                            <span className="ml-1.5 text-folk-ink2">
                              {aktivitaet.naechster_termin.titel}
                            </span>
                          </dd>
                        </div>
                      )}
                      {aktivitaet?.naechste_aufgabe && (
                        <div className="flex flex-wrap justify-between gap-x-3">
                          <dt className="text-folk-ink2">{t("kunde.activity.nextTask")}</dt>
                          <dd className="text-folk-ink">
                            {aktivitaet.naechste_aufgabe.titel}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-xl border border-folk-line bg-folk-card p-4">
                  <h2 className="mb-3 text-[15px] font-semibold text-folk-ink">
                    {t("kunde.section.numbers")}
                  </h2>
                  {zusammenfassungFehler ? (
                    <p className="text-[13.5px] text-folk-ink2">
                      {t("kunde.error.summaryHint")}
                    </p>
                  ) : (
                    // Auf dem Telefon zwei Spalten, nicht drei schmale: eine
                    // Zahl mit abgeschnittener Beschriftung ist keine Kennzahl.
                    <button
                      type="button"
                      onClick={() => setTab("documents")}
                      className="grid w-full grid-cols-2 gap-2 text-left sm:grid-cols-3"
                    >
                      {(
                        [
                          ["kunde.count.anfragen", zahlen?.anfragen],
                          ["kunde.count.offerten", zahlen?.offerten],
                          ["kunde.count.auftraege", zahlen?.auftraege],
                          ["kunde.count.termine", zahlen?.termine],
                          ["kunde.count.rechnungen", zahlen?.rechnungen],
                          ["kunde.count.quittungen", zahlen?.quittungen],
                        ] as [MessageKey, number | undefined][]
                      ).map(([k, n]) => (
                        <span
                          key={k}
                          className="rounded-lg bg-folk-bg-warm p-2.5 transition-colors hover:bg-folk-line-soft"
                        >
                          <span className="block font-mono text-[19px] font-semibold text-folk-ink">
                            {n ?? 0}
                          </span>
                          <span className="block text-[12px] text-folk-ink2">{t(k)}</span>
                        </span>
                      ))}
                    </button>
                  )}
                </section>

                {zusammenfassung && !zusammenfassungFehler && (
                  <KundeFinanzen finanzen={zusammenfassung.finanzen} />
                )}

                <section className="rounded-xl border border-folk-line bg-folk-card p-4">
                  <PortalZugangPanel customerId={kunde.id} companyId={companyId} />
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <KundeVerlauf
              ereignisse={verlauf.ereignisse}
              loading={verlauf.loading}
              mehrLaedt={verlauf.mehrLaedt}
              mehrDa={verlauf.mehrDa}
              fehler={verlauf.fehler}
              mehrLaden={verlauf.mehrLaden}
              neuLaden={verlauf.neuLaden}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <KundeVorgaengeListe
              vorgaenge={vorgaenge.vorgaenge}
              laedt={vorgaenge.laedt}
              fehler={vorgaenge.fehler}
              neuLaden={vorgaenge.laden}
            />
          </TabsContent>

          <TabsContent value="finance" className="mt-4 space-y-4">
            {zusammenfassungFehler ? (
              <AbschnittFehler
                titelKey="kunde.error.summary"
                hinweisKey="kunde.error.summaryHint"
                fehler={zusammenfassungFehler}
                laedt={zusammenfassungLaedt}
                onRetry={zusammenfassungLaden}
              />
            ) : zusammenfassung ? (
              <KundeFinanzen finanzen={zusammenfassung.finanzen} />
            ) : (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-folk-coral" aria-hidden />
              </div>
            )}
            <KundeVorgaengeListe
              vorgaenge={vorgaenge.vorgaenge}
              arten={["rechnungen", "quittungen"]}
              laedt={vorgaenge.laedt}
              fehler={vorgaenge.fehler}
              neuLaden={vorgaenge.laden}
            />
          </TabsContent>

          <TabsContent value="locations" className="mt-4">
            <KundeOrte orte={orte} darfLoeschen={darfLoeschen} />
          </TabsContent>
        </Tabs>
      </div>

      <KundeBearbeitenDialog
        kunde={kunde}
        offen={bearbeiten}
        onOpenChange={setBearbeiten}
        onSpeichern={speichern}
      />

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
