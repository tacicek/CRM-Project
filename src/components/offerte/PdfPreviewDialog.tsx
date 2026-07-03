import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Download, FileText, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import * as pdfjsLib from "pdfjs-dist";
// Bundle the worker locally (Vite ?url) instead of a pinned CDN URL. The CDN was locked to
// 4.0.379 while the installed pdfjs-dist is 4.10.x (version drift that can break rendering),
// and a third-party CDN fails offline / under a strict CSP.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { OfferPDF } from "@/components/pdf/OfferPDF";
import { mapOfferToPdfData, LegacyOfferData } from "@/components/pdf/utils/mapOfferData";
import { generateQRCode } from "@/components/pdf/utils/qr";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: LegacyOfferData;
  onSend: () => Promise<void>;
  isSending: boolean;
}

// Helper function to convert service type to readable German name
const formatServiceTypeTitle = (title: string): string => {
  const serviceTypeMap: Record<string, string> = {
    umzug_privat: "Privater Umzug",
    umzug_firma: "Firmenumzug",
    umzug: "Umzug",
    privatumzug: "Privater Umzug",
    reinigung: "Reinigung",
    reinigung_privat: "Private Reinigung",
    reinigung_firma: "Firmenreinigung",
    endreinigung: "Endreinigung",
    entsorgung: "Entsorgung",
    raeumung: "Räumung",
    lagerung: "Lagerung",
    klaviertransport: "Klaviertransport",
    moebellift: "Möbellift",
    entrümpelung: "Entrümpelung",
  };

  const cleanTitle = title.replace(/→/g, "nach").replace(/!'/g, "nach");
  const lowerTitle = cleanTitle.toLowerCase().trim();
  if (serviceTypeMap[lowerTitle]) {
    return serviceTypeMap[lowerTitle];
  }

  if (lowerTitle.startsWith("offerte: ")) {
    const serviceType = lowerTitle.replace("offerte: ", "");
    if (serviceTypeMap[serviceType]) {
      return serviceTypeMap[serviceType];
    }
  }

  for (const [key, label] of Object.entries(serviceTypeMap)) {
    if (lowerTitle.startsWith(key) || lowerTitle.includes(label.toLowerCase())) {
      const locationMatch = cleanTitle.match(/(?:nach|in|von)\s+(.+)/i);
      if (locationMatch) {
        return `${label} ${locationMatch[0]}`;
      }
      return label;
    }
  }

  return cleanTitle;
};

export const PdfPreviewDialog = ({
  open,
  onOpenChange,
  offer,
  onSend,
  isSending,
}: PdfPreviewDialogProps) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDocument, setPdfDocument] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imageUrlToBase64 = useCallback(async (url: string): Promise<string | undefined> => {
    if (!url) return undefined;
    
    // Already base64
    if (url.startsWith("data:image")) {
      return url;
    }

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        console.warn("Failed to fetch image for PDF:", url);
        return undefined;
      }
      const blob = await response.blob();
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
  }, []);

  const generatePreview = useCallback(async () => {
    setIsGenerating(true);
    try {
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
      const pdfBlob = await doc.toBlob();

      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blobUrl;
      });

      const buffer = await pdfBlob.arrayBuffer();
      setPdfArrayBuffer(buffer);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error generating PDF preview:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [imageUrlToBase64, offer]);

  useEffect(() => {
    if (open) {
      generatePreview();
    } else {
      setPdfDocument((prev: { destroy?: () => void } | null) => {
        if (prev?.destroy) {
          prev.destroy();
        }
        return null;
      });
      setPdfBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setPdfArrayBuffer(null);
      setCurrentPage(1);
      setTotalPages(0);
    }
  }, [generatePreview, open]);

  useEffect(() => {
    if (!pdfArrayBuffer) return;

    let cancelled = false;

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
      } catch (e) {
        console.error("PDF.js load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfArrayBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas || totalPages === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocument.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.4 });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error("PDF.js render failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentPage, totalPages, pdfDocument]);

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `Offerte_${offer.id.slice(0, 8).toUpperCase()}_${offer.customer_last_name}.pdf`;
    link.click();
  };

  const handleOpenInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, "_blank");
    }
  };

  const handleSend = async () => {
    await onSend();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            PDF-Vorschau: {formatServiceTypeTitle(offer.title)}
          </DialogTitle>
          <DialogDescription>
            Überprüfen Sie die PDF-Offerte, bevor Sie sie an {offer.customer_email} senden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/30">
          {isGenerating ? (
            <div className="flex items-center justify-center h-[500px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-secondary" />
                <p className="text-sm text-muted-foreground">PDF wird generiert...</p>
              </div>
            </div>
          ) : pdfArrayBuffer ? (
            <div className="h-[500px] overflow-auto p-4">
              <div className="mx-auto w-fit rounded-md border bg-background shadow-sm">
                <canvas ref={canvasRef} className="block" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[500px]">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">Fehler beim Laden der Vorschau</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={!pdfBlobUrl}>
                    <Download className="w-4 h-4 mr-2" />
                    Herunterladen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!pdfBlobUrl}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    In neuem Tab
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={isGenerating || currentPage <= 1 || totalPages <= 1}
              aria-label="Vorherige Seite"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="w-[150px]">
              <Select
                value={String(currentPage)}
                onValueChange={(v) => setCurrentPage(Number(v))}
                disabled={isGenerating || totalPages <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seite wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      Seite {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-sm text-muted-foreground">von {totalPages || "-"}</span>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={isGenerating || currentPage >= totalPages || totalPages <= 1}
              aria-label="Nächste Seite"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleOpenInNewTab} disabled={!pdfBlobUrl || isGenerating}>
              <ExternalLink className="w-4 h-4 mr-2" />
              In neuem Tab
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={!pdfBlobUrl || isGenerating}>
              <Download className="w-4 h-4 mr-2" />
              Herunterladen
            </Button>
            <Button onClick={handleSend} disabled={isSending || isGenerating}>
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Offerte senden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
