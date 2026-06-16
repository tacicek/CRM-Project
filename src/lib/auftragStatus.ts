export type AuftragStatus =
  | "geplant"
  | "bestaetigt"
  | "in_bearbeitung"
  | "abgeschlossen"
  | "storniert";

export const AUFTRAG_STATUS_LABELS: Record<AuftragStatus, string> = {
  geplant: "Geplant",
  bestaetigt: "Bestätigt",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
  storniert: "Storniert",
};

/**
 * Erlaubte Status-Übergänge (state machine).
 * Verhindert unsinnige Wechsel wie abgeschlossen → geplant.
 * - abgeschlossen ist terminal (kein Wechsel mehr).
 * - storniert kann reaktiviert werden (→ geplant).
 */
export const AUFTRAG_TRANSITIONS: Record<AuftragStatus, AuftragStatus[]> = {
  geplant: ["bestaetigt", "in_bearbeitung", "abgeschlossen", "storniert"],
  bestaetigt: ["geplant", "in_bearbeitung", "abgeschlossen", "storniert"],
  in_bearbeitung: ["bestaetigt", "abgeschlossen", "storniert"],
  abgeschlossen: [],
  storniert: ["geplant"],
};

export const isAuftragStatus = (value: string): value is AuftragStatus =>
  value in AUFTRAG_STATUS_LABELS;

/** True, wenn der Wechsel von `from` nach `to` erlaubt ist (gleicher Status ist immer erlaubt). */
export const canTransitionAuftrag = (from: string, to: string): boolean => {
  if (from === to) return true;
  if (!isAuftragStatus(from) || !isAuftragStatus(to)) return false;
  return AUFTRAG_TRANSITIONS[from].includes(to);
};

/** Liste der zulässigen Zielstatus inkl. des aktuellen Status (für Select-Optionen). */
export const allowedAuftragTargets = (from: string): AuftragStatus[] => {
  if (!isAuftragStatus(from)) return ["geplant"];
  return [from, ...AUFTRAG_TRANSITIONS[from]];
};
