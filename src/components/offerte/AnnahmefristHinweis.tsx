import { AlertCircle, CalendarCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isoToDisplay } from "@/lib/dateInputCH";
import { useT } from "@/i18n/useI18n";
import {
  addDays,
  evaluateAcceptanceWindow,
  heuteIso,
} from "../../../supabase/functions/_shared/offerAcceptanceWindow.ts";

/**
 * Sagt dem Bediener, was seine zwei Datumsfelder zusammen bedeuten: bis wann
 * der Kunde zusagen kann.
 *
 * WARUM ES DAS BRAUCHT
 *
 * «Ausführungsdatum» und «Gültig bis» stehen nebeneinander und ergeben
 * zusammen eine dritte Zahl, die nirgends stand: die Annahmefrist, der frühere
 * der beiden Tage (Ausführung minus eins). Wer sie nicht sieht, kann eine
 * Offerte anlegen, die schon beim Speichern abgelaufen ist — genau das ist bei
 * 10095 passiert, und die einzige Warnung im Formular zeigte in die falsche
 * Richtung: sie mass «Gültig bis» gegen heute und schwieg zur Ausführung.
 *
 * Der Hinweis ist ANZEIGE, kein Tor. Gesendet wird über `sendOffer`, und dort
 * entscheidet dieselbe Regel noch einmal — massgeblich in `send-offer`.
 *
 * Sprache: die des BEDIENERS (`useT`). Er liest das hier, nicht der Kunde.
 */

/** Unter dieser Spanne ist die Frist knapp — Erfahrungswert des Betriebs, kein Gesetz. */
const KNAPP_AB_TAGEN = 7;

interface AnnahmefristHinweisProps {
  /**
   * DER Termin dieser Offerte, nicht das rohe Feld: tragen die Positionen ein
   * eigenes Datum, gilt dieses. Die Seite löst es mit `resolveOfferTermin` auf —
   * dieselbe Regel, die PDF, Kundenseite und E-Mail drucken. Rechnete der
   * Hinweis mit dem globalen Feld, nennte er eine Frist, die für das gedruckte
   * Dokument gar nicht gilt.
   */
  terminDate: string | null;
  /** ISO `YYYY-MM-DD` oder "" */
  validUntil: string;
}

export const AnnahmefristHinweis = ({ terminDate, validUntil }: AnnahmefristHinweisProps) => {
  const t = useT();
  const heute = heuteIso();
  const { frist, offen } = evaluateAcceptanceWindow(validUntil || null, terminDate || null, heute);

  // Ohne beide Daten ist die Annahme unbefristet — dann gibt es nichts zu sagen.
  if (frist === null) return null;

  const tag = isoToDisplay(frist);

  if (!offen) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {t("offer.form.acceptance.expired", { date: tag })}{" "}
          {t("offer.form.acceptance.hint")}
        </AlertDescription>
      </Alert>
    );
  }

  if (frist < addDays(heute, KNAPP_AB_TAGEN)) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          {t("offer.form.acceptance.short", { date: tag })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
      {t("offer.form.acceptance.open", { date: tag })}
    </p>
  );
};
