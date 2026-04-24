/**
 * Shared TypeScript interfaces for edge functions
 */

export interface Lead {
  id: string;
  service_type: string;
  from_plz: string;
  to_plz?: string;
  from_rooms?: number;
  from_living_space_m2?: number;
  preferred_date?: string;
  packing_service_needed?: boolean;
  cleaning_service_needed?: boolean;
  storage_needed?: boolean;
  token_cost: number;
  max_companies: number;
  piano_type?: string;
  piano_weight_kg?: number;
  staircase_type?: string;
  staircase_turns?: number;
  moebellift_floor?: number;
}

export interface MatchedCompany {
  company_id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  distance_km: number;
  coverage_plz: string;
  coverage_radius_km: number;
}

export interface PricingSettings {
  token_value_chf: number;
  min_lead_price_tokens: number;
  max_lead_price_tokens: number;
  size_multipliers: Record<string, number>;
  offerten_multipliers: Record<string, number>;
}
