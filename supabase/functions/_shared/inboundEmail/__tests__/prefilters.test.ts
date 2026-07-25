import { describe, expect, it } from "vitest";

import { isPlausibleCustomerAddress, runPrefilters } from "../prefilters.ts";
import type { NormalizedInboundEmail } from "../types.ts";

const email = (overrides: Partial<NormalizedInboundEmail> = {}): NormalizedInboundEmail => ({
  provider: "resend",
  providerMessageId: "e1",
  fromEmail: "max@example.com",
  fromName: "Max Müller",
  toEmails: ["anfragen@example.ch"],
  ccEmails: [],
  subject: "Umzugsanfrage von Zürich nach Luzern",
  textBody: "Guten Tag, wir möchten am 15. September umziehen. Freundliche Grüsse, Max",
  truncated: false,
  receivedAt: "2026-07-25T08:00:00Z",
  attachments: [],
  headers: {},
  ...overrides,
});

describe("runPrefilters — rejections", () => {
  it("catches a bounce by sender", () => {
    expect(runPrefilters(email({ fromEmail: "mailer-daemon@example.com" }))?.reason).toBe("bounce");
  });

  it("catches a bounce by subject", () => {
    expect(runPrefilters(email({ subject: "Undeliverable: Ihre Nachricht" }))?.reason).toBe("bounce");
  });

  it("catches a German bounce subject", () => {
    expect(runPrefilters(email({ subject: "Nachricht unzustellbar" }))?.reason).toBe("bounce");
  });

  it("catches RFC 3834 auto-replies", () => {
    expect(
      runPrefilters(email({ headers: { "auto-submitted": "auto-replied" } }))?.reason,
    ).toBe("auto_reply");
  });

  it("catches an out-of-office reply in all three languages", () => {
    for (const subject of ["Out of Office", "Abwesenheitsnotiz", "Réponse automatique"]) {
      expect(runPrefilters(email({ subject }))?.reason).toBe("auto_reply");
    }
  });

  it("catches bulk mail", () => {
    expect(runPrefilters(email({ headers: { precedence: "bulk" } }))?.reason).toBe("auto_reply");
  });

  it("catches a no-reply sender", () => {
    expect(runPrefilters(email({ fromEmail: "noreply@example.com" }))?.reason).toBe("system_sender");
  });

  it("catches an empty message", () => {
    expect(runPrefilters(email({ subject: "", textBody: "  " }))?.reason).toBe("empty_message");
  });
});

describe("runPrefilters — must let genuine requests through", () => {
  it("passes a normal inquiry", () => {
    expect(runPrefilters(email())).toBeNull();
  });

  it("passes auto-submitted: no", () => {
    expect(runPrefilters(email({ headers: { "auto-submitted": "no" } }))).toBeNull();
  });

  it("passes a customer writing from an info@ address", () => {
    expect(runPrefilters(email({ fromEmail: "info@kundenfirma.ch" }))).toBeNull();
  });

  it("passes a mail that merely mentions a holiday absence", () => {
    // "Abwesenheit" in the BODY is not an out-of-office reply — the customer is
    // telling us when they are away.
    expect(
      runPrefilters(
        email({
          subject: "Umzug im August",
          textBody: "Wegen Abwesenheit bin ich erst ab dem 10. August erreichbar. Bitte offerieren.",
        }),
      ),
    ).toBeNull();
  });

  it("passes a short but meaningful request", () => {
    expect(runPrefilters(email({ subject: "Umzug", textBody: "3.5 Zimmer, Zürich → Bern" }))).toBeNull();
  });
});

describe("isPlausibleCustomerAddress", () => {
  it.each([
    ["max@example.com", true],
    ["info@kundenfirma.ch", true],
    ["noreply@example.com", false],
    ["no-reply@example.com", false],
    ["mailer-daemon@example.com", false],
    ["bounces+abc@example.com", false],
    ["kein-at-zeichen", false],
  ])("%s → %s", (address, expected) => {
    expect(isPlausibleCustomerAddress(address)).toBe(expected);
  });
});
