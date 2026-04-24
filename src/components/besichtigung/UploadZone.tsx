import { useState, useRef, useCallback } from "react";
import { Upload, Camera, Images, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomType, getRoomName } from "@/types/virtualBesichtigung";
import { toast } from "sonner";
import { compressImages } from "@/lib/imageCompression";

interface UploadZoneProps {
  roomType: RoomType;
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  primaryColor?: string;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

export function UploadZone({
  roomType,
  onFilesSelected,
  isUploading = false,
  maxFiles = 20,
  maxSizeMB = 50,
  primaryColor,
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Gallery / drag-drop input (desktop + gallery on mobile)
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Camera-only input (mobile, capture="environment")
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isUploading || isCompressing;

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const validFiles: File[] = [];
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const file of files) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: Ungültiges Format. Nur Bilder und Videos erlaubt.`);
          continue;
        }
        if (file.size > maxSizeBytes) {
          toast.error(`${file.name}: Datei zu gross (max. ${maxSizeMB}MB)`);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > maxFiles) {
        toast.warning(`Maximal ${maxFiles} Dateien auf einmal erlaubt.`);
        return validFiles.slice(0, maxFiles);
      }

      return validFiles;
    },
    [maxFiles, maxSizeMB]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles = validateFiles(fileArray);
      if (validFiles.length === 0) return;

      setIsCompressing(true);
      try {
        const processed = await compressImages(validFiles);
        onFilesSelected(processed);
      } catch {
        // Fallback: pass originals if compression fails unexpectedly
        onFilesSelected(validFiles);
      } finally {
        setIsCompressing(false);
      }
    },
    [validateFiles, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (isBusy) return;
      const { files } = e.dataTransfer;
      if (files?.length) handleFiles(files);
    },
    [handleFiles, isBusy]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  // Desktop: click anywhere on zone opens gallery picker
  const handleZoneClick = useCallback(() => {
    if (!isBusy) fileInputRef.current?.click();
  }, [isBusy]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files?.length) handleFiles(files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const statusText = isCompressing
    ? "Wird optimiert…"
    : isUploading
    ? "Wird hochgeladen…"
    : isDragActive
    ? "Dateien hier ablegen"
    : `Fotos vom ${getRoomName(roomType)} hochladen`;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative flex flex-col items-center justify-center",
        "border-2 border-dashed rounded-xl p-8 sm:p-12",
        "transition-all duration-200",
        isDragActive
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-gray-300 bg-gray-50/50",
        // Desktop: entire zone is clickable
        "sm:cursor-pointer sm:hover:border-gray-400",
        isBusy && "opacity-60 pointer-events-none"
      )}
      style={
        isDragActive && primaryColor
          ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` }
          : undefined
      }
      // Desktop only click handler — on mobile we use the explicit buttons below
      onClick={() => {
        // Only fire on desktop (sm breakpoint and above)
        if (window.innerWidth >= 640) handleZoneClick();
      }}
    >
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={isBusy}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        disabled={isBusy}
      />

      {/* Icon */}
      <div
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mb-4",
          isDragActive ? "bg-primary/10" : "bg-gray-100"
        )}
        style={isDragActive && primaryColor ? { backgroundColor: `${primaryColor}15` } : undefined}
      >
        {isBusy ? (
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        ) : isDragActive ? (
          <Upload
            className="w-8 h-8 text-primary"
            style={primaryColor ? { color: primaryColor } : undefined}
          />
        ) : (
          <Camera className="w-8 h-8 text-gray-400" />
        )}
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="font-medium text-gray-700 mb-1">{statusText}</p>
        <p className="text-sm text-gray-500 hidden sm:block">
          Bilder oder Videos hierher ziehen oder{" "}
          <span
            className="text-primary underline"
            style={primaryColor ? { color: primaryColor } : undefined}
          >
            auswählen
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          JPG, PNG, HEIC, MP4 • Max. {maxSizeMB}MB pro Datei
        </p>
      </div>

      {/* Mobile: two prominent action buttons */}
      <div className="mt-5 flex flex-col gap-2 w-full max-w-xs sm:hidden">
        {/* Primary: open camera directly */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isBusy) cameraInputRef.current?.click();
          }}
          disabled={isBusy}
          className={cn(
            "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl",
            "text-white text-sm font-semibold shadow-sm",
            "transition-opacity",
            isBusy && "opacity-50"
          )}
          style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
        >
          <Camera className="w-5 h-5" />
          Foto aufnehmen
        </button>

        {/* Secondary: open gallery / file picker */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isBusy) fileInputRef.current?.click();
          }}
          disabled={isBusy}
          className={cn(
            "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl",
            "bg-white border border-gray-300 text-gray-700 text-sm font-medium",
            "hover:bg-gray-50 transition-colors",
            isBusy && "opacity-50"
          )}
        >
          <Images className="w-5 h-5" />
          Aus Galerie wählen
        </button>
      </div>
    </div>
  );
}
