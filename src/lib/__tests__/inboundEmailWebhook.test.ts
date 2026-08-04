import { describe, expect, it } from "vitest";
import {
  INBOUND_WEBHOOK_EVENT,
  INBOUND_WEBHOOK_FUNCTION,
  buildInboundWebhookUrl,
} from "../inboundEmailWebhook";

describe("buildInboundWebhookUrl", () => {
  it("haengt Pfad und Funktionsnamen an die Basis", () => {
    expect(buildInboundWebhookUrl("https://crm-hirschen.ch")).toBe(
      "https://crm-hirschen.ch/functions/v1/inbound-email-lead",
    );
  });

  it("schluckt einen abschliessenden Schraegstrich", () => {
    // Sonst entstuende `…//functions/v1/…` — Resend traegt das ein und die
    // Mails laufen ins Leere.
    expect(buildInboundWebhookUrl("https://crm-hirschen.ch/")).toBe(
      "https://crm-hirschen.ch/functions/v1/inbound-email-lead",
    );
    expect(buildInboundWebhookUrl("https://crm-hirschen.ch///")).toBe(
      "https://crm-hirschen.ch/functions/v1/inbound-email-lead",
    );
  });

  it("behaelt einen Unterpfad der Basis", () => {
    expect(buildInboundWebhookUrl("https://beispiel.test/supabase")).toBe(
      "https://beispiel.test/supabase/functions/v1/inbound-email-lead",
    );
  });

  it("laesst Port und http zu", () => {
    expect(buildInboundWebhookUrl("http://localhost:54321")).toBe(
      "http://localhost:54321/functions/v1/inbound-email-lead",
    );
  });

  it("ignoriert Leerraum um die Basis", () => {
    expect(buildInboundWebhookUrl("  https://crm-hirschen.ch  ")).toBe(
      "https://crm-hirschen.ch/functions/v1/inbound-email-lead",
    );
  });
});

describe("buildInboundWebhookUrl — lieber nichts als geraten", () => {
  it.each([undefined, null, "", "   "])("gibt bei %p null zurueck", (basis) => {
    expect(buildInboundWebhookUrl(basis as string | undefined)).toBeNull();
  });

  it("gibt bei einer unbrauchbaren Basis null zurueck", () => {
    for (const basis of ["nicht-eine-url", "crm-hirschen.ch", "://kaputt"]) {
      expect(buildInboundWebhookUrl(basis), basis).toBeNull();
    }
  });

  it("weist fremde Protokolle ab", () => {
    // `javascript:` in einem Feld, das der Nutzer kopiert und woanders
    // einfuegt, ist nichts, was hier entstehen soll.
    for (const basis of ["javascript:alert(1)", "file:///etc/passwd", "ftp://host"]) {
      expect(buildInboundWebhookUrl(basis), basis).toBeNull();
    }
  });

  it("liefert bei fehlender Basis keinen Text, sondern null", () => {
    // Ausdruecklich `null` und nicht "" — die Oberflaeche entscheidet daran, ob
    // sie das Feld ueberhaupt anzeigt. Ein leerer String waere ein Feld zum
    // Kopieren, in dem nichts steht.
    const ergebnis = buildInboundWebhookUrl(undefined);
    expect(ergebnis).toBeNull();
    expect(typeof ergebnis).not.toBe("string");
  });
});

describe("die festen Bestandteile", () => {
  it("nennt die Funktion, die Resend anruft", () => {
    expect(INBOUND_WEBHOOK_FUNCTION).toBe("inbound-email-lead");
  });

  it("nennt das Ereignis, das im Dashboard gewaehlt wird", () => {
    expect(INBOUND_WEBHOOK_EVENT).toBe("email.received");
  });
});
