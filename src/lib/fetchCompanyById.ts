import { supabase } from "@/integrations/supabase/client";

/**
 * Laedt GENAU die Firma, nach der gefragt wurde.
 *
 * WARUM ES DIESE FUNKTION GIBT
 *
 * `fetchSingleCompanyForUser` beantwortet die Frage "welche Firma ist meine?".
 * Unter `/firma` ist diese Frage bereits beantwortet: der `CompanyProvider`
 * traegt den ausgewaehlten Mandanten. Es gab also zwei Antworten auf eine
 * Frage — und die zweite riet: erst `companies.email`/`notification_email`
 * gegen die Anmeldeadresse, sonst die zuletzt angelegte Firma.
 *
 * Bei zwei Firmen (Produktionsstand 2026-08-28) konnte damit eine Rechnungsliste
 * die Zeilen der Firma A zeigen und im selben PDF Name, Adresse und IBAN der
 * Firma B eintragen. Der Kunde bekommt eine QR-Rechnung mit dem falschen
 * Gläubiger.
 *
 * Diese Funktion raet nicht. Sie fragt nach einer `id` und liefert genau die
 * Zeile — oder `null`. Ob der Aufrufer sie sehen darf, entscheidet weiterhin
 * RLS, nicht der Browser.
 *
 * `maybeSingle()` statt `single()`: eine fremde `id` ist unter RLS kein Fehler,
 * sondern eine leere Menge. Ein 406 im Netzwerk-Tab waere die Auskunft
 * "diese Zeile gibt es, du darfst sie nur nicht sehen".
 */
export async function fetchCompanyById<T>(params: {
  companyId: string | null | undefined;
  select: string;
}): Promise<T | null> {
  // Kein Rückfall auf "die eine Firma". Ohne id gibt es keine Antwort — der
  // Aufrufer wartet noch auf den Kontext, und Warten ist keine Auswahl.
  if (!params.companyId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select(params.select)
    .eq("id", params.companyId)
    .maybeSingle();

  if (error) throw error;
  return (data as T | null) ?? null;
}
