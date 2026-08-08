/**
 * webcal/ICS-Abo der CRM-Termine.
 *
 *   GET /functions/v1/calendar-feed?token=<64-hex>&typ=<typ>
 *
 * Kalender-Clients (Apple/Google/Outlook) koennen weder Authorization-Header
 * noch apikey schicken — das Token in der URL ist die EINZIGE
 * Zugangskontrolle. Deshalb:
 *
 * - Verglichen wird ausschliesslich der SHA-256-Hash gegen
 *   `calendar_feed_tokens.token_hash`; der Klartext steht nirgends in der DB.
 * - Jede Fehlerantwort ist ein nacktes 404 in text/plain. Kein JSON, kein
 *   Grund, kein Echo des Tokens — ein Feed-Client kann damit nichts anfangen,
 *   ein Angreifer auch nicht.
 * - Logs tragen hoechstens die ersten 8 Zeichen des Tokens.
 *
 * Die Funktion laeuft unter service_role: RLS traegt hier NICHTS. Die
 * Mandanten-Grenze ist der explizite `company_id`-Filter aus der Token-Zeile —
 * jede Query unten muss ihn tragen.
 *
 * Feed-Aufteilung: ein Abo pro Termin-Typ (`typ=besichtigung|service|
 * follow_up|meeting|blocked`) plus `typ=other` als Auffangbecken fuer alles,
 * was keiner der bekannten Typen ist (heute strukturell leer, weil
 * appointment_type ein NOT-NULL-Enum ist — waechst das Enum, faengt `other`
 * die neuen Werte auf, bis der Feed sie kennt). Die Feeds sind paarweise
 * disjunkt und ihre Vereinigung ist die Gesamtmenge.
 *
 * Nie im Feed: internal_notes, description, completion_notes,
 * cancellation_reason, location_notes — nur Titel, Kunde, Adresse, Telefon.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildIcsCalendar, IcsEvent } from "./ics.ts";

const KNOWN_TYPES = ["besichtigung", "service", "follow_up", "meeting", "blocked"] as const;
type KnownType = (typeof KNOWN_TYPES)[number];
type FeedTyp = KnownType | "other";

// Farben = die --cal-* Werte aus src/index.css (CRM-Kalender-UI), Pluralformen
// = die deutschen Katalog-Labels. Bewusst hart kodiert: die Edge Function darf
// keine Frontend-Module ziehen, und diese Werte aendern sich zusammen mit dem
// Kalender-UI — der Kommentar dort verweist hierher nicht, also bei Aenderung
// an index.css hier nachziehen.
const TYPE_META: Record<FeedTyp, { color: string; plural: string; label: string }> = {
  besichtigung: { color: "#7C3AED", plural: "Besichtigungen", label: "Besichtigung" },
  service: { color: "#047857", plural: "Dienstleistungen", label: "Dienstleistung" },
  follow_up: { color: "#B45309", plural: "Nachfassen", label: "Nachfassen" },
  meeting: { color: "#2563EB", plural: "Besprechungen", label: "Besprechung" },
  blocked: { color: "#4B5563", plural: "Blockierte Zeiten", label: "Blockiert" },
  other: { color: "#6B7280", plural: "Weitere Termine", label: "Termin" },
};

// VEVENT-STATUS kennt nur drei Werte. `rescheduled` ist CANCELLED, weil die
// Zeile durch einen Nachfolger ersetzt wurde; `no_show` und `completed` haben
// stattgefunden und bleiben CONFIRMED.
const STATUS_MAP: Record<string, string> = {
  pending: "TENTATIVE",
  confirmed: "CONFIRMED",
  completed: "CONFIRMED",
  cancelled: "CANCELLED",
  rescheduled: "CANCELLED",
  no_show: "CONFIRMED",
};

const LAST_USED_THROTTLE_MS = 15 * 60 * 1000;

const notFound = (): Response =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const typ = url.searchParams.get("typ") ?? "";

    // 64 Hex-Zeichen, sonst gar nicht erst hashen. Ein unbekanntes `typ` ist
    // dasselbe nackte 404 wie ein falsches Token — die Antwort verraet nicht,
    // welcher Teil der URL nicht stimmte.
    if (!/^[0-9a-f]{64}$/.test(token)) return notFound();
    if (!(KNOWN_TYPES as readonly string[]).includes(typ) && typ !== "other") {
      return notFound();
    }
    const feedTyp = typ as FeedTyp;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("calendar_feed_tokens")
      .select("id, company_id, last_used_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenError) {
      console.error("[calendar-feed] token lookup failed:", tokenError.message);
      return notFound();
    }
    if (!tokenRow) {
      console.warn(`[calendar-feed] unknown or revoked token ${token.slice(0, 8)}…`);
      return notFound();
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("company_name")
      .eq("id", tokenRow.company_id)
      .maybeSingle();

    if (companyError || !company) {
      console.error(`[calendar-feed] company ${tokenRow.company_id} not found`);
      return notFound();
    }

    // Fenster: heute-30 Tage bis heute+365 Tage, auf appointment_date (DATE).
    const now = new Date();
    const windowFrom = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const windowTo = isoDate(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));

    let query = supabase
      .from("appointments")
      .select(
        "id, appointment_type, appointment_date, start_time, end_time, title, status, " +
          "customer_first_name, customer_last_name, customer_phone, " +
          "location_address, location_plz, location_city, updated_at, created_at"
      )
      // service_role sieht ALLES — dieser Filter ist die Mandanten-Grenze.
      .eq("company_id", tokenRow.company_id)
      .gte("appointment_date", windowFrom)
      .lte("appointment_date", windowTo)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(5000);

    // Disjunkte Aufteilung: bekannte Typen exakt, `other` ist das Komplement
    // derselben Liste (plus NULL-Absicherung). Ein Termin kann so nie in zwei
    // Feeds auftauchen und keiner faellt durch.
    if (feedTyp === "other") {
      query = query.or(
        `appointment_type.is.null,appointment_type.not.in.(${KNOWN_TYPES.join(",")})`
      );
    } else {
      query = query.eq("appointment_type", feedTyp);
    }

    const { data: appointments, error: apptError } = await query;
    if (apptError) {
      console.error("[calendar-feed] appointments query failed:", apptError.message);
      return new Response("Internal error", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // `last_used_at` hoechstens alle 15 Minuten — Anzeigezweck, kein Audit.
    const lastUsed = tokenRow.last_used_at ? Date.parse(tokenRow.last_used_at) : 0;
    if (now.getTime() - lastUsed > LAST_USED_THROTTLE_MS) {
      const { error: touchError } = await supabase
        .from("calendar_feed_tokens")
        .update({ last_used_at: now.toISOString() })
        .eq("id", tokenRow.id);
      if (touchError) {
        console.warn("[calendar-feed] last_used_at update failed:", touchError.message);
      }
    }

    // UID-Domain: MUSS die oeffentliche sein. SUPABASE_URL ist im Container die
    // Docker-interne Adresse (http://supabase-kong:8000) — die wuerde als
    // UID-Host "supabase-kong" ergeben und bei jedem Infrastruktur-Umbau alle
    // Abonnenten-Kalender mit Duplikaten fluten. UIDs sind fuer immer.
    const host = new URL(
      Deno.env.get("SUPABASE_PUBLIC_URL") ?? Deno.env.get("SUPABASE_URL")!
    ).hostname;
    const meta = TYPE_META[feedTyp];

    const events: IcsEvent[] = (appointments ?? []).map((a) => {
      const customer = [a.customer_first_name, a.customer_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const cityLine = [a.location_plz, a.location_city].filter(Boolean).join(" ");
      const rowTyp = (a.appointment_type ?? "") as string;
      const label =
        (KNOWN_TYPES as readonly string[]).includes(rowTyp)
          ? TYPE_META[rowTyp as KnownType].label
          : TYPE_META.other.label;
      return {
        uid: `auftrag-${a.id}@${host}`,
        date: a.appointment_date,
        startTime: a.start_time,
        endTime: a.end_time,
        summary: customer ? `${label} – ${customer}` : `${label} – ${a.title ?? ""}`,
        location: [a.location_address, cityLine].filter(Boolean).join(", "),
        description: a.customer_phone ? `Telefon: ${a.customer_phone}` : "",
        status: STATUS_MAP[a.status ?? ""] ?? "CONFIRMED",
        updatedAt: a.updated_at ?? a.created_at ?? "",
      };
    });

    const body = buildIcsCalendar({
      calendarName: `${company.company_name} – ${meta.plural}`,
      color: meta.color,
      prodId: "-//CRM//calendar-feed//DE",
      events,
    });

    // Der Body haengt nur vom DB-Stand ab (kein "jetzt" im Inhalt), darum ist
    // der Hash ein echtes ETag und 304 funktioniert wirklich.
    const etag = `"${await sha256Hex(body)}"`;
    const baseHeaders: Record<string, string> = {
      ETag: etag,
      "Cache-Control": "private, max-age=900",
    };

    const ifNoneMatch = req.headers.get("If-None-Match") ?? "";
    if (ifNoneMatch.includes(etag)) {
      return new Response(null, { status: 304, headers: baseHeaders });
    }

    return new Response(req.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(
      "[calendar-feed] unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    return new Response("Internal error", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
