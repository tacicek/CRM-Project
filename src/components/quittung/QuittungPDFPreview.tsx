import { BlobProvider, PDFDownloadLink } from "@react-pdf/renderer";
import { QuittungPDF } from "./QuittungPDF";
import { Quittung } from "@/types/quittung.types";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2 } from "lucide-react";

interface CompanyInfo {
  company_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  email: string;
  phone?: string | null;
  street?: string | null;
  plz?: string | null;
  city?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  bewertungs_url?: string | null;
}

interface Props {
  quittung: Quittung;
  company: CompanyInfo;
  onClose?: () => void;
}

export function QuittungPDFPreview({ quittung, company }: Props) {
  const filename = `Quittung-${quittung.quittung_nr || "entwurf"}.pdf`;
  const doc = <QuittungPDF quittung={quittung} company={company} />;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700">PDF-Vorschau</span>
        <div className="flex items-center gap-2">
          {/* Open in new tab */}
          <BlobProvider document={doc}>
            {({ url, loading }) => (
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !url}
                className="h-8 text-xs gap-1.5"
                onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ExternalLink className="w-3.5 h-3.5" />}
                {loading ? "Erstellen..." : "Öffnen"}
              </Button>
            )}
          </BlobProvider>

          {/* Download */}
          <PDFDownloadLink document={doc} fileName={filename}>
            {({ loading }) => (
              <Button size="sm" variant="outline" disabled={loading} className="h-8 text-xs gap-1.5">
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                {loading ? "Erstellen..." : "Herunterladen"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="px-4 py-8 text-center text-sm text-slate-500">
        <p className="mb-3">Klicken Sie auf <strong>Öffnen</strong>, um das PDF in einem neuen Tab anzuzeigen.</p>
        <p className="text-xs text-slate-400">Oder laden Sie die Datei direkt herunter.</p>
      </div>
    </div>
  );
}
