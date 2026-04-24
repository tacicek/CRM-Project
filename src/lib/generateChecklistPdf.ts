import jsPDF from "jspdf";
import type { ChecklistSection } from "@/lib/checklistTemplates";

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
  slogan?: string | null;
}

interface ChecklistData {
  title: string;
  subtitle?: string | null;
  sections: ChecklistSection[];
  company: CompanyInfo;
}

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
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

// Load and register Poppins font
const loadPoppinsFont = async (doc: jsPDF): Promise<boolean> => {
  try {
    // Fetch Poppins Regular from Google Fonts
    const regularResponse = await fetch(
      "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrFJA.ttf"
    );
    const boldResponse = await fetch(
      "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7V1s.ttf"
    );

    if (!regularResponse.ok || !boldResponse.ok) {
      return false;
    }

    const regularBlob = await regularResponse.blob();
    const boldBlob = await boldResponse.blob();

    const toBase64 = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract base64 data after the comma
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const regularBase64 = await toBase64(regularBlob);
    const boldBase64 = await toBase64(boldBlob);

    // Add fonts to jsPDF
    doc.addFileToVFS("Poppins-Regular.ttf", regularBase64);
    doc.addFileToVFS("Poppins-Bold.ttf", boldBase64);
    doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
    doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");

    return true;
  } catch (error) {
    console.error("Failed to load Poppins font:", error);
    return false;
  }
};

// Helper to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace("#", "");
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

// Create a lighter version of a color for backgrounds
const lightenColor = (r: number, g: number, b: number, factor: number = 0.85): { r: number; g: number; b: number } => {
  return {
    r: Math.round(r + (255 - r) * factor),
    g: Math.round(g + (255 - g) * factor),
    b: Math.round(b + (255 - b) * factor),
  };
};

export const generateChecklistPdf = async (data: ChecklistData): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const marginTop = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPos = marginTop;

  // Try to load Poppins font
  const fontLoaded = await loadPoppinsFont(doc);
  const fontFamily = fontLoaded ? "Poppins" : "helvetica";

  // Parse primary color or use default
  const primaryColor = data.company.primary_color
    ? hexToRgb(data.company.primary_color)
    : { r: 79, g: 70, b: 229 }; // Default indigo
  
  const lightPrimaryColor = lightenColor(primaryColor.r, primaryColor.g, primaryColor.b, 0.9);

  const addPageFooter = () => {
    const pageNum = doc.getNumberOfPages();
    doc.setFontSize(10);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(100, 100, 100);

    const footerY = pageHeight - 10;
    
    // Build address line
    const addressParts: string[] = [];
    if (data.company.street) {
      const streetLine = data.company.house_number
        ? `${data.company.street} ${data.company.house_number}`
        : data.company.street;
      addressParts.push(streetLine);
    }
    addressParts.push(`${data.company.plz} ${data.company.city}`);
    const addressLine = addressParts.join(", ");

    // Build contact line
    const contactParts: string[] = [data.company.company_name];
    if (data.company.phone) {
      contactParts.push(`Tel: ${data.company.phone}`);
    }
    contactParts.push(data.company.email);
    const contactLine = contactParts.join(" | ");

    // Draw footer with primary color accent line
    doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, footerY - 14, pageWidth - marginRight, footerY - 14);

    doc.text(contactLine, pageWidth / 2, footerY - 9, { align: "center" });
    doc.text(addressLine, pageWidth / 2, footerY - 4, { align: "center" });
    doc.text(`Seite ${pageNum}`, pageWidth / 2, footerY + 1, { align: "center" });
  };

  const checkPageBreak = (neededHeight: number): boolean => {
    if (yPos + neededHeight > pageHeight - 30) {
      addPageFooter();
      doc.addPage();
      yPos = marginTop;
      return true;
    }
    return false;
  };

  // ========== HEADER SECTION ==========

  // Load and add logo if available
  if (data.company.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(data.company.logo_url);
      if (logoBase64) {
        const maxLogoWidth = 45;
        const maxLogoHeight = 16;
        const logoX = pageWidth - marginRight - maxLogoWidth;

        // White background to prevent PNG transparency rendering as black
        doc.setFillColor(255, 255, 255);
        doc.rect(logoX, yPos, maxLogoWidth, maxLogoHeight, "F");

        doc.addImage(
          logoBase64,
          "PNG",
          logoX,
          yPos,
          maxLogoWidth,
          maxLogoHeight,
          undefined,
          "NONE"
        );
      }
    } catch (e) {
      console.error("Failed to load logo:", e);
    }
  }

  // Company info - left side
  doc.setFontSize(13);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(data.company.company_name, marginLeft, yPos + 5);
  yPos += 10;

  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(80, 80, 80);

  // Street and house number
  if (data.company.street) {
    const streetLine = data.company.house_number
      ? `${data.company.street} ${data.company.house_number}`
      : data.company.street;
    doc.text(streetLine, marginLeft, yPos);
    yPos += 4;
  }

  // PLZ and City
  doc.text(`${data.company.plz} ${data.company.city}`, marginLeft, yPos);
  yPos += 4;

  // Phone
  if (data.company.phone) {
    doc.text(`Tel: ${data.company.phone}`, marginLeft, yPos);
    yPos += 4;
  }

  // Email
  doc.text(`E-Mail: ${data.company.email}`, marginLeft, yPos);
  yPos += 4;

  // Website
  if (data.company.website) {
    doc.text(data.company.website, marginLeft, yPos);
    yPos += 4;
  }

  // Ensure enough space after header
  yPos = Math.max(yPos + 4, marginTop + 25);

  // Horizontal separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 15;

  // ========== TITLE SECTION ==========

  doc.setFontSize(20);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(20, 20, 20);
  
  // Center the title
  const titleLines = doc.splitTextToSize(data.title, contentWidth);
  doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
  yPos += titleLines.length * 8 + 4;

  // Subtitle - centered
  if (data.subtitle) {
    doc.setFontSize(10);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(100, 100, 100);

    const subtitleLines = doc.splitTextToSize(data.subtitle, contentWidth - 20);
    doc.text(subtitleLines, pageWidth / 2, yPos, { align: "center" });
    yPos += subtitleLines.length * 5 + 4;
  }

  // Company slogan - centered with primary color
  if (data.company.slogan) {
    doc.setFontSize(9);
    doc.setFont(fontFamily, "italic");
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);

    const sloganLines = doc.splitTextToSize(`"${data.company.slogan}"`, contentWidth - 30);
    doc.text(sloganLines, pageWidth / 2, yPos, { align: "center" });
    yPos += sloganLines.length * 5 + 8;
  }

  yPos += 10;

  // ========== SECTIONS ==========

  for (const section of data.sections) {
    // Check if section header fits
    checkPageBreak(25);

    // Section timeline header with light primary color background
    doc.setFillColor(lightPrimaryColor.r, lightPrimaryColor.g, lightPrimaryColor.b);
    doc.roundedRect(marginLeft, yPos - 5, contentWidth, 10, 2, 2, "F");

    // Add left accent bar with primary color
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(marginLeft, yPos - 5, 3, 10, "F");

    doc.setFontSize(11);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(section.timeline, marginLeft + 8, yPos + 1);
    yPos += 14;

    // Items
    for (const item of section.items) {
      if (!item.trim()) continue;

      const itemLines = doc.splitTextToSize(item, contentWidth - 18);
      const itemHeight = itemLines.length * 5 + 4;

      checkPageBreak(itemHeight);

      // Checkbox with primary color border
      doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.setLineWidth(0.5);
      doc.rect(marginLeft + 2, yPos - 3.5, 4.5, 4.5);

      // Item text
      doc.setFontSize(10);
      doc.setFont(fontFamily, "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(itemLines, marginLeft + 14, yPos);
      yPos += itemHeight;
    }

    yPos += 10;
  }

  // Add footer to last page
  addPageFooter();

  return doc;
};

export const downloadChecklistPdf = async (data: ChecklistData): Promise<void> => {
  const doc = await generateChecklistPdf(data);
  const sanitizedCompanyName = data.company.company_name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")
    .replace(/_+/g, "_");
  const fileName = `Checkliste_${sanitizedCompanyName}.pdf`;
  doc.save(fileName);
};

export const getChecklistPdfBase64 = async (data: ChecklistData): Promise<string> => {
  const doc = await generateChecklistPdf(data);
  return doc.output("datauristring").split(",")[1];
};
