import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Receipt,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import { AbschnittFehler } from "@/components/firma/kunde/AbschnittFehler";
import type { Ereignis } from "@/hooks/useKundeTimeline";
import type { Ladefehler } from "@/lib/ladefehler";
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

/**
 * Symbol statt Emoji: ein Emoji wird je nach Schrift verschieden gross und
 * verschieden bunt gerendert und traegt bei Screenreadern seinen eigenen Namen
 * ("Briefumschlag mit Pfeil"). Die Art steht ohnehin als Text daneben.
 */
const EREIGNIS_ICON: Record<string, typeof FileText> = {
  anfrage: Inbox,
  offerte: FileText,
  auftrag: Wrench,
  termin: CalendarDays,
  rechnung: Wallet,
  quittung: Receipt,
  email: Mail,
};

/**
 * Welche Ereignisart auf welchen Bildschirm fuehrt.
 *
 * NUR die drei, die es wirklich gibt (App.tsx): Offerte, Rechnung und Quittung
 * haben eine Detailroute. Anfragen, Auftraege, Termine und E-Mails erscheinen
 * ausschliesslich in ihrer Liste — sie bekommen deshalb KEINEN Zeiger, keinen
 * Hover und kein Chevron. Ein Klick, der nichts tut, ist schlimmer als ein
 * Eintrag, der sichtbar nicht klickbar ist.
 */
const ZIEL: Record<string, (id: string) => string> = {
  offerte: (id) => `/firma/offerten/${id}`,
  rechnung: (id) => `/firma/rechnungen/${id}`,
  quittung: (id) => `/firma/quittungen/${id}`,
};

type Filter = "alle" | "offerten" | "auftraege" | "finanzen" | "kontakt";

const FILTER: { wert: Filter; labelKey: MessageKey; arten: string[] }[] = [
  { wert: "alle", labelKey: "kunde.history.filter.alle", arten: [] },
  { wert: "offerten", labelKey: "kunde.history.filter.offerten", arten: ["offerte"] },
  {
    wert: "auftraege",
    labelKey: "kunde.history.filter.auftraege",
    arten: ["auftrag", "termin"],
  },
  {
    wert: "finanzen",
    labelKey: "kunde.history.filter.finanzen",
    arten: ["rechnung", "quittung"],
  },
  { wert: "kontakt", labelKey: "kunde.history.filter.kontakt", arten: ["anfrage", "email"] },
];

export const KundeVerlauf = ({
  ereignisse,
  loading,
  mehrLaedt,
  mehrDa,
  fehler,
  mehrLaden,
  neuLaden,
}: {
  ereignisse: Ereignis[];
  loading: boolean;
  mehrLaedt: boolean;
  mehrDa: boolean;
  fehler: Ladefehler | null;
  mehrLaden: () => void;
  neuLaden: () => void;
}) => {
  const navigate = useNavigate();
  const t = useT();
  const { locale, dateLocale } = useI18n();
  const [filter, setFilter] = useState<Filter>("alle");

  const gefiltert = useMemo(() => {
    const arten = FILTER.find((f) => f.wert === filter)?.arten ?? [];
    return arten.length === 0
      ? ereignisse
      : ereignisse.filter((e) => arten.includes(e.ereignis_art));
  }, [ereignisse, filter]);

  // Der Fehler ersetzt die Liste NICHT, wenn schon etwas geladen war: das
  // Geladene war gueltig. Er steht dann darueber.
  const fehlerKasten = fehler ? (
    <AbschnittFehler
      titelKey="kunde.error.timeline"
      fehler={fehler}
      laedt={loading || mehrLaedt}
      onRetry={neuLaden}
    />
  ) : null;

  if (fehler && ereignisse.length === 0) {
    return <div className="space-y-3">{fehlerKasten}</div>;
  }

  return (
    <div className="space-y-3">
      {fehlerKasten}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("kunde.tab.history")}>
        {FILTER.map((f) => (
          <button
            key={f.wert}
            type="button"
            aria-pressed={filter === f.wert}
            onClick={() => setFilter(f.wert)}
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

      <section className="rounded-xl border border-folk-line bg-folk-card p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-folk-coral" aria-hidden />
          </div>
        ) : gefiltert.length === 0 ? (
          // Zwei verschiedene Aussagen: "dieser Kunde hat noch nichts" und
          // "in dieser Auswahl ist nichts". Beides ist wahr und keines ist ein Fehler.
          <p className="py-12 text-center text-folk-ink2">
            {t(ereignisse.length === 0 ? "kunde.history.empty" : "kunde.history.noMatch")}
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {gefiltert.map((e) => {
                const Icon = EREIGNIS_ICON[e.ereignis_art] ?? FileText;
                const ziel = ZIEL[e.ereignis_art]?.(e.entitaet_id);
                const zeit = new Date(e.ereignis_am);
                const inhalt = (
                  <>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink3" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-[12.5px] text-folk-ink2">
                          {t(EREIGNIS_LABEL[e.ereignis_art] ?? "kunde.event.anfrage")}
                        </span>
                        <span className="break-words text-[14px] font-medium text-folk-ink">
                          {e.titel}
                        </span>
                        {e.status && (
                          <span className="rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink2">
                            {e.status}
                          </span>
                        )}
                      </div>
                      {e.untertitel && (
                        <div className="break-words text-[12.5px] text-folk-ink2">
                          {e.untertitel}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {e.betrag !== null && (
                        <div className="font-mono text-[13px] text-folk-ink2">
                          {formatCurrency(Number(e.betrag), locale)}
                        </div>
                      )}
                      {/* Uhrzeit gehoert dazu: an einem Tag mit drei Ereignissen
                          sagt das blosse Datum nicht, was zuerst kam. */}
                      <div className="text-[12px] text-folk-ink2">
                        {format(zeit, "dd. MMM yyyy", { locale: dateLocale })}
                        {" · "}
                        {format(zeit, "HH:mm", { locale: dateLocale })}
                      </div>
                    </div>
                    {ziel && (
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink3"
                        aria-hidden
                      />
                    )}
                  </>
                );

                return (
                  <li key={`${e.entitaet}-${e.entitaet_id}`}>
                    {ziel ? (
                      <button
                        type="button"
                        onClick={() => navigate(ziel)}
                        className="flex w-full items-start gap-3 rounded-lg border border-folk-line p-3 text-left transition-colors hover:bg-folk-bg-warm"
                      >
                        {inhalt}
                      </button>
                    ) : (
                      <div className="flex items-start gap-3 rounded-lg border border-folk-line p-3">
                        {inhalt}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {mehrDa && filter === "alle" && (
              <div className="mt-3 text-center">
                <Button variant="outline" size="sm" disabled={mehrLaedt} onClick={mehrLaden}>
                  {mehrLaedt && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {t("kunde.history.more")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
