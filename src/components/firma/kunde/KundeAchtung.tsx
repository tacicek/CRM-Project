import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertOctagon,
  BellRing,
  CalendarClock,
  CircleCheck,
  CircleDollarSign,
  FileText,
  Inbox,
} from "lucide-react";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { KundeZusammenfassung } from "@/hooks/useKunde";

type Kachel = {
  schluessel: string;
  icon: typeof BellRing;
  titel: string;
  wert: string;
  detail?: string;
  /** Kritisch heisst: es laeuft etwas schief, nicht nur "es gibt etwas". */
  kritisch: boolean;
  ziel: string;
};

/**
 * Der Achtungsstreifen: was an diesem Kunden JETZT etwas verlangt.
 *
 * Die Zaehlerkacheln daneben ("7 Offerten") sind Bestandsangaben und sagen
 * nichts ueber Dringlichkeit. Hier stehen nur Dinge, die eine Handlung nach
 * sich ziehen — und nur, wenn es sie gibt. Ein Streifen aus lauter Nullen waere
 * genau der Laerm, aus dem heraus man das eine Wichtige uebersieht.
 *
 * Kritisches (ueberfaellige Rechnung, dringender Fall, ueberfaellige Aufgabe)
 * traegt Rahmen UND Symbol UND einen Zusatz im Text — nicht nur eine andere
 * Farbe.
 */
export const KundeAchtung = ({
  zusammenfassung,
  customerId,
}: {
  zusammenfassung: KundeZusammenfassung;
  customerId: string;
}) => {
  const navigate = useNavigate();
  const t = useT();
  const { locale, dateLocale } = useI18n();

  const { offen, finanzen, pipeline, aktivitaet } = zusammenfassung;
  const kacheln: Kachel[] = [];

  const datum = (iso: string) => format(new Date(iso), "dd. MMM yyyy", { locale: dateLocale });
  const uhrzeit = (hhmm: string) => hhmm.slice(0, 5);

  // 1. Nächste Aufgabe — die konkreteste Handlung überhaupt.
  if (aktivitaet.naechste_aufgabe) {
    const a = aktivitaet.naechste_aufgabe;
    const ueberfaellig = a.faellig_am !== null && new Date(a.faellig_am) < new Date();
    kacheln.push({
      schluessel: "aufgabe",
      icon: BellRing,
      titel: t("kunde.attention.nextTask"),
      wert: a.titel,
      detail: a.faellig_am
        ? `${t("kunde.attention.due")} ${datum(a.faellig_am)}${ueberfaellig ? ` · ${t("kunde.attention.overdue")}` : ""}`
        : t("kunde.attention.noDate"),
      kritisch: ueberfaellig || a.prioritaet === "high",
      ziel: "/firma/aufgaben",
    });
  }

  // 2. Nächster Termin — mit Uhrzeit. "am 21." allein beantwortet die Frage nicht.
  if (aktivitaet.naechster_termin) {
    const tm = aktivitaet.naechster_termin;
    kacheln.push({
      schluessel: "termin",
      icon: CalendarClock,
      titel: t("kunde.attention.nextAppointment"),
      wert: `${datum(tm.datum)}${tm.start && !tm.ganztags ? ` · ${uhrzeit(tm.start)}` : ""}`,
      detail: tm.titel,
      kritisch: false,
      ziel: "/firma/kalender",
    });
  }

  // 3. Geld. Ueberfaellig schlaegt offen: eine offene Rechnung innerhalb der
  //    Frist ist der Normalfall, eine ueberfaellige ist es nicht.
  if (Number(finanzen.offen) > 0) {
    const ueberfaellig = Number(finanzen.ueberfaellig) > 0;
    kacheln.push({
      schluessel: "offen",
      icon: CircleDollarSign,
      titel: t("kunde.attention.openBalance"),
      wert: formatCurrency(Number(finanzen.offen), locale),
      detail: ueberfaellig
        ? `${formatCurrency(Number(finanzen.ueberfaellig), locale)} ${t("kunde.attention.overdue")}`
        : undefined,
      kritisch: ueberfaellig,
      ziel: "/firma/rechnungen",
    });
  }

  // 4. Fälle.
  if (offen.faelle > 0) {
    kacheln.push({
      schluessel: "faelle",
      icon: AlertOctagon,
      titel: t("kunde.attention.openCases"),
      wert: String(offen.faelle),
      detail: offen.faelle_dringend > 0 ? String(offen.faelle_dringend) : undefined,
      kritisch: offen.faelle_dringend > 0,
      ziel: "/firma/faelle",
    });
  }

  // 5. Offene Offerten und laufende Aufträge — Bestand, nie kritisch.
  if (pipeline.offerten_offen > 0) {
    kacheln.push({
      schluessel: "offerten",
      icon: FileText,
      titel: t("kunde.attention.openOffers"),
      wert: String(pipeline.offerten_offen),
      kritisch: false,
      ziel: "/firma/offerten",
    });
  }

  // 6. Änderungswünsche aus dem Portal warten auf eine Entscheidung.
  if (offen.aenderungswuensche > 0) {
    kacheln.push({
      schluessel: "wuensche",
      icon: Inbox,
      titel: t("kunde.attention.changeRequests"),
      wert: String(offen.aenderungswuensche),
      kritisch: false,
      ziel: `/firma/kunden/${customerId}`,
    });
  }

  if (kacheln.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-folk-line bg-folk-card px-4 py-3 text-[14px] text-folk-ink2">
        <CircleCheck className="h-4 w-4 shrink-0 text-folk-mint" aria-hidden />
        {t("kunde.attention.none")}
      </div>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {kacheln.map((k) => {
        const Icon = k.icon;
        return (
          <li key={k.schluessel}>
            <button
              type="button"
              onClick={() => navigate(k.ziel)}
              className={`flex w-full min-h-[44px] items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                k.kritisch
                  ? "border-folk-coral/50 bg-folk-coral-bg hover:bg-folk-coral-bg/70"
                  : "border-folk-line bg-folk-card hover:bg-folk-bg-warm"
              }`}
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${k.kritisch ? "text-folk-coral" : "text-folk-ink3"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium uppercase tracking-wide text-folk-ink3">
                  {k.titel}
                </span>
                <span className="mt-0.5 block break-words text-[15px] font-semibold text-folk-ink">
                  {k.wert}
                </span>
                {k.detail && (
                  <span
                    className={`mt-0.5 block break-words text-[12.5px] ${
                      k.kritisch ? "font-medium text-folk-coral" : "text-folk-ink2"
                    }`}
                  >
                    {k.detail}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
