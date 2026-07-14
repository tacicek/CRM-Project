import jsPDF from "jspdf";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import { formatCurrency, formatDate } from "@/i18n/format";
import type { MessageKey, Translator } from "@/i18n/translator";

// =============================================================================
// INTERFACES
// =============================================================================

interface BoxItem {
  type: string;
  quantity: number;
}

interface CompanyInfo {
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email: string;
  website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
}

interface BoxRentalData {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  // Delivery address - where boxes are delivered TO (old home)
  delivery_address?: string | null;
  delivery_plz?: string | null;
  delivery_city?: string | null;
  // Pickup address - where boxes will be collected FROM (new home)
  pickup_address?: string | null;
  pickup_plz?: string | null;
  pickup_city?: string | null;
  box_items: BoxItem[] | null;
  box_quantity?: number;
  box_type?: string;
  box_description?: string | null;
  is_rental: boolean;
  rental_price_per_day?: number | null;
  deposit_amount?: number | null;
  deposit_paid: boolean;
  delivery_date: string;
  expected_return_date?: string | null;
  status: string;
  internal_notes?: string | null;
  customer_notes?: string | null;
  created_at: string;
  /**
   * The CUSTOMER's language. The box rental table carries no `language` column, so the
   * caller resolves it with `resolveDocumentLocale(rental, company)` — which falls back
   * to `companies.default_language` (see the report note).
   */
  locale: Locale;
  company: CompanyInfo;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const dateOrDash = (dateString: string | undefined | null, locale: Locale): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDate(date, locale);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [59, 130, 246]; // Default blue
};

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** DB status value → catalog key (the catalog keys are named after the German wording). */
const STATUS_KEYS: Record<string, MessageKey> = {
  reserved: "doc.boxes.status.reserviert",
  delivered: "doc.boxes.status.geliefert",
  in_use: "doc.boxes.status.in_gebrauch",
  pickup_requested: "doc.boxes.status.abholung_angefragt",
  pickup_scheduled: "doc.boxes.status.abholung_geplant",
  returned: "doc.boxes.status.zurueckgegeben",
  lost: "doc.boxes.status.verloren",
  damaged: "doc.boxes.status.beschaedigt",
};

const BOX_TYPE_KEYS: Record<string, MessageKey> = {
  standard: "doc.boxes.type.standard",
  wardrobe: "doc.boxes.type.kleiderbox",
  book: "doc.boxes.type.buecherbox",
  fragile: "doc.boxes.type.fragile",
  archive: "doc.boxes.type.archivbox",
  other: "doc.boxes.type.andere",
};

// An unknown value is printed raw — better a visible code than a blank cell.
const getStatusLabel = (status: string, t: Translator): string => {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
};

const getBoxTypeLabel = (type: string, t: Translator): string => {
  const key = BOX_TYPE_KEYS[type];
  return key ? t(key) : type;
};

const getTotalBoxQuantity = (rental: BoxRentalData): number => {
  if (rental.box_items && Array.isArray(rental.box_items)) {
    return rental.box_items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }
  return rental.box_quantity || 0;
};

// =============================================================================
// MAIN PDF GENERATOR
// =============================================================================

export const generateBoxRentalPdf = async (rental: BoxRentalData): Promise<void> => {
  // Customer language — the delivery note is signed by the customer on site.
  const locale = rental.locale;
  const { t } = documentI18nFor(locale);
  const chf = (amount: number): string => formatCurrency(amount, locale);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const footerHeight = 30;
  const contentBottom = pageHeight - footerHeight;
  const fontFamily = "helvetica";

  // Get primary color for accent lines
  const primaryColor = rental.company.primary_color || "#3b82f6";
  const primaryRgb = hexToRgb(primaryColor);

  // Load logo if available
  let logoBase64: string | null = null;
  if (rental.company.logo_url) {
    logoBase64 = await loadImageAsBase64(rental.company.logo_url);
  }

  // Helper: Draw section header with full-width thin underline
  const drawSectionHeader = (title: string, y: number): number => {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(title, margin, y);
    
    // Thin full-width colored underline
    doc.setDrawColor(...primaryRgb);
    doc.setLineWidth(0.4);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    
    return y + 10;
  };

  // Helper function to add footer
  const addFooter = () => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

    doc.setFontSize(7);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(120, 120, 120);

    const phone = rental.company.phone?.replace(/\s+/g, "").trim() || "";
    const footerLine1 = `${rental.company.company_name} | ${rental.company.email}${phone ? " | " + t("doc.workorder.phone") + phone : ""}`;
    const street = rental.company.street || "";
    const houseNumber = rental.company.house_number || "";
    const footerLine2 = `${street} ${houseNumber}, ${rental.company.plz} ${rental.company.city}`;

    doc.text(footerLine1, pageWidth / 2, pageHeight - 16, { align: "center" });
    doc.text(footerLine2, pageWidth / 2, pageHeight - 12, { align: "center" });
  };

  // Helper to check for page break
  const checkPageBreak = (yPos: number, neededHeight: number): number => {
    if (yPos + neededHeight > contentBottom) {
      addFooter();
      doc.addPage();
      return 25;
    }
    return yPos;
  };

  let yPos = 20;

  // =============================================================================
  // HEADER SECTION
  // =============================================================================

  // Logo on the left - with better quality settings
  if (logoBase64) {
    try {
      // Use SLOW compression for better quality
      doc.addImage(logoBase64, "PNG", margin, yPos, 45, 20, undefined, "SLOW");
    } catch {
      doc.setFontSize(16);
      doc.setFont(fontFamily, "bold");
      doc.setTextColor(...primaryRgb);
      doc.text(rental.company.company_name, margin, yPos + 12);
    }
  } else {
    doc.setFontSize(16);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(...primaryRgb);
    doc.text(rental.company.company_name, margin, yPos + 12);
  }

  // Company info on the right - clean single block
  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(80, 80, 80);

  // Build address as single block
  const addressLine = rental.company.street 
    ? `${rental.company.street} ${rental.company.house_number || ""}, ${rental.company.plz} ${rental.company.city}`
    : `${rental.company.plz} ${rental.company.city}`;
  
  let infoY = yPos + 5;
  const infoX = pageWidth - margin;

  doc.text(addressLine, infoX, infoY, { align: "right" });
  infoY += 4;
  
  // Contact on one line - clean phone number format
  const cleanPhone = rental.company.phone?.replace(/\s+/g, "").trim() || "";
  const contactLine = cleanPhone
    ? `${t("doc.workorder.phone")}${cleanPhone} | ${rental.company.email}`
    : rental.company.email;
  doc.text(contactLine, infoX, infoY, { align: "right" });

  yPos += 28;

  // Thin separator line
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 10;

  // =============================================================================
  // DOCUMENT TITLE
  // =============================================================================

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(t("doc.boxes.title"), margin, yPos);

  // Status on the right
  const statusLabel = getStatusLabel(rental.status, t);
  doc.setFontSize(10);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${t("doc.boxes.status")}${statusLabel}`, pageWidth - margin, yPos, { align: "right" });

  yPos += 12;

  // =============================================================================
  // CUSTOMER SECTION
  // =============================================================================

  yPos = drawSectionHeader(t("doc.boxes.customer"), yPos);

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`${rental.customer_first_name} ${rental.customer_last_name}`, margin, yPos);
  yPos += 5;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  if (rental.customer_phone) {
    doc.text(`${t("doc.contact.phone")}${rental.customer_phone}`, margin, yPos);
    yPos += 4;
  }
  if (rental.customer_email) {
    doc.text(`${t("doc.contact.email")}${rental.customer_email}`, margin, yPos);
    yPos += 4;
  }

  yPos += 8;

  // =============================================================================
  // ADDRESSES SECTION
  // =============================================================================

  yPos = drawSectionHeader(t("doc.boxes.addresses"), yPos);

  const addressColWidth = (pageWidth - margin * 2 - 20) / 2;

  // Left - Delivery Address
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(t("doc.boxes.deliveryAddress"), margin, yPos);
  
  let deliveryY = yPos + 5;
  doc.setFont(fontFamily, "normal");
  
  if (rental.delivery_address) {
    doc.text(rental.delivery_address, margin, deliveryY);
    deliveryY += 4;
  }
  if (rental.delivery_plz || rental.delivery_city) {
    doc.text(`${rental.delivery_plz || ""} ${rental.delivery_city || ""}`.trim(), margin, deliveryY);
    deliveryY += 4;
  }
  if (!rental.delivery_address && !rental.delivery_city) {
    doc.setTextColor(150, 150, 150);
    doc.text(t("doc.boxes.notSpecified"), margin, deliveryY);
    doc.setTextColor(60, 60, 60);
    deliveryY += 4;
  }

  // Right - Pickup Address
  const pickupX = margin + addressColWidth + 20;
  doc.setFont(fontFamily, "bold");
  doc.text(t("doc.boxes.pickupAddress"), pickupX, yPos);
  
  let pickupY = yPos + 5;
  doc.setFont(fontFamily, "normal");
  
  if (rental.pickup_address) {
    doc.text(rental.pickup_address, pickupX, pickupY);
    pickupY += 4;
  }
  if (rental.pickup_plz || rental.pickup_city) {
    doc.text(`${rental.pickup_plz || ""} ${rental.pickup_city || ""}`.trim(), pickupX, pickupY);
    pickupY += 4;
  }
  if (!rental.pickup_address && !rental.pickup_city) {
    doc.setTextColor(150, 150, 150);
    doc.text(t("doc.boxes.notYetSpecified"), pickupX, pickupY);
    doc.setTextColor(60, 60, 60);
    pickupY += 4;
  }

  yPos = Math.max(deliveryY, pickupY) + 8;

  // =============================================================================
  // DATES SECTION
  // =============================================================================

  yPos = checkPageBreak(yPos, 30);
  yPos = drawSectionHeader(t("doc.boxes.appointments"), yPos);

  const dateColWidth = (pageWidth - margin * 2) / 3;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  // Delivery date
  doc.setFont(fontFamily, "bold");
  doc.text(t("doc.boxes.deliveryDate"), margin, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(dateOrDash(rental.delivery_date, locale), margin, yPos + 5);

  // Return date
  doc.setFont(fontFamily, "bold");
  doc.text(t("doc.boxes.returnDate"), margin + dateColWidth, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(dateOrDash(rental.expected_return_date, locale), margin + dateColWidth, yPos + 5);

  // Rental type
  doc.setFont(fontFamily, "bold");
  doc.text(t("doc.boxes.kind"), margin + dateColWidth * 2, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(
    rental.is_rental ? t("doc.boxes.rental") : t("doc.boxes.purchase"),
    margin + dateColWidth * 2,
    yPos + 5
  );

  yPos += 18;

  // =============================================================================
  // BOX ITEMS TABLE
  // =============================================================================

  yPos = checkPageBreak(yPos, 50);
  yPos = drawSectionHeader(t("doc.boxes.overview"), yPos);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 2, pageWidth - margin * 2, 8, "F");

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const col1 = margin + 3;
  const col2 = margin + 90;
  const col3 = pageWidth - margin - 20;

  doc.text(t("doc.boxes.col.type"), col1, yPos + 4);
  doc.text(t("doc.boxes.col.count"), col2, yPos + 4);
  doc.text(t("doc.boxes.col.status"), col3, yPos + 4, { align: "right" });

  yPos += 10;

  // Table rows
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  if (rental.box_items && rental.box_items.length > 0) {
    rental.box_items.forEach((item, idx) => {
      yPos = checkPageBreak(yPos, 7);

      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 3, pageWidth - margin * 2, 6, "F");
      }

      doc.setTextColor(40, 40, 40);
      doc.text(getBoxTypeLabel(item.type, t), col1, yPos);
      doc.text(`${item.quantity} ${t("domain.unit.piece")}`, col2, yPos);
      doc.setTextColor(34, 197, 94); // Green checkmark color
      doc.text("OK", col3, yPos, { align: "right" });

      yPos += 6;
    });
  } else if (rental.box_quantity) {
    doc.text(
      rental.box_type ? getBoxTypeLabel(rental.box_type, t) : t("doc.boxes.type.standard"),
      col1,
      yPos
    );
    doc.text(`${rental.box_quantity} ${t("domain.unit.piece")}`, col2, yPos);
    doc.setTextColor(34, 197, 94);
    doc.text("OK", col3, yPos, { align: "right" });
    yPos += 6;
  }

  // Total row
  yPos += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryRgb);
  doc.text(t("doc.boxes.total"), col1, yPos);
  doc.text(`${getTotalBoxQuantity(rental)} ${t("doc.boxes.unit")}`, col2, yPos);

  yPos += 12;

  // =============================================================================
  // PRICING SECTION (if rental)
  // =============================================================================

  if (rental.is_rental && (rental.rental_price_per_day || rental.deposit_amount)) {
    yPos = checkPageBreak(yPos, 30);
    yPos = drawSectionHeader(t("doc.boxes.costs"), yPos);

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    if (rental.rental_price_per_day) {
      doc.text(`${t("doc.boxes.pricePerDay")}${chf(rental.rental_price_per_day)}`, margin, yPos);
      yPos += 5;
    }

    if (rental.deposit_amount) {
      const depositStatus = rental.deposit_paid ? t("doc.boxes.paid") : t("doc.boxes.unpaid");
      const depositColor = rental.deposit_paid ? [34, 197, 94] : [220, 38, 38];

      doc.text(`${t("doc.boxes.deposit")}${chf(rental.deposit_amount)}`, margin, yPos);
      doc.setTextColor(depositColor[0], depositColor[1], depositColor[2]);
      doc.text(` ${depositStatus}`, margin + 45, yPos);
      doc.setTextColor(60, 60, 60);
      yPos += 5;
    }

    yPos += 8;
  }

  // =============================================================================
  // NOTES SECTION
  // =============================================================================

  if (rental.box_description || rental.customer_notes) {
    yPos = checkPageBreak(yPos, 30);
    yPos = drawSectionHeader(t("doc.boxes.remarks"), yPos);

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    if (rental.box_description) {
      const descLines = doc.splitTextToSize(rental.box_description, pageWidth - margin * 2);
      descLines.forEach((line: string) => {
        yPos = checkPageBreak(yPos, 5);
        doc.text(line, margin, yPos);
        yPos += 4;
      });
    }

    if (rental.customer_notes) {
      yPos += 2;
      doc.setFont(fontFamily, "bold");
      doc.text(t("doc.boxes.customerNotes"), margin, yPos);
      yPos += 4;
      doc.setFont(fontFamily, "normal");
      const noteLines = doc.splitTextToSize(rental.customer_notes, pageWidth - margin * 2);
      noteLines.forEach((line: string) => {
        yPos = checkPageBreak(yPos, 5);
        doc.text(line, margin, yPos);
        yPos += 4;
      });
    }

    yPos += 8;
  }

  // =============================================================================
  // SIGNATURE SECTION
  // =============================================================================

  yPos = checkPageBreak(yPos, 50);
  yPos += 5;

  const signatureWidth = (pageWidth - margin * 3) / 2;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  doc.text(t("doc.workorder.placeDate"), margin, yPos);
  doc.text(t("doc.workorder.placeDate"), margin + signatureWidth + margin, yPos);
  yPos += 12;

  // Signature lines
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + signatureWidth, yPos);
  doc.line(margin + signatureWidth + margin, yPos, pageWidth - margin, yPos);

  yPos += 5;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(t("doc.boxes.signature.customer"), margin, yPos);
  doc.text(t("doc.boxes.signature.supplier"), margin + signatureWidth + margin, yPos);
  yPos += 4;

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`(${rental.customer_first_name} ${rental.customer_last_name})`, margin, yPos);
  doc.text(`(${rental.company.company_name})`, margin + signatureWidth + margin, yPos);

  // =============================================================================
  // TERMS SECTION
  // =============================================================================

  yPos += 12;
  yPos = checkPageBreak(yPos, 25);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - margin * 2, 20, "S");

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(t("doc.boxes.terms"), margin + 3, yPos + 5);

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(t("doc.boxes.terms.care"), margin + 3, yPos + 10);
  doc.text(t("doc.boxes.terms.damage"), margin + 3, yPos + 14);
  doc.text(t("doc.boxes.terms.return"), margin + 3, yPos + 18);

  // =============================================================================
  // ADD FOOTER AND FINALIZE
  // =============================================================================

  addFooter();

  // Save PDF
  const customerName = `${rental.customer_first_name}_${rental.customer_last_name}`.replace(/\s+/g, "_");
  // Locale-formatted dates use "/" in fr/en — strip every separator so the filename stays valid.
  const datePart = dateOrDash(rental.delivery_date, locale).replace(/[./\s]/g, "-");
  const fileName = `Boxen_Lieferschein_${customerName}_${datePart}.pdf`;
  doc.save(fileName);
};

export default generateBoxRentalPdf;
