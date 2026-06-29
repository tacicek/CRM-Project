/**
 * Rechnung PDF üretimi — Katman 3 (Swiss QR-Bill, Faz 3 / S3).
 *
 * Gövde tasarımı serbest (Offerio markası); alttaki 105mm ödeme dilimi SIX
 * "Swiss Implementation Guidelines QR-bill" normuna göre koordinat-bazlı çizilir
 * (Empfangsschein 62mm + Zahlteil 148mm, QR 46×46mm, İsviçre çaprazı 7×7mm).
 *
 * Katman 2 (saf çekirdek) ile bağ: buildQrPayload + renderQrPng. DB/React bilmez;
 * düz RechnungData alır. Numara/referans üretimi S4'te (erstelleRechnung) yapılır.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildQrPayload, renderQrPng, isQRIBAN, type QrBillInput, type QrBillAddress, type QrCurrency } from "@/lib/swiss-qr/core";

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
  /** QR-Bill için zorunlu — yoksa buildQrPayload hata fırlatır. */
  iban: string;
  /** PDF-Redesign (Parça 2): Akzentfarbe + Unterschrift/Ansprechpartner. */
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
  /** ISO tarih (YYYY-MM-DD). */
  datum: string;
  faellig_am: string;
  customer_name: string;
  /** Tek satır/çok satır serbest adres (offer/auftrag'dan). QR-Bill debtor'ı MVP'de boş. */
  customer_address?: string | null;
  customer_email?: string | null;
  positionen: RechnungPosition[];
  zwischensumme: number;
  mwst_satz: number;
  mwst_betrag: number;
  total: number;
  currency?: QrCurrency;
  /** QRR (27 hane) veya SCOR (RF…). Yoksa referanssız (NON) QR-Bill. */
  qr_referenz?: string | null;
  /** Üretim anı IBAN snapshot; yoksa company.iban kullanılır. */
  qr_iban?: string | null;
  /** QR-Bill "Zusätzliche Informationen" (Ustrd). Yoksa "Rechnung <nr>". */
  message?: string | null;
  /** PDF-Redesign (Parça 2): rechnungsbezogene Texte. Werden hier NUR getragen,
   *  noch nicht gerendert (drawInvoiceBody bleibt unverändert). */
  anrede?: string | null;
  einleitung?: string | null;
  schlusstext?: string | null;
  zahlungskonditionen?: string | null;
  company: RechnungCompany;
}

const FONT = "helvetica";
const A4_W = 210;
const A4_H = 297;
const MARGIN = 20;

// ── Biçimlendirme yardımcıları ───────────────────────────────────────────────

/** "1 234.50" — binlik ayraç boşluk, 2 ondalık (QR-Bill normu). */
// QR-Bill ödeme kısmı binlik ayracı NORM gereği BOŞLUK ister (formatAmount).
// Fatura gövdesi İsviçre konvansiyonu apostrof kullanır (formatAmountCH) —
// uygulamanın geri kalanıyla ("CHF 3'234.35") tutarlı.
const groupAmount = (n: number, sep: string): string => {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? "-" : ""}${grouped}.${dec}`;
};
const formatAmount = (n: number): string => groupAmount(n, " ");
const formatAmountCH = (n: number): string => groupAmount(n, "'");

/**
 * Serbest "customer_address" (tek/çok satır) → QR-Bill structured debtor.
 * İsviçre formatı: "<sokak no> <PLZ 4 hane> <Ort>". Parse edilemezse undefined
 * → debtor hiç eklenmez (geçersiz QR yerine boş borçlu; norm buna izin verir).
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

/** "Zahlbar durch" satırları: debtor varsa isim+adres, yoksa sadece isim. */
const debtorLines = (data: RechnungData, debtor?: QrBillAddress): string[] => {
  if (!debtor) return [data.customer_name];
  const lines = [debtor.name];
  const st = [debtor.street, debtor.buildingNumber].filter(Boolean).join(" ").trim();
  if (st) lines.push(st);
  lines.push(`${debtor.postalCode} ${debtor.town}`);
  return lines;
};

const formatDateCH = (iso: string): string => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Referansı görüntü için gruplar (QRR: 5'li, SCOR/RF: 4'lü). */
const formatReferenceDisplay = (ref: string): string => {
  const r = ref.replace(/\s+/g, "");
  if (/^RF/i.test(r)) return r.replace(/(.{4})/g, "$1 ").trim();
  return r.replace(/(.{5})/g, "$1 ").trim();
};

const creditorLines = (c: RechnungCompany): string[] => {
  const streetLine = [c.street, c.house_number].filter(Boolean).join(" ").trim();
  return [c.company_name, streetLine, `${c.plz} ${c.city}`.trim()].filter((l) => l.length > 0);
};

// ── QR-Bill ödeme dilimi (alttaki 105mm) ─────────────────────────────────────

const PP_TOP = A4_H - 105; // 192 — ödeme dilimi üst kenarı
const RECEIPT_X = 5;
const SEP_X = 62; // Empfangsschein / Zahlteil ayracı
const ZAHLTEIL_X = SEP_X + 5; // 67 — Zahlteil sol içerik
const INFO_X = 118; // Zahlteil sağ bilgi sütunu
const QR_SIZE = 46;
const QR_X = ZAHLTEIL_X;
const QR_Y = PP_TOP + 17; // başlık altında

const setFont = (doc: jsPDF, size: number, style: "normal" | "bold"): void => {
  doc.setFont(FONT, style);
  doc.setFontSize(size);
};

/** QR ortasına İsviçre çaprazı (7×7mm siyah kare + beyaz haç). */
const drawSwissCross = (doc: jsPDF): void => {
  const c = 7;
  const cx = QR_X + QR_SIZE / 2;
  const cy = QR_Y + QR_SIZE / 2;
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - c / 2, cy - c / 2, c, c, "F");
  doc.setFillColor(255, 255, 255);
  // beyaz haç (dikey + yatay kollar)
  const armLong = 4.4;
  const armShort = 1.2;
  doc.rect(cx - armShort / 2, cy - armLong / 2, armShort, armLong, "F");
  doc.rect(cx - armLong / 2, cy - armShort / 2, armLong, armShort, "F");
  doc.setFillColor(0, 0, 0);
};

const drawReceipt = (doc: jsPDF, data: RechnungData, refType: string, reference: string, debtor?: QrBillAddress): void => {
  let y = PP_TOP + 7;
  setFont(doc, 11, "bold");
  doc.text("Empfangsschein", RECEIPT_X, y);
  y += 7;

  setFont(doc, 6, "bold");
  doc.text("Konto / Zahlbar an", RECEIPT_X, y);
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
    doc.text("Referenz", RECEIPT_X, y);
    y += 3;
    setFont(doc, 8, "normal");
    doc.text(formatReferenceDisplay(reference), RECEIPT_X, y);
    y += 3;
  }

  y += 1;
  setFont(doc, 6, "bold");
  doc.text("Zahlbar durch", RECEIPT_X, y);
  y += 3;
  setFont(doc, 8, "normal");
  for (const line of debtorLines(data, debtor)) {
    doc.text(line, RECEIPT_X, y);
    y += 3;
  }

  // Währung / Betrag (alt blok)
  const amountY = PP_TOP + 80;
  setFont(doc, 6, "bold");
  doc.text("Währung", RECEIPT_X, amountY);
  doc.text("Betrag", RECEIPT_X + 16, amountY);
  setFont(doc, 8, "normal");
  doc.text(data.currency ?? "CHF", RECEIPT_X, amountY + 4);
  doc.text(formatAmount(data.total), RECEIPT_X + 16, amountY + 4);

  // Annahmestelle (sağ alt)
  setFont(doc, 6, "bold");
  doc.text("Annahmestelle", SEP_X - 5, PP_TOP + 92, { align: "right" });
};

const drawZahlteil = (doc: jsPDF, data: RechnungData, qrPng: string, refType: string, reference: string, debtor?: QrBillAddress): void => {
  // Başlık
  setFont(doc, 11, "bold");
  doc.text("Zahlteil", ZAHLTEIL_X, PP_TOP + 7);

  // QR + İsviçre çaprazı
  doc.addImage(qrPng, "PNG", QR_X, QR_Y, QR_SIZE, QR_SIZE);
  drawSwissCross(doc);

  // Währung / Betrag (QR altında)
  const amountY = QR_Y + QR_SIZE + 6;
  setFont(doc, 8, "bold");
  doc.text("Währung", ZAHLTEIL_X, amountY);
  doc.text("Betrag", ZAHLTEIL_X + 18, amountY);
  setFont(doc, 10, "normal");
  doc.text(data.currency ?? "CHF", ZAHLTEIL_X, amountY + 5);
  doc.text(formatAmount(data.total), ZAHLTEIL_X + 18, amountY + 5);

  // Sağ bilgi sütunu
  let y = PP_TOP + 7;
  setFont(doc, 8, "bold");
  doc.text("Konto / Zahlbar an", INFO_X, y);
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
    doc.text("Referenz", INFO_X, y);
    y += 4;
    setFont(doc, 10, "normal");
    doc.text(formatReferenceDisplay(reference), INFO_X, y);
    y += 4;
  }

  const msg = data.message?.trim() || `Rechnung ${data.rechnung_nr}`;
  y += 2;
  setFont(doc, 8, "bold");
  doc.text("Zusätzliche Informationen", INFO_X, y);
  y += 4;
  setFont(doc, 10, "normal");
  doc.text(doc.splitTextToSize(msg, A4_W - INFO_X - 5), INFO_X, y);

  y = PP_TOP + 56;
  setFont(doc, 8, "bold");
  doc.text("Zahlbar durch", INFO_X, y);
  y += 4;
  setFont(doc, 10, "normal");
  for (const line of debtorLines(data, debtor)) {
    doc.text(line, INFO_X, y);
    y += 4;
  }
};

const drawQrBill = async (doc: jsPDF, data: RechnungData): Promise<void> => {
  const iban = data.qr_iban || data.company.iban;
  const reference = data.qr_referenz?.replace(/\s+/g, "") ?? "";
  // QRR yalnız QR-IBAN ile geçerli; düz IBAN + QRR → buildQrPayload hata verir.
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
    message: data.message?.trim() || `Rechnung ${data.rechnung_nr}`,
    reference: reference || undefined,
  };

  const payload = buildQrPayload(input);
  const qrPng = await renderQrPng(payload);

  // Norm: kesme uyarısı + makas çizgisi + dikey ayraç
  setFont(doc, 8, "normal");
  doc.text("Vor der Einzahlung abzutrennen", A4_W / 2, PP_TOP - 2, { align: "center" });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.line(0, PP_TOP, A4_W, PP_TOP);
  doc.line(SEP_X, PP_TOP, SEP_X, A4_H);

  drawReceipt(doc, data, refType, reference, debtor);
  drawZahlteil(doc, data, qrPng, refType, reference, debtor);
};

// ── Fatura gövdesi (üst kısım) ───────────────────────────────────────────────

const LOGO_MAX_W = 55;
const LOGO_MAX_H = 20;

const drawInvoiceBody = (doc: jsPDF, data: RechnungData, logoBase64: string | null): void => {
  const c = data.company;

  // Firma başlığı (sol üst): logo varsa görsel, yoksa firma adı text (fallback)
  let headerBottom = MARGIN + 8;
  let logoDrawn = false;
  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const scale = Math.min(LOGO_MAX_W / props.width, LOGO_MAX_H / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(logoBase64, "PNG", MARGIN, MARGIN, w, h);
      headerBottom = MARGIN + h;
      logoDrawn = true;
    } catch {
      logoDrawn = false; // sessiz fallback → text
    }
  }
  if (!logoDrawn) {
    setFont(doc, 16, "bold");
    doc.text(c.company_name, MARGIN, MARGIN + 4);
    headerBottom = MARGIN + 8;
  }

  // Firma iletişim bilgileri (sağ üst)
  setFont(doc, 8, "normal");
  const headerInfo = [
    logoDrawn ? c.company_name : "",
    [c.street, c.house_number].filter(Boolean).join(" "),
    `${c.plz} ${c.city}`,
    c.phone ? `Tel: ${c.phone}` : "",
    c.email ?? "",
    c.mwst_number ? `MwSt: ${/mwst/i.test(c.mwst_number) ? c.mwst_number : `${c.mwst_number} MWST`}` : "",
  ].filter((l) => l && l.trim().length > 0);
  let infoY = MARGIN;
  for (const line of headerInfo) {
    doc.text(line, A4_W - MARGIN, infoY, { align: "right" });
    infoY += 4;
  }

  let y = Math.max(headerBottom, infoY) + 8;
  // Başlık + numara
  setFont(doc, 14, "bold");
  doc.text("RECHNUNG", MARGIN, y);
  setFont(doc, 11, "normal");
  doc.text(data.rechnung_nr, A4_W - MARGIN, y, { align: "right" });
  y += 8;

  // Müşteri adresi (sol) + meta (sağ)
  setFont(doc, 10, "bold");
  doc.text(data.customer_name, MARGIN, y);
  setFont(doc, 9, "normal");
  let custY = y + 5;
  if (data.customer_address) {
    for (const line of data.customer_address.split("\n")) {
      doc.text(line, MARGIN, custY);
      custY += 4;
    }
  }

  setFont(doc, 9, "normal");
  const meta = [
    `Rechnungsdatum: ${formatDateCH(data.datum)}`,
    `Fällig am: ${formatDateCH(data.faellig_am)}`,
  ];
  let metaY = y;
  for (const line of meta) {
    doc.text(line, A4_W - MARGIN, metaY, { align: "right" });
    metaY += 4;
  }

  y = Math.max(custY, metaY) + 6;

  // Kalem tablosu
  autoTable(doc, {
    startY: y,
    head: [["Beschreibung", "Menge", "Einzelpreis", "Betrag"]],
    body: data.positionen.map((p) => [
      p.beschreibung,
      typeof p.menge === "number" ? `${p.menge}${p.einheit ? " " + p.einheit : ""}` : "",
      typeof p.einzelpreis === "number" ? formatAmountCH(p.einzelpreis) : "",
      formatAmountCH(p.betrag),
    ]),
    styles: { font: FONT, fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, halign: "left" },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right", cellWidth: 22 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // Toplamlar
  let ty = doc.lastAutoTable.finalY + 6;
  const labelX = A4_W - MARGIN - 60;
  const valX = A4_W - MARGIN;
  const totalRow = (label: string, value: string, bold = false): void => {
    setFont(doc, 10, bold ? "bold" : "normal");
    doc.text(label, labelX, ty);
    doc.text(value, valX, ty, { align: "right" });
    ty += 5;
  };
  totalRow("Zwischensumme", `${data.currency ?? "CHF"} ${formatAmountCH(data.zwischensumme)}`);
  // MwSt-Zeile nur bei aktiver Steuer (Satz > 0); ohne MwSt = Zwischensumme entspricht Total.
  if (data.mwst_satz > 0) {
    totalRow(`MwSt ${data.mwst_satz}%`, `${data.currency ?? "CHF"} ${formatAmountCH(data.mwst_betrag)}`);
  }
  totalRow("Total", `${data.currency ?? "CHF"} ${formatAmountCH(data.total)}`, true);

  ty += 4;
  setFont(doc, 9, "normal");
  // Gün sayısı sabit değil — datum↔faellig gerçek farkından (yoksa "30 Tagen" yazıp
  // 29 günlük tarih basmak gibi kendi içinde çelişkili olur).
  const dueDays = Math.round(
    (new Date(data.faellig_am + "T00:00:00").getTime() - new Date(data.datum + "T00:00:00").getTime()) / 86_400_000,
  );
  doc.text(
    dueDays > 0
      ? `Zahlbar innert ${dueDays} Tagen, bis ${formatDateCH(data.faellig_am)}.`
      : `Zahlbar bis ${formatDateCH(data.faellig_am)}.`,
    MARGIN,
    ty,
  );
};

// ── Genel API ────────────────────────────────────────────────────────────────

/**
 * Fatura PDF'ini kurar ve jsPDF doc'unu döner (download veya base64 için).
 * logoBase64 (PNG data URL) UI katmanında çözülür — Katman 3 DB/storage bilmez.
 */
export const buildRechnungDoc = async (
  data: RechnungData,
  logoBase64: string | null = null,
): Promise<jsPDF> => {
  const doc = new jsPDF(); // mm, A4 portrait
  drawInvoiceBody(doc, data, logoBase64);
  await drawQrBill(doc, data);
  return doc;
};

/** Fatura PDF'ini tarayıcıda indirir. */
export const downloadRechnungPdf = async (
  data: RechnungData,
  logoBase64: string | null = null,
): Promise<void> => {
  const doc = await buildRechnungDoc(data, logoBase64);
  doc.save(`${data.rechnung_nr}.pdf`);
};
