export type RechnungStatus =
  | "entwurf"
  | "versendet"
  | "bezahlt"
  | "ueberfaellig";

export const RECHNUNG_STATUS_LABELS: Record<RechnungStatus, string> = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  bezahlt: "Bezahlt",
  ueberfaellig: "Überfällig",
};

/** Tailwind badge colors (for status badges). */
export const RECHNUNG_STATUS_COLORS: Record<RechnungStatus, string> = {
  entwurf: "bg-slate-100 text-slate-700",
  versendet: "bg-blue-100 text-blue-700",
  bezahlt: "bg-green-100 text-green-700",
  ueberfaellig: "bg-red-100 text-red-700",
};

/**
 * Erlaubte Status-Übergänge (state machine).
 * - entwurf → versendet | bezahlt (direkte Zahlung)
 * - versendet → bezahlt | ueberfaellig (Fälligkeit überschritten)
 * - ueberfaellig → bezahlt
 * - bezahlt ist terminal (kein Wechsel mehr).
 */
export const RECHNUNG_TRANSITIONS: Record<RechnungStatus, RechnungStatus[]> = {
  entwurf: ["versendet", "bezahlt"],
  versendet: ["bezahlt", "ueberfaellig"],
  ueberfaellig: ["bezahlt"],
  bezahlt: [],
};

export const isRechnungStatus = (value: string): value is RechnungStatus =>
  Object.prototype.hasOwnProperty.call(RECHNUNG_STATUS_LABELS, value);

/** True, wenn der Wechsel von `from` nach `to` erlaubt ist (gleicher Status ist immer erlaubt). */
export const canTransitionRechnung = (from: string, to: string): boolean => {
  if (from === to) return true;
  if (!isRechnungStatus(from) || !isRechnungStatus(to)) return false;
  return RECHNUNG_TRANSITIONS[from].includes(to);
};

/** Liste der zulässigen Zielstatus inkl. des aktuellen Status (für Select-Optionen). */
export const allowedRechnungTargets = (from: string): RechnungStatus[] => {
  if (!isRechnungStatus(from)) return ["entwurf"];
  return [from, ...RECHNUNG_TRANSITIONS[from]];
};
