// =============================================================================
// VIRTUAL BESICHTIGUNG TYPES
// =============================================================================

export type BesichtigungStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "analyzing"
  | "analyzed"
  | "completed"
  | "expired";

export type RoomType =
  | "wohnzimmer"
  | "schlafzimmer"
  | "kueche"
  | "badezimmer"
  | "kinderzimmer"
  | "buero"
  | "keller"
  | "estrich"
  | "garage"
  | "balkon"
  | "flur"
  | "abstellraum"
  | "sonstiges";

export type AccessDifficulty = "einfach" | "mittel" | "schwierig";

export type TruckSize = "transporter" | "3.5t" | "7.5t" | "18t";

// =============================================================================
// ROOM CONFIGURATION
// =============================================================================

export interface RoomConfig {
  id: RoomType;
  name: string;
  icon: string;
  description?: string;
}

export const ROOM_TYPES: RoomConfig[] = [
  { id: "wohnzimmer", name: "Wohnzimmer", icon: "🛋️", description: "Sofa, TV, Regale" },
  { id: "schlafzimmer", name: "Schlafzimmer", icon: "🛏️", description: "Bett, Schrank, Kommode" },
  { id: "kueche", name: "Küche", icon: "🍳", description: "Küchenmöbel, Geräte" },
  { id: "badezimmer", name: "Badezimmer", icon: "🚿", description: "Bad-/Spiegelschränke" },
  { id: "kinderzimmer", name: "Kinderzimmer", icon: "🧸", description: "Kinderbett, Spielzeug" },
  { id: "buero", name: "Büro/Arbeitszimmer", icon: "💼", description: "Schreibtisch, Bürostuhl" },
  { id: "keller", name: "Keller", icon: "📦", description: "Lagerräume, Werkzeug" },
  { id: "estrich", name: "Estrich/Dachboden", icon: "🏠", description: "Dachboden-Lager" },
  { id: "garage", name: "Garage", icon: "🚗", description: "Fahrzeuge, Werkzeug" },
  { id: "balkon", name: "Balkon/Terrasse", icon: "🌿", description: "Gartenmöbel, Pflanzen" },
  { id: "flur", name: "Flur/Eingang", icon: "🚪", description: "Garderobe, Schuhe" },
  { id: "abstellraum", name: "Abstellraum", icon: "🗄️", description: "Reinigungsgeräte" },
  { id: "sonstiges", name: "Sonstiges", icon: "📍", description: "Andere Räume" },
];

// =============================================================================
// SESSION
// =============================================================================

export interface BesichtigungSession {
  id: string;
  token: string;
  company_id: string;
  lead_id: string | null;
  offer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  from_address: string | null;
  from_plz: string | null;
  from_city: string | null;
  status: BesichtigungStatus;
  created_at: string;
  uploaded_at: string | null;
  analyzed_at: string | null;
  completed_at: string | null;
  expires_at: string;
  customer_notes: string | null;
  created_by: string | null;
}

// =============================================================================
// PHOTO
// =============================================================================

export interface BesichtigungPhoto {
  id: string;
  session_id: string;
  storage_path: string;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  room_type: RoomType | null;
  ai_labels: string[];
  ai_items: DetectedItem[];
  ai_processed: boolean;
  ai_processed_at: string | null;
  uploaded_at: string;
  // Client-side only
  preview_url?: string;
  upload_progress?: number;
}

// =============================================================================
// VIDEO
// =============================================================================

export interface BesichtigungVideo {
  id: string;
  session_id: string;
  storage_path: string;
  filename: string;
  file_size: number | null;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  uploaded_at: string;
  // Client-side only
  preview_url?: string;
  upload_progress?: number;
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

export interface DetectedItem {
  name: string;
  count: number;
  volume_m3?: number;
  special?: boolean;
  confidence?: number;
}

export interface RoomBreakdown {
  room: RoomType;
  volume_m3: number;
  items: string[];
  photo_count?: number;
}

export interface BesichtigungAnalysis {
  id: string;
  session_id: string;
  estimated_volume_m3: number | null;
  estimated_time_hours: number | null;
  recommended_workers: number | null;
  recommended_truck: TruckSize | null;
  room_breakdown: RoomBreakdown[];
  detected_items: DetectedItem[];
  special_items: string[];
  special_requirements: string[];
  from_access_difficulty: AccessDifficulty | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_parking_distance: "direkt" | "nah" | "weit" | null;
  confidence: number | null;
  raw_response: unknown;
  analyzed_at: string;
}

// =============================================================================
// SESSION WITH RELATIONS
// =============================================================================

export interface BesichtigungSessionWithData extends BesichtigungSession {
  photos: BesichtigungPhoto[];
  videos: BesichtigungVideo[];
  analysis: BesichtigungAnalysis | null;
  company?: {
    id: string;
    company_name: string;
    logo_url: string | null;
    primary_color: string | null;
  };
}

// =============================================================================
// CREATE SESSION REQUEST
// =============================================================================

export interface CreateBesichtigungSessionRequest {
  company_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  lead_id?: string;
  offer_id?: string;
  from_address?: string;
  from_plz?: string;
  from_city?: string;
  expires_days?: number;
}

export interface CreateBesichtigungSessionResponse {
  session: BesichtigungSession;
  url: string;
}

// =============================================================================
// UPLOAD TYPES
// =============================================================================

export interface UploadFileRequest {
  token: string;
  room_type: RoomType;
  file: File;
}

export interface UploadProgress {
  file_id: string;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

// =============================================================================
// PUBLIC SESSION (for customer portal)
// =============================================================================

export interface PublicBesichtigungSession {
  id: string;
  status: BesichtigungStatus;
  customer_name: string;
  from_address: string | null;
  from_plz: string | null;
  from_city: string | null;
  expires_at: string;
  /**
   * Sprache des KUNDEN, serverseitig aufgelöst (Offerte → Lead → Firmen-Default) von
   * `validate-besichtigung-token`. Die Seite hat keinen eingeloggten Operator und darf
   * die Sprache deshalb nirgendwo anders herholen.
   */
  language: string;
  company: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
  };
  photos: Pick<BesichtigungPhoto, "id" | "room_type" | "filename" | "uploaded_at">[];
  videos: Pick<BesichtigungVideo, "id" | "filename" | "uploaded_at">[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export const getRoomName = (roomType: RoomType): string => {
  const room = ROOM_TYPES.find((r) => r.id === roomType);
  return room?.name || roomType;
};

export const getRoomIcon = (roomType: RoomType): string => {
  const room = ROOM_TYPES.find((r) => r.id === roomType);
  return room?.icon || "📍";
};

export const getStatusLabel = (status: BesichtigungStatus): string => {
  const labels: Record<BesichtigungStatus, string> = {
    pending: "Ausstehend",
    uploading: "Wird hochgeladen",
    uploaded: "Hochgeladen",
    analyzing: "Wird analysiert",
    analyzed: "Analysiert",
    completed: "Abgeschlossen",
    expired: "Abgelaufen",
  };
  return labels[status] || status;
};

export const getStatusColor = (status: BesichtigungStatus): string => {
  const colors: Record<BesichtigungStatus, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    uploading: "bg-blue-100 text-blue-700 border-blue-200",
    uploaded: "bg-cyan-100 text-cyan-700 border-cyan-200",
    analyzing: "bg-purple-100 text-purple-700 border-purple-200",
    analyzed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
};
