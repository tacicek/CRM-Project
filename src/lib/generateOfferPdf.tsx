import { pdf } from "@react-pdf/renderer";
import { OfferPDF } from "@/components/pdf/OfferPDF";
import { mapOfferToPdfData, LegacyOfferData } from "@/components/pdf/utils/mapOfferData";
import { generateQRCode } from "@/components/pdf/utils/qr";

/**
 * Convert image URL to base64 data URL for PDF embedding.
 * @react-pdf/renderer does NOT support WebP, so we convert any image
 * to PNG via an off-screen canvas before encoding to base64.
 * This also handles CORS by fetching through the browser.
 */
const imageUrlToBase64 = async (url: string): Promise<string | undefined> => {
  if (!url) return undefined;

  // Already base64 – but reject webp (react-pdf can't render it)
  if (url.startsWith("data:image")) {
    if (url.startsWith("data:image/webp")) {
      // Convert webp data-url via canvas
      return convertImageToBase64ViaCanvas(url);
    }
    return url;
  }

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      console.warn("Failed to fetch image for PDF:", url);
      return undefined;
    }
    const blob = await response.blob();
    const contentType = blob.type;

    // If the image is webp or the format is unknown, convert via canvas to PNG
    if (contentType === "image/webp" || !contentType.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await convertImageToBase64ViaCanvas(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    // For PNG / JPEG – read directly
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Error converting image to base64:", error);
    return undefined;
  }
};

/**
 * Draw an image onto an off-screen canvas and export as PNG base64.
 * This converts any browser-supported format (including WebP) to PNG
 * which @react-pdf/renderer can handle.
 */
const convertImageToBase64ViaCanvas = (src: string): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(undefined);
          return;
        }
        // Draw white background first (handles transparency -> no black bg)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
};

/**
 * Build PDF blob from offer data using @react-pdf/renderer.
 * Shared between download and email-send flows so both produce an identical PDF.
 */
const buildOfferPdfBlob = async (offer: LegacyOfferData): Promise<Blob> => {
  const acceptanceUrl =
    offer.access_token && offer.baseUrl
      ? `${offer.baseUrl}/offerte/${offer.access_token}`
      : undefined;

  // Convert logo and QR code to base64 for reliable PDF embedding
  const [logoBase64, qrCodeUrl] = await Promise.all([
    offer.company.logo_url ? imageUrlToBase64(offer.company.logo_url) : Promise.resolve(undefined),
    acceptanceUrl ? generateQRCode(acceptanceUrl) : Promise.resolve(undefined),
  ]);

  // Create a copy with base64 logo
  const offerWithBase64Logo: LegacyOfferData = {
    ...offer,
    company: {
      ...offer.company,
      logo_url: logoBase64,
    },
  };

  const pdfData = mapOfferToPdfData(offerWithBase64Logo, qrCodeUrl);

  const doc = pdf(<OfferPDF data={pdfData} />);
  return doc.toBlob();
};

/**
 * Generate and download an offer PDF (triggers browser download).
 */
export const generateOfferPdf = async (offer: LegacyOfferData): Promise<void> => {
  const pdfBlob = await buildOfferPdfBlob(offer);

  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `Offerte_${offer.id.slice(0, 8).toUpperCase()}_${offer.customer_last_name}.pdf`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};

/**
 * Generate the offer PDF and return it as a base64 string (without data URI prefix).
 * Used when sending the PDF via email so the edge function can attach it directly.
 */
export const generateOfferPdfBase64 = async (offer: LegacyOfferData): Promise<string> => {
  const pdfBlob = await buildOfferPdfBlob(offer);
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
