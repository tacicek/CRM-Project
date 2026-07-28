import { supabase } from "@/integrations/supabase/client";

/**
 * Returns exactly one company for a logged-in user.
 *
 * Der Umfang ist die MITGLIEDSCHAFT (`company_members`), nicht das Eigentum
 * (`companies.user_id`).
 *
 * Bis 2026-07-28 suchte diese Funktion mit `.eq("user_id", …)`. Damit fand sie
 * nur Firmen, die dem Benutzer GEHOEREN — ein eingeladenes Mitglied bekam
 * `null` zurueck. Die 18 aufrufenden Seiten behandeln `null` als "keine Firma"
 * und rendern fehlerfrei eine leere Seite: keine Fehlermeldung, kein Hinweis,
 * nur nichts. Bemerkt haette man es erst bei der ersten Einladung, und dann als
 * "das CRM zeigt bei mir nichts an".
 *
 * `CompanyProvider` loeste dieselbe Frage schon immer ueber `company_members`.
 * Es gab also zwei Antworten auf "welche Firma ist meine" — je nachdem, wen man
 * fragte. Jetzt nur noch eine.
 *
 * Dass jeder Eigentuemer auch Mitglied IST, garantiert seit 20260728170000 ein
 * Trigger auf `companies`; vorher war es eine Konvention, an die sich jemand
 * beim manuellen Anlegen erinnern musste.
 *
 * Die Auswahlregel bei mehreren Firmen bleibt unveraendert: zuerst die, deren
 * `email`/`notification_email` zur Anmeldeadresse passt, sonst die zuletzt
 * angelegte.
 */
export async function fetchSingleCompanyForUser<T>(params: {
  userId: string;
  userEmail?: string | null;
  select: string;
}): Promise<T | null> {
  // Schritt 1: die Firmen, in denen der Benutzer Mitglied ist.
  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", params.userId);

  if (membershipError) throw membershipError;

  const companyIds = (memberships ?? []).map((m) => m.company_id);
  if (companyIds.length === 0) return null;

  // Schritt 2: die Auswahl aus GENAU diesen Firmen — mit der Spaltenliste, die
  // der Aufrufer angefordert hat. Bewusst zwei Abfragen statt eines Embeds:
  // so bleibt `select` woertlich das, was der Aufrufer erwartet, und die
  // Vorzugsregel laeuft weiterhin in SQL statt im Browser.
  const makeBase = () =>
    supabase.from("companies").select(params.select).in("id", companyIds);

  // Prefer the company whose email (or notification email) matches the user's login email.
  if (params.userEmail) {
    const { data: byEmail, error: byEmailError } = await makeBase()
      .eq("email", params.userEmail)
      .limit(1);

    if (byEmailError) throw byEmailError;
    if (byEmail?.length) return byEmail[0] as T;

    const { data: byNotificationEmail, error: byNotificationEmailError } = await makeBase()
      .eq("notification_email", params.userEmail)
      .limit(1);

    if (byNotificationEmailError) throw byNotificationEmailError;
    if (byNotificationEmail?.length) return byNotificationEmail[0] as T;
  }

  // Fallback: most recently created company the user belongs to.
  const { data: latest, error: latestError } = await makeBase()
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestError) throw latestError;
  return (latest?.[0] as T) ?? null;
}
