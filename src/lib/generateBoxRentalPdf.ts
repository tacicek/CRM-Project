import jsPDF from "jspdf";

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
  company: CompanyInfo;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(amount);
};

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    reserved: "Reserviert",
    delivered: "Geliefert",
    in_use: "In Gebrauch",
    pickup_requested: "Abholung angefragt",
    pickup_scheduled: "Abholung geplant",
    returned: "Zurückgegeben",
    lost: "Verloren",
    damaged: "Beschädigt",
  };
  return statusMap[status] || status;
};

const getBoxTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    standard: "Standard",
    wardrobe: "Kleiderbox",
    book: "Bücherbox",
    fragile: "Fragile",
    archive: "Archivbox",
    other: "Andere",
  };
  return typeMap[type] || type;
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
    const footerLine1 = `${rental.company.company_name} | ${rental.company.email}${phone ? " | Tel: " + phone : ""}`;
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
    ? `Tel: ${cleanPhone} | ${rental.company.email}`
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
  doc.text("BOXEN-LIEFERSCHEIN", margin, yPos);

  // Status on the right
  const statusLabel = getStatusLabel(rental.status);
  doc.setFontSize(10);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Status: ${statusLabel}`, pageWidth - margin, yPos, { align: "right" });

  yPos += 12;

  // =============================================================================
  // CUSTOMER SECTION
  // =============================================================================

  yPos = drawSectionHeader("Kunde", yPos);

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`${rental.customer_first_name} ${rental.customer_last_name}`, margin, yPos);
  yPos += 5;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  if (rental.customer_phone) {
    doc.text(`Telefon: ${rental.customer_phone}`, margin, yPos);
    yPos += 4;
  }
  if (rental.customer_email) {
    doc.text(`E-Mail: ${rental.customer_email}`, margin, yPos);
    yPos += 4;
  }

  yPos += 8;

  // =============================================================================
  // ADDRESSES SECTION
  // =============================================================================

  yPos = drawSectionHeader("Adressen", yPos);

  const addressColWidth = (pageWidth - margin * 2 - 20) / 2;

  // Left - Delivery Address
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text("Lieferadresse (Boxen hinbringen)", margin, yPos);
  
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
    doc.text("Nicht angegeben", margin, deliveryY);
    doc.setTextColor(60, 60, 60);
    deliveryY += 4;
  }

  // Right - Pickup Address
  const pickupX = margin + addressColWidth + 20;
  doc.setFont(fontFamily, "bold");
  doc.text("Abholadresse (Boxen abholen)", pickupX, yPos);
  
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
    doc.text("Noch nicht angegeben", pickupX, pickupY);
    doc.setTextColor(60, 60, 60);
    pickupY += 4;
  }

  yPos = Math.max(deliveryY, pickupY) + 8;

  // =============================================================================
  // DATES SECTION
  // =============================================================================

  yPos = checkPageBreak(yPos, 30);
  yPos = drawSectionHeader("Termine", yPos);

  const dateColWidth = (pageWidth - margin * 2) / 3;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  // Delivery date
  doc.setFont(fontFamily, "bold");
  doc.text("Lieferdatum:", margin, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(formatDate(rental.delivery_date), margin, yPos + 5);

  // Return date
  doc.setFont(fontFamily, "bold");
  doc.text("Rückgabe geplant:", margin + dateColWidth, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(formatDate(rental.expected_return_date), margin + dateColWidth, yPos + 5);

  // Rental type
  doc.setFont(fontFamily, "bold");
  doc.text("Art:", margin + dateColWidth * 2, yPos);
  doc.setFont(fontFamily, "normal");
  doc.text(rental.is_rental ? "Miete" : "Kauf/Verkauf", margin + dateColWidth * 2, yPos + 5);

  yPos += 18;

  // =============================================================================
  // BOX ITEMS TABLE
  // =============================================================================

  yPos = checkPageBreak(yPos, 50);
  yPos = drawSectionHeader("Boxen-Übersicht", yPos);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 2, pageWidth - margin * 2, 8, "F");

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const col1 = margin + 3;
  const col2 = margin + 90;
  const col3 = pageWidth - margin - 20;

  doc.text("Box-Typ", col1, yPos + 4);
  doc.text("Anzahl", col2, yPos + 4);
  doc.text("Status", col3, yPos + 4, { align: "right" });

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
      doc.text(getBoxTypeLabel(item.type), col1, yPos);
      doc.text(`${item.quantity} Stück`, col2, yPos);
      doc.setTextColor(34, 197, 94); // Green checkmark color
      doc.text("OK", col3, yPos, { align: "right" });

      yPos += 6;
    });
  } else if (rental.box_quantity) {
    doc.text(rental.box_type ? getBoxTypeLabel(rental.box_type) : "Standard", col1, yPos);
    doc.text(`${rental.box_quantity} Stück`, col2, yPos);
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
  doc.text("Gesamt:", col1, yPos);
  doc.text(`${getTotalBoxQuantity(rental)} Boxen`, col2, yPos);

  yPos += 12;

  // =============================================================================
  // PRICING SECTION (if rental)
  // =============================================================================

  if (rental.is_rental && (rental.rental_price_per_day || rental.deposit_amount)) {
    yPos = checkPageBreak(yPos, 30);
    yPos = drawSectionHeader("Kosten & Kaution", yPos);

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    if (rental.rental_price_per_day) {
      doc.text(`Mietpreis pro Tag: ${formatCurrency(rental.rental_price_per_day)}`, margin, yPos);
      yPos += 5;
    }

    if (rental.deposit_amount) {
      const depositStatus = rental.deposit_paid ? "(Bezahlt)" : "(Offen)";
      const depositColor = rental.deposit_paid ? [34, 197, 94] : [220, 38, 38];
      
      doc.text(`Kaution: ${formatCurrency(rental.deposit_amount)}`, margin, yPos);
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
    yPos = drawSectionHeader("Bemerkungen", yPos);

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
      doc.text("Kundenhinweise:", margin, yPos);
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

  doc.text("Ort, Datum:", margin, yPos);
  doc.text("Ort, Datum:", margin + signatureWidth + margin, yPos);
  yPos += 12;

  // Signature lines
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + signatureWidth, yPos);
  doc.line(margin + signatureWidth + margin, yPos, pageWidth - margin, yPos);

  yPos += 5;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Unterschrift Kunde", margin, yPos);
  doc.text("Unterschrift Lieferant", margin + signatureWidth + margin, yPos);
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
  doc.text("Mietbedingungen:", margin + 3, yPos + 5);

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Die Boxen sind sorgfältig zu behandeln und vor Beschädigungen zu schützen.", margin + 3, yPos + 10);
  doc.text("Bei Verlust oder Beschädigung wird der Wiederbeschaffungswert berechnet.", margin + 3, yPos + 14);
  doc.text("Die Rückgabe hat am vereinbarten Termin zu erfolgen.", margin + 3, yPos + 18);

  // =============================================================================
  // ADD FOOTER AND FINALIZE
  // =============================================================================

  addFooter();

  // Save PDF
  const customerName = `${rental.customer_first_name}_${rental.customer_last_name}`.replace(/\s+/g, "_");
  const fileName = `Boxen_Lieferschein_${customerName}_${formatDate(rental.delivery_date).replace(/\./g, "-")}.pdf`;
  doc.save(fileName);
};

export default generateBoxRentalPdf;
