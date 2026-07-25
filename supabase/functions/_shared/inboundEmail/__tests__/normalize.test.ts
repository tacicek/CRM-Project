import { describe, expect, it } from "vitest";

import {
  buildBodyPreview,
  BODY_PREVIEW_CHARS,
  htmlToText,
  MAX_SUBJECT_CHARS,
  normalizeInboundEmail,
  parseAddress,
  parseResendWebhook,
  stripQuotedReply,
} from "../normalize.ts";

const webhookData = {
  email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
  created_at: "2026-07-25T08:41:11.894719+00:00",
  from: "Max Müller <max@example.com>",
  to: ["anfragen@example.ch"],
  subject: "Umzugsanfrage",
  attachments: [
    { id: "a1", filename: "grundriss.pdf", content_type: "application/pdf" },
  ],
};

describe("parseResendWebhook", () => {
  it("accepts an email.received event", () => {
    const result = parseResendWebhook(
      JSON.stringify({ type: "email.received", data: webhookData }),
    );
    expect(result).toMatchObject({ ok: true, emailId: webhookData.email_id });
  });

  it("ignores other event types", () => {
    const result = parseResendWebhook(
      JSON.stringify({ type: "email.delivered", data: { email_id: "x" } }),
    );
    expect(result).toEqual({ ok: false, reason: "unsupported_event" });
  });

  it("rejects a body that is not JSON", () => {
    expect(parseResendWebhook("not json")).toEqual({ ok: false, reason: "not_json" });
  });

  it("rejects an event without an email id — there would be no idempotency key", () => {
    const result = parseResendWebhook(JSON.stringify({ type: "email.received", data: {} }));
    expect(result).toEqual({ ok: false, reason: "missing_email_id" });
  });
});

describe("parseAddress", () => {
  it("splits display name and address", () => {
    expect(parseAddress("Max Müller <Max@Example.com>")).toEqual({
      email: "max@example.com",
      name: "Max Müller",
    });
  });

  it("handles a bare address", () => {
    expect(parseAddress("max@example.com")).toEqual({ email: "max@example.com", name: null });
  });

  it("strips quotes around the display name", () => {
    expect(parseAddress('"Müller, Max" <max@example.com>').name).toBe("Müller, Max");
  });

  it("survives a non-string value", () => {
    expect(parseAddress(null)).toEqual({ email: "", name: null });
  });
});

describe("htmlToText", () => {
  it("drops scripts and styles entirely", () => {
    const text = htmlToText(
      "<style>p{color:red}</style><p>Hallo</p><script>alert('x')</script><p>Welt</p>",
    );
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Hallo");
    expect(text).toContain("Welt");
  });

  it("keeps line structure and decodes common entities", () => {
    expect(htmlToText("<p>Z&uuml;rich</p><br>Luzern &amp; Bern")).toContain("Luzern & Bern");
  });

  it("removes comments and leaves no tags", () => {
    expect(htmlToText("<!-- tracking --><div>Text</div>")).toBe("Text");
  });
});

describe("stripQuotedReply", () => {
  it("cuts the quoted history of a reply", () => {
    const body = [
      "Guten Tag",
      "Wir möchten am 15. September umziehen.",
      "",
      "Am 3. Juli 2026 schrieb info@example.ch:",
      "> Ihre Anfrage ist eingegangen",
    ].join("\n");
    const result = stripQuotedReply(body);
    expect(result).toContain("15. September");
    expect(result).not.toContain("Ihre Anfrage ist eingegangen");
  });

  it("cuts at the signature delimiter", () => {
    const body = ["Guten Tag", "3.5-Zimmer-Wohnung", "", "--", "Max Müller", "Musterfirma AG"].join("\n");
    expect(stripQuotedReply(body)).not.toContain("Musterfirma AG");
  });

  it("keeps a mail that merely opens with a date line", () => {
    // A marker in the first lines is not history — the customer is telling us
    // when something happened. Over-trimming would cost the request itself.
    const body = ["Am 3. Juli schrieb mir der Vermieter:", "Ich muss per Ende Monat raus.", "Bitte offerieren."].join("\n");
    expect(stripQuotedReply(body)).toContain("Bitte offerieren.");
  });

  it("drops a trailing block of quoted lines", () => {
    const body = ["Bitte um Offerte.", "", "> alte Nachricht", "> noch mehr"].join("\n");
    expect(stripQuotedReply(body)).toBe("Bitte um Offerte.");
  });
});

describe("normalizeInboundEmail", () => {
  it("prefers the plain-text body from the fetched message", () => {
    const email = normalizeInboundEmail({
      webhookData,
      fetched: {
        text: "Wir ziehen von Zürich nach Luzern.",
        html: "<p>ignoriert</p>",
        headers: { "Auto-Submitted": "no" },
        attachments: [
          { id: "a1", filename: "grundriss.pdf", content_type: "application/pdf", size: 12345 },
        ],
      },
      maxBodyChars: 30_000,
    });

    expect(email.textBody).toBe("Wir ziehen von Zürich nach Luzern.");
    expect(email.fromEmail).toBe("max@example.com");
    expect(email.fromName).toBe("Max Müller");
    expect(email.toEmails).toEqual(["anfragen@example.ch"]);
    expect(email.providerMessageId).toBe(webhookData.email_id);
    expect(email.truncated).toBe(false);
    // Header names are lower-cased so the pre-filters can look them up.
    expect(email.headers["auto-submitted"]).toBe("no");
  });

  it("falls back to converted HTML when there is no text part", () => {
    const email = normalizeInboundEmail({
      webhookData,
      fetched: { text: "   ", html: "<p>Nur HTML</p>" },
    });
    expect(email.textBody).toBe("Nur HTML");
  });

  it("carries attachment metadata only — never content", () => {
    const email = normalizeInboundEmail({
      webhookData,
      fetched: {
        text: "Anbei der Grundriss.",
        attachments: [
          {
            id: "a1",
            filename: "grundriss.pdf",
            content_type: "application/pdf",
            size: 12345,
            content: "BASE64CONTENT",
          },
        ],
      },
    });

    expect(email.attachments).toEqual([
      {
        providerAttachmentId: "a1",
        filename: "grundriss.pdf",
        contentType: "application/pdf",
        sizeBytes: 12345,
      },
    ]);
    expect(JSON.stringify(email.attachments)).not.toContain("BASE64CONTENT");
  });

  it("marks truncation instead of silently cutting", () => {
    const email = normalizeInboundEmail({
      webhookData: { ...webhookData, subject: "x".repeat(MAX_SUBJECT_CHARS + 10) },
      fetched: { text: "y".repeat(120) },
      maxBodyChars: 100,
    });

    expect(email.subject).toHaveLength(MAX_SUBJECT_CHARS);
    expect(email.textBody).toHaveLength(100);
    expect(email.truncated).toBe(true);
  });

  it("still normalises when the body fetch returned nothing", () => {
    const email = normalizeInboundEmail({ webhookData, fetched: null });
    expect(email.textBody).toBe("");
    expect(email.subject).toBe("Umzugsanfrage");
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].sizeBytes).toBeNull();
  });
});

describe("buildBodyPreview", () => {
  it("caps the preview at the database limit", () => {
    const email = normalizeInboundEmail({
      webhookData,
      fetched: { text: "z".repeat(BODY_PREVIEW_CHARS + 500) },
    });
    expect(buildBodyPreview(email)).toHaveLength(BODY_PREVIEW_CHARS);
  });
});
