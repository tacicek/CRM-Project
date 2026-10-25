import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as documentRules from "../document";
import { buildInvoiceEmailHtml, buildInvoiceEmailSubject } from "../../_shared/invoiceEmailTemplate";
import { createTranslator, toLocale } from "../../_shared/i18n";
import { escapeHtml, emailBrandColor } from "../../_shared/htmlEscape";
import { receiptEmailLines, receiptEmailPaymentHtml } from "../presentation";

// Execute the real Edge handler with only its network/database adapters replaced.
// Pure document rules and shared email rendering are the production modules.
const source = readFileSync("supabase/functions/send-quittung/index.ts", "utf8").replace(/^import[^\n]+\n/gm, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const receiptId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000002";
const documentId = "00000000-0000-4000-8000-000000000003";
type Row = Record<string, unknown>;

async function fixture(options: { member?: boolean; failReceiptWrite?: boolean; failCustomer?: boolean; noArchive?: boolean; issued?: boolean } = {}) {
  const bytes = new TextEncoder().encode("%PDF-1.7\nSynthetic immutable receipt\n%%EOF");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
  const receipt: Row = {
    id: receiptId, company_id: companyId, version: 2, issued_at: options.issued === false ? null : "2026-10-26T09:00:00Z",
    quittung_nr: "QU-2026-0001", datum: "2026-10-26", customer_name: "Çağrı <script>x</script>",
    customer_email: "Customer@Example.Invalid", language: "fr", status: "paid", payment_status: "paid",
    rechnung_id: null, paid_amount: 108.1, payment_open_amount: 0, payment_date: "2026-10-26", payment_method: "cash", payment_reference: null,
    company_snapshot: { company_name: "Frozen Company", email: "office@example.invalid", primary_color: "#123456" },
    gesamttotal: 108.1, mwst_satz: 8.1, mwst_betrag: 8.1, rabatt: 0, zwischensumme: 100,
    positionen: [{ beschreibung: "Service", satz: "1", betrag: 100, checked: true }],
  };
  const document: Row = { id: documentId, company_id: companyId, quittung_id: receiptId, version: 2,
    pdf_path: documentRules.receiptPdfPath(companyId, receiptId, 2, hash), sha256: hash };
  const dispatches: Row[] = [];
  const providerRequests: Row[] = [];
  const receiptUpdates: Row[] = [];
  let secretsReads = 0;
  let archive: Row | null = options.noArchive ? null : document;
  let handler: (req: Request) => Promise<Response>;
  const company = { id: companyId, email: "office@example.invalid", notification_email: null, default_language: "de", resend_enabled: false };

  class Query {
    filters: Record<string, unknown> = {};
    patch?: Row;
    constructor(private table: string) {}
    select() { return this; }
    eq(key: string, value: unknown) { this.filters[key] = value; return this; }
    returns() { return this; }
    update(value: Row) { this.patch = value; return this; }
    result() {
      const value = this.table === "quittungen" ? receipt : this.table === "companies" ? company :
        this.table === "quittung_documents" ? archive : dispatches.find(r => Object.entries(this.filters).every(([k, v]) => r[k] === v)) ?? null;
      if (this.patch && this.table === "quittungen" && options.failReceiptWrite) return { data: null, error: { message: "injected persistence error" } };
      if (this.patch && value) {
        if (this.table === "quittungen") receiptUpdates.push(this.patch);
        Object.assign(value, this.patch);
      }
      return { data: value, error: null };
    }
    single() { return Promise.resolve(this.result()); }
    maybeSingle() { return this.single(); }
    then(resolve: (value: ReturnType<Query["result"]>) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve(this.result()).then(resolve, reject);
    }
  }
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) },
    from: (table: string) => new Query(table),
    storage: { from: () => ({
      download: async () => ({ data: new Blob([bytes]), error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: `http://supabase-kong:8000/storage/v1/object/sign/document-pdfs/${document.pdf_path}?token=synthetic%2Bsignature` }, error: null }),
      createSignedUploadUrl: async (path: string) => ({ data: { path, token: "synthetic-upload-token" }, error: null }),
    }) },
    rpc: async (name: string, args: Row) => {
      if (name === "register_quittung_document") { archive = document; return { data: document, error: null }; }
      const prior = dispatches.find(d => d.recipient_kind === args.p_kind && d.recipient_email === args.p_email);
      if (prior?.status === "sent") return { data: null, error: null };
      const row = prior ?? { id: `dispatch-${args.p_kind}`, document_id: documentId, recipient_kind: args.p_kind, recipient_email: args.p_email, created_at: new Date().toISOString() };
      row.status = "processing";
      if (!prior) dispatches.push(row);
      return { data: row, error: null };
    },
  };
  runInNewContext(compiled, {
    Request, Response, Blob, Uint8Array, TextDecoder, crypto, btoa,
    console: { error: () => undefined },
    serve: (fn: typeof handler) => { handler = fn; }, createClient: () => db,
    Deno: { env: { get: (name: string) => name === "SUPABASE_PUBLIC_URL" ? "http://public-kong.example.invalid" : "synthetic" } },
    verifyCompanyMembership: async () => options.member !== false,
    loadCompanySecrets: async () => { secretsReads += 1; return {}; },
    getSenderEmail: () => "sender@example.invalid", getDashAppUrl: () => "https://crm.example.invalid", logEmail: async () => undefined,
    buildInvoiceEmailHtml, buildInvoiceEmailSubject, createTranslator, toLocale, escapeHtml, emailBrandColor, receiptEmailLines, receiptEmailPaymentHtml,
    ...documentRules,
    fetch: async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body)) as Row;
      providerRequests.push({ ...payload, headers: init.headers });
      if (options.failCustomer && (payload.to as string[])[0] === "customer@example.invalid") return Response.json({ message: "provider rejected customer" }, { status: 422 });
      return Response.json({ id: `mail-${providerRequests.length}` });
    },
  });
  const request = async (patch: Row = {}) => handler!(new Request("https://edge.example.invalid/send-quittung", {
    method: "POST", headers: { Authorization: "Bearer synthetic" },
    body: JSON.stringify({ action: "send", quittungId: receiptId, version: 2, documentId, ...patch }),
  }));
  return { request, receipt, document, hash, providerRequests, receiptUpdates, secretsReads: () => secretsReads };
}

describe("send-quittung handler", () => {
  it.each(["paid", "issued", "signed", "sent"])("returns a browser-reachable archive URL for %s receipts without changing them", async status => {
    const f = await fixture();
    f.receipt.status = status;
    const response = await f.request({ action: "lookup" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      document: { id: documentId, version: 2, sha256: f.hash },
      url: `https://crm.example.invalid/storage/v1/object/sign/document-pdfs/${f.document.pdf_path}?token=synthetic%2Bsignature`,
    });
    expect(f.receiptUpdates).toHaveLength(0);
    expect(f.providerRequests).toHaveLength(0);
  });
  it("checks membership before reading sender secrets or delivering", async () => {
    const f = await fixture({ member: false });
    expect((await f.request()).status).toBe(403);
    expect(f.secretsReads()).toBe(0);
    expect(f.providerRequests).toHaveLength(0);
  });
  it("requires an issued receipt, matching version and archived PDF", async () => {
    expect((await (await fixture({ issued: false })).request()).status).toBe(409);
    expect((await (await fixture()).request({ version: 1 })).status).toBe(409);
    expect((await (await fixture({ noArchive: true })).request()).status).toBe(409);
  });
  it("reuses archived bytes, preserves paid status and never resends successful recipients", async () => {
    const f = await fixture();
    expect((await f.request()).status).toBe(200);
    expect((await f.request()).status).toBe(200);
    expect(f.providerRequests).toHaveLength(2);
    expect(f.receipt.status).toBe("paid");
    expect(f.receiptUpdates.every(p => Object.keys(p).join() === "sent_at")).toBe(true);
    const first = f.providerRequests[0];
    expect(first.html).toContain("Çağrı &lt;script&gt;");
    expect(first.html).toContain("Frozen Company");
    expect(atob((first.attachments as Array<{ content: string }>)[0].content)).toContain("Synthetic immutable receipt");
    expect((first.headers as Record<string, string>)["Idempotency-Key"]).toBe("quittung/dispatch-customer");
  });
  it("does not report success when receipt delivery persistence fails", async () => {
    const f = await fixture({ failReceiptWrite: true });
    expect((await f.request()).status).toBe(500);
    expect((await f.request()).status).toBe(500);
    expect(f.providerRequests).toHaveLength(2);
  });
  it("reports partial delivery and does not mark a customer failure as sent", async () => {
    const f = await fixture({ failCustomer: true });
    const response = await f.request();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ partial: true, sent_to: ["firma"] });
    expect(f.receiptUpdates).toHaveLength(0);
  });
  it("validates the immutable upload path and PDF before archive registration", async () => {
    const f = await fixture({ noArchive: true });
    expect((await f.request({ action: "archive", sha256: f.hash, pdfPath: "another-company.pdf" })).status).toBe(400);
    const response = await f.request({ action: "archive", sha256: f.hash, pdfPath: f.document.pdf_path });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ document: { id: documentId, sha256: f.hash } });
  });
});
