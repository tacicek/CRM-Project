import { describe, it, expect, vi } from "vitest";
import { dispatchReceipt, parseDocumentRequest, receiptPdfPath, verifyReceiptPdf, type ReceiptDispatchStore, type ReceiptRecipient } from "../document";

const id = "11111111-1111-4111-8111-111111111111";
const customer: ReceiptRecipient = { kind: "customer", email: "customer@example.invalid", subject: "Receipt", html: "<p>Receipt</p>", locale: "de" };
const firma: ReceiptRecipient = { ...customer, kind: "firma", email: "company@example.invalid" };
const now = Date.parse("2026-10-26T12:00:00Z");
const store = (): ReceiptDispatchStore => ({
  claim: vi.fn(async () => ({ state: "claimed", id, createdAt: new Date(now).toISOString() })),
  complete: vi.fn(async () => {}), fail: vi.fn(async () => {}), markSent: vi.fn(async () => {}),
});

describe("receipt document contract", () => {
  it("rejects a legacy attachment-only request without a saved version", () => {
    expect(() => parseDocumentRequest({ quittungId: id, quittungPdfBase64: "arbitrary" })).toThrow();
  });
  it("requires archived document identity before dispatch", () => {
    expect(() => parseDocumentRequest({ action: "send", quittungId: id, version: 1 })).toThrow();
    expect(parseDocumentRequest({ action: "send", quittungId: id, version: 2, documentId: id }).version).toBe(2);
  });
  it("names immutable files by company, receipt, version and digest", () => {
    expect(receiptPdfPath(id, id, 2, "ab")).toBe(`${id}/quittung/${id}/2/ab.pdf`);
  });
  it("checks both PDF magic and content digest", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nfixture");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
    await expect(verifyReceiptPdf(bytes, hash)).resolves.toBeUndefined();
    await expect(verifyReceiptPdf(bytes, "0".repeat(64))).rejects.toThrow("Prüfsumme");
    await expect(verifyReceiptPdf(new TextEncoder().encode("not a pdf"), hash)).rejects.toThrow("PDF");
  });
});

describe("receipt delivery", () => {
  it("does not re-send already completed recipients", async () => {
    const db = store(); vi.mocked(db.claim).mockResolvedValue({ state: "sent" });
    const deliver = vi.fn();
    expect((await dispatchReceipt([customer, firma], db, deliver, now)).sentTo).toEqual(["customer", "firma"]);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("uses the persistent dispatch id for provider deduplication", async () => {
    const deliver = vi.fn(async () => "provider-id");
    await dispatchReceipt([customer], store(), deliver, now);
    expect(deliver).toHaveBeenCalledWith(customer, `quittung/${id}`);
  });
  it("does not mark the receipt sent when only the internal copy succeeds", async () => {
    const db = store();
    const result = await dispatchReceipt([customer, firma], db, async r => {
      if (r.kind === "customer") throw new Error("rejected");
      return "provider-id";
    }, now);
    expect(result.sentTo).toEqual(["firma"]);
    expect(result.failures).toHaveLength(1);
    expect(db.markSent).not.toHaveBeenCalled();
  });
  it("does not report success or mark failed if persistence fails after provider acceptance", async () => {
    const db = store(); vi.mocked(db.complete).mockRejectedValue(new Error("DB unavailable"));
    await expect(dispatchReceipt([customer], db, async () => "provider-id", now)).rejects.toThrow("DB unavailable");
    expect(db.fail).not.toHaveBeenCalled(); expect(db.markSent).not.toHaveBeenCalled();
  });
  it("reports busy dispatches without another provider request", async () => {
    const db = store(); vi.mocked(db.claim).mockResolvedValue({ state: "busy" });
    const deliver = vi.fn();
    expect((await dispatchReceipt([customer], db, deliver, now)).failures).toHaveLength(1);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("does not retry uncertain delivery after the provider's deduplication window", async () => {
    const db = store(); vi.mocked(db.claim).mockResolvedValue({ state: "claimed", id, createdAt: new Date(now - 86400000).toISOString() });
    const deliver = vi.fn();
    expect((await dispatchReceipt([customer], db, deliver, now)).failures[0]).toContain("prüfen");
    expect(deliver).not.toHaveBeenCalled();
  });
});
