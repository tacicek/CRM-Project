import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { convertToWebP } from "@/lib/image-utils";

interface SignatureUploadProps {
  currentSignatureUrl: string | null;
  userId: string;
  companyId: string;
  onSignatureChange: (newUrl: string | null) => void;
}

export const SignatureUpload = ({
  currentSignatureUrl,
  userId,
  companyId,
  onSignatureChange,
}: SignatureUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = event.target.files?.[0];
    if (!originalFile) return;

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

    if (!ALLOWED_TYPES.includes(originalFile.type)) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte wählen Sie eine JPG, PNG oder WebP Datei.",
        variant: "destructive",
      });
      return;
    }

    if (originalFile.size > MAX_SIZE_BYTES) {
      toast({
        title: "Datei zu gross",
        description: `Die Datei ist ${(originalFile.size / 1024 / 1024).toFixed(1)} MB gross. Maximal 1 MB erlaubt.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sitzung abgelaufen",
          description: "Bitte laden Sie die Seite neu oder melden Sie sich erneut an.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      let fileToUpload: File;
      let ext: string;

      try {
        fileToUpload = await convertToWebP(originalFile, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 600,
        });
        ext = "webp";
      } catch {
        fileToUpload = originalFile;
        ext = originalFile.name.split(".").pop()?.toLowerCase() || "png";
      }

      const fileName = `${userId}/signature-${Date.now()}.${ext}`;

      if (currentSignatureUrl) {
        const oldPath = currentSignatureUrl.split("/company-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("company-logos").remove([oldPath]);
        }
      }

      const { data, error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, fileToUpload, {
          cacheControl: "3600",
          upsert: true,
          contentType: fileToUpload.type,
        });

      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(data.path);

      const newSignatureUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from("companies")
        .update({ signature_url: newSignatureUrl })
        .eq("id", companyId);

      if (updateError) throw new Error(`DB: ${updateError.message}`);

      onSignatureChange(newSignatureUrl);

      toast({
        title: "Signatur hochgeladen",
        description: "Ihre Unterschrift wurde gespeichert.",
      });
    } catch (error) {
      console.error("Error uploading signature:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: "Fehler beim Signatur-Upload",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveSignature = async () => {
    if (!currentSignatureUrl) return;

    setIsUploading(true);

    try {
      // Extract path from URL
      const path = currentSignatureUrl.split("/company-logos/")[1];
      if (path) {
        await supabase.storage.from("company-logos").remove([path]);
      }

      // Update company record
      const { error } = await supabase
        .from("companies")
        .update({ signature_url: null })
        .eq("id", companyId);

      if (error) throw error;

      onSignatureChange(null);

      toast({
        title: "Signatur entfernt",
        description: "Ihre Unterschrift wurde entfernt.",
      });
    } catch (error) {
      console.error("Error removing signature:", error);
      toast({
        title: "Fehler",
        description: "Die Signatur konnte nicht entfernt werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Unterschrift für Auftragsbestätigung</Label>
      <p className="text-sm text-muted-foreground">
        Diese Unterschrift wird auf der Auftragsbestätigungs-Seite des PDFs angezeigt
      </p>
      <div className="flex items-start gap-4">
        {/* Signature Preview */}
        <div className="w-48 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
          {currentSignatureUrl ? (
            <img
              src={currentSignatureUrl}
              alt="Unterschrift"
              className="max-w-full max-h-full object-contain p-2"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <PenTool className="w-6 h-6 mx-auto mb-1" />
              <p className="text-xs">Keine Unterschrift</p>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {currentSignatureUrl ? "Ändern" : "Hochladen"}
          </Button>

          {currentSignatureUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveSignature}
              disabled={isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Entfernen
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            PNG mit transparentem Hintergrund empfohlen. Max. 1MB.
          </p>
        </div>
      </div>
    </div>
  );
};
