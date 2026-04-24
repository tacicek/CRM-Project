// =============================================================================
// CONSTANTS
// =============================================================================

export const PENDING_STATUSES = ["pending_verification", "pending", "new"] as const;
// fallback_distributed: distributed via 30km geographic fallback — still a successful distribution
export const VERIFIED_STATUSES = ["verified", "distributed", "completed", "fallback_distributed"] as const;
// Leads that went through verification but found no matching companies
export const NO_MATCH_STATUSES = ["no_matches", "unknown_plz", "expired"] as const;
// AI validation: waiting for customer to click double opt-in link
export const AWAITING_CONFIRMATION_STATUSES = ["awaiting_customer_confirmation"] as const;
// AI validation: customer never confirmed OR email unreachable (fake email)
export const RISKY_STATUSES = ["unconfirmed_risky"] as const;
export const MAX_RECURSION_DEPTH = 10;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_CONCURRENT_REQUESTS = 5;

// =============================================================================
// TYPES
// =============================================================================

export interface Lead {
  id: string;
  slug: string;
  service_type: string;
  from_plz: string;
  from_city: string;
  from_street: string | null;
  from_house_number: string | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_plz: string | null;
  to_city: string | null;
  to_street: string | null;
  to_house_number: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  status: string | null;
  created_at: string;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  is_flexible_date: boolean | null;
  description: string | null;
  special_items: string[] | null;
  max_companies: number;
  token_cost: number | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  spam_score: number | null;
  ip_address: string | null;
  packing_service_needed: boolean | null;
  cleaning_service_needed: boolean | null;
  storage_needed: boolean | null;
  piano_type: string | null;
  piano_brand: string | null;
  piano_weight_kg: number | null;
  property_type: string | null;
  bathroom_count: number | null;
  clearing_type: string | null;
  estimated_volume: string | null;
  disposal_type: string | null;
  items_description: string | null;
  storage_duration: string | null;
  storage_volume: string | null;
  detailed_form_data: Record<string, unknown> | null;
  form_version: number | null;
  piano_transport_needed: boolean | null;
  // AI-tabanlı Lead Quality Validation
  ai_quality_score: number | null;
  ai_validation_signals: string[] | null;
  ai_validated_at: string | null;
  ai_rejected_reason: string | null;
}

export interface BlacklistEntry {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_count: number;
  created_at: string;
}

export interface LeadDistribution {
  id: string;
  company_id: string;
  company_name: string;
  status: string;
  sent_at: string;
  token_cost: number;
}
