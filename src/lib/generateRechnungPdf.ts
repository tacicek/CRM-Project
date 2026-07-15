/**
 * Rechnung PDF generation — Layer 3 (Swiss QR-Bill, Phase 3 / S3).
 *
 * Body design is free (Offerio branding); the 105mm payment part below is drawn
 * coordinate-based per the SIX "Swiss Implementation Guidelines QR-bill" norm
 * (Empfangsschein 62mm + Zahlteil 148mm, QR 46×46mm, Swiss cross 7×7mm).
 *
 * Link to Layer 2 (pure core): buildQrPayload + renderQrPng. Knows no DB/React;
 * takes plain RechnungData. Number/reference generation happens in S4 (erstelleRechnung).
 */
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { buildQrPayload, renderQrPng, isQRIBAN, type QrBillInput, type QrBillAddress, type QrCurrency } from "@/lib/swiss-qr/core";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { Translator } from "@/i18n/translator";
import { formatCurrency, formatDate } from "@/i18n/format";
import { getLetterSalutation } from "@/i18n/domain";

export interface RechnungCompany {
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mwst_number?: string | null;
  /** Mandatory for QR-Bill — if missing, buildQrPayload throws. */
  iban: string;
  /** PDF-Redesign (Part 2): Akzentfarbe + Unterschrift/Ansprechpartner. */
  primary_color?: string | null;
  legal_name?: string | null;
}

export interface RechnungPosition {
  beschreibung: string;
  menge?: number | null;
  einheit?: string | null;
  einzelpreis?: number | null;
  betrag: number;
}

export interface RechnungData {
  rechnung_nr: string;
  /** ISO date (YYYY-MM-DD). */
  datum: string;
  faellig_am: string;
  customer_name: string;
  /** Single-/multi-line free address (from offer/auftrag). QR-Bill debtor empty in MVP. */
  customer_address?: string | null;
  customer_email?: string | null;
  positionen: RechnungPosition[];
  zwischensumme: number;
  mwst_satz: number;
  mwst_betrag: number;
  total: number;
  currency?: QrCurrency;
  /** QRR (27 digits) or SCOR (RF…). If missing, reference-less (NON) QR-Bill. */
  qr_referenz?: string | null;
  /** IBAN snapshot at generation time; if missing, company.iban is used. */
  qr_iban?: string | null;
  /** QR-Bill "Zusätzliche Informationen" (Ustrd). If missing, "Rechnung <nr>". */
  message?: string | null;
  /** PDF-Redesign (Part 2): rechnungsbezogene Texte. Werden hier NUR getragen,
   *  noch nicht gerendert (drawInvoiceBody bleibt unverändert). */
  anrede?: string | null;
  einleitung?: string | null;
  schlusstext?: string | null;
  zahlungskonditionen?: string | null;
  /**
   * The CUSTOMER's language (rechnungen.language). Resolve it with
   * `resolveDocumentLocale(rechnung, company)` — never from the dashboard context.
   */
  locale: Locale;
  company: RechnungCompany;
}

const FONT = "helvetica";
const A4_W = 210;
const A4_H = 297;
const MARGIN = 20;

// ── Farben (PDF-Redesign) ────────────────────────────────────────────────────
type Rgb = [number, number, number];
const DEFAULT_ACCENT: Rgb = [15, 118, 110]; // teal-700 — Fallback, wenn primary_color NULL/ungültig
const COL_DARK: Rgb = [15, 23, 42];         // slate-900 (Rechnungsnummer, Firmenname)
const COL_GRAY: Rgb = [100, 116, 139];      // slate-500 (Adresse/Kontakt)
const COL_LABEL: Rgb = [148, 163, 184];     // slate-400 (kleine Labels, "RECHNUNG")

/** "#RRGGBB" | "#RGB" | "RRGGBB" → [r,g,b]; ungültig/leer → fallback. */
const hexToRgb = (hex: string | null | undefined, fallback: Rgb): Rgb => {
  if (!hex) return fallback;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const setText = (doc: jsPDF, [r, g, b]: Rgb): void => doc.setTextColor(r, g, b);

// ── Formatting helpers ───────────────────────────────────────────────────────

/** "1 234.50" — thousands separator space, 2 decimals (QR-Bill NORM, not locale). */
// The QR-Bill payment part prescribes a SPACE as thousands separator in every language;
// it must NOT follow the document locale. The invoice body above it is free-form and does
// follow the locale (formatCurrency).
const groupAmount = (n: number, sep: string): string => {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? "-" : ""}${grouped}.${dec}`;
};
const formatQrAmount = (n: number): string => groupAmount(n, " ");

/**
 * jsPDF's built-in Helvetica is WinAnsi-only. Intl's fr-CH formatter emits U+202F
 * (narrow no-break space) as the digit-grouping separator and U+00A0 before the currency
 * code — neither has a WinAnsi glyph, so an amount like "2 500.00 CHF" renders as tofu.
 * Normalise the exotic spaces Intl can produce to a plain space before any amount is drawn.
 * (The QR payment part already uses a plain space per the SIX norm.)
 */
const sanitizePdfText = (s: string): string => s.replace(/[\u00a0\u2007\u2009\u202f\u2060]/g, " ");

// Legacy German auto-seed: older invoices persisted these hard-coded GERMAN intro/outro
// strings into every row regardless of the customer's language, so a French/English invoice
// rendered German boilerplate. Sourced from the DE catalog (not a magic string); when a stored
// value equals it, the renderer treats it as "unset" and falls back to the localized default.
const DE_DEFAULT_INTRO = documentI18nFor("de").t("doc.invoice.defaultIntro");
const DE_DEFAULT_OUTRO = documentI18nFor("de").t("doc.invoice.defaultOutro");

/**
 * Free "customer_address" (single/multi-line) → QR-Bill structured debtor.
 * Swiss format: "<street no> <PLZ 4 digits> <Ort>". If it cannot be parsed, undefined
 * → debtor is not added at all (empty debtor instead of invalid QR; the norm allows this).
 */
const parseDebtor = (name: string, address?: string | null): QrBillAddress | undefined => {
  const flat = (address ?? "").replace(/\s+/g, " ").trim();
  if (!name.trim() || !flat) return undefined;
  const m = flat.match(/^(.+?)[, ]+(\d{4})\s+(.+)$/);
  if (!m) return undefined;
  return {
    name: name.trim(),
    street: m[1].trim(),
    buildingNumber: "",
    postalCode: m[2],
    town: m[3].trim(),
    country: "CH",
  };
};

/** "Zahlbar durch" lines: name+address if debtor exists, otherwise only name. */
const debtorLines = (data: RechnungData, debtor?: QrBillAddress): string[] => {
  if (!debtor) return [data.customer_name];
  const lines = [debtor.name];
  const st = [debtor.street, debtor.buildingNumber].filter(Boolean).join(" ").trim();
  if (st) lines.push(st);
  lines.push(`${debtor.postalCode} ${debtor.town}`);
  return lines;
};

/** ISO date → locale date; an unparsable value is printed as-is instead of "Invalid Date". */
const formatIsoDate = (iso: string, locale: Locale): string => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return formatDate(d, locale);
};

/** Groups the reference for display (QRR: in 5s, SCOR/RF: in 4s). */
const formatReferenceDisplay = (ref: string): string => {
  const r = ref.replace(/\s+/g, "");
  if (/^RF/i.test(r)) return r.replace(/(.{4})/g, "$1 ").trim();
  return r.replace(/(.{5})/g, "$1 ").trim();
};

const creditorLines = (c: RechnungCompany): string[] => {
  const streetLine = [c.street, c.house_number].filter(Boolean).join(" ").trim();
  return [c.company_name, streetLine, `${c.plz} ${c.city}`.trim()].filter((l) => l.length > 0);
};

// ── QR-Bill payment part (bottom 105mm) ──────────────────────────────────────

const PP_TOP = A4_H - 105; // 192 — payment part top edge
const RECEIPT_X = 5;
const SEP_X = 62; // Empfangsschein / Zahlteil separator
const ZAHLTEIL_X = SEP_X + 5; // 67 — Zahlteil left content
const INFO_X = 118; // Zahlteil right info column
const QR_SIZE = 46;
const QR_X = ZAHLTEIL_X;
const QR_Y = PP_TOP + 17; // below the heading

const setFont = (doc: jsPDF, size: number, style: "normal" | "bold"): void => {
  doc.setFont(FONT, style);
  doc.setFontSize(size);
};

/** Swiss cross in the center of the QR (7×7mm black square + white cross). */
const drawSwissCross = (doc: jsPDF): void => {
  const c = 7;
  const cx = QR_X + QR_SIZE / 2;
  const cy = QR_Y + QR_SIZE / 2;
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - c / 2, cy - c / 2, c, c, "F");
  doc.setFillColor(255, 255, 255);
  // white cross (vertical + horizontal arms)
  const armLong = 4.4;
  const armShort = 1.2;
  doc.rect(cx - armShort / 2, cy - armLong / 2, armShort, armLong, "F");
  doc.rect(cx - armLong / 2, cy - armShort / 2, armLong, armShort, "F");
  doc.setFillColor(0, 0, 0);
};

const drawReceipt = (doc: jsPDF, data: RechnungData, t: Translator, refType: string, reference: string, debtor?: QrBillAddress): void => {
  let y = PP_TOP + 7;
  setFont(doc, 11, "bold");
  doc.text(t("doc.qr.receipt"), RECEIPT_X, y);
  y += 7;

  setFont(doc, 6, "bold");
  doc.text(t("doc.qr.account"), RECEIPT_X, y);
  y += 3;
  setFont(doc, 8, "normal");
  doc.text(data.qr_iban || data.company.iban, RECEIPT_X, y);
  y += 3;
  for (const line of creditorLines(data.company)) {
    doc.text(line, RECEIPT_X, y);
    y += 3;
  }

  if (refType !== "NON") {
    y += 1;
    setFont(doc, 6, "bold");
    doc.text(t("doc.qr.reference"), RECEIPT_X, y);
    y += 3;
    setFont(doc, 8, "normal");
    doc.text(formatReferenceDisplay(reference), RECEIPT_X, y);
    y += 3;
  }

  y += 1;
  setFont(doc, 6, "bold");
  doc.text(t("doc.qr.payableBy"), RECEIPT_X, y);
  y += 3;
  setFont(doc, 8, "normal");
  for (const line of debtorLines(data, debtor)) {
    doc.text(line, RECEIPT_X, y);
    y += 3;
  }

  // Währung / Betrag (bottom block)
  const amountY = PP_TOP + 80;
  setFont(doc, 6, "bold");
  doc.text(t("doc.qr.currency"), RECEIPT_X, amountY);
  doc.text(t("doc.qr.amount"), RECEIPT_X + 16, amountY);
  setFont(doc, 8, "normal");
  doc.text(data.currency ?? "CHF", RECEIPT_X, amountY + 4);
  doc.text(formatQrAmount(data.total), RECEIPT_X + 16, amountY + 4);

  // Annahmestelle (bottom right)
  setFont(doc, 6, "bold");
  doc.text(t("doc.qr.acceptancePoint"), SEP_X - 5, PP_TOP + 92, { align: "right" });
};

const drawZahlteil = (doc: jsPDF, data: RechnungData, t: Translator, qrPng: string, refType: string, reference: string, debtor?: QrBillAddress): void => {
  // Heading
  setFont(doc, 11, "bold");
  doc.text(t("doc.qr.paymentPart"), ZAHLTEIL_X, PP_TOP + 7);

  // QR + Swiss cross
  doc.addImage(qrPng, "PNG", QR_X, QR_Y, QR_SIZE, QR_SIZE);
  drawSwissCross(doc);

  // Währung / Betrag (below the QR)
  const amountY = QR_Y + QR_SIZE + 6;
  setFont(doc, 8, "bold");
  doc.text(t("doc.qr.currency"), ZAHLTEIL_X, amountY);
  doc.text(t("doc.qr.amount"), ZAHLTEIL_X + 18, amountY);
  setFont(doc, 10, "normal");
  doc.text(data.currency ?? "CHF", ZAHLTEIL_X, amountY + 5);
  doc.text(formatQrAmount(data.total), ZAHLTEIL_X + 18, amountY + 5);

  // Right info column
  let y = PP_TOP + 7;
  setFont(doc, 8, "bold");
  doc.text(t("doc.qr.account"), INFO_X, y);
  y += 4;
  setFont(doc, 10, "normal");
  doc.text(data.qr_iban || data.company.iban, INFO_X, y);
  y += 4;
  for (const line of creditorLines(data.company)) {
    doc.text(line, INFO_X, y);
    y += 4;
  }

  if (refType !== "NON") {
    y += 2;
    setFont(doc, 8, "bold");
    doc.text(t("doc.qr.reference"), INFO_X, y);
    y += 4;
    setFont(doc, 10, "normal");
    doc.text(formatReferenceDisplay(reference), INFO_X, y);
    y += 4;
  }

  const msg = data.message?.trim() || t("doc.invoice.number", { number: data.rechnung_nr });
  y += 2;
  setFont(doc, 8, "bold");
  doc.text(t("doc.qr.additionalInfo"), INFO_X, y);
  y += 4;
  setFont(doc, 10, "normal");
  doc.text(doc.splitTextToSize(msg, A4_W - INFO_X - 5), INFO_X, y);

  y = PP_TOP + 56;
  setFont(doc, 8, "bold");
  doc.text(t("doc.qr.payableBy"), INFO_X, y);
  y += 4;
  setFont(doc, 10, "normal");
  for (const line of debtorLines(data, debtor)) {
    doc.text(line, INFO_X, y);
    y += 4;
  }
};

const drawQrBill = async (doc: jsPDF, data: RechnungData, t: Translator): Promise<void> => {
  const iban = data.qr_iban || data.company.iban;
  const reference = data.qr_referenz?.replace(/\s+/g, "") ?? "";
  // QRR is only valid with a QR-IBAN; plain IBAN + QRR → buildQrPayload errors.
  const refType = !reference ? "NON" : /^RF/i.test(reference) ? "SCOR" : isQRIBAN(iban) ? "QRR" : "NON";
  const debtor = parseDebtor(data.customer_name, data.customer_address);

  const input: QrBillInput = {
    creditor: {
      iban,
      name: data.company.company_name,
      street: data.company.street ?? "",
      buildingNumber: data.company.house_number ?? "",
      postalCode: data.company.plz,
      town: data.company.city,
      country: "CH",
    },
    debtor,
    amount: data.total > 0 ? data.total : undefined,
    currency: data.currency ?? "CHF",
    message: data.message?.trim() || t("doc.invoice.number", { number: data.rechnung_nr }),
    reference: reference || undefined,
  };

  const payload = buildQrPayload(input);
  const qrPng = await renderQrPng(payload);

  // Norm: cut-off notice + scissors line + vertical separator
  setFont(doc, 8, "normal");
  doc.text(t("doc.qr.separateNotice"), A4_W / 2, PP_TOP - 2, { align: "center" });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.line(0, PP_TOP, A4_W, PP_TOP);
  doc.line(SEP_X, PP_TOP, SEP_X, A4_H);

  drawReceipt(doc, data, t, refType, reference, debtor);
  drawZahlteil(doc, data, t, qrPng, refType, reference, debtor);
};

// ── Invoice body (upper part) ────────────────────────────────────────────────

const LOGO_MAX_W = 55;
const LOGO_MAX_H = 20;

const drawInvoiceBody = (doc: jsPDF, data: RechnungData, t: Translator, logoBase64: string | null): void => {
  const c = data.company;
  const locale = data.locale;
  const money = (n: number): string => sanitizePdfText(formatCurrency(n, locale));
  const accent = hexToRgb(c.primary_color, DEFAULT_ACCENT);

  // ── BLOCK 1: Akzent-Streifen + Header ──
  // Top accent stripe (full width, primary_color || teal-Fallback)
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, A4_W, 4, "F");

  // Header left: Logo (if present) or Firmenname (fallback)
  let logoBottom = MARGIN;
  let logoDrawn = false;
  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const scale = Math.min(LOGO_MAX_W / props.width, LOGO_MAX_H / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(logoBase64, "PNG", MARGIN, MARGIN, w, h);
      logoBottom = MARGIN + h;
      logoDrawn = true;
    } catch {
      logoDrawn = false; // silent fallback → text
    }
  }

  // Firmenblock (links, unter dem Logo): Name + Adresse + Telefon · E-Mail + MwSt-Nr
  let lx = logoDrawn ? logoBottom + 6 : MARGIN + 4;
  setText(doc, COL_DARK);
  setFont(doc, logoDrawn ? 10 : 14, "bold");
  doc.text(c.legal_name || c.company_name, MARGIN, lx);
  lx += logoDrawn ? 5 : 6;
  setFont(doc, 8, "normal");
  setText(doc, COL_GRAY);
  const companyLines = [
    [c.street, c.house_number].filter(Boolean).join(" ").trim(),
    `${c.plz} ${c.city}`.trim(),
    [c.phone, c.email].filter(Boolean).join("  ·  "),
    c.mwst_number ? (/mwst/i.test(c.mwst_number) ? c.mwst_number : `${c.mwst_number} MWST`) : "",
  ].filter((l) => l && l.length > 0);
  for (const line of companyLines) {
    doc.text(line, MARGIN, lx);
    lx += 4;
  }

  // Header right: "RECHNUNG" (letter-spaced, gray) + große, dunkle Rechnungsnummer
  // Sperrung über Leerzeichen statt charSpace: bei align:"right" rechnet jsPDF die
  // charSpace-Breite nicht in die Ausrichtung ein → rechte Kante verschiebt sich.
  // Mit echten Leerzeichen liefert getTextWidth die korrekte Breite → bündige rechte Kante.
  setText(doc, COL_LABEL);
  setFont(doc, 8, "bold");
  doc.text(t("doc.invoice.wordmark"), A4_W - MARGIN, MARGIN + 4, { align: "right" });
  setText(doc, COL_DARK);
  setFont(doc, 20, "bold");
  doc.text(data.rechnung_nr, A4_W - MARGIN, MARGIN + 13, { align: "right" });

  // Folgende (noch alte) Blöcke erwarten Schwarz → Farbe zurücksetzen.
  doc.setTextColor(0, 0, 0);

  let y = Math.max(lx, MARGIN + 20) + 10;

  // ── BLOCK 2: RECHNUNG AN (links) + Meta-Box (rechts) ──
  const blockTop = y;

  // Left: "RECHNUNG AN" + Kunde
  setText(doc, COL_LABEL);
  setFont(doc, 7, "bold");
  doc.text(t("doc.invoice.recipient"), MARGIN, blockTop, { charSpace: 1 });
  setText(doc, COL_DARK);
  setFont(doc, 11, "bold");
  doc.text(data.customer_name, MARGIN, blockTop + 7);
  setFont(doc, 9, "normal");
  setText(doc, COL_GRAY);
  let custY = blockTop + 12;
  if (data.customer_address) {
    for (const line of data.customer_address.split("\n")) {
      doc.text(line, MARGIN, custY);
      custY += 4;
    }
  }

  // Right: Meta-Box (rounded corner, light gray background + thin border)
  const boxX = 118;
  const boxW = A4_W - MARGIN - boxX; // 72 → rechter Rand = A4_W - MARGIN
  const boxY = blockTop - 4;
  const boxH = 30;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, "FD");
  const metaPad = 6;
  const metaRows: [string, string][] = [
    [t("doc.invoice.date"), formatIsoDate(data.datum, locale)],
    [t("doc.invoice.dueDate"), formatIsoDate(data.faellig_am, locale)],
    [t("doc.invoice.contact"), c.legal_name || c.company_name],
  ];
  const metaGap = 3; // min space between label and value on one row
  let mrY = boxY + 8;
  for (const [label, value] of metaRows) {
    setFont(doc, 8, "normal");
    setText(doc, COL_GRAY);
    doc.text(label, boxX + metaPad, mrY);
    const labelW = doc.getTextWidth(label);
    // Available width for the right-aligned value; shrink the value font until it fits so a
    // long FR label ("Personne de contact") + a long value (company name) never overlap.
    const valueMax = boxW - 2 * metaPad - labelW - metaGap;
    let valueSize = 9;
    setFont(doc, valueSize, "bold");
    while (doc.getTextWidth(value) > valueMax && valueSize > 6.5) {
      valueSize -= 0.5;
      setFont(doc, valueSize, "bold");
    }
    setText(doc, COL_DARK);
    doc.text(value, boxX + boxW - metaPad, mrY, { align: "right" });
    mrY += 8;
  }

  // Color/line reset → so the blocks below (still old) stay black/thin
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);

  y = Math.max(custY, boxY + boxH) + 6;

  // ── BLOCK 3: Briefanrede + Einleitungstext ──
  setText(doc, COL_DARK);
  setFont(doc, 11, "bold");
  // The salutation is derived from the stored `anrede` (Herr/Frau) — getLetterSalutation
  // falls back to the neutral form when it is empty, in every language.
  doc.text(getLetterSalutation(data.anrede, data.customer_name, locale), MARGIN, y);
  y += 7;

  // Intro text: the operator's custom text if set, otherwise the localized default in the
  // CUSTOMER's language. A stored value equal to the legacy German auto-seed is treated as
  // unset so a French/English invoice no longer prints German boilerplate.
  const storedIntro = data.einleitung?.trim();
  const introText = !storedIntro || storedIntro === DE_DEFAULT_INTRO
    ? t("doc.invoice.defaultIntro")
    : storedIntro;
  if (introText) {
    setFont(doc, 9, "normal");
    setText(doc, COL_GRAY);
    const einleitungLines = doc.splitTextToSize(introText, A4_W - 2 * MARGIN);
    doc.text(einleitungLines, MARGIN, y);
    y += einleitungLines.length * 4 + 2;
  }
  doc.setTextColor(0, 0, 0);
  y += 2;

  // ── BLOCK 4: positions table (POS badge, light header, uniform halign) ──
  // M6: keep the table out of the Swiss-QR payment zone (y ≥ PP_TOP). Reserve space below
  // the table for the totals/signature band; a longer table paginates instead of drawing
  // rows over the QR slip (which would make the payment part unscannable).
  const TOTALS_RESERVE = 40; // mm reserved between the table end and PP_TOP for the totals band
  const pagesBefore = doc.getNumberOfPages();
  autoTable(doc, {
    startY: y,
    head: [[
      t("doc.invoice.col.pos"),
      t("doc.invoice.col.description"),
      t("doc.invoice.col.quantity"),
      t("doc.invoice.col.unitPrice"),
      t("doc.invoice.col.amount"),
    ]],
    body: data.positionen.map((p) => [
      "", // POS — Badge wird in didDrawCell gezeichnet
      p.beschreibung,
      typeof p.menge === "number" ? `${p.menge}${p.einheit ? " " + p.einheit : ""}` : "",
      typeof p.einzelpreis === "number" ? money(p.einzelpreis) : "",
      money(p.betrag),
    ]),
    theme: "plain",
    styles: { font: FONT, fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 }, textColor: [71, 85, 105], valign: "middle" },
    // halign in columnStyles gilt für Kopf UND Body → konsistente Ausrichtung.
    headStyles: { fillColor: [255, 255, 255], textColor: COL_LABEL, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "left", fontStyle: "bold", textColor: COL_DARK },
      2: { halign: "right", cellWidth: 24 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30, fontStyle: "bold", textColor: COL_DARK },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: A4_H - (PP_TOP - TOTALS_RESERVE) },
    didParseCell: (hook: CellHookData) => {
      // Kopf UND Body pro Spalte identisch ausrichten — autoTable wendet die
      // halign-Kaskade für head/body uneinheitlich an; hier deterministisch erzwingen.
      const aligns = ["center", "left", "right", "right", "right"] as const;
      const a = aligns[hook.column.index];
      if (a) hook.cell.styles.halign = a;
    },
    didDrawCell: (hook: CellHookData) => {
      const { x, y: cy, width, height } = hook.cell;
      if (hook.section === "head") {
        // Kopfzeile: dünne untere Trennlinie
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(x, cy + height, x + width, cy + height);
        return;
      }
      if (hook.section === "body") {
        // dünner Zeilentrenner
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.1);
        doc.line(x, cy + height, x + width, cy + height);
        // POS-Badge: heller Grund + dunkle (accent) Zahl
        if (hook.column.index === 0) {
          const b = 6;
          const bx = x + (width - b) / 2;
          const by = cy + (height - b) / 2;
          doc.setFillColor(224, 242, 241);
          doc.roundedRect(bx, by, b, b, 1, 1, "F");
          setText(doc, accent);
          setFont(doc, 8, "bold");
          doc.text(String(hook.row.index + 1), bx + b / 2, by + b / 2 + 1.4, { align: "center" });
        }
      }
    },
  });

  // After the table, color/line reset → so the total block below (still old) stays black/thin
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);

  // ── BLOCK 5: Summen (rechts) + Konditionen/Schluss/Unterschrift (links) ──
  const finalY = doc.lastAutoTable.finalY;

  // Rechts: Zwischensumme + MwSt (nur Satz>0), rechtsbündig auf 190 (wie Tabelle).
  let ty = finalY + 9;
  const rLabelX = 118;
  const rValX = A4_W - MARGIN;
  const subRow = (label: string, value: string): void => {
    setFont(doc, 9, "normal");
    setText(doc, COL_GRAY);
    doc.text(label, rLabelX, ty);
    setText(doc, COL_DARK);
    doc.text(value, rValX, ty, { align: "right" });
    ty += 6;
  };
  subRow(t("doc.invoice.subtotal"), money(data.zwischensumme));
  if (data.mwst_satz > 0) {
    subRow(t("doc.invoice.vat", { rate: data.mwst_satz }), money(data.mwst_betrag));
  }

  // Rechts: dunkle Total-Box (weiße Schrift = garantierter Kontrast).
  // Auto-fit: the label varies by language ("Rechnungstotal inkl. MwSt." vs. the much longer
  // "Total de la facture TVA incluse") and the amount can be large. Measure both, grow the box
  // leftward, and step the fonts down if they would still collide — the old fixed 80mm box let
  // the French label overlap the amount and clipped it past the right edge.
  const boxRight = A4_W - MARGIN;          // 190 — fixed right edge (aligns with the table)
  const boxPad = 5;
  const boxGap = 5;                        // min space between label and amount
  const totalLabel = t("doc.invoice.total");
  const totalValue = money(data.total);
  const MAX_BOX_W = 98;                     // left edge ≥ 92 → leaves room for the left text column
  const innerMax = MAX_BOX_W - 2 * boxPad;
  const measure = (text: string, size: number, style: "normal" | "bold"): number => {
    setFont(doc, size, style);
    return doc.getTextWidth(text);
  };
  let labelSize = 8.5;
  let valueSize = 13;
  let labelW = measure(totalLabel, labelSize, "normal");
  let valueW = measure(totalValue, valueSize, "bold");
  // Shrink the label first, then the amount, until they fit the widest allowed box.
  while (labelW + boxGap + valueW > innerMax && (labelSize > 7 || valueSize > 11)) {
    if (labelSize > 7) labelSize -= 0.5;
    else valueSize -= 0.5;
    labelW = measure(totalLabel, labelSize, "normal");
    valueW = measure(totalValue, valueSize, "bold");
  }
  const boxW2 = Math.min(MAX_BOX_W, Math.max(80, labelW + boxGap + valueW + 2 * boxPad));
  const boxX2 = boxRight - boxW2;
  const boxH2 = 14;
  const boxY2 = ty + 1;
  doc.setFillColor(COL_DARK[0], COL_DARK[1], COL_DARK[2]);
  doc.roundedRect(boxX2, boxY2, boxW2, boxH2, 2, 2, "F");
  const boxMidY = boxY2 + boxH2 / 2 + 1;
  setFont(doc, labelSize, "normal");
  doc.setTextColor(226, 232, 240);
  doc.text(totalLabel, boxX2 + boxPad, boxMidY);
  setFont(doc, valueSize, "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(totalValue, boxRight - boxPad, boxMidY + 0.5, { align: "right" });

  // Links: Zahlungskonditionen + Schlusstext + Unterschrift.
  let ly = finalY + 9;
  const leftW = boxX2 - MARGIN - 6; // Textbreite links (vor der Box)
  if (data.zahlungskonditionen && data.zahlungskonditionen.trim()) {
    setFont(doc, 9, "bold");
    const lbl = t("doc.invoice.paymentTerms");
    const lblW = doc.getTextWidth(lbl);
    setText(doc, COL_DARK);
    doc.text(lbl, MARGIN, ly);
    setFont(doc, 9, "normal");
    setText(doc, COL_GRAY);
    doc.text(data.zahlungskonditionen.trim(), MARGIN + lblW, ly);
    ly += 6;
  }
  // Closing text: operator's custom text, else the localized default; the legacy German
  // auto-seed is treated as unset (same rule as the intro above).
  const storedOutro = data.schlusstext?.trim();
  const outroText = !storedOutro || storedOutro === DE_DEFAULT_OUTRO
    ? t("doc.invoice.defaultOutro")
    : storedOutro;
  if (outroText) {
    setFont(doc, 9, "normal");
    setText(doc, COL_GRAY);
    const sl = doc.splitTextToSize(outroText, leftW);
    doc.text(sl, MARGIN, ly);
    ly += sl.length * 4 + 4;
  }
  ly += 6;
  setFont(doc, 9, "normal");
  setText(doc, COL_GRAY);
  doc.text(t("doc.invoice.closing"), MARGIN, ly);
  ly += 7;
  setFont(doc, 10, "bold");
  setText(doc, COL_DARK);
  doc.text(c.legal_name || c.company_name, MARGIN, ly);

  // Overflow guard — content must not enter the Zahlteil zone (y ≥ PP_TOP). Fires a visible
  // warning both when the totals band crosses PP_TOP AND when the table itself paginated
  // (rows spilled onto a second page). The bottom margin above already stops rows from
  // overprinting the QR slip; this makes the overflow explicit instead of silent.
  // TODO(root-cause): proper multi-page layout with the QR-bill only on the last page = separate task.
  const bandBottom = Math.max(ly, boxY2 + boxH2);
  const tablePaginated = doc.getNumberOfPages() > pagesBefore;
  if (tablePaginated || bandBottom > PP_TOP - 4) {
    setFont(doc, 8, "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(t("doc.invoice.overflowWarning"), MARGIN, PP_TOP - 6);
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
};

// ── General API ──────────────────────────────────────────────────────────────

/**
 * Builds the invoice PDF and returns the jsPDF doc (for download or base64).
 * logoBase64 (PNG data URL) is resolved in the UI layer — Layer 3 knows no DB/storage.
 */
export const buildRechnungDoc = async (
  data: RechnungData,
  logoBase64: string | null = null,
): Promise<jsPDF> => {
  const doc = new jsPDF(); // mm, A4 portrait
  // Customer language — taken from the invoice row, never from the operator's dashboard.
  const { t } = documentI18nFor(data.locale);
  drawInvoiceBody(doc, data, t, logoBase64);
  await drawQrBill(doc, data, t);
  return doc;
};

/** Downloads the invoice PDF in the browser. */
export const downloadRechnungPdf = async (
  data: RechnungData,
  logoBase64: string | null = null,
): Promise<void> => {
  const doc = await buildRechnungDoc(data, logoBase64);
  doc.save(`${data.rechnung_nr}.pdf`);
};
