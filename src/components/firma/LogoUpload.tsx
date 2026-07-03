import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { convertToWebP } from "@/lib/image-utils";

interface LogoUploadProps {
  currentLogoUrl: string | null;
  userId: string;
  companyId: string;
  onLogoChange: (newUrl: string | null) => void;
}

export const LogoUpload = ({
  currentLogoUrl,
  userId,
  companyId,
  onLogoChange,
}: LogoUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = event.target.files?.[0];
    if (!originalFile) return;

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

    if (!ALLOWED_TYPES.includes(originalFile.type)) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte wählen Sie eine JPG, PNG oder WebP Datei. SVG wird nicht unterstützt.",
        variant: "destructive",
      });
      return;
    }

    if (originalFile.size > MAX_SIZE_BYTES) {
      toast({
        title: "Datei zu gross",
        description: `Die Datei ist ${(originalFile.size / 1024 / 1024).toFixed(1)} MB gross. Maximal 2 MB erlaubt.`,
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
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
        });
        ext = "webp";
      } catch (err) {
        // Fallback to the original file is intentional, but must be observable (no silent fallback).
        console.warn("[LogoUpload] WebP-Konvertierung fehlgeschlagen, Original wird verwendet:", err);
        toast({
          title: "Bild nicht optimiert",
          description: "Das Logo konnte nicht verkleinert werden und wird im Original hochgeladen.",
        });
        fileToUpload = originalFile;
        ext = originalFile.name.split(".").pop()?.toLowerCase() || "png";
      }

      const fileName = `${userId}/logo-${Date.now()}.${ext}`;

      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split("/company-logos/")[1];
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

      const newLogoUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: newLogoUrl })
        .eq("id", companyId);

      if (updateError) throw new Error(`DB: ${updateError.message}`);

      onLogoChange(newLogoUrl);

      toast({
        title: "Logo hochgeladen",
        description: "Ihr Firmenlogo wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: "Fehler beim Logo-Upload",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setIsUploading(true);

    try {
      // Extract path from URL
      const path = currentLogoUrl.split("/company-logos/")[1];
      if (path) {
        await supabase.storage.from("company-logos").remove([path]);
      }

      // Update company record
      const { error } = await supabase
        .from("companies")
        .update({ logo_url: null })
        .eq("id", companyId);

      if (error) throw error;

      onLogoChange(null);

      toast({
        title: "Logo entfernt",
        description: "Ihr Firmenlogo wurde entfernt.",
      });
    } catch (error) {
      console.error("Error removing logo:", error);
      toast({
        title: "Fehler",
        description: "Das Logo konnte nicht entfernt werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Firmenlogo</Label>
      <div className="flex items-start gap-4">
        {/* Logo Preview */}
        <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt="Firmenlogo"
              className="w-full h-full object-contain p-2"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mx-auto mb-1" />
              <p className="text-xs">Kein Logo</p>
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
            {currentLogoUrl ? "Logo ändern" : "Logo hochladen"}
          </Button>

          {currentLogoUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveLogo}
              disabled={isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Entfernen
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            JPG, PNG oder WebP. Max. 2MB.
          </p>
        </div>
      </div>
    </div>
  );
};
