/**
 * Shared constants for Team module
 */

import { Car, HardHat, Wrench, Briefcase, Building2, Users, type LucideIcon } from "lucide-react";

export interface RoleOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface ColorOption {
  value: string;
  name: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: "fahrer", label: "Fahrer", icon: Car },
  { value: "helfer", label: "Helfer", icon: HardHat },
  { value: "reiniger", label: "Reiniger", icon: Wrench },
  { value: "teamleiter", label: "Teamleiter", icon: Briefcase },
  { value: "buero", label: "Büro", icon: Building2 },
];

export const COLOR_OPTIONS: ColorOption[] = [
  { value: "#3B82F6", name: "Blau" },
  { value: "#10B981", name: "Grün" },
  { value: "#8B5CF6", name: "Violet" },
  { value: "#F59E0B", name: "Amber" },
  { value: "#EF4444", name: "Rot" },
  { value: "#EC4899", name: "Pink" },
  { value: "#06B6D4", name: "Cyan" },
  { value: "#84CC16", name: "Lime" },
  { value: "#F97316", name: "Orange" },
  { value: "#6366F1", name: "Indigo" },
];

export const DEFAULT_WORK_HOURS = {
  START: "08:00",
  END: "17:00",
} as const;

export const APPOINTMENT_TYPE_COLORS: Record<string, { bg: string; label: string }> = {
  besichtigung: { bg: "bg-violet-500", label: "Besichtigung" },
  service: { bg: "bg-emerald-500", label: "Auftrag" },
  follow_up: { bg: "bg-amber-500", label: "Nachkontrolle" },
  meeting: { bg: "bg-blue-500", label: "Besprechung" },
  blocked: { bg: "bg-gray-500", label: "Blockiert" },
};

// Helper functions
export function getRoleLabel(roleValue: string | null): string | null {
  if (!roleValue) return null;
  return ROLE_OPTIONS.find(r => r.value === roleValue)?.label || roleValue;
}

export function getRoleIcon(roleValue: string | null): LucideIcon {
  if (!roleValue) return Users;
  return ROLE_OPTIONS.find(r => r.value === roleValue)?.icon || Users;
}

export function getRandomColor(): string {
  return COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].value;
}
