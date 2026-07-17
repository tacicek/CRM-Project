/**
 * Read-boundary parsers for the two `leads` JSON columns the moving-calculator prefill uses:
 *   - inventory_items    (Json)  → LeadInventoryItem[] | null
 *   - detailed_form_data (Json)  → DetailedFormData | null
 *
 * Both are fail-closed: a malformed value aborts the calculator load rather than feeding
 * wrong data into a price estimate. The financial part — the inventory item arrays (top-level
 * and nested `inventar`) — is validated field-by-field. `detailed_form_data`'s remaining
 * sub-objects are all-optional, operator-form-controlled (leadDetailedFormSync) and consumed
 * only via optional chaining, so the parser validates the CONTAINER and the financial arrays,
 * not every decorative address/floor field. No cast, no silent default, no mutation.
 */

export interface LeadInventoryItem {
  kategorie: string;
  name: string;
  anzahl: number;
  gewicht_kg?: number;
  spezial?: boolean;
  aufpreis_chf?: number;
}

export interface DetailedFormData {
  auszug?: {
    adresse?: { strasse?: string; hausnummer?: string; plz?: string; ort?: string; kanton?: string };
    stockwerk?: string;
    aufzug?: { vorhanden?: boolean; groesse?: 'klein' | 'mittel' | 'gross' };
    parkplatz?: { distanz_meter?: number };
    treppenhaus?: { breite?: 'eng' | 'normal' | 'breit'; enge_kurven?: boolean };
  };
  einzug?: {
    adresse?: { strasse?: string; hausnummer?: string; plz?: string; ort?: string; kanton?: string };
    stockwerk?: string;
    aufzug?: { vorhanden?: boolean; groesse?: 'klein' | 'mittel' | 'gross' };
    parkplatz?: { distanz_meter?: number };
    treppenhaus?: { breite?: 'eng' | 'normal' | 'breit'; enge_kurven?: boolean };
  };
  inventar?: {
    items?: LeadInventoryItem[];
    geschaetzte_kartons?: number;
    schwere_gegenstaende?: LeadInventoryItem[];
  };
  zusatzleistungen?: {
    verpackung?: { aktiv?: boolean };
    entsorgung?: { aktiv?: boolean };
    moebellift?: { aktiv?: boolean };
    zwischenlagerung?: { aktiv?: boolean };
  };
}

export type InventoryItemsResult = { ok: true; value: LeadInventoryItem[] | null } | { ok: false };
export type DetailedFormDataResult = { ok: true; value: DetailedFormData | null } | { ok: false };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isLeadInventoryItem = (v: unknown): v is LeadInventoryItem =>
  isRecord(v) &&
  typeof v.kategorie === "string" &&
  typeof v.name === "string" &&
  isFiniteNumber(v.anzahl) &&
  (v.gewicht_kg === undefined || isFiniteNumber(v.gewicht_kg)) &&
  (v.spezial === undefined || typeof v.spezial === "boolean") &&
  (v.aufpreis_chf === undefined || isFiniteNumber(v.aufpreis_chf));

/**
 * null/undefined → valid empty (no inventory); a non-array or ANY malformed item → failure
 * (never silently filtered or defaulted). Values preserved; input not mutated.
 */
export const parseInventoryItems = (raw: unknown): InventoryItemsResult => {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (!Array.isArray(raw)) return { ok: false };
  const value: LeadInventoryItem[] = [];
  for (const item of raw) {
    if (!isLeadInventoryItem(item)) return { ok: false };
    value.push(item);
  }
  return { ok: true, value };
};

/**
 * Validates the container is a plain object and — the financial part — that any present
 * `inventar.items` / `inventar.schwere_gegenstaende` are valid inventory arrays. Fails closed
 * on a non-object or malformed inventory. The remaining all-optional sub-objects are trusted
 * to the writer + optional-chaining consumers.
 */
const isDetailedFormData = (v: unknown): v is DetailedFormData => {
  if (!isRecord(v)) return false;
  const inv = v.inventar;
  if (inv !== undefined) {
    if (!isRecord(inv)) return false;
    if (inv.items !== undefined && !parseInventoryItems(inv.items).ok) return false;
    if (inv.schwere_gegenstaende !== undefined && !parseInventoryItems(inv.schwere_gegenstaende).ok) return false;
  }
  return true;
};

export const parseDetailedFormData = (raw: unknown): DetailedFormDataResult => {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (!isDetailedFormData(raw)) return { ok: false };
  return { ok: true, value: raw };
};
