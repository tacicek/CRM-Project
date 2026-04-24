import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Camera,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  User,
  Send,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { RoomSelector } from "@/components/besichtigung/RoomSelector";
import { UploadZone } from "@/components/besichtigung/UploadZone";
import { PhotoGrid } from "@/components/besichtigung/PhotoGrid";
import {
  RoomType,
  BesichtigungPhoto,
  PublicBesichtigungSession,
  ROOM_TYPES,
} from "@/types/virtualBesichtigung";

type SessionStatus = "loading" | "valid" | "expired" | "completed" | "error";

export default function VirtualBesichtigung() {
  const { token } = useParams<{ token: string }>();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [session, setSession] = useState<PublicBesichtigungSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [selectedRoom, setSelectedRoom] = useState<RoomType>("wohnzimmer");
  const [photos, setPhotos] = useState<Record<RoomType, BesichtigungPhoto[]>>(
    {} as Record<RoomType, BesichtigungPhoto[]>
  );
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      if (!token) {
        setSessionStatus("error");
        setError("Kein Token angegeben");
        return;
      }

      try {
        // Call Edge Function to validate token and get session
        const { data, error: fnError } = await supabase.functions.invoke(
          "validate-besichtigung-token",
          {
            body: { token },
          }
        );

        if (fnError) throw fnError;

        if (!data?.session) {
          setSessionStatus("error");
          setError("Session nicht gefunden");
          return;
        }

        const sessionData = data.session as PublicBesichtigungSession;

        // Check status
        if (sessionData.status === "completed") {
          setSessionStatus("completed");
          setSession(sessionData);
          return;
        }

        // Check expiration
        if (new Date(sessionData.expires_at) < new Date()) {
          setSessionStatus("expired");
          setSession(sessionData);
          return;
        }

        setSession(sessionData);
        setSessionStatus("valid");

        // Load existing photos grouped by room
        if (sessionData.photos?.length) {
          const grouped = sessionData.photos.reduce((acc, photo) => {
            const room = photo.room_type || "sonstiges";
            if (!acc[room]) acc[room] = [];
            acc[room].push(photo as BesichtigungPhoto);
            return acc;
          }, {} as Record<RoomType, BesichtigungPhoto[]>);
          setPhotos(grouped);
        }
      } catch (err) {
        console.error("Error fetching session:", err);
        setSessionStatus("error");
        setError("Fehler beim Laden der Session");
      }
    };

    fetchSession();
  }, [token]);

  // Handle file upload
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!token || !session) return;

      setIsUploading(true);

      for (const file of files) {
        const photoId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        // Add placeholder photo with preview
        const placeholderPhoto: BesichtigungPhoto = {
          id: photoId,
          session_id: session.id,
          storage_path: "",
          filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          room_type: selectedRoom,
          ai_labels: [],
          ai_items: [],
          ai_processed: false,
          ai_processed_at: null,
          uploaded_at: new Date().toISOString(),
          preview_url: previewUrl,
          upload_progress: 0,
        };

        setPhotos((prev) => ({
          ...prev,
          [selectedRoom]: [...(prev[selectedRoom] || []), placeholderPhoto],
        }));

        try {
          // Upload to storage via Edge Function
          const formData = new FormData();
          formData.append("file", file);
          formData.append("token", token);
          formData.append("room_type", selectedRoom);

          const { data, error: uploadError } = await supabase.functions.invoke(
            "upload-besichtigung-photo",
            {
              body: formData,
            }
          );

          if (uploadError) throw uploadError;

          // Update photo with server data
          setPhotos((prev) => ({
            ...prev,
            [selectedRoom]: prev[selectedRoom].map((p) =>
              p.id === photoId
                ? {
                    ...p,
                    id: data.photo.id,
                    storage_path: data.photo.storage_path,
                    upload_progress: 100,
                  }
                : p
            ),
          }));

          toast.success(`${file.name} hochgeladen`);
        } catch (err) {
          console.error("Upload error:", err);
          toast.error(`Fehler beim Hochladen von ${file.name}`);

          // Remove failed photo
          setPhotos((prev) => ({
            ...prev,
            [selectedRoom]: prev[selectedRoom].filter((p) => p.id !== photoId),
          }));
          URL.revokeObjectURL(previewUrl);
        }
      }

      setIsUploading(false);
    },
    [token, session, selectedRoom]
  );

  // Handle photo deletion
  const handleDeletePhoto = useCallback(
    async (photoId: string) => {
      if (!token) return;

      setDeletingPhotoId(photoId);

      try {
        const { error: deleteError } = await supabase.functions.invoke(
          "delete-besichtigung-photo",
          {
            body: { token, photo_id: photoId },
          }
        );

        if (deleteError) throw deleteError;

        // Remove from local state
        setPhotos((prev) => {
          const updated = { ...prev };
          for (const room of Object.keys(updated) as RoomType[]) {
            updated[room] = updated[room].filter((p) => p.id !== photoId);
          }
          return updated;
        });

        toast.success("Foto gelöscht");
      } catch (err) {
        console.error("Delete error:", err);
        toast.error("Fehler beim Löschen");
      } finally {
        setDeletingPhotoId(null);
      }
    },
    [token]
  );

  // Submit/complete session
  const handleSubmit = useCallback(async () => {
    if (!token) return;

    setIsSubmitting(true);

    try {
      const { error: submitError } = await supabase.functions.invoke(
        "complete-besichtigung",
        {
          body: {
            token,
            customer_notes: customerNotes,
          },
        }
      );

      if (submitError) throw submitError;

      setSessionStatus("completed");
      toast.success("Besichtigung abgeschlossen!");
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Fehler beim Abschließen");
    } finally {
      setIsSubmitting(false);
    }
  }, [token, customerNotes]);

  // Calculate totals
  const totalPhotos = Object.values(photos).flat().length;
  const photoCounts = ROOM_TYPES.reduce((acc, room) => {
    acc[room.id] = photos[room.id]?.length || 0;
    return acc;
  }, {} as Record<RoomType, number>);

  const primaryColor = session?.company?.primary_color || "#0891B2";

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (sessionStatus === "error") {
    return (
      <>
        <Helmet>
          <title>Fehler | Virtuelle Besichtigung</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Ungültiger Link
              </h1>
              <p className="text-gray-600 mb-6">
                {error || "Dieser Link ist ungültig oder existiert nicht mehr."}
              </p>
              <p className="text-sm text-gray-500">
                Bitte kontaktieren Sie die Umzugsfirma für einen neuen Link.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Expired state
  if (sessionStatus === "expired") {
    return (
      <>
        <Helmet>
          <title>Link abgelaufen | Virtuelle Besichtigung</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Link abgelaufen
              </h1>
              <p className="text-gray-600 mb-6">
                Dieser Besichtigungs-Link ist leider abgelaufen.
              </p>
              <p className="text-sm text-gray-500">
                Bitte kontaktieren Sie{" "}
                <span className="font-medium">{session?.company?.name}</span> für
                einen neuen Link.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Completed state
  if (sessionStatus === "completed") {
    return (
      <>
        <Helmet>
          <title>Abgeschlossen | Virtuelle Besichtigung</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <CheckCircle
                  className="w-10 h-10"
                  style={{ color: primaryColor }}
                />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Vielen Dank!
              </h1>
              <p className="text-gray-600 mb-6">
                Ihre virtuelle Besichtigung wurde erfolgreich übermittelt.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>
                  <span className="font-medium">{session?.company?.name}</span>{" "}
                  wird Ihre Fotos analysieren und sich mit einem Angebot bei
                  Ihnen melden.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Main upload portal
  return (
    <>
      <Helmet>
        <title>Virtuelle Besichtigung | {session?.company?.name || "Offerio"}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header
          className="bg-white border-b-4"
          style={{ borderColor: primaryColor }}
        >
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {session?.company?.logo_url ? (
                  <img
                    src={session.company.logo_url}
                    alt={session.company.name}
                    className="h-12 object-contain"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {session?.company?.name?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Virtuelle Besichtigung
                  </h1>
                  <p className="text-sm text-gray-600">
                    {session?.company?.name}
                  </p>
                </div>
              </div>

              {/* Customer info */}
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{session?.customer_name}</span>
                </div>
                {session?.from_city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {session.from_plz} {session.from_city}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Instructions */}
          <Card
            className="border-l-4"
            style={{ borderLeftColor: primaryColor }}
          >
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  style={{ color: primaryColor }}
                />
                <div className="space-y-2">
                  <h2 className="font-semibold text-gray-900">
                    So funktioniert's:
                  </h2>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>
                      📸 Fotografieren Sie alle Zimmer Ihrer Wohnung
                    </li>
                    <li>
                      🪑 Zeigen Sie grosse und schwere Möbel deutlich
                    </li>
                    <li>
                      📦 Vergessen Sie Keller, Estrich und Garage nicht
                    </li>
                    <li>
                      💬 Fügen Sie am Ende zusätzliche Informationen hinzu
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Room selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-5 h-5" style={{ color: primaryColor }} />
                Raum auswählen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RoomSelector
                selectedRoom={selectedRoom}
                onRoomChange={setSelectedRoom}
                photoCounts={photoCounts}
                primaryColor={primaryColor}
              />
            </CardContent>
          </Card>

          {/* Upload zone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Fotos hochladen -{" "}
                {ROOM_TYPES.find((r) => r.id === selectedRoom)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <UploadZone
                roomType={selectedRoom}
                onFilesSelected={handleFilesSelected}
                isUploading={isUploading}
                primaryColor={primaryColor}
              />

              {photos[selectedRoom]?.length > 0 && (
                <PhotoGrid
                  photos={photos[selectedRoom]}
                  onDelete={handleDeletePhoto}
                  isDeleting={deletingPhotoId}
                  primaryColor={primaryColor}
                />
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Zusätzliche Informationen (optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="z.B. Schweres Klavier im Wohnzimmer, enge Treppe, 3. Stock ohne Lift, Parkplatz weit entfernt..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Submit section */}
          <Card
            className="border-2"
            style={{ borderColor: totalPhotos > 0 ? primaryColor : undefined }}
          >
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-lg font-semibold text-gray-900">
                    {totalPhotos} Foto{totalPhotos !== 1 ? "s" : ""} hochgeladen
                  </p>
                  <p className="text-sm text-gray-500">
                    {Object.keys(photos).filter((k) => photos[k as RoomType]?.length > 0).length} von{" "}
                    {ROOM_TYPES.length} Räumen dokumentiert
                  </p>
                </div>

                <Button
                  size="lg"
                  disabled={totalPhotos === 0 || isSubmitting}
                  onClick={handleSubmit}
                  className="gap-2 px-8"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Besichtigung abschliessen
                    </>
                  )}
                </Button>
              </div>

              {totalPhotos === 0 && (
                <p className="text-center text-sm text-amber-600 mt-4">
                  Bitte laden Sie mindestens ein Foto hoch, um fortzufahren.
                </p>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center text-sm text-gray-500">
          <p>
            Powered by{" "}
            <a
              href="https://offerio.ch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Offerio
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
