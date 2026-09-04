import { CalendarDays, CheckCircle2, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DateInputCH } from "@/components/ui/date-input-ch";
import { TimeInputCH } from "@/components/ui/time-input-ch";
import { AnnahmefristHinweis } from "@/components/offerte/AnnahmefristHinweis";
import { isoToDisplay } from "@/lib/dateInputCH";
import { getAppointmentLabel } from "@/i18n/domain";
import { useI18n, useT } from "@/i18n/useI18n";

/**
 * Die Datumsfelder einer Offerte — getrennt nach dem, was sie beschreiben.
 *
 * WARUM GETRENNT
 *
 * Eine Offerte trägt drei Daten, und zwei davon gehören nicht zusammen:
 *
 *   Offertendatum   wann das Dokument ausgestellt wurde  (`offers.created_at`,
 *                   automatisch, im PDF-Kopf als «Datum»)
 *   Gültig bis      bis wann der Kunde zusagen darf      (`offers.valid_until`)
 *   Ausführungstermin  wann gearbeitet wird              (`offers.service_date`)
 *
 * Die ersten beiden beschreiben das DOKUMENT, das dritte die ARBEIT. Bis hierher
 * standen «Ausführungsdatum» und «Gültig bis» als Paar nebeneinander in einer
 * Karte namens «Offerten-Details», und das Offertendatum kam im Formular
 * ueberhaupt nicht vor — es entsteht ja von selbst.
 *
 * Wer weiss, dass eine Offerte ein Datum hat, sucht es also, findet das erste
 * Datumsfeld und traegt den heutigen Tag ein. Das System glaubt ihm dann, dass
 * der Umzug heute stattfindet, und druckt es als Termin. Genau so entstanden
 * sechs Offerten mit dem Anlagetag als Umzugstag, bei Kundenwuenschen, die
 * Wochen spaeter lagen.
 *
 * Deshalb hier: zwei beschriftete Bloecke, das Offertendatum sichtbar (aber
 * nicht editierbar, denn es ist keine Entscheidung), und das Terminfeld traegt
 * das Wort, das auch im PDF steht — «Umzugstermin», «Reinigungstermin»,
 * «Einsatztermin», je nach Service. Ein Feld mit diesem Namen laedt niemanden
 * mehr dazu ein, das Datum der Offerte hineinzuschreiben.
 *
 * Der Wunschtermin aus der Anfrage steht daneben. Er ist die Vorbelegung; weicht
 * das Feld davon ab, sagt es das und bietet an, ihn zurueckzuholen.
 *
 * Sprache: die des BEDIENERS (`useT`/`useI18n`). Er liest das hier, nicht der
 * Kunde — das Dokument beschriftet dieselben Felder mit `documentI18nFor`.
 */

interface OfferteDatumsfelderProps {
  /** Bestimmt das Terminwort («Umzugstermin» …). `null` → «Ausführungstermin». */
  serviceType: string | null;
  /**
   * `offers.created_at` als ISO-Tag. `null` heisst: die Offerte gibt es noch
   * nicht, das Datum entsteht beim Speichern.
   */
  offertendatum: string | null;
  /** `leads.preferred_date` — die Vorbelegung. `null`, wo der Lead nicht vorliegt. */
  wunschtermin: string | null;
  /** ISO `YYYY-MM-DD` oder "" */
  serviceDate: string;
  onServiceDateChange: (iso: string) => void;
  /** ISO `YYYY-MM-DD` oder "" */
  validUntil: string;
  onValidUntilChange: (iso: string) => void;
  /** "HH:MM" oder "" */
  startTime: string;
  onStartTimeChange: (v: string) => void;
  /** "HH:MM" oder "" */
  endTime: string;
  onEndTimeChange: (v: string) => void;
  /** Erster Arbeitstag inkl. Gruppenterminen — fuer den Fristhinweis. */
  arbeitsbeginn: string | null;
}

export const OfferteDatumsfelder = ({
  serviceType,
  offertendatum,
  wunschtermin,
  serviceDate,
  onServiceDateChange,
  validUntil,
  onValidUntilChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  arbeitsbeginn,
}: OfferteDatumsfelderProps) => {
  const t = useT();
  const { locale } = useI18n();
  const terminLabel = getAppointmentLabel(serviceType, locale);
  const weichtAb = Boolean(wunschtermin) && serviceDate !== wunschtermin;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ── Was der Kunde bekommt: die Arbeit ────────────────────────────── */}
      <div className="rounded-lg border border-dashed px-3 py-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("offer.form.section.termin")}
        </p>

        <div className="space-y-1.5 sm:w-1/2 sm:pr-2">
          <Label htmlFor="serviceDate" className="text-xs sm:text-sm">
            {terminLabel}
          </Label>
          <DateInputCH id="serviceDate" value={serviceDate} onChange={onServiceDateChange} />
        </div>

        {wunschtermin ? (
          weichtAb ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="text-xs text-amber-800">
                {t("offer.form.wunschtermin.abweichend", { date: isoToDisplay(wunschtermin) })}
              </span>
              <button
                type="button"
                onClick={() => onServiceDateChange(wunschtermin)}
                className="text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
              >
                {t("offer.form.wunschtermin.uebernehmen")}
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {t("offer.form.wunschtermin.gleich")}
            </p>
          )
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="serviceStartTime" className="text-xs sm:text-sm">
              {t("offer.details.field.startTime")}
            </Label>
            <TimeInputCH id="serviceStartTime" value={startTime} onChange={onStartTimeChange} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serviceEndTime" className="text-xs sm:text-sm">
              {t("offer.details.field.endTime")}
            </Label>
            <TimeInputCH id="serviceEndTime" value={endTime} onChange={onEndTimeChange} />
          </div>
        </div>
      </div>

      {/* ── Was das Dokument über sich selbst sagt ───────────────────────── */}
      <div className="rounded-lg border border-dashed px-3 py-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("offer.form.section.dokument")}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">{t("offer.form.field.offertendatum")}</Label>
            {/* Kein Eingabefeld: das Datum entsteht beim Speichern und steht so im
                PDF-Kopf. Sichtbar ist es trotzdem — wer es sucht, soll es finden
                und nicht das Terminfeld dafuer benutzen. */}
            <div className="flex h-9 sm:h-10 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>
                {offertendatum
                  ? isoToDisplay(offertendatum)
                  : t("offer.form.offertendatum.beimSpeichern")}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="validUntil" className="text-xs sm:text-sm">
                {t("offer.form.field.validUntil")}
              </Label>
              {validUntil && (
                <button
                  type="button"
                  onClick={() => onValidUntilChange("")}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  {t("common.remove")}
                </button>
              )}
            </div>
            {validUntil ? (
              <DateInputCH id="validUntil" value={validUntil} onChange={onValidUntilChange} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 30);
                  onValidUntilChange(d.toISOString().split("T")[0]);
                }}
                className="w-full h-9 sm:h-10 border border-dashed border-input rounded-md text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                {t("offer.form.validUntil.add")}
              </button>
            )}
          </div>
        </div>

        <AnnahmefristHinweis arbeitsbeginn={arbeitsbeginn} validUntil={validUntil} />
      </div>
    </div>
  );
};
