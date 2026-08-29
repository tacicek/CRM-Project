/**
 * Was der aktive Mandant im Browser hinterlaesst — und die einzige Stelle, die
 * die Schluessel kennt.
 *
 * Bis 2026-08-28 standen die Namen an drei Orten: `CompanyProvider` schrieb
 * `crm_active_company_id`, `useCachedCompany` las `firma_company_cache`, und
 * `FirmaLayout` loeschte beim Abmelden beide — mit abgeschriebenen Literalen.
 * Ein umbenannter Schluessel waere dort still stehen geblieben, und der naechste
 * Benutzer an diesem Browser haette die Firmenauswahl seines Vorgaengers geerbt.
 *
 * `sessionStorage` kann werfen (privater Modus, blockierte Site-Daten). Jeder
 * Zugriff faengt das ab: eine fehlende Auswahl ist kein Fehler, sondern der
 * Zustand vor der ersten Auswahl.
 */

const AKTIVE_FIRMA = "crm_active_company_id";
const FIRMEN_CACHE = "firma_company_cache";

export const getActiveCompanyId = (): string | null => {
  try {
    return sessionStorage.getItem(AKTIVE_FIRMA);
  } catch {
    return null;
  }
};

export const setActiveCompanyId = (id: string): void => {
  try {
    sessionStorage.setItem(AKTIVE_FIRMA, id);
  } catch {
    /* ignore */
  }
};

/**
 * Vorlauf-Cache fuer die aktive Firma. Wird geschrieben, aber bewusst NICHT
 * mehr gelesen: ein synchroner Griff hierher war eine zweite Antwort auf
 * "welche Firma", und eine, die beim Wechsel nicht nachzieht (das Schreiben
 * passiert in einem Effekt nach dem Rendern und loest kein Rendern aus).
 * Gelesen wird der Kontext.
 */
export const cacheActiveCompany = (wert: unknown): void => {
  try {
    sessionStorage.setItem(FIRMEN_CACHE, JSON.stringify(wert));
  } catch {
    /* ignore */
  }
};

/** Beim Abmelden: alles loeschen, was den Mandanten ueberdauert haette. */
export const clearTenantSession = (): void => {
  for (const schluessel of [AKTIVE_FIRMA, FIRMEN_CACHE]) {
    try {
      sessionStorage.removeItem(schluessel);
    } catch {
      /* ignore */
    }
  }
};
