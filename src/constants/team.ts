/**
 * Shared constants for the Team module.
 *
 * Role and colour labels are locale-aware: the operator's dashboard language decides
 * how a role reads, so every lookup takes the locale explicitly instead of shipping a
 * hardcoded German map. The stored values (`fahrer`, `#3B82F6`, …) are unchanged — only
 * the labels are translated.
 */

import { Car, HardHat, Wrench, Briefcase, Building2, Users, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/locale";
import { createTranslator, type MessageKey } from "@/i18n/translator";

export interface RoleOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface ColorOption {
  value: string;
  name: string;
}

/** The role values stored on `team_members.role`. */
export const ROLE_VALUES = ["fahrer", "helfer", "reiniger", "teamleiter", "buero"] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

const ROLE_ICONS: Record<RoleValue, LucideIcon> = {
  fahrer: Car,
  helfer: HardHat,
  reiniger: Wrench,
  teamleiter: Briefcase,
  buero: Building2,
};

const isRoleValue = (value: string): value is RoleValue =>
  (ROLE_VALUES as readonly string[]).includes(value);

/** Hex colour + catalog key. The hex value is what lands in `team_members.color_code`. */
const COLORS: ReadonlyArray<{ value: string; key: MessageKey }> = [
  { value: "#3B82F6", key: "team.color.blue" },
  { value: "#10B981", key: "team.color.green" },
  { value: "#8B5CF6", key: "team.color.violet" },
  { value: "#F59E0B", key: "team.color.amber" },
  { value: "#EF4444", key: "team.color.red" },
  { value: "#EC4899", key: "team.color.pink" },
  { value: "#06B6D4", key: "team.color.cyan" },
  { value: "#84CC16", key: "team.color.lime" },
  { value: "#F97316", key: "team.color.orange" },
  { value: "#6366F1", key: "team.color.indigo" },
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

// --- Locale-aware lookups -----------------------------------------------------------

export const getRoleOptions = (locale: Locale): RoleOption[] => {
  const t = createTranslator(locale);
  return ROLE_VALUES.map((value) => ({
    value,
    label: t(`team.role.${value}` as const),
    icon: ROLE_ICONS[value],
  }));
};

export const getColorOptions = (locale: Locale): ColorOption[] => {
  const t = createTranslator(locale);
  return COLORS.map(({ value, key }) => ({ value, name: t(key) }));
};

/** Unknown roles (free text from an older import) are shown as stored, not swallowed. */
export const getRoleLabel = (roleValue: string | null, locale: Locale): string | null => {
  if (!roleValue) return null;
  if (!isRoleValue(roleValue)) return roleValue;
  return createTranslator(locale)(`team.role.${roleValue}` as const);
};

export const getRoleIcon = (roleValue: string | null): LucideIcon => {
  if (!roleValue || !isRoleValue(roleValue)) return Users;
  return ROLE_ICONS[roleValue];
};

export const getRandomColor = (): string =>
  COLORS[Math.floor(Math.random() * COLORS.length)].value;
