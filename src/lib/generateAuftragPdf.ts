import jsPDF from "jspdf";

// =============================================================================
// INTERFACES
// =============================================================================

interface OfferItem {
  id?: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number | null;
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
  mwst_number?: string | null;
  iban?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  signature_url?: string | null;
}

interface TeamMember {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
}

interface ExtraService {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface AuftragData {
  id: string;
  auftrag_nummer: string;
  title: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  scheduled_date: string;
  scheduled_time?: string | null;
  estimated_duration_minutes?: number | null;
  description?: string | null;
  special_instructions?: string | null;
  status: string;
  service_type?: string | null;
  pricing_type?: "fixed" | "hourly" | "estimate" | null;
  hourly_rate?: number | null;
  subtotal?: number | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
  total?: number | null;
  items?: OfferItem[];
  extra_services?: ExtraService[];
  service_details?: Record<string, unknown>;
  team_leader?: TeamMember | null;
  assigned_team_members_data?: TeamMember[];
  company: CompanyInfo;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// CONSTANTS
// =============================================================================

const PDF_CONSTANTS = {
  MARGIN: 20,
  FOOTER_HEIGHT: 35,
  SIGNATURE_SECTION_HEIGHT: 55,
  FIELD_EXTRAS_HEIGHT: 130,
  BLANK_ROW_HEIGHT: 9,
  ROW_PADDING: 4,
  ROW_GAP: 2,
  IMAGE_TIMEOUT_MS: 5000,
  DEFAULT_VAT_RATE: 8.1,
} as const;

const DEFAULT_PRIMARY_COLOR: [number, number, number] = [59, 130, 246]; // Blue

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatCurrency = (amount: number): string => {
  // Handle NaN, undefined, null
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(safeAmount);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const formatTime = (timeString: string | undefined | null): string => {
  if (!timeString) return "-";
  // Validate format: expect at least HH:MM
  if (timeString.length < 5) return timeString;
  // Extract HH:MM safely
  const match = /^(\d{1,2}):(\d{2})/.exec(timeString);
  if (!match) return timeString;
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes} Uhr`;
};

const hexToRgb = (hex: string): [number, number, number] => {
  if (!hex || typeof hex !== 'string') return DEFAULT_PRIMARY_COLOR;
  
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');
  
  // Handle 3-character hex (e.g., #fff -> #ffffff)
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex.split('').map(c => c + c).join('');
  }
  
  // Validate 6-character hex
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : DEFAULT_PRIMARY_COLOR;
};

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
const sanitizeFileName = (name: string): string => {
  if (!name) return 'unnamed';
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid chars
    .replace(/\.\./g, '') // Prevent path traversal
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .slice(0, 50) // Limit length
    .trim() || 'unnamed';
};

interface ProcessedLogo {
  dataUrl: string;
  /** Display width in mm (aspect-ratio preserved, capped at MAX_W × MAX_H) */
  displayW: number;
  /** Display height in mm */
  displayH: number;
}

/**
 * Flatten an image onto a white canvas (JPEG, no transparency artefacts)
 * and return display dimensions that preserve the original aspect ratio.
 * Max area: 60 mm wide × 24 mm tall.
 */
const flattenImageToWhiteJpeg = (base64: string): Promise<ProcessedLogo> =>
  new Promise((resolve) => {
    const MAX_W = 60;
    const MAX_H = 24;

    const img = new Image();
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth  || img.width  || 1;
        const naturalH = img.naturalHeight || img.height || 1;

        // Scale to fit within MAX_W × MAX_H while preserving aspect ratio
        const scale = Math.min(MAX_W / naturalW, MAX_H / naturalH);
        const displayW = naturalW * scale;
        const displayH = naturalH * scale;

        const canvas = document.createElement("canvas");
        canvas.width  = naturalW;
        canvas.height = naturalH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl: base64, displayW: MAX_W, displayH: MAX_H });
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.95), displayW, displayH });
      } catch {
        resolve({ dataUrl: base64, displayW: MAX_W, displayH: MAX_H });
      }
    };
    img.onerror = () => resolve({ dataUrl: base64, displayW: MAX_W, displayH: MAX_H });
    img.src = base64;
  });

/**
 * Load image with timeout to prevent hanging
 */
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  if (!url || typeof url !== 'string') return null;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_CONSTANTS.IMAGE_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Check if response is ok
    if (!response.ok) {
      console.warn(`Image load failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Verify content type is an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`Invalid content type for image: ${contentType}`);
      return null;
    }
    
    const blob = await response.blob();
    
    // Limit image size (5MB max)
    if (blob.size > 5 * 1024 * 1024) {
      console.warn('Image too large, skipping');
      return null;
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Image load timed out');
    }
    return null;
  }
};

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    geplant: "Geplant",
    bestaetigt: "Bestätigt",
    in_bearbeitung: "In Bearbeitung",
    abgeschlossen: "Abgeschlossen",
    storniert: "Storniert",
  };
  return statusMap[status] || status;
};

const getServiceLabel = (serviceType: string): string => {
  const serviceMap: Record<string, string> = {
    umzug: "Umzug",
    reinigung: "Reinigung",
    klaviertransport: "Klaviertransport",
    raeumung: "Räumung",
    entsorgung: "Entsorgung",
    lagerung: "Lagerung",
    moebellift: "Möbellift",
  };
  return serviceMap[serviceType] || serviceType;
};

// =============================================================================
// MAIN PDF GENERATOR
// =============================================================================

export const generateAuftragPdf = async (auftrag: AuftragData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const footerHeight = 35; // Increased footer height for better spacing
  const contentBottom = pageHeight - footerHeight;
  const fontFamily = "helvetica";

  // Get primary color
  const primaryColor = auftrag.company.primary_color || "#3b82f6";
  const primaryRgb = hexToRgb(primaryColor);

  // Load logo if available — flatten to JPEG (no black transparency) and
  // preserve original aspect ratio within a capped display area.
  let logoBase64: string | null = null;
  let logoDisplayW = 55;
  let logoDisplayH = 20;
  if (auftrag.company.logo_url) {
    const raw = await loadImageAsBase64(auftrag.company.logo_url);
    if (raw) {
      const processed = await flattenImageToWhiteJpeg(raw);
      logoBase64   = processed.dataUrl;
      logoDisplayW = processed.displayW;
      logoDisplayH = processed.displayH;
    }
  }

  // Placeholder for total pages
  const totalPagesPlaceholder = "{total_pages}";

  // Helper function to add footer
  const addFooter = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    doc.setFontSize(7);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(120, 120, 120);

    const phone = auftrag.company.phone?.replace(/\s+/g, "").trim() || "";
    const footerLine1 = `${auftrag.company.company_name} | ${auftrag.company.email}${phone ? " | Tel: " + phone : ""}`;
    const street = auftrag.company.street || "";
    const houseNumber = auftrag.company.house_number || "";
    const footerLine2 = `${street}${houseNumber ? " " + houseNumber : ""}, ${auftrag.company.plz} ${auftrag.company.city}`;

    doc.text(footerLine1, pageWidth / 2, pageHeight - 20, { align: "center" });
    doc.text(footerLine2, pageWidth / 2, pageHeight - 15, { align: "center" });

    // Page number
    doc.setFontSize(8);
    const pageNumber = doc.getNumberOfPages();
    doc.text(
      `Seite ${pageNumber} von ${totalPagesPlaceholder}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: "center" }
    );
  };

  // Helper to check for page break
  const checkPageBreak = (yPos: number, neededHeight: number): number => {
    if (yPos + neededHeight > contentBottom) {
      addFooter();
      doc.addPage();
      return 30;
    }
    return yPos;
  };

  let yPos = 20;

  // =============================================================================
  // HEADER SECTION
  // =============================================================================

  // Logo on the left — JPEG with white bg, correct aspect ratio
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "JPEG", margin, yPos, logoDisplayW, logoDisplayH);
    } catch {
      // Fallback to company name if logo fails
      doc.setFontSize(16);
      doc.setFont(fontFamily, "bold");
      doc.setTextColor(...primaryRgb);
      doc.text(auftrag.company.company_name, margin, yPos + 12);
    }
  } else {
    doc.setFontSize(16);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(...primaryRgb);
    doc.text(auftrag.company.company_name, margin, yPos + 12);
  }

  // Company info on the right
  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(100, 100, 100);

  const companyInfoLines: string[] = [];
  if (auftrag.company.street) {
    const street  = auftrag.company.street.trim();
    const houseNr = (auftrag.company.house_number || "").trim();
    companyInfoLines.push(houseNr ? `${street} ${houseNr}` : street);
  }
  companyInfoLines.push(`${auftrag.company.plz} ${auftrag.company.city}`);
  if (auftrag.company.phone) {
    // Normalise: collapse multiple spaces so "Tel: +41 79..." looks clean
    const phone = auftrag.company.phone.replace(/\s+/g, " ").trim();
    companyInfoLines.push(`Tel. ${phone}`);
  }
  companyInfoLines.push(auftrag.company.email);
  if (auftrag.company.website) {
    companyInfoLines.push(auftrag.company.website);
  }

  let infoY = yPos + 5;
  companyInfoLines.forEach((line) => {
    doc.text(line, pageWidth - margin, infoY, { align: "right" });
    infoY += 4;
  });

  yPos = Math.max(yPos + logoDisplayH + 5, infoY + 5);

  // =============================================================================
  // AUFTRAG TITLE SECTION
  // =============================================================================

  // Colored header bar
  doc.setFillColor(...primaryRgb);
  doc.rect(margin, yPos, pageWidth - margin * 2, 16, "F");

  doc.setFontSize(14);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ARBEITSAUFTRAG", margin + 5, yPos + 11);

  // Auftrag number on the right
  doc.setFontSize(11);
  doc.text(auftrag.auftrag_nummer, pageWidth - margin - 5, yPos + 11, { align: "right" });

  yPos += 25;

  // =============================================================================
  // AUFTRAG TITLE & STATUS
  // =============================================================================

  // Compute badge width first so we can constrain the title
  const statusLabel = getStatusLabel(auftrag.status);
  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  const statusWidth = doc.getTextWidth(statusLabel) + 10;

  // Title — capped width so it never overlaps the right-aligned badge
  doc.setFontSize(13);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(40, 40, 40);
  const titleMaxWidth = pageWidth - margin * 2 - statusWidth - 10;
  doc.text(auftrag.title, margin, yPos, { maxWidth: titleMaxWidth });

  // Status badge — right-aligned on the same baseline as the title
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(pageWidth - margin - statusWidth, yPos - 6, statusWidth, 10, 2, 2, "F");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  doc.text(statusLabel, pageWidth - margin - statusWidth / 2, yPos, { align: "center" });

  yPos += 10;

  // Service type if available
  if (auftrag.service_type) {
    doc.setFontSize(10);
    doc.setTextColor(...primaryRgb);
    doc.text(`Dienstleistung: ${getServiceLabel(auftrag.service_type)}`, margin, yPos);
    yPos += 8;
  }

  yPos += 5;

  // =============================================================================
  // MAIN INFO GRID (Customer, Date, Team)
  // =============================================================================

  const colWidth = (pageWidth - margin * 2 - 10) / 3;

  // Section headers
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(9);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("KUNDE", margin + 3, yPos + 5.5);
  doc.text("TERMIN", margin + colWidth + 8, yPos + 5.5);
  doc.text("TEAM", margin + colWidth * 2 + 13, yPos + 5.5);

  yPos += 12;

  // Column content
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  // Customer column
  let customerY = yPos;
  doc.setFont(fontFamily, "bold");
  doc.text(auftrag.customer_name, margin + 3, customerY);
  customerY += 5;
  doc.setFont(fontFamily, "normal");
  if (auftrag.customer_phone) {
    doc.text(`Tel: ${auftrag.customer_phone}`, margin + 3, customerY);
    customerY += 4;
  }
  if (auftrag.customer_email) {
    doc.text(auftrag.customer_email, margin + 3, customerY);
    customerY += 4;
  }

  // Date column
  let dateY = yPos;
  doc.setFont(fontFamily, "bold");
  doc.text(formatDate(auftrag.scheduled_date), margin + colWidth + 8, dateY);
  dateY += 5;
  doc.setFont(fontFamily, "normal");
  if (auftrag.scheduled_time) {
    doc.text(`Zeit: ${formatTime(auftrag.scheduled_time)}`, margin + colWidth + 8, dateY);
    dateY += 4;
  }
  if (auftrag.estimated_duration_minutes) {
    const hours = Math.floor(auftrag.estimated_duration_minutes / 60);
    const mins = auftrag.estimated_duration_minutes % 60;
    const durationStr = mins > 0 ? `${hours}h ${mins}min` : `${hours} Stunden`;
    doc.text(`Dauer: ~${durationStr}`, margin + colWidth + 8, dateY);
    dateY += 4;
  }

  // Team column
  let teamY = yPos;
  if (auftrag.team_leader) {
    doc.setFont(fontFamily, "bold");
    doc.text("Team-Leiter:", margin + colWidth * 2 + 13, teamY);
    teamY += 5;
    doc.setFont(fontFamily, "normal");
    doc.text(
      `${auftrag.team_leader.first_name} ${auftrag.team_leader.last_name}`,
      margin + colWidth * 2 + 13,
      teamY
    );
    teamY += 4;
    if (auftrag.team_leader.phone) {
      doc.text(`Tel: ${auftrag.team_leader.phone}`, margin + colWidth * 2 + 13, teamY);
      teamY += 4;
    }
  } else {
    doc.text("Nicht zugewiesen", margin + colWidth * 2 + 13, teamY);
    teamY += 4;
  }

  // Additional team members
  if (auftrag.assigned_team_members_data && auftrag.assigned_team_members_data.length > 0) {
    teamY += 2;
    doc.setFont(fontFamily, "bold");
    doc.text("Weitere Mitarbeiter:", margin + colWidth * 2 + 13, teamY);
    teamY += 5;
    doc.setFont(fontFamily, "normal");
    auftrag.assigned_team_members_data.forEach((member) => {
      doc.text(`• ${member.first_name} ${member.last_name}`, margin + colWidth * 2 + 13, teamY);
      teamY += 4;
    });
  }

  yPos = Math.max(customerY, dateY, teamY) + 8;

  // =============================================================================
  // ADDRESSES SECTION
  // =============================================================================

  if (auftrag.from_address || auftrag.to_address) {
    yPos = checkPageBreak(yPos, 35);

    doc.setFillColor(...primaryRgb);
    doc.setDrawColor(...primaryRgb);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("ADRESSEN", margin + 5, yPos + 5.5);
    yPos += 12;

    const addressColWidth = (pageWidth - margin * 2 - 10) / 2;

    // From address
    if (auftrag.from_address) {
      doc.setFontSize(9);
      doc.setFont(fontFamily, "bold");
      doc.setTextColor(...primaryRgb);
      doc.text("Von:", margin, yPos);

      doc.setFont(fontFamily, "normal");
      doc.setTextColor(60, 60, 60);
      const fromLines = auftrag.from_address.split("\n");
      let fromY = yPos + 5;
      fromLines.forEach((line) => {
        doc.text(line, margin, fromY);
        fromY += 4;
      });
    }

    // To address
    if (auftrag.to_address) {
      doc.setFont(fontFamily, "bold");
      doc.setTextColor(...primaryRgb);
      doc.text("Nach:", margin + addressColWidth + 10, yPos);

      doc.setFont(fontFamily, "normal");
      doc.setTextColor(60, 60, 60);
      const toLines = auftrag.to_address.split("\n");
      let toY = yPos + 5;
      toLines.forEach((line) => {
        doc.text(line, margin + addressColWidth + 10, toY);
        toY += 4;
      });
    }

    const fromLineCount = auftrag.from_address?.split("\n").length || 0;
    const toLineCount = auftrag.to_address?.split("\n").length || 0;
    yPos += 5 + Math.max(fromLineCount, toLineCount) * 4 + 8;
  }

  // =============================================================================
  // SERVICE DETAILS SECTION (if available)
  // =============================================================================

  if (auftrag.service_details && Object.keys(auftrag.service_details).length > 0) {
    yPos = checkPageBreak(yPos, 30);

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("DETAILS ZUR DIENSTLEISTUNG", margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const details = auftrag.service_details;
    const detailLabels: Record<string, string> = {
      from_rooms: "Zimmer",
      from_living_space_m2: "Wohnfläche (m²)",
      from_floor: "Stockwerk (Von)",
      from_has_lift: "Lift vorhanden (Von)",
      to_floor: "Stockwerk (Nach)",
      to_has_lift: "Lift vorhanden (Nach)",
      property_type: "Objekttyp",
      distance_km: "Distanz (km)",
      packing_service_needed: "Verpackungsservice",
      cleaning_service_needed: "Endreinigung",
      storage_needed: "Lagerung benötigt",
      piano_transport_needed: "Klaviertransport",
      bathroom_count: "Badezimmer",
      kitchen_type: "Küche",
      has_balcony: "Balkon",
      has_garage: "Garage",
      has_basement: "Keller",
      has_attic: "Estrich",
      cleaning_windows: "Fensterreinigung",
      piano_type: "Klaviertyp",
      piano_weight_kg: "Gewicht (kg)",
      clearing_type: "Räumungsart",
      estimated_volume: "Geschätztes Volumen",
      has_heavy_items: "Schwere Gegenstände",
      heavy_items_description: "Beschreibung schwere Gegenstände",
      storage_duration: "Lagerdauer",
      storage_volume: "Lagervolumen",
    };

    const detailsArray: { label: string; value: string }[] = [];
    Object.entries(details).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        const label = detailLabels[key] || key;
        let displayValue: string;

        if (typeof value === "boolean") {
          displayValue = value ? "Ja" : "Nein";
        } else {
          displayValue = String(value);
        }

        detailsArray.push({ label, value: displayValue });
      }
    });

    // Display in 2-column layout inside a light background box
    const detailColWidth = (pageWidth - margin * 2 - 10) / 2;

    // Pre-compute height so we can draw the background box first
    const numDetailRows = Math.ceil(detailsArray.length / 2);
    const detailContentH = Math.max(numDetailRows, 1) * 5 + 6;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos - 1, pageWidth - margin * 2, detailContentH, "FD");

    let detailX = margin + 3;
    let detailY = yPos + 4;
    let itemCount = 0;

    detailsArray.forEach((detail) => {
      if (itemCount > 0 && itemCount % 2 === 0) {
        detailY += 5;
        detailX = margin + 3;
      }

      doc.setFont(fontFamily, "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(`${detail.label}:`, detailX, detailY);
      doc.setFont(fontFamily, "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(detail.value, detailX + doc.getTextWidth(`${detail.label}: `) + 1, detailY);

      detailX = margin + detailColWidth + 10;
      itemCount++;
    });

    yPos = detailY + 9;
  }

  // =============================================================================
  // PRICING TYPE INFO (for hourly work)
  // =============================================================================

  const isHourlyPricing = auftrag.pricing_type === "hourly";

  if (isHourlyPricing) {
    yPos = checkPageBreak(yPos, 30);

    // Hourly rate info box
    doc.setFillColor(255, 243, 224); // Light amber background
    doc.setDrawColor(255, 152, 0); // Amber border
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, pageWidth - margin * 2, 20, "FD");

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(230, 81, 0);
    doc.text("ABRECHNUNG NACH AUFWAND", margin + 5, yPos + 7);

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 60, 20);

    if (auftrag.hourly_rate) {
      doc.text(`Stundensatz: ${formatCurrency(auftrag.hourly_rate)}/Std.`, margin + 5, yPos + 14);
      doc.text("Der Endpreis wird nach Abschluss der Arbeiten berechnet.", margin + 80, yPos + 14);
    } else {
      doc.text("Der Endpreis wird nach Abschluss der Arbeiten berechnet.", margin + 5, yPos + 14);
    }

    yPos += 28;
  }

  // =============================================================================
  // ITEMS TABLE (only show for fixed price or estimate)
  // =============================================================================

  if (!isHourlyPricing && auftrag.items && auftrag.items.length > 0) {
    // -----------------------------------------------------------------------
    // Issue 1 fix: Pre-check if items + totals fit together on the same page.
    // If not, start a new page BEFORE the section header so nothing is split.
    // -----------------------------------------------------------------------
    const ROW_PADDING = 3;   // Issue 2: tighter rows (3pt top + 3pt bottom = 6pt total)
    const ROW_GAP     = 1;
    const estimatedRowH = 4 + ROW_PADDING * 2; // 1 text line + padding
    const estimatedItemsH =
      12 +                                          // section header bar
      10 +                                          // table column header
      auftrag.items.length * (estimatedRowH + ROW_GAP) +
      6 +                                           // gap after rows
      38;                                           // totals block
    if (yPos + estimatedItemsH > contentBottom) {
      addFooter();
      doc.addPage();
      yPos = 30;
    }

    // Section header bar
    doc.setFillColor(...primaryRgb);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    const priceTitle = auftrag.pricing_type === "estimate" ? "KOSTENVORANSCHLAG" : "LEISTUNGEN & PREISE";
    doc.text(priceTitle, margin + 5, yPos + 5.5);
    yPos += 12;

    // -----------------------------------------------------------------------
    // Issue 3 fix: Column widths — 45% Beschreibung | 15% Menge | 20% Preis | 20% Total
    // -----------------------------------------------------------------------
    const tLeft  = margin;                                      // 20
    const tRight = pageWidth - margin;                          // 190
    const tW     = tRight - tLeft;                              // 170

    const col1 = tLeft + 5;                                     // 25  — Beschreibung (left)
    const col2 = tLeft + tW * 0.45 + tW * 0.075;               // ≈109 — Menge (center)
    const col3 = tLeft + tW * 0.60 + tW * 0.10;                // ≈139 — Preis (center)
    const col4 = tRight - 5;                                    // 185  — Total (right)
    const maxDescWidth = tLeft + tW * 0.45 - col1 - 4;         // ≈68  — Beschreibung wrap width

    // Table column header
    doc.setFillColor(240, 240, 240);
    doc.rect(tLeft, yPos, tW, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Beschreibung", col1, yPos + 5.5);
    doc.text("Menge",        col2, yPos + 5.5, { align: "center" });
    doc.text("Preis",        col3, yPos + 5.5, { align: "center" });
    doc.text("Total",        col4, yPos + 5.5, { align: "right"  });
    yPos += 10;

    // Table rows
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    auftrag.items.forEach((item, idx) => {
      const descLines  = doc.splitTextToSize(item.description, maxDescWidth);
      const textHeight = descLines.length * 4;
      const rowHeight  = textHeight + ROW_PADDING * 2;

      yPos = checkPageBreak(yPos, rowHeight + ROW_GAP);

      // Alternating row background
      const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(tLeft, yPos, tW, rowHeight, "F");

      // Subtle row bottom border
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.2);
      doc.line(tLeft, yPos + rowHeight, tRight, yPos + rowHeight);

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      const textY = yPos + ROW_PADDING + 3; // baseline offset

      doc.text(descLines[0], col1, textY);
      doc.text(`${item.quantity} ${item.unit || ""}`,                          col2, textY, { align: "center" });
      doc.text(formatCurrency(item.unit_price),                                col3, textY, { align: "center" });
      doc.text(formatCurrency(item.total ?? item.quantity * item.unit_price),  col4, textY, { align: "right"  });

      // Wrapped description continuation lines
      let lineY = textY + 4;
      for (let i = 1; i < descLines.length; i++) {
        doc.setTextColor(100, 100, 100);
        doc.text(descLines[i], col1, lineY);
        lineY += 4;
      }

      yPos += rowHeight + ROW_GAP;
    });

    yPos += 6;

    // -----------------------------------------------------------------------
    // Issue 4 fix: Totals block — right-aligned, bottom-right of items section
    // -----------------------------------------------------------------------
    const totalsBoxWidth = 85;
    const totalsBoxX     = pageWidth - margin - totalsBoxWidth;
    const totalsValueX   = pageWidth - margin - 5;
    const totalsTextX    = totalsBoxX + 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsBoxX, yPos - 2, totalsBoxWidth, 34, 2, 2, "FD");

    yPos += 5;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Zwischensumme:",              totalsTextX, yPos);
    doc.text(formatCurrency(auftrag.subtotal || 0), totalsValueX, yPos, { align: "right" });
    yPos += 7;

    doc.text(`MwSt. (${auftrag.vat_rate || 8.1}%):`, totalsTextX, yPos);
    doc.text(formatCurrency(auftrag.vat_amount || 0), totalsValueX, yPos, { align: "right" });
    yPos += 6;

    // Divider
    doc.setDrawColor(...primaryRgb);
    doc.setLineWidth(0.5);
    doc.line(totalsTextX, yPos, totalsValueX, yPos);
    yPos += 7;

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryRgb);
    const totalLabel = auftrag.pricing_type === "estimate" ? "Geschätzt:" : "Gesamtbetrag:";
    doc.text(totalLabel,                           totalsTextX, yPos);
    doc.text(formatCurrency(auftrag.total || 0),   totalsValueX, yPos, { align: "right" });

    yPos += 15;
  }

  // =============================================================================
  // EXTRA SERVICES SECTION
  // =============================================================================

  if (auftrag.extra_services && auftrag.extra_services.length > 0) {
    yPos = checkPageBreak(yPos, 40);

    doc.setFillColor(71, 85, 105); // Slate-600 — professional, distinct from primary blue
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("ZUSÄTZLICHE LEISTUNGEN", margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    auftrag.extra_services.forEach((service) => {
      yPos = checkPageBreak(yPos, 6);

      doc.text(`• ${service.description}`, margin, yPos);
      
      // Show price only if not hourly
      if (!isHourlyPricing && service.unit_price > 0) {
        const priceInfo = `${service.quantity} ${service.unit} × ${formatCurrency(service.unit_price)}`;
        doc.text(priceInfo, pageWidth - margin, yPos, { align: "right" });
      } else {
        doc.text(`${service.quantity} ${service.unit}`, pageWidth - margin, yPos, { align: "right" });
      }

      yPos += 5;
    });

    yPos += 8;
  }

  // =============================================================================
  // DESCRIPTION SECTION
  // =============================================================================

  if (auftrag.description) {
    yPos = checkPageBreak(yPos, 25);

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("BESCHREIBUNG", margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const descLines = doc.splitTextToSize(auftrag.description, pageWidth - margin * 2);
    descLines.forEach((line: string) => {
      yPos = checkPageBreak(yPos, 5);
      doc.text(line, margin, yPos);
      yPos += 4;
    });

    yPos += 8;
  }

  // =============================================================================
  // SPECIAL INSTRUCTIONS SECTION
  // =============================================================================

  if (auftrag.special_instructions) {
    yPos = checkPageBreak(yPos, 25);

    // Orange warning box
    doc.setFillColor(255, 243, 224);
    doc.setDrawColor(255, 152, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, "FD");

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(230, 81, 0);
    doc.text("⚠ WICHTIGE HINWEISE", margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 60, 20);

    const specialLines = doc.splitTextToSize(auftrag.special_instructions, pageWidth - margin * 2);
    specialLines.forEach((line: string) => {
      yPos = checkPageBreak(yPos, 5);
      doc.text(line, margin, yPos);
      yPos += 4;
    });

    yPos += 8;
  }

  // =============================================================================
  // ZUSÄTZLICHE ARBEITEN (FIELD EXTRAS) SECTION - For manual entries
  // =============================================================================

  // Always start this section on a new page if not enough space
  // Need space for: header(8) + table header(8) + 5 rows(50) + total(10) + notes(40) + signature(55) = ~171
  const fieldExtrasNeededHeight = 130;
  
  // Check if we need a new page
  if (yPos + fieldExtrasNeededHeight > contentBottom) {
    addFooter();
    doc.addPage();
    yPos = 30;
  }

  // Section header - gray background (not purple)
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, "FD");
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("ZUSÄTZLICHE ARBEITEN", margin + 5, yPos + 5.5);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("(Für Einträge vor Ort)", pageWidth - margin - 5, yPos + 5.5, { align: "right" });
  yPos += 12;

  // Table header for extras
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - margin * 2, 7, "FD");

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  // Column positions for extras table
  const extCol1 = margin + 8; // Beschreibung (after row number)
  const extCol2 = pageWidth - margin - 55; // Menge
  const extCol3 = pageWidth - margin - 30; // Preis
  const extCol4 = pageWidth - margin - 5;  // Total

  doc.text("Beschreibung", extCol1, yPos + 5);
  doc.text("Anz.", extCol2, yPos + 5);
  doc.text("Preis", extCol3, yPos + 5);
  doc.text("Total", extCol4, yPos + 5, { align: "right" });
  yPos += 9;

  // Draw 5 blank rows for manual entry
  const blankRowHeight = 9;
  for (let i = 0; i < 5; i++) {
    // Row border only (no fill)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPos, pageWidth - margin * 2, blankRowHeight, "S");
    
    // Column separators
    doc.line(extCol2 - 5, yPos, extCol2 - 5, yPos + blankRowHeight);
    doc.line(extCol3 - 5, yPos, extCol3 - 5, yPos + blankRowHeight);
    doc.line(extCol4 - 20, yPos, extCol4 - 20, yPos + blankRowHeight);
    
    // Row number
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${i + 1}.`, margin + 2, yPos + 6);
    
    yPos += blankRowHeight;
  }

  // Subtotal row for extras
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, "S");
  
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Zwischensumme Zusatzarbeiten:", extCol2 - 50, yPos + 5.5);
  doc.text("CHF", extCol4, yPos + 5.5, { align: "right" });
  yPos += 18;

  // Notes section with blank lines
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Bemerkungen:", margin, yPos);
  yPos += 5;

  // Draw 3 blank lines for notes
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 3; i++) {
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 7;
  }

  yPos += 3;

  // =============================================================================
  // GESAMTBETRAG (GRAND TOTAL) SECTION - At the bottom
  // =============================================================================

  // Grand total box
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, pageWidth - margin * 2, 12, "FD");
  
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("GESAMTBETRAG (inkl. Zusatzarbeiten):", margin + 5, yPos + 8);
  doc.text("CHF", pageWidth - margin - 5, yPos + 8, { align: "right" });
  
  yPos += 18;

  // =============================================================================
  // SIGNATURE SECTION
  // =============================================================================

  // Signature section needs approximately 55 units of space (including margin from footer)
  const signatureSectionHeight = 55;
  yPos = checkPageBreak(yPos, signatureSectionHeight);

  yPos += 10;

  // -------------------------------------------------------------------------
  // Issue 5 fix: Clean two-column signature layout — no duplicate labels.
  //   Left:  Unterschrift Kunde     Right: Unterschrift Mitarbeiter
  //          ________________              ________________
  //          (Name)                        (Name)
  //   Ort, Datum:                    Ort, Datum:
  //          ________________              ________________
  // -------------------------------------------------------------------------
  const sigColW  = (pageWidth - margin * 3) / 2; // half of usable width
  const leftX    = margin;
  const rightX   = margin + sigColW + margin;

  const leaderName = auftrag.team_leader
    ? `${auftrag.team_leader.first_name} ${auftrag.team_leader.last_name}`
    : auftrag.company.company_name;

  // Row 1: column labels
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Unterschrift Kunde:",        leftX,  yPos);
  doc.text("Unterschrift Mitarbeiter:",  rightX, yPos);
  yPos += 14;

  // Row 2: signature lines
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.4);
  doc.line(leftX,  yPos, leftX  + sigColW, yPos);
  doc.line(rightX, yPos, rightX + sigColW, yPos);
  yPos += 5;

  // Row 3: name placeholders
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(`(${auftrag.customer_name})`, leftX,  yPos);
  doc.text(`(${leaderName})`,            rightX, yPos);
  yPos += 11;

  // Row 4: date labels
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Ort, Datum:",  leftX,  yPos);
  doc.text("Ort, Datum:",  rightX, yPos);
  yPos += 13;

  // Row 5: date lines
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(leftX,  yPos, leftX  + sigColW, yPos);
  doc.line(rightX, yPos, rightX + sigColW, yPos);

  // =============================================================================
  // ADD FOOTER AND FINALIZE
  // =============================================================================

  addFooter();

  // Replace total pages placeholder
  doc.putTotalPages(totalPagesPlaceholder);

  // Save PDF with sanitized filename
  const safeAuftragNummer = sanitizeFileName(auftrag.auftrag_nummer || 'unknown');
  const safeCustomerName = sanitizeFileName(auftrag.customer_name || 'customer');
  const fileName = `Auftrag_${safeAuftragNummer}_${safeCustomerName}.pdf`;
  doc.save(fileName);
};

export default generateAuftragPdf;
