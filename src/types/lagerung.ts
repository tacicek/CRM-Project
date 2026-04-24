// Type definitions for Lagerung (Storage) service

export interface LagerungAnfrage {
  // Storage Type
  storage_type: "temporary" | "long_term" | "climate_controlled";
  storage_duration: string; // "1_month", "3_months", "6_months", "12_months", "unlimited"
  
  // Items to Store
  items: LagerungItem[];
  estimated_volume_m3?: number;
  
  // Pickup Address
  pickup_address: {
    street: string;
    house_number: string;
    plz: string;
    city: string;
    floor: number;
    has_lift: boolean;
    parking_available: boolean;
  };
  
  // Special Requirements
  requirements: {
    climate_controlled: boolean;
    security_level: "standard" | "high" | "maximum";
    access_frequency: "none" | "monthly" | "weekly" | "daily";
    insurance_needed: boolean;
    pickup_service: boolean;
    packing_service: boolean;
  };
  
  // Contact
  contact: {
    salutation: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    preferred_contact_time?: string;
  };
  
  // Timing
  preferred_start_date?: string;
  flexibility: "exact" | "flexible_1_week" | "flexible_2_weeks" | "flexible_1_month";
  
  // Notes
  notes?: string;
}

export interface LagerungItem {
  category: string;
  name: string;
  quantity: number;
  fragile?: boolean;
  special_handling?: string;
}

export const storageDurationLabels: Record<string, string> = {
  "kurzfristig": "Kurzfristig (wenige Tage)",
  "1-3_monate": "1-3 Monate",
  "3-6_monate": "3-6 Monate",
  "6-12_monate": "6-12 Monate",
  "langfristig": "Langfristig (1+ Jahr)",
};

export const accessFrequencyLabels: Record<string, string> = {
  "nie": "Kein Zugriff nötig",
  "selten": "Selten",
  "monatlich": "Monatlich",
  "wöchentlich": "Wöchentlich",
  "täglich": "Täglich",
};

export const volumeLabels: Record<string, string> = {
  "klein": "Klein (1-5 m³)",
  "mittel": "Mittel (5-15 m³)",
  "gross": "Gross (15-30 m³)",
  "sehr_gross": "Sehr gross (30+ m³)",
};

