import { useState } from "react";
import { X, Loader2, CheckCircle, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { BesichtigungPhoto, getRoomIcon, getRoomName } from "@/types/virtualBesichtigung";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoGridProps {
  photos: BesichtigungPhoto[];
  onDelete?: (photoId: string) => void;
  isDeleting?: string | null;
  showRoomBadge?: boolean;
  primaryColor?: string;
}

export function PhotoGrid({
  photos,
  onDelete,
  isDeleting,
  showRoomBadge = false,
  primaryColor,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<BesichtigungPhoto | null>(null);

  if (photos.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => {
          const isCurrentlyDeleting = isDeleting === photo.id;
          const isUploading = photo.upload_progress !== undefined && photo.upload_progress < 100;

          return (
            <div
              key={photo.id}
              className={cn(
                "relative group aspect-square rounded-lg overflow-hidden",
                "border-2 transition-all duration-200",
                isUploading ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-100",
                !isUploading && "hover:border-gray-300 hover:shadow-md cursor-pointer"
              )}
              onClick={() => !isUploading && setSelectedPhoto(photo)}
            >
              {/* Image */}
              {photo.preview_url ? (
                <img
                  src={photo.preview_url}
                  alt={photo.filename}
                  className={cn(
                    "w-full h-full object-cover transition-opacity",
                    isUploading && "opacity-50"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-4xl">📷</span>
                </div>
              )}

              {/* Upload progress overlay */}
              {isUploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                  <span className="text-xs font-medium text-blue-600">
                    {Math.round(photo.upload_progress || 0)}%
                  </span>
                </div>
              )}

              {/* AI processed indicator */}
              {photo.ai_processed && (
                <div className="absolute top-2 left-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              {/* Room badge */}
              {showRoomBadge && photo.room_type && (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 rounded-full bg-black/60 text-white text-xs">
                    {getRoomIcon(photo.room_type)} {getRoomName(photo.room_type)}
                  </span>
                </div>
              )}

              {/* Hover overlay with actions */}
              {!isUploading && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhoto(photo);
                    }}
                    className="p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white mr-2"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(photo.id);
                      }}
                      disabled={isCurrentlyDeleting}
                      className="p-2 rounded-full bg-red-500/90 text-white hover:bg-red-500"
                    >
                      {isCurrentlyDeleting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Delete button always visible on mobile */}
              {onDelete && !isUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(photo.id);
                  }}
                  disabled={isCurrentlyDeleting}
                  className={cn(
                    "absolute top-2 right-2 p-1.5 rounded-full",
                    "bg-red-500 text-white shadow-md",
                    "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
                    isCurrentlyDeleting && "opacity-50"
                  )}
                >
                  {isCurrentlyDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Filename on hover */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="text-xs text-white truncate">{photo.filename}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              {selectedPhoto?.room_type && (
                <>
                  <span>{getRoomIcon(selectedPhoto.room_type)}</span>
                  <span>{getRoomName(selectedPhoto.room_type)}</span>
                  <span className="text-muted-foreground">•</span>
                </>
              )}
              <span className="text-muted-foreground truncate">
                {selectedPhoto?.filename}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center bg-black/5 min-h-[300px] max-h-[70vh]">
            {selectedPhoto?.preview_url && (
              <img
                src={selectedPhoto.preview_url}
                alt={selectedPhoto.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
          </div>
          {selectedPhoto?.ai_items && selectedPhoto.ai_items.length > 0 && (
            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Erkannte Gegenstände:
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedPhoto.ai_items.map((item, index) => (
                  <span
                    key={`${item.name}-${index}`}
                    className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                    style={primaryColor ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : undefined}
                  >
                    {item.count > 1 && `${item.count}x `}{item.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
