/**
 * Shared type definitions for Team module
 */

export interface TeamMember {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  skills: string[] | null;
  is_active: boolean;
  color_code: string;
  created_at: string;
}

export interface Resource {
  id: string;
  company_id: string;
  resource_type: "vehicle" | "equipment";
  name: string;
  description: string | null;
  license_plate: string | null;
  capacity_m3: number | null;
  quantity: number;
  is_available: boolean;
  created_at: string;
}

export interface TeamAvailability {
  id: string;
  team_member_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  notes: string | null;
}

export interface Appointment {
  id: string;
  appointment_type: string;
  status: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  title: string;
  location_city: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  assigned_team_member_ids: string[] | null;
}

// Form state types
export interface MemberFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  color_code: string;
}

export interface ResourceFormState {
  resource_type: string;
  name: string;
  description: string;
  license_plate: string;
  capacity_m3: string;
  quantity: string;
}

export interface AvailabilityFormState {
  isAvailable: boolean;
  startTime: string;
  endTime: string;
  notes: string;
}
