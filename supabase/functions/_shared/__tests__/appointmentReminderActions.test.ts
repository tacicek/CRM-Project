import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildReminderActions,
  renderCancelAction,
  showsCancelAction,
  type CancelActionTexts,
  type ReminderActionsInput,
} from "../appointmentReminderActions.ts";

const TERMIN = "11111111-2222-3333-4444-555555555555";
const TOKEN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const BASIS = "https://app.example.test";

const eingabe = (over: Partial<ReminderActionsInput> = {}): ReminderActionsInput => ({
  baseUrl: BASIS,
  appointmentId: TERMIN,
  actionToken: TOKEN,
  locale: "de",
  ...over,
});

describe("buildReminderActions — der gueltige Fall", () => {
  it("baut genau den Capability-Link", () => {
    const r = buildReminderActions(eingabe());
    expect(r.cancelUrl).toBe(`https://app.example.test/termin/${TERMIN}/absagen?lang=de#t=${TOKEN}`);
    expect(showsCancelAction(r)).toBe(true);
  });

  it.each(["de", "fr", "en"])("traegt die Sprache %s in die Abfrage", (locale) => {
    const r = buildReminderActions(eingabe({ locale }));
    expect(r.cancelUrl).toBe(`https://app.example.test/termin/${TERMIN}/absagen?lang=${locale}#t=${TOKEN}`);
  });

  it("legt das Token AUSSCHLIESSLICH ins Fragment", () => {
    const r = buildReminderActions(eingabe());
    const url = new URL(r.cancelUrl as string);
    expect(url.hash).toBe(`#t=${TOKEN}`);
    expect(url.search).toBe("?lang=de");
    expect(url.searchParams.get("t")).toBeNull();
    // Vor dem `#` darf das Token nirgends stehen.
    expect((r.cancelUrl as string).split("#")[0]).not.toContain(TOKEN);
  });

  it("laesst in der Abfrage nur lang stehen", () => {
    const url = new URL(buildReminderActions(eingabe()).cancelUrl as string);
    expect([...url.searchParams.keys()]).toEqual(["lang"]);
  });

  it("nennt keine E-Mail-Adresse", () => {
    const r = buildReminderActions(eingabe());
    expect(r.cancelUrl).not.toContain("email");
    expect(r.cancelUrl).not.toContain("@");
    expect(r.cancelUrl).not.toContain("%40");
  });

  it("zeigt auf die Absage-Seite, nicht auf das Verschieben", () => {
    expect(buildReminderActions(eingabe()).cancelUrl).toContain("/absagen");
    expect(buildReminderActions(eingabe()).cancelUrl).not.toContain("/verschieben");
  });
});

describe("buildReminderActions — kein Link", () => {
  const ohneLink = (r: ReturnType<typeof buildReminderActions>) => {
    expect(r.cancelUrl).toBeNull();
    expect(r.cancelHref).toBeNull();
    expect(showsCancelAction(r)).toBe(false);
  };

  it("bei widerrufenem Token (NULL)", () => {
    const r = buildReminderActions(eingabe({ actionToken: null }));
    ohneLink(r);
    expect(r.reason).toBe("missing_token");
  });

  it("bei fehlendem Token (undefined)", () => {
    expect(buildReminderActions(eingabe({ actionToken: undefined })).reason).toBe("missing_token");
  });

  it.each(["kaputt", "", "  ", 42, {}, [], true, TOKEN.slice(0, -1), `${TOKEN} `])(
    "bei unbrauchbarem Token %s",
    (token) => {
      const r = buildReminderActions(eingabe({ actionToken: token }));
      ohneLink(r);
      expect(r.reason).toBe("invalid_token");
    },
  );

  it.each(["kaputt", "", 42, null, undefined, TERMIN.slice(0, -1)])(
    "bei unbrauchbarer Termin-id %s",
    (id) => {
      const r = buildReminderActions(eingabe({ appointmentId: id }));
      ohneLink(r);
      expect(r.reason).toBe("invalid_appointment_id");
    },
  );

  it.each(["it", "DE", "", "de-CH", null, 42])("bei unbekannter Sprache %s", (locale) => {
    const r = buildReminderActions(eingabe({ locale }));
    ohneLink(r);
    expect(r.reason).toBe("invalid_locale");
  });

  it.each([
    ["fehlt", undefined, "missing_base_url"],
    ["leer", "", "missing_base_url"],
    ["nur Leerraum", "   ", "missing_base_url"],
    ["keine URL", "app.example.test", "unparsable_base_url"],
    ["Zahl", 42, "missing_base_url"],
  ])("bei Basisadresse %s", (_was, baseUrl, reason) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    ohneLink(r);
    expect(r.reason).toBe(reason);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<h1>x</h1>"],
    ["file:", "file:///etc/passwd"],
    ["ftp:", "ftp://example.test"],
  ])("bei dem Schema %s", (_was, baseUrl) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    ohneLink(r);
    expect(r.reason).toBe("unsupported_scheme");
  });

  it.each([
    ["https://user:pass@app.example.test"],
    ["https://user@app.example.test"],
    ["http://user:pass@127.0.0.1:8080"],
  ])("bei Zugangsdaten in der Adresse (%s)", (baseUrl) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    ohneLink(r);
    expect(r.reason).toBe("credentials_in_url");
  });
});

describe("buildReminderActions — Schema und Herkunft", () => {
  it("nimmt HTTPS auf einem echten Host an", () => {
    expect(buildReminderActions(eingabe({ baseUrl: "https://crm.example.test" })).cancelUrl).toContain(
      "https://crm.example.test/termin/",
    );
  });

  it.each([
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.1.2.3",
    "http://[::1]:3000",
  ])("nimmt HTTP auf der Rueckschleife an (%s)", (baseUrl) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    expect(r.cancelUrl, baseUrl).not.toBeNull();
    expect(r.cancelUrl, baseUrl).toContain("/absagen?lang=de#t=");
  });

  it.each([
    "http://app.example.test",
    "http://192.168.1.10",
    "http://10.0.0.1",
    "http://localhost.example.test",
  ])("lehnt HTTP ausserhalb der Rueckschleife ab (%s)", (baseUrl) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    expect(r.cancelUrl, baseUrl).toBeNull();
    expect(r.reason, baseUrl).toBe("insecure_http");
  });
});

describe("buildReminderActions — Zusammensetzen der Adresse", () => {
  it.each([
    ["https://app.example.test", "https://app.example.test"],
    ["https://app.example.test/", "https://app.example.test"],
    ["https://app.example.test///", "https://app.example.test"],
    ["https://app.example.test/crm", "https://app.example.test/crm"],
    ["https://app.example.test/crm/", "https://app.example.test/crm"],
  ])("erzeugt aus %s kein doppeltes Schraegstrichpaar", (baseUrl, erwartetesPraefix) => {
    const r = buildReminderActions(eingabe({ baseUrl }));
    expect(r.cancelUrl).toBe(`${erwartetesPraefix}/termin/${TERMIN}/absagen?lang=de#t=${TOKEN}`);
    // Nach dem Schema darf kein `//` mehr vorkommen.
    expect((r.cancelUrl as string).slice("https://".length)).not.toContain("//");
  });

  it("uebernimmt weder Abfrage noch Fragment der Basisadresse", () => {
    const r = buildReminderActions(
      eingabe({ baseUrl: "https://app.example.test/crm?ref=newsletter&email=alt%40example.test#oben" }),
    );
    expect(r.cancelUrl).toBe(`https://app.example.test/crm/termin/${TERMIN}/absagen?lang=de#t=${TOKEN}`);
    expect(r.cancelUrl).not.toContain("ref=");
    expect(r.cancelUrl).not.toContain("alt%40example.test");
    expect(r.cancelUrl).not.toContain("oben");
  });

  it("behaelt einen abweichenden Port", () => {
    expect(buildReminderActions(eingabe({ baseUrl: "https://app.example.test:8443" })).cancelUrl).toContain(
      "https://app.example.test:8443/termin/",
    );
  });
});

describe("buildReminderActions — Maskierung fuer HTML", () => {
  it("liefert eine attributsichere Fassung", () => {
    const r = buildReminderActions(eingabe());
    expect(r.cancelHref).toBe(r.cancelUrl); // hier ist nichts zu maskieren
    for (const zeichen of ['"', "'", "<", ">"]) {
      expect(r.cancelHref).not.toContain(zeichen);
    }
  });

  it("maskiert auch dann, wenn der Basiswert Sonderzeichen enthaelt", () => {
    const r = buildReminderActions(eingabe({ baseUrl: 'https://app.example.test/a"b<c>' }));
    expect(r.cancelHref).not.toContain('"');
    expect(r.cancelHref).not.toContain("<");
    expect(r.cancelHref).not.toContain(">");
    // In ein Attribut eingesetzt bleibt es ein einziges Attribut.
    const attribut = `<a href="${r.cancelHref}">x</a>`;
    expect(attribut.match(/"/g)?.length).toBe(2);
  });
});

describe("buildReminderActions — Verschwiegenheit", () => {
  it("nennt das Token in keinem Grund", () => {
    for (const over of [
      { actionToken: null },
      { actionToken: `${TOKEN}x` },
      { appointmentId: "kaputt" },
      { locale: "it" },
      { baseUrl: "http://example.test" },
      { baseUrl: "javascript:alert(1)" },
    ]) {
      const r = buildReminderActions(eingabe(over));
      expect(JSON.stringify(r)).not.toContain(TOKEN);
    }
  });

  it("gibt bei einem Fehlschlag ueberhaupt keine Eingabewerte zurueck", () => {
    const r = buildReminderActions(
      eingabe({ appointmentId: "kaputt", baseUrl: "https://geheim.example.test/pfad" }),
    );
    expect(r).toEqual({ cancelUrl: null, cancelHref: null, reason: "invalid_appointment_id" });
  });

  it("liefert nur die drei vereinbarten Felder", () => {
    expect(Object.keys(buildReminderActions(eingabe())).sort()).toEqual(["cancelHref", "cancelUrl"]);
    expect(Object.keys(buildReminderActions(eingabe({ actionToken: null }))).sort()).toEqual([
      "cancelHref",
      "cancelUrl",
      "reason",
    ]);
  });
});

// ── Der Cron-Lauf als Quelltext ─────────────────────────────────────────────
//
// Die Datei selbst laesst sich hier nicht ausfuehren (Deno-Globals,
// `https://`-Importe). Geprueft wird deshalb, dass die alten Wege wirklich
// verschwunden sind und der neue Helfer angebunden ist.

describe("notify-appointment-reminder — Quelltext", () => {
  const quelle = readFileSync(
    new URL("../../notify-appointment-reminder/index.ts", import.meta.url),
    "utf8",
  );

  it("baut keine Adresse mehr in die Abfrage", () => {
    // Zusammengesetzt statt woertlich: die Abschlussmessung durchsucht den
    // ganzen Ordner nach dieser Zeichenfolge, und dieser Test gehoert dazu.
    const alterParameter = "?" + "email=";
    expect(quelle).not.toContain(alterParameter);
    expect(quelle).not.toContain("customer_email || \"\"");
  });

  it("bietet den kaputten Verschieben-Weg nicht mehr an", () => {
    expect(quelle).not.toContain("/verschieben");
    expect(quelle).not.toContain("rescheduleUrl");
    expect(quelle).not.toContain("reschedule-btn");
  });

  it("holt das Token aus der Zeile und reicht es an den Helfer", () => {
    expect(quelle).toContain("customer_action_token");
    expect(quelle).toContain("buildReminderActions");
  });

  it("setzt den Tokenwert nirgends in eine Zeichenkette ein", () => {
    // Weder in eine Mail, noch in eine SMS, noch in eine Protokollzeile.
    expect(quelle).not.toContain("${appointment.customer_action_token");
    expect(quelle).not.toContain("customer_action_token}");
  });

  it("nennt das Token nur an den drei vorgesehenen Stellen", () => {
    const zeilen = quelle
      .split("\n")
      .map((z, i) => ({ nr: i + 1, text: z }))
      .filter((z) => z.text.includes("customer_action_token"));
    // Feldbeschreibung, Spaltenliste der Abfrage, Uebergabe an den Helfer.
    expect(zeilen).toHaveLength(3);
    expect(zeilen[0].text).toContain("customer_action_token: string | null;");
    expect(zeilen[1].text.trim()).toBe("customer_action_token");
    expect(zeilen[2].text).toContain("actionToken: appointment.customer_action_token,");
  });

  it("schreibt das Token in keine Zeile, die etwas ausgibt oder ablegt", () => {
    for (const zeile of quelle.split("\n")) {
      if (!zeile.includes("customer_action_token")) continue;
      for (const verboten of ["console.", ".insert(", ".update(", "body:", "html:", "sms", "Twilio"]) {
        expect(zeile, zeile.trim()).not.toContain(verboten);
      }
    }
  });
});

// ── Der Aktionsabschnitt, wirklich gerendert ────────────────────────────────
//
// Vorher war "ohne Link kommt gar nichts" nur eine Bedingung in einer Vorlage,
// die kein Test laden kann — belegt allein durch Hinsehen. Jetzt laeuft sie.

const TEXTE: CancelActionTexts = {
  title: "Muessen Sie absagen?",
  cta: "Termin absagen",
  note: "Der Link gilt bis zum Terminbeginn.",
};

describe("renderCancelAction", () => {
  it("liefert bei widerrufenem Token EXAKT die leere Zeichenkette", () => {
    expect(renderCancelAction(buildReminderActions(eingabe({ actionToken: null })), TEXTE)).toBe("");
  });

  it.each([
    ["kaputtes Token", { actionToken: "kaputt" }],
    ["kaputte Termin-id", { appointmentId: "kaputt" }],
    ["unbekannte Sprache", { locale: "it" }],
    ["fehlende Basisadresse", { baseUrl: "" }],
    ["unsicheres http", { baseUrl: "http://app.example.test" }],
    ["javascript-Schema", { baseUrl: "javascript:alert(1)" }],
  ])("liefert bei %s ebenfalls exakt die leere Zeichenkette", (_was, over) => {
    expect(renderCancelAction(buildReminderActions(eingabe(over)), TEXTE)).toBe("");
  });

  it("liefert bei gueltigem Token genau EINEN Verweis und EINEN Knopf", () => {
    const html = renderCancelAction(buildReminderActions(eingabe()), TEXTE);
    expect(html.match(/<a\s/g)).toHaveLength(1);
    expect(html.match(/class="cancel-btn"/g)).toHaveLength(1);
    expect(html).toContain("Termin absagen");
    expect(html).toContain("Muessen Sie absagen?");
    expect(html).toContain("Der Link gilt bis zum Terminbeginn.");
  });

  it("nennt das Token genau einmal, und zwar im Fragment des href", () => {
    const html = renderCancelAction(buildReminderActions(eingabe()), TEXTE);
    expect(html.split(TOKEN)).toHaveLength(2); // genau ein Vorkommen
    const href = html.match(/href="([^"]+)"/)?.[1] as string;
    expect(href).toContain(`#t=${TOKEN}`);
    expect(href.split("#")[0]).not.toContain(TOKEN);
    // Ausserhalb des href steht es nirgends.
    expect(html.replace(href, "")).not.toContain(TOKEN);
  });

  it("laesst in der Abfrage des Verweises nur lang stehen", () => {
    const html = renderCancelAction(buildReminderActions(eingabe({ locale: "fr" })), TEXTE);
    const href = html.match(/href="([^"]+)"/)?.[1] as string;
    const url = new URL(href);
    expect([...url.searchParams.keys()]).toEqual(["lang"]);
    expect(url.searchParams.get("lang")).toBe("fr");
  });

  it("nimmt die Adresse ausschliesslich aus cancelHref", () => {
    const aktionen = buildReminderActions(eingabe());
    const html = renderCancelAction(aktionen, TEXTE);
    expect(html).toContain(`href="${aktionen.cancelHref}"`);
    expect(html.match(/href="/g)).toHaveLength(1);
  });

  it("erzeugt nirgends etwas zum Verschieben", () => {
    const html = renderCancelAction(buildReminderActions(eingabe()), TEXTE);
    expect(html).not.toContain("verschieben");
    expect(html).not.toContain("reschedule");
    expect(html).not.toContain("reschedule-btn");
  });

  it("laesst sich ueber die Texte kein HTML unterschieben", () => {
    const html = renderCancelAction(buildReminderActions(eingabe()), {
      title: '<img src=x onerror="alert(1)">',
      cta: "</a><script>fetch('//evil.test')</script>",
      note: 'x" onmouseover="alert(1)',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('onmouseover="');
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;script&gt;");
    // Der Knopf bleibt ein einziger Verweis.
    expect(html.match(/<a\s/g)).toHaveLength(1);
    expect(html.match(/href="/g)).toHaveLength(1);
  });

  it("bleibt bei leerem Abschnitt einsetzbar, ohne die Mail zu zerlegen", () => {
    const leer = renderCancelAction(buildReminderActions(eingabe({ actionToken: null })), TEXTE);
    const mail = `<div class="content">A</div>${leer}<div class="footer">B</div>`;
    expect(mail).toBe('<div class="content">A</div><div class="footer">B</div>');
    expect(mail).not.toContain("action-section");
  });
});

// ── Das Typversprechen der beiden Abfragen ──────────────────────────────────

describe("notify-appointment-reminder — Abfragen und Typen", () => {
  const quelle = readFileSync(
    new URL("../../notify-appointment-reminder/index.ts", import.meta.url),
    "utf8",
  );

  const abschnitt = (von: string, bis: string): string => {
    const a = quelle.indexOf(von);
    const b = quelle.indexOf(bis, a);
    return quelle.slice(a, b);
  };

  it("verspricht das Token nur im Typ der Heute-Zeilen", () => {
    const basis = abschnitt("interface Appointment {", "interface TodayAppointment");
    expect(basis).not.toContain("customer_action_token");
    const heute = abschnitt("interface TodayAppointment", "interface Company {");
    expect(heute).toContain("customer_action_token: string | null;");
  });

  it("waehlt das Token nur in der Heute-Abfrage aus", () => {
    const heuteAbfrage = abschnitt("// Get today's appointments", '.eq("appointment_date", todayStr)');
    expect(heuteAbfrage).toContain("customer_action_token");
    const morgenAbfrage = abschnitt("// Get tomorrow's Besichtigung", '.eq("appointment_date", tomorrowStr)');
    expect(morgenAbfrage).not.toContain("customer_action_token");
  });

  it("laeuft ueber die Heute-Zeilen als TodayAppointment und ueber morgen als Appointment", () => {
    expect(quelle).toContain("appointments as TodayAppointment[]");
    expect(quelle).toContain("(tomorrowBesichtigungen || []) as Appointment[]");
  });

  it("fasst das Token nur im Ein-Stunden-Zweig an", () => {
    const einStunde = abschnitt("// 1-hour reminder with cancel option", "// 2-hour reminder");
    expect(einStunde).toContain("actionToken: appointment.customer_action_token");
    // Ausserhalb dieses Zweigs kommt der Aufruf nicht vor.
    expect(quelle.split("buildReminderActions(")).toHaveLength(2);
  });

  it("setzt den Aktionsabschnitt aus dem reinen Renderer ein", () => {
    expect(quelle).toContain("renderCancelAction(aktionen, {");
    expect(quelle).toContain("${actionSectionHtml}");
    // Keine zweite, nachgebaute Bedingung in der Vorlage.
    expect(quelle).not.toContain("cancelHref ? `");
  });
});
