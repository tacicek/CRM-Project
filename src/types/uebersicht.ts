/**
 * Das Ansichtsmodell der Übersicht.
 *
 * Bewusst getrennt von den Tabellenformen aus `integrations/supabase/types.ts`:
 * die Darstellung soll nicht brechen, wenn eine Spalte umbenannt wird, und die
 * Regeln dazwischen bleiben ohne Datenbank testbar.
 */

export type WorkItemStatus = "neu" | "offeriert" | "ueberfaellig" | "abgelehnt" | "gewonnen";

/**
 * Die Felder einer Offerte, die für die Statusableitung nötig sind.
 *
 * `superseded_at` und `version_number` gehören dazu, weil `offers` versioniert
 * ist: ohne sie erschiene jede Anfrage so oft, wie ihre Offerte überarbeitet
 * wurde.
 */
export type OfferForStatus = {
  id: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  valid_until: string | null;
  superseded_at: string | null;
  version_number: number | null;
};

export type WorkItem = {
  id: string;
  leadId: string;
  serviceType: string | null;
  title: string;
  from: string | null;
  to: string | null;
  status: WorkItemStatus;
  amountChf: number | null;
  daysOpen: number | null;
  jobDate: string | null;
  createdAt: string;
};

export type KpiKey = "anfragen" | "offerten" | "auftraege" | "umsatz";

export type Kpi = {
  key: KpiKey;
  value: number;
  format: "count" | "chf";
  /** `null`, wenn es keine Vergleichsbasis gibt — nicht 0 und nicht 100. */
  deltaPct: number | null;
  /** Ob ein Anstieg eine gute Nachricht ist. Unbeantwortete Anfragen: nein. */
  risingIsGood: boolean;
};

export type RevenueWeek = {
  /** ISO-Woche als Kürzel, z. B. "KW31". */
  label: string;
  amountChf: number;
  current: boolean;
};
