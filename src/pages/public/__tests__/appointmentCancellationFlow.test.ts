import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HISTORY_STATE_KEY,
  MAX_REASON_LENGTH,
  belongsToSession,
  buildCancellationPayload,
  classifyCancellation,
  classifyPreview,
  extractCapability,
  offersCalendarFile,
  openRouteSession,
  planUrlCleanup,
  routeSignature,
  previewFieldNames,
  showsTimeRange,
  viewForOutcome,
  viewForPreview,
  type PreviewAppointment,
} from "../appointmentCancellationFlow";

const TERMIN = "11111111-2222-3333-4444-555555555555";
const ANDERER = "22222222-3333-4444-5555-666666666666";
const TOKEN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const ort = (over: Partial<{ pathname: string; search: string; hash: string }> = {}) => ({
  pathname: `/termin/${TERMIN}/absagen`,
  search: "?lang=fr",
  hash: `#t=${TOKEN}`,
  ...over,
});

const zeile = (over: Record<string, unknown> = {}) => ({
  id: TERMIN,
  appointment_date: "2026-09-10",
  start_time: "09:00:00",
  end_time: "10:30:00",
  all_day: false,
  title: "Besichtigung Zürich",
  appointment_type: "besichtigung",
  status: "confirmed",
  location_city: "Zürich",
  language: "fr",
  company_name: "Muster Umzug AG",
  company_phone: "+41 00 000 00 00",
  ...over,
});

const vorschau = (over: Partial<PreviewAppointment> = {}): PreviewAppointment => ({
  id: TERMIN,
  appointment_date: "2026-09-10",
  start_time: "09:00:00",
  end_time: "10:30:00",
  all_day: false,
  title: "Besichtigung Zürich",
  appointment_type: "besichtigung",
  status: "confirmed",
  location_city: "Zürich",
  language: "fr",
  company_name: "Muster Umzug AG",
  company_phone: "+41 00 000 00 00",
  ...over,
});

/** Ein Doppel der beiden Aussenwege, das mitzaehlt. */
const dienste = (
  antworten: {
    preview?: { data: unknown; error: unknown };
    invoke?: { data: unknown; error: unknown; status?: number | null };
  } = {},
) => {
  const spur: string[] = [];
  const rpcArgs: Array<Record<string, unknown>> = [];
  const invokeKoerper: Array<Record<string, unknown>> = [];
  return {
    spur,
    rpcArgs,
    invokeKoerper,
    rpc: async (name: string, args: Record<string, unknown>) => {
      spur.push(`rpc:${name}`);
      rpcArgs.push(args);
      // Ohne ausdrueckliche Vorgabe antwortet die Vorschau fuer GENAU den
      // angefragten Termin — sonst schluege die Identitaetspruefung zu, und
      // der Test meinte etwas ganz anderes zu messen.
      return antworten.preview ?? { data: [zeile({ id: args.p_appointment_id })], error: null };
    },
    invoke: async (name: string, koerper: Record<string, unknown>) => {
      spur.push(`invoke:${name}`);
      invokeKoerper.push(koerper);
      return antworten.invoke ?? { data: { success: true, result: "cancelled_now" }, error: null };
    },
  };
};

/**
 * Der Ablauf der Seite, so wie die Komponente ihn nimmt — aber ohne React.
 * Damit laesst sich pruefen, ob bei fehlender Berechtigung wirklich KEIN
 * Netzaufruf entsteht, statt das nur aus dem Quelltext zu schliessen.
 */
const seitenlauf = async (
  routeId: string | undefined,
  loc: ReturnType<typeof ort>,
  historyState: unknown,
  d: ReturnType<typeof dienste>,
  grund = "",
) => {
  const capability = extractCapability(routeId, loc, historyState);
  const plan = planUrlCleanup(capability, loc, historyState);
  if (!capability.ok) return { view: "invalid_link" as const, plan, capability };

  const preview = classifyPreview(
    await d.rpc("get_appointment_by_action_token", {
      p_appointment_id: capability.appointmentId,
      p_token: capability.token,
    }),
    capability.appointmentId,
  );
  if (preview.kind !== "ok") {
    return {
      view: preview.kind === "invalid" ? ("invalid_link" as const) : ("service_error" as const),
      plan,
      capability,
    };
  }
  const nachVorschau = viewForPreview(preview.appointment);
  if (nachVorschau !== "form") return { view: nachVorschau, plan, capability, appointment: preview.appointment };

  const koerper = buildCancellationPayload(capability.appointmentId, capability.token, grund);
  if (!koerper.ok) return { view: "form" as const, plan, capability, abgelehnt: koerper.reason };

  // Als flaches Objekt weitergereicht: ein `interface` bekommt in TypeScript
  // keine implizite Index-Signatur und passt deshalb nicht auf
  // `Record<string, unknown>`. Die Schluessel bleiben dieselben.
  const antwort = await d.invoke("notify-appointment-cancelled", { ...koerper.payload });
  return {
    view: viewForOutcome(classifyCancellation(antwort)),
    plan,
    capability,
    appointment: preview.appointment,
  };
};

// ── 1. Berechtigung ─────────────────────────────────────────────────────────

describe("extractCapability", () => {
  it("nimmt das Token aus dem Fragment", () => {
    const r = extractCapability(TERMIN, ort());
    expect(r).toEqual({ ok: true, appointmentId: TERMIN, token: TOKEN, source: "fragment" });
  });

  it("weist eine unformatierte Termin-id ab", () => {
    for (const id of [undefined, "", "kaputt", TERMIN.slice(0, -1)]) {
      expect(extractCapability(id, ort())).toEqual({ ok: false, reason: "invalid_appointment_id" });
    }
  });

  it("weist ein unformatiertes Token ab, ohne es zu nennen", () => {
    const r = extractCapability(TERMIN, ort({ hash: "#t=geheim-aber-kaputt" }));
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
    expect(JSON.stringify(r)).not.toContain("geheim");
  });

  it("liest KEIN Token aus der Abfrage", () => {
    expect(extractCapability(TERMIN, ort({ search: `?t=${TOKEN}`, hash: "" }))).toEqual({
      ok: false,
      reason: "no_token",
    });
  });

  it("akzeptiert den alten E-Mail-Link nicht mehr", () => {
    expect(extractCapability(TERMIN, ort({ search: "?email=kundin%40example.test", hash: "" }))).toEqual({
      ok: false,
      reason: "no_token",
    });
  });

  it("nimmt das Token aus dem History-State, wenn es zu DIESEM Termin gehoert", () => {
    const state = { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: TOKEN } };
    expect(extractCapability(TERMIN, ort({ hash: "" }), state)).toEqual({
      ok: true,
      appointmentId: TERMIN,
      token: TOKEN,
      source: "history",
    });
  });

  it("benutzt das Token eines ANDEREN Termins nicht", () => {
    const state = { [HISTORY_STATE_KEY]: { appointmentId: ANDERER, token: TOKEN } };
    expect(extractCapability(TERMIN, ort({ hash: "" }), state)).toEqual({ ok: false, reason: "no_token" });
  });

  it("laesst sich von einem kaputten State nicht stoeren", () => {
    for (const state of [null, undefined, 42, "text", {}, { [HISTORY_STATE_KEY]: "text" }, { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: "kaputt" } }]) {
      expect(extractCapability(TERMIN, ort({ hash: "" }), state)).toEqual({ ok: false, reason: "no_token" });
    }
  });

  it("bevorzugt das Fragment vor dem State", () => {
    const state = { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: ANDERER } };
    const r = extractCapability(TERMIN, ort(), state);
    expect(r.ok && r.token).toBe(TOKEN);
  });
});

// ── 2. Adresse aufraeumen ───────────────────────────────────────────────────

describe("planUrlCleanup", () => {
  it("entfernt das Fragment und behaelt Pfad und lang", () => {
    const plan = planUrlCleanup(extractCapability(TERMIN, ort()), ort());
    expect(plan?.replace).toBe(true);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen?lang=fr`);
    expect(plan?.url).not.toContain("#");
    expect(plan?.url).not.toContain(TOKEN);
  });

  it("bindet das Token im State an genau diesen Termin", () => {
    const plan = planUrlCleanup(extractCapability(TERMIN, ort()), ort());
    expect(plan?.state[HISTORY_STATE_KEY]).toEqual({ appointmentId: TERMIN, token: TOKEN });
  });

  it("laesst den bestehenden Router-State unangetastet", () => {
    const vorhanden = { usr: { von: "kalender" }, key: "abc", idx: 3 };
    const plan = planUrlCleanup(extractCapability(TERMIN, ort(), vorhanden), ort(), vorhanden);
    expect(plan?.state.usr).toEqual({ von: "kalender" });
    expect(plan?.state.key).toBe("abc");
    expect(plan?.state.idx).toBe(3);
  });

  it("wirft alte Abfrageparameter weg statt sie mitzuschleppen", () => {
    const l = ort({ search: `?lang=en&t=${TOKEN}&email=kundin%40example.test` });
    const plan = planUrlCleanup(extractCapability(TERMIN, l), l);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen?lang=en`);
    expect(plan?.url).not.toContain("email");
    expect(plan?.url).not.toContain(TOKEN);
  });

  it("kommt ohne lang aus", () => {
    const l = ort({ search: "" });
    expect(planUrlCleanup(extractCapability(TERMIN, l), l)?.url).toBe(`/termin/${TERMIN}/absagen`);
  });



  it("raeumt ein biestiges Fragment weg, ohne es zu speichern", () => {
    const l = ort({ hash: "#t=kaputt" });
    const plan = planUrlCleanup(extractCapability(TERMIN, l), l);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen?lang=fr`);
    expect(plan?.state[HISTORY_STATE_KEY]).toBeUndefined();
    expect(JSON.stringify(plan)).not.toContain("kaputt");
  });

  it("entfernt eine alte Bindung, wenn die Berechtigung nicht mehr traegt", () => {
    const vorhanden = { usr: { a: 1 }, [HISTORY_STATE_KEY]: { appointmentId: ANDERER, token: TOKEN } };
    const l = ort({ hash: "" });
    const plan = planUrlCleanup(extractCapability(TERMIN, l, vorhanden), l, vorhanden);
    expect(plan?.state[HISTORY_STATE_KEY]).toBeUndefined();
    expect(plan?.state.usr).toEqual({ a: 1 });
  });

  it("tut nichts, wenn Adresse und Bindung bereits stimmen", () => {
    const zustand = { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: TOKEN } };
    const l = ort({ hash: "", search: "?lang=fr" });
    expect(planUrlCleanup(extractCapability(TERMIN, l, zustand), l, zustand)).toBeNull();
  });

  it("putzt alte Abfrageparameter auch bei gueltiger Bindung aus dem Verlauf", () => {
    const zustand = { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: TOKEN } };
    const l = ort({ hash: "", search: `?lang=de&email=k%40example.test&t=${TOKEN}` });
    const plan = planUrlCleanup(extractCapability(TERMIN, l, zustand), l, zustand);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen?lang=de`);
    expect(plan?.state[HISTORY_STATE_KEY]).toEqual({ appointmentId: TERMIN, token: TOKEN });
  });

  it("putzt einen reinen Alt-Link ohne jede Berechtigung", () => {
    const l = ort({ hash: "", search: "?email=kundin%40example.test" });
    const plan = planUrlCleanup(extractCapability(TERMIN, l), l);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen`);
    expect(plan?.state[HISTORY_STATE_KEY]).toBeUndefined();
  });
});

// ── 3. Vorschau ─────────────────────────────────────────────────────────────

describe("classifyPreview", () => {
  it("liefert bei genau einer Zeile das Modell", () => {
    const r = classifyPreview({ data: [zeile()], error: null }, TERMIN);
    expect(r.kind).toBe("ok");
  });

  it("traegt nur die erlaubten Felder — und keine Kundendaten", () => {
    const r = classifyPreview({
      data: [
        zeile({
          customer_email: "kundin@example.test",
          customer_first_name: "Anna",
          customer_phone: "+41 79 000 00 00",
          company_id: "99999999-8888-7777-6666-555555555555",
          customer_action_token: TOKEN,
          internal_notes: "INTERNE-NOTIZ-SENTINEL",
          description: "BESCHREIBUNG-SENTINEL",
          lead_id: "LEAD-SENTINEL",
        }),
      ],
      error: null,
    }, TERMIN);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(Object.keys(r.appointment).sort()).toEqual([...previewFieldNames()].sort());
    const text = JSON.stringify(r.appointment);
    // Eindeutige Kennzeichen statt kurzer Woerter: "lang" steckt auch in
    // "language" und haette den Test aus dem falschen Grund rot gemacht.
    for (const verboten of [
      "kundin@example.test",
      "Anna",
      "+41 79 000 00 00",
      TOKEN,
      "INTERNE-NOTIZ-SENTINEL",
      "BESCHREIBUNG-SENTINEL",
      "LEAD-SENTINEL",
      "99999999-8888-7777-6666-555555555555",
    ]) {
      expect(text).not.toContain(verboten);
    }
  });

  it("meldet bei null Zeilen einen ungueltigen Link", () => {
    expect(classifyPreview({ data: [], error: null }, TERMIN)).toEqual({ kind: "invalid" });
  });

  it("meldet bei einem Fehler eine Stoerung", () => {
    expect(classifyPreview({ data: null, error: { message: "boom" } }, TERMIN)).toEqual({ kind: "service_error" });
  });

  it("meldet bei mehr als einer Zeile eine Stoerung", () => {
    expect(classifyPreview({ data: [zeile(), zeile()], error: null }, TERMIN)).toEqual({ kind: "service_error" });
  });

  it.each([null, undefined, {}, "text", 42, [null], [42], [{}], [{ id: "kaputt" }]])(
    "meldet bei der unbrauchbaren Form %s eine Stoerung",
    (data) => {
      expect(classifyPreview({ data, error: null }, TERMIN)).toEqual({ kind: "service_error" });
    },
  );

  it("fuehrt einen bereits abgesagten Termin nicht ins Formular", () => {
    const r = classifyPreview({ data: [zeile({ status: "cancelled" })], error: null }, TERMIN);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(viewForPreview(r.appointment)).toBe("already_cancelled");
    expect(viewForPreview(vorschau())).toBe("form");
  });
});

// ── 4. Absage ───────────────────────────────────────────────────────────────

describe("buildCancellationPayload", () => {
  it("erzeugt genau drei Felder", () => {
    const r = buildCancellationPayload(TERMIN, TOKEN, "krank");
    expect(r.ok).toBe(true);
    expect(r.ok && Object.keys(r.payload).sort()).toEqual(["actionToken", "appointmentId", "reason"]);
    expect(r.ok && r.payload).toEqual({ appointmentId: TERMIN, actionToken: TOKEN, reason: "krank" });
  });

  it("schickt einen leeren Grund als null, ohne Ersatztext", () => {
    for (const grund of ["", "   ", "\n\t "]) {
      const r = buildCancellationPayload(TERMIN, TOKEN, grund);
      expect(r.ok && r.payload.reason).toBeNull();
    }
  });

  it("nimmt 2000 Zeichen an und weist 2001 ab", () => {
    expect(buildCancellationPayload(TERMIN, TOKEN, "x".repeat(MAX_REASON_LENGTH)).ok).toBe(true);
    expect(buildCancellationPayload(TERMIN, TOKEN, "x".repeat(MAX_REASON_LENGTH + 1))).toEqual({
      ok: false,
      reason: "reason_too_long",
    });
  });
});

describe("classifyCancellation", () => {
  it("erkennt die frische Absage", () => {
    expect(classifyCancellation({ data: { success: true, result: "cancelled_now" }, error: null })).toEqual({
      kind: "cancelled_now",
    });
  });

  it("erkennt die Wiederholung", () => {
    expect(classifyCancellation({ data: { success: true, result: "already_cancelled" }, error: null })).toEqual({
      kind: "already_cancelled",
    });
  });

  it("macht aus 403 einen ungueltigen Link", () => {
    expect(classifyCancellation({ data: null, error: { name: "FunctionsHttpError" }, status: 403 })).toEqual({
      kind: "invalid",
    });
  });

  it("macht aus 409 ein nicht mehr absagbar", () => {
    expect(classifyCancellation({ data: null, error: { name: "FunctionsHttpError" }, status: 409 })).toEqual({
      kind: "not_cancellable",
    });
  });

  it.each([503, 500, 502, 413, 400, null, undefined])("macht aus dem Status %s eine Stoerung", (status) => {
    expect(classifyCancellation({ data: null, error: { name: "x" }, status: status as number | null })).toEqual({
      kind: "service_error",
    });
  });

  it("behandelt einen Netz-/Relay-Fehler ohne Status als Stoerung", () => {
    expect(classifyCancellation({ data: null, error: new TypeError("Failed to fetch") })).toEqual({
      kind: "service_error",
    });
  });

  it.each([
    [null],
    [undefined],
    ["ok"],
    [42],
    [[]],
    [{}],
    [{ success: true }],
    [{ success: true, result: "vielleicht" }],
    [{ success: false, result: "cancelled_now" }],
    [{ result: "cancelled_now" }],
  ])("wertet den unbekannten Erfolgskoerper %s NICHT als Erfolg", (data) => {
    expect(classifyCancellation({ data, error: null })).toEqual({ kind: "service_error" });
  });
});

// ── 5. Darstellung ──────────────────────────────────────────────────────────

describe("Darstellung", () => {
  it("zeigt bei ganztaegigen Terminen weder Zeitfenster noch Kalenderdatei", () => {
    const ganztags = vorschau({ all_day: true });
    expect(showsTimeRange(ganztags)).toBe(false);
    expect(offersCalendarFile(ganztags)).toBe(false);
  });

  it("zeigt beides bei einem Termin mit Uhrzeit", () => {
    expect(showsTimeRange(vorschau())).toBe(true);
    expect(offersCalendarFile(vorschau())).toBe(true);
  });

  it("zeigt kein Zeitfenster, wenn die Zeiten fehlen", () => {
    expect(showsTimeRange(vorschau({ start_time: "", end_time: "" }))).toBe(false);
  });

  it("bildet jedes Ergebnis auf eine eigene Ansicht ab", () => {
    expect(viewForOutcome({ kind: "cancelled_now" })).toBe("done");
    expect(viewForOutcome({ kind: "already_cancelled" })).toBe("already_cancelled");
    expect(viewForOutcome({ kind: "invalid" })).toBe("invalid_link");
    expect(viewForOutcome({ kind: "not_cancellable" })).toBe("not_cancellable");
    expect(viewForOutcome({ kind: "service_error" })).toBe("service_error");
  });
});

// ── 6. Der Ablauf als Ganzes, mit Doppeln ───────────────────────────────────

describe("Seitenablauf", () => {
  it("fragt bei gueltiger Berechtigung die Vorschau genau einmal", async () => {
    const d = dienste();
    await seitenlauf(TERMIN, ort(), undefined, d);
    expect(d.spur.filter((s) => s.startsWith("rpc:"))).toEqual(["rpc:get_appointment_by_action_token"]);
    expect(d.rpcArgs).toEqual([{ p_appointment_id: TERMIN, p_token: TOKEN }]);
  });

  it.each([
    ["fehlende id", undefined, ort()],
    ["kaputte id", "kaputt", ort()],
    ["kein Token", TERMIN, ort({ hash: "" })],
    ["kaputtes Token", TERMIN, ort({ hash: "#t=kaputt" })],
    ["Token nur in der Abfrage", TERMIN, ort({ search: `?t=${TOKEN}`, hash: "" })],
    ["alter E-Mail-Link", TERMIN, ort({ search: "?email=k%40example.test", hash: "" })],
  ])("macht bei %s ueberhaupt keinen Netzaufruf", async (_was, id, l) => {
    const d = dienste();
    const r = await seitenlauf(id as string | undefined, l, undefined, d);
    expect(r.view).toBe("invalid_link");
    expect(d.spur).toEqual([]);
  });

  it("funktioniert nach dem Aufraeumen weiter — Neuladen mit demselben Termin", async () => {
    const erst = ort();
    const plan = planUrlCleanup(extractCapability(TERMIN, erst), erst)!;
    // Nach dem Neuladen: kein Fragment mehr, aber der State ist noch da.
    const d = dienste();
    const r = await seitenlauf(TERMIN, ort({ hash: "", search: "?lang=fr" }), plan.state, d);
    expect(r.view).toBe("done");
    expect(d.rpcArgs[0]).toEqual({ p_appointment_id: TERMIN, p_token: TOKEN });
  });

  it("nutzt den State eines anderen Termins nicht", async () => {
    const erst = ort();
    const plan = planUrlCleanup(extractCapability(TERMIN, erst), erst)!;
    const d = dienste();
    const r = await seitenlauf(ANDERER, { ...ort({ hash: "" }), pathname: `/termin/${ANDERER}/absagen` }, plan.state, d);
    expect(r.view).toBe("invalid_link");
    expect(d.spur).toEqual([]);
  });

  it("ruft bei einem bereits abgesagten Termin die Edge Function nicht", async () => {
    const d = dienste({ preview: { data: [zeile({ status: "cancelled" })], error: null } });
    const r = await seitenlauf(TERMIN, ort(), undefined, d);
    expect(r.view).toBe("already_cancelled");
    expect(d.spur).toEqual(["rpc:get_appointment_by_action_token"]);
  });

  it("schickt genau drei Felder an die Edge Function", async () => {
    const d = dienste();
    await seitenlauf(TERMIN, ort(), undefined, d, "krank");
    expect(d.invokeKoerper).toEqual([{ appointmentId: TERMIN, actionToken: TOKEN, reason: "krank" }]);
    const alteFelder = [
      "appointmentTitle", "appointmentDate", "appointmentTime", "customerName", "customerEmail",
      "companyEmail", "companyName", "companyId", "language", "cancellationReason",
    ];
    for (const f of alteFelder) expect(Object.keys(d.invokeKoerper[0])).not.toContain(f);
  });

  it.each([
    [{ data: { success: true, result: "cancelled_now" }, error: null }, "done"],
    [{ data: { success: true, result: "already_cancelled" }, error: null }, "already_cancelled"],
    [{ data: null, error: { name: "e" }, status: 403 }, "invalid_link"],
    [{ data: null, error: { name: "e" }, status: 409 }, "not_cancellable"],
    [{ data: null, error: { name: "e" }, status: 503 }, "service_error"],
    [{ data: null, error: new TypeError("Failed to fetch") }, "service_error"],
    [{ data: { success: true, result: "irgendwas" }, error: null }, "service_error"],
    [{ data: "ok", error: null }, "service_error"],
  ])("bildet die Edge-Antwort auf %s ab", async (antwort, erwartet) => {
    const d = dienste({ invoke: antwort as { data: unknown; error: unknown; status?: number | null } });
    const r = await seitenlauf(TERMIN, ort(), undefined, d);
    expect(r.view).toBe(erwartet);
  });

  it("laesst das Token in keinem oeffentlichen Ergebnis auftauchen", async () => {
    for (const antwort of [
      { data: { success: true, result: "cancelled_now" }, error: null },
      { data: null, error: { name: "e", context: { status: 403, body: TOKEN } }, status: 403 },
      { data: null, error: new TypeError("Failed to fetch") },
    ]) {
      const d = dienste({ invoke: antwort as { data: unknown; error: unknown; status?: number | null } });
      const r = await seitenlauf(TERMIN, ort(), undefined, d, "krank");
      // Der Zustand, den die Seite zeigt: Ansicht, Plan-URL und Terminmodell.
      expect(JSON.stringify({ view: r.view, url: r.plan?.url, appointment: r.appointment })).not.toContain(TOKEN);
    }
  });

  it("lehnt einen zu langen Grund vor jedem Netzaufruf ab", async () => {
    const d = dienste();
    const r = await seitenlauf(TERMIN, ort(), undefined, d, "x".repeat(MAX_REASON_LENGTH + 1));
    expect(r.view).toBe("form");
    expect(d.spur.filter((s) => s.startsWith("invoke:"))).toEqual([]);
  });
});

// ── 7. Was die Seite NICHT mehr tut ─────────────────────────────────────────

describe("AppointmentCancel als Quelltext", () => {
  const quelle = readFileSync(new URL("../AppointmentCancel.tsx", import.meta.url), "utf8");

  it("liest keine Tabelle mehr direkt", () => {
    expect(quelle).not.toContain('from("appointments")');
    expect(quelle).not.toContain('from("companies")');
    expect(quelle).not.toContain("select(");
    expect(quelle).not.toContain(".update(");
  });

  it("ruft die Absage-RPC nicht selbst auf — sie bleibt service_role", () => {
    expect(quelle).not.toContain("cancel_appointment_by_action_token");
  });

  it("benutzt genau die beiden erlaubten Aussenwege", () => {
    expect(quelle).toContain('supabase.rpc("get_appointment_by_action_token"');
    expect(quelle).toContain('supabase.functions.invoke("notify-appointment-cancelled"');
  });

  it("liest kein email- oder t-Abfrageparameter", () => {
    expect(quelle).not.toContain('get("email")');
    expect(quelle).not.toContain('get("t")');
  });

  it("legt das Token in keinem Speicher ab", () => {
    expect(quelle).not.toContain("localStorage");
    expect(quelle).not.toContain("sessionStorage");
  });

  it("protokolliert nichts auf der Konsole", () => {
    expect(quelle).not.toContain("console.");
  });
});

// ── 8. Routenwechsel im laufenden Betrieb ───────────────────────────────────
//
// Die Komponente wird beim Wechsel von Termin A zu Termin B NICHT abgebaut —
// dieselbe Route, andere id. Der folgende Aufbau bildet genau das nach: eine
// Sitzung pro Route-Auftritt, und jedes Ergebnis traegt die Sitzung, die es
// angefordert hat.

const routenSchnappschuss = (id: string, key: string, over: Partial<{ search: string; hash: string }> = {}) => ({
  appointmentId: id,
  key,
  pathname: `/termin/${id}/absagen`,
  search: "?lang=de",
  hash: `#t=${TOKEN}`,
  ...over,
});

/** Eine Seite, die sich wie die Komponente verhaelt — ohne React. */
const seite = (d: ReturnType<typeof dienste>) => {
  let session = openRouteSession(routenSchnappschuss(TERMIN, "k1"), undefined);
  let angezeigt: { routeId: string; view: string; appointment: PreviewAppointment | null } = {
    routeId: "",
    view: "loading",
    appointment: null,
  };
  // Genau wie im Bauteil: an den Auftritt gebunden, nicht global.
  let absendend: string | null = null;
  let versuche = { routeId: "", n: 0 };

  const sichtbar = () => (belongsToSession(session, angezeigt.routeId) ? angezeigt.view : "loading");

  return {
    get session() {
      return session;
    },
    sichtbar,
    /** Wartet dieser Auftritt gerade auf eine Absage? */
    get sperrt() {
      return absendend === session.routeId;
    },
    /** Wie oft wurde in diesem Auftritt "erneut versuchen" gedrueckt? */
    get versuchZaehler() {
      return versuche.routeId === session.routeId ? versuche.n : 0;
    },
    erneutVersuchen() {
      versuche = { routeId: session.routeId, n: this.versuchZaehler + 1 };
    },
    navigiere(id: string, key: string, historyState?: unknown, over?: Partial<{ search: string; hash: string }>) {
      session = openRouteSession(routenSchnappschuss(id, key, over), historyState);
    },
    /** Startet die Vorschau fuer die AKTUELLE Sitzung und liefert das Anwenden nach. */
    ladeVorschau() {
      const meine = session;
      return async () => {
        if (!meine.capability.ok) {
          if (session.routeId === meine.routeId) {
            angezeigt = { routeId: meine.routeId, view: "invalid_link", appointment: null };
          }
          return;
        }
        const antwort = await d.rpc("get_appointment_by_action_token", {
          p_appointment_id: meine.capability.appointmentId,
          p_token: meine.capability.token,
        });
        const vorschau = classifyPreview(antwort, meine.capability.appointmentId);
        // Der Kern: das Ergebnis wird nur uebernommen, wenn seine Route noch laeuft.
        if (session.routeId !== meine.routeId) return;
        angezeigt =
          vorschau.kind === "ok"
            ? { routeId: meine.routeId, view: viewForPreview(vorschau.appointment), appointment: vorschau.appointment }
            : {
                routeId: meine.routeId,
                view: vorschau.kind === "invalid" ? "invalid_link" : "service_error",
                appointment: null,
              };
      };
    },
    starteAbsage(grund = "") {
      const meine = session;
      if (!meine.capability.ok) return async () => {};
      absendend = meine.routeId;
      return async () => {
        const koerper = buildCancellationPayload(
          (meine.capability as { appointmentId: string }).appointmentId,
          (meine.capability as { token: string }).token,
          grund,
        );
        try {
          if (!koerper.ok) return;
          const antwort = await d.invoke("notify-appointment-cancelled", { ...koerper.payload });
          if (session.routeId !== meine.routeId) return;
          angezeigt = {
            routeId: meine.routeId,
            view: viewForOutcome(classifyCancellation(antwort)),
            appointment: null,
          };
        } finally {
          // Funktional: A darf B's Sperre nicht aufheben.
          absendend = absendend === meine.routeId ? null : absendend;
        }
      };
    },
  };
};

describe("Routenwechsel", () => {
  it("benutzt nach dem Wechsel nur noch die Berechtigung von B", () => {
    const s = seite(dienste());
    expect(s.session.capability.ok && s.session.capability.appointmentId).toBe(TERMIN);
    const bToken = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${bToken}` });
    expect(s.session.capability).toEqual({
      ok: true,
      appointmentId: ANDERER,
      token: bToken,
      source: "fragment",
    });
    expect(s.session.routeId).not.toBe("k1::" + TERMIN);
  });

  it("laesst eine spaet eintreffende Vorschau von A den Bildschirm von B nicht anfassen", async () => {
    const d = dienste();
    const s = seite(d);
    const aVorschau = s.ladeVorschau();
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    await aVorschau();
    expect(s.sichtbar()).toBe("loading");
  });

  it("laesst eine spaet eintreffende Absage von A den Bildschirm von B nicht anfassen", async () => {
    const d = dienste();
    const s = seite(d);
    const aAbsage = s.starteAbsage("krank");
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    await aAbsage();
    expect(s.sichtbar()).toBe("loading");
    expect(["done", "already_cancelled", "service_error"]).not.toContain(s.sichtbar());
  });

  it("zeigt fuer B einen ungueltigen Link, wenn nur A's Bindung im Verlauf steht", async () => {
    const d = dienste();
    const s = seite(d);
    const nurA = { [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: TOKEN } };
    s.navigiere(ANDERER, "k2", nurA, { hash: "" });
    expect(s.session.capability.ok).toBe(false);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("invalid_link");
    expect(d.spur).toEqual([]);
  });

  it("uebernimmt das Ergebnis, solange die Route dieselbe bleibt", async () => {
    const d = dienste();
    const s = seite(d);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("form");
  });
});

// ── 9. Vorschau, fail-closed ────────────────────────────────────────────────

describe("classifyPreview — strenge Feldpruefung", () => {
  it("lehnt eine Antwort fuer einen ANDEREN Termin ab", () => {
    expect(classifyPreview({ data: [zeile({ id: ANDERER })], error: null }, TERMIN)).toEqual({
      kind: "service_error",
    });
  });

  it.each([
    ["fehlender status", { status: undefined }],
    ["unbekannter status", { status: "verschoben" }],
    ["status null", { status: null }],
    ["unbekannte Terminart", { appointment_type: "hausbesuch" }],
    ["fehlende Terminart", { appointment_type: undefined }],
    ["unbekannte Sprache", { language: "it" }],
    ["fehlende Sprache", { language: null }],
    ["kaputtes Datum", { appointment_date: "10.09.2026" }],
    ["unmoegliches Datum", { appointment_date: "2026-02-30" }],
    ["Datum als Zahl", { appointment_date: 20260910 }],
    ["kaputte Startzeit", { start_time: "9 Uhr" }],
    ["Startzeit 25:00", { start_time: "25:00" }],
    ["fehlende Endzeit", { end_time: null }],
    ["all_day als Zeichenkette", { all_day: "true" }],
    ["all_day als Zahl", { all_day: 1 }],
    ["Titel fehlt", { title: null }],
    ["Firmenname fehlt", { company_name: undefined }],
    ["Ort als Zahl", { location_city: 8001 }],
    ["Telefon als Objekt", { company_phone: {} }],
  ])("lehnt %s ab", (_was, over) => {
    expect(classifyPreview({ data: [zeile(over)], error: null }, TERMIN)).toEqual({ kind: "service_error" });
  });

  it("nimmt null in den wirklich nullbaren Feldern an", () => {
    const r = classifyPreview(
      { data: [zeile({ location_city: null, company_phone: null, all_day: null })], error: null },
      TERMIN,
    );
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.appointment.location_city).toBeNull();
    expect(r.appointment.company_phone).toBeNull();
    expect(r.appointment.all_day).toBe(false);
  });

  it("baut kein Modell aus Platzhaltern", () => {
    const r = classifyPreview({ data: [{ id: TERMIN }], error: null }, TERMIN);
    expect(r).toEqual({ kind: "service_error" });
  });

  it.each([
    ["pending", "form"],
    ["confirmed", "form"],
    ["rescheduled", "form"],
    ["cancelled", "already_cancelled"],
    ["completed", "not_cancellable"],
    ["no_show", "not_cancellable"],
  ])("bildet den Status %s auf %s ab", (status, erwartet) => {
    const r = classifyPreview({ data: [zeile({ status })], error: null }, TERMIN);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(viewForPreview(r.appointment)).toBe(erwartet);
  });
});

// ── 10. Erneut versuchen ────────────────────────────────────────────────────

describe("Erneut versuchen", () => {
  it("laedt nur die Vorschau neu und wiederholt die Absage nicht", async () => {
    const d = dienste({ preview: { data: null, error: { message: "boom" } } });
    const s = seite(d);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("service_error");

    const vorherInvoke = d.spur.filter((x) => x.startsWith("invoke:")).length;
    await s.ladeVorschau()(); // genau das tut der Knopf
    expect(d.spur.filter((x) => x.startsWith("rpc:")).length).toBe(2);
    expect(d.spur.filter((x) => x.startsWith("invoke:")).length).toBe(vorherInvoke);
    expect(vorherInvoke).toBe(0);
  });

  it("findet ueber die Vorschau heraus, dass die Absage laengst festgeschrieben ist", async () => {
    // Die Antwort der Edge Function ging verloren, der Uebergang war aber
    // erfolgreich. Ein blindes Wiederholen der Absage waere hier falsch — die
    // Vorschau sagt die Wahrheit.
    const d = dienste({ preview: { data: [zeile({ status: "cancelled" })], error: null } });
    const s = seite(d);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("already_cancelled");
    expect(d.spur.filter((x) => x.startsWith("invoke:"))).toEqual([]);
  });
});

// ── 11. Verdrahtung der Komponente (Quelltext) ──────────────────────────────
//
// Ohne @testing-library/react, jsdom oder happy-dom laesst sich die Komponente
// hier nicht rendern; ein Paket nachzuinstallieren ist in dieser Stufe nicht
// erlaubt. Die Ablauflogik oben ist echt ausgefuehrt — diese Gruppe prueft
// zusaetzlich, dass die Komponente sie auch so verdrahtet.

describe("AppointmentCancel — Verdrahtung", () => {
  const quelle = readFileSync(new URL("../AppointmentCancel.tsx", import.meta.url), "utf8");

  it("leitet die Berechtigung aus der aktuellen Route ab und zieht sie nach", () => {
    expect(quelle).toContain("openRouteSession");
    expect(quelle).toContain("routeSignature");
    expect(quelle).toContain("session.signature !== signatur");
    // Kein useMemo mehr: es duerfte sein Ergebnis jederzeit wegwerfen.
    expect(quelle).not.toContain("useMemo");
  });

  it("bindet Absendesperre, Grund und Versuche an den Auftritt", () => {
    expect(quelle).toContain("absendend === session.routeId");
    expect(quelle).toContain("setAbsendend((laufend) =>");
    expect(quelle).toContain("versuche.routeId === session.routeId");
    expect(quelle).toContain("grund.routeId === session.routeId");
    // Keine globalen Schalter mehr.
    expect(quelle).not.toContain("useState(false)");
    expect(quelle).not.toContain("setVersuch(0)");
  });

  it("bindet angezeigte Ergebnisse an die Sitzung", () => {
    expect(quelle).toContain("belongsToSession");
    expect(quelle).toContain("laufendeRoute");
  });

  it("gibt der Vorschau die erwartete Termin-id mit", () => {
    expect(quelle).toContain("classifyPreview(antwort, capability.appointmentId)");
  });

  it("bietet den Erneut-versuchen-Knopf an und laedt damit nur die Vorschau", () => {
    expect(quelle).toContain('t("public.cancel.retry")');
    expect(quelle).toContain("setVersuche((v) => ({ routeId: session.routeId");
    // Der Knopf ruft die Edge Function nicht.
    const knopf = quelle.slice(quelle.indexOf('view === "service_error"'), quelle.indexOf('view === "not_cancellable"'));
    expect(knopf).not.toContain("functions.invoke");
  });

  it("raeumt die Adresse unabhaengig von der Berechtigung auf", () => {
    expect(quelle).toContain("planUrlCleanup");
    expect(quelle).toContain("window.history.replaceState");
  });
});

// ── ROT B.2.4.1.1 ───────────────────────────────────────────────────────────

describe("ROT: Route-Identitaet, Feldstrenge, State-Vergleich", () => {
  it("gibt demselben History-Key bei Rueckkehr eine NEUE Sitzung", () => {
    const a1 = openRouteSession(routenSchnappschuss(TERMIN, "k1"));
    openRouteSession(routenSchnappschuss(ANDERER, "k2"));
    const a2 = openRouteSession(routenSchnappschuss(TERMIN, "k1"));
    expect(a2.routeId).not.toBe(a1.routeId);
  });

  it.each([["all_day"], ["location_city"], ["company_phone"]])(
    "lehnt ein fehlendes %s ab",
    (feld) => {
      expect(classifyPreview({ data: [zeile({ [feld]: undefined })], error: null }, TERMIN)).toEqual({
        kind: "service_error",
      });
    },
  );

  it.each([
    ["BigInt", 1n],
    ["Array", [1, 2]],
    ["Zahl", 42],
    ["Feld fehlt", { appointmentId: TERMIN }],
    ["Token kaputt", { appointmentId: TERMIN, token: "kaputt" }],
  ])("stolpert nicht ueber die kaputte Bindung %s", (_was, wert) => {
    const zustand: Record<string, unknown> = { usr: { a: 1 }, [HISTORY_STATE_KEY]: wert };
    const l = ort({ hash: "" });
    expect(() => planUrlCleanup(extractCapability(TERMIN, l, zustand), l, zustand)).not.toThrow();
  });

  it("stolpert nicht ueber einen zyklischen State", () => {
    const zyklisch: Record<string, unknown> = { usr: { a: 1 } };
    zyklisch.selbst = zyklisch;
    zyklisch[HISTORY_STATE_KEY] = { appointmentId: TERMIN, token: TOKEN };
    const l = ort({ hash: "" });
    expect(() => planUrlCleanup(extractCapability(TERMIN, l, zyklisch), l, zyklisch)).not.toThrow();
  });
});

// ── Auftrittsgebundener Zustand ─────────────────────────────────────────────

describe("Zustand gehoert zum Auftritt", () => {
  it("gibt beim Zurueckgehen auf denselben Verlaufseintrag eine neue Sitzung", async () => {
    const d = dienste();
    const s = seite(d);
    const a1 = s.session.routeId;
    const a1Vorschau = s.ladeVorschau();
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    // Zurueck auf A — derselbe History-Key, aber ein neuer Besuch.
    s.navigiere(TERMIN, "k1");
    expect(s.session.routeId).not.toBe(a1);
    const a2Vorschau = s.ladeVorschau();

    await a1Vorschau(); // die alte Antwort trifft ein
    expect(s.sichtbar()).toBe("loading");
    await a2Vorschau(); // erst die neue zaehlt
    expect(s.sichtbar()).toBe("form");
  });

  it("laesst eine alte Absage-Antwort den zurueckgekehrten Auftritt nicht anfassen", async () => {
    const d = dienste();
    const s = seite(d);
    const a1Absage = s.starteAbsage("krank");
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    s.navigiere(TERMIN, "k1");
    await a1Absage();
    expect(s.sichtbar()).toBe("loading");
  });

  it("zeigt beim Zurueckgehen nicht die alte Ansicht, sondern laedt neu", async () => {
    const d = dienste();
    const s = seite(d);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("form");
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    s.navigiere(TERMIN, "k1");
    expect(s.sichtbar()).toBe("loading");
  });

  it("sperrt den Knopf von B nicht, waehrend A noch auf seine Absage wartet", async () => {
    const d = dienste();
    const s = seite(d);
    const aAbsage = s.starteAbsage("krank");
    expect(s.sperrt).toBe(true);
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    expect(s.sperrt).toBe(false);
    await s.ladeVorschau()();
    expect(s.sichtbar()).toBe("form");
    expect(s.sperrt).toBe(false);
    await aAbsage();
    expect(s.sperrt).toBe(false);
  });

  it("laesst A's Abschluss die Sperre von B nicht aufheben", async () => {
    const d = dienste();
    const s = seite(d);
    const aAbsage = s.starteAbsage("krank");
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    const bAbsage = s.starteAbsage("auch krank");
    expect(s.sperrt).toBe(true);
    await aAbsage();
    expect(s.sperrt).toBe(true); // B wartet weiter
    await bAbsage();
    expect(s.sperrt).toBe(false);
  });

  it("startet fuer B genau EINE Vorschau, auch wenn A schon einen Wiederholversuch hatte", async () => {
    const d = dienste();
    const s = seite(d);
    await s.ladeVorschau()();
    s.erneutVersuchen();
    expect(s.versuchZaehler).toBe(1);
    const vorher = d.spur.filter((x) => x.startsWith("rpc:")).length;

    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    // Der Zaehler gehoert zu A, fuer B steht er wieder bei 0 — ohne dass ihn
    // jemand zuruecksetzen muss. Genau dieses Zuruecksetzen loeste vorher eine
    // zweite Vorschau aus.
    expect(s.versuchZaehler).toBe(0);
    await s.ladeVorschau()();
    expect(d.spur.filter((x) => x.startsWith("rpc:")).length).toBe(vorher + 1);
  });

  it("traegt den getippten Grund nicht auf den naechsten Termin", () => {
    const s = seite(dienste());
    const a = s.session.routeId;
    s.navigiere(ANDERER, "k2", undefined, { hash: `#t=${TOKEN}` });
    expect(s.session.routeId).not.toBe(a);
  });

  it("nennt in der Sitzungskennung kein Token", () => {
    const s = seite(dienste());
    expect(s.session.routeId).not.toContain(TOKEN);
    expect(s.session.signature).not.toContain(TOKEN);
  });
});

describe("History-State ohne Serialisierung", () => {
  it("entfernt eine kaputte Bindung, statt sie stehen zu lassen", () => {
    for (const wert of [1n, [1, 2], 42, { appointmentId: TERMIN }, { appointmentId: TERMIN, token: "kaputt" }, null]) {
      const zustand: Record<string, unknown> = { usr: { a: 1 }, key: "k", [HISTORY_STATE_KEY]: wert };
      const l = ort({ hash: "" });
      const plan = planUrlCleanup(extractCapability(TERMIN, l, zustand), l, zustand);
      expect(plan, String(wert)).not.toBeNull();
      expect(plan?.state[HISTORY_STATE_KEY]).toBeUndefined();
      expect(plan?.state.usr).toEqual({ a: 1 });
      expect(plan?.state.key).toBe("k");
    }
  });

  it("erkennt eine gueltige Bindung mit zusaetzlichen Feldern und laesst sie stehen", () => {
    const zustand = {
      usr: { a: 1 },
      [HISTORY_STATE_KEY]: { appointmentId: TERMIN, token: TOKEN, extra: "egal" },
    };
    const l = ort({ hash: "", search: "?lang=fr" });
    expect(planUrlCleanup(extractCapability(TERMIN, l, zustand), l, zustand)).toBeNull();
  });
});

// ── ROT B.2.4.1.2: Query-Werte in der Signatur ──────────────────────────────

describe("ROT: die Signatur traegt abgelehnte Query-Werte", () => {
  const MIT_MUELL = `?lang=de&t=${TOKEN}&email=kunde%40example.test`;

  it("traegt kein Query-Token", () => {
    const sig = routeSignature({ ...ort({ search: MIT_MUELL, hash: "" }), appointmentId: TERMIN, key: "k1" });
    expect(sig).not.toContain(TOKEN);
  });

  it("traegt keine prozent-kodierte Kundenadresse", () => {
    const sig = routeSignature({ ...ort({ search: MIT_MUELL, hash: "" }), appointmentId: TERMIN, key: "k1" });
    expect(sig).not.toContain("kunde%40example.test");
    expect(sig).not.toContain("kunde@example.test");
  });

  it("gibt die Werte auch nicht ueber die Sitzung weiter", () => {
    const s = openRouteSession({ ...ort({ search: MIT_MUELL, hash: "" }), appointmentId: TERMIN, key: "k1" });
    expect(s.signature).not.toContain(TOKEN);
    expect(s.signature).not.toContain("kunde%40example.test");
    expect(s.routeId).not.toContain(TOKEN);
  });
});

// ── Die Signatur traegt nur, was sie tragen muss ────────────────────────────

describe("routeSignature", () => {
  const snap = (over: Partial<{ search: string; hash: string; key: string; id: string }> = {}) => ({
    appointmentId: over.id ?? TERMIN,
    key: over.key ?? "k1",
    pathname: `/termin/${over.id ?? TERMIN}/absagen`,
    search: over.search ?? "?lang=de",
    hash: over.hash ?? "",
  });

  it("unterscheidet Termin, Verlaufseintrag und Pfad", () => {
    const a = routeSignature(snap());
    expect(routeSignature(snap({ key: "k2" }))).not.toBe(a);
    expect(routeSignature(snap({ id: ANDERER }))).not.toBe(a);
  });

  it("merkt sich vom Fragment nur, DASS eines da war", () => {
    const ohne = routeSignature(snap({ hash: "" }));
    const mit = routeSignature(snap({ hash: `#t=${TOKEN}` }));
    expect(mit).not.toBe(ohne);
    expect(mit).not.toContain(TOKEN);
    // Zwei verschiedene Tokens am selben Verlaufseintrag sehen gleich aus —
    // sie zu unterscheiden wuerde bedeuten, sie zu speichern.
    expect(routeSignature(snap({ hash: `#t=${ANDERER}` }))).toBe(mit);
  });

  it("traegt ueberhaupt keinen Abfragewert", () => {
    // Der Verlaufseintrag trennt die Auftritte; die Abfrage muss dafuer nicht
    // mitgeschleppt werden — und ein alter Link bringt dort Geheimnisse mit.
    const sauber = routeSignature(snap({ search: "?lang=de" }));
    expect(routeSignature(snap({ search: `?lang=de&t=${TOKEN}&email=kunde%40example.test` }))).toBe(sauber);
    expect(routeSignature(snap({ search: "" }))).toBe(sauber);
  });

  it("laesst in der ganzen Sitzung keinen Abfragewert zurueck", () => {
    const s = openRouteSession(snap({ search: `?t=${TOKEN}&email=kunde%40example.test`, hash: `#t=${TOKEN}` }));
    const alles = JSON.stringify({ routeId: s.routeId, signature: s.signature });
    expect(alles).not.toContain(TOKEN);
    expect(alles).not.toContain("kunde%40example.test");
    expect(alles).not.toContain("kunde@example.test");
    expect(alles).not.toContain("email");
    // Die Berechtigung selbst stammt weiterhin nur aus dem Fragment.
    expect(s.capability.ok && s.capability.source).toBe("fragment");
  });

  it("nimmt einen Abfrage-Token weiterhin nicht als Berechtigung", () => {
    const s = openRouteSession(snap({ search: `?t=${TOKEN}`, hash: "" }));
    expect(s.capability).toEqual({ ok: false, reason: "no_token" });
    expect(s.signature).not.toContain(TOKEN);
  });

  it("raeumt Abfrage-Token und Adresse trotzdem aus der URL", () => {
    const l = ort({ hash: "", search: `?lang=de&t=${TOKEN}&email=kunde%40example.test` });
    const plan = planUrlCleanup(extractCapability(TERMIN, l), l);
    expect(plan?.url).toBe(`/termin/${TERMIN}/absagen?lang=de`);
    expect(plan?.url).not.toContain(TOKEN);
    expect(plan?.url).not.toContain("email");
  });
});
