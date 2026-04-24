import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// Currency Formatting - Swiss Franc (CHF)
// =============================================================================

/**
 * Format a number as Swiss Franc currency
 * Handles NaN, undefined, null gracefully
 */
export function formatCHF(amount: number | null | undefined): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(safeAmount!);
}

/**
 * Format a number as Swiss Franc without currency symbol
 * Useful for input fields
 */
export function formatCHFValue(amount: number | null | undefined): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount!);
}

// =============================================================================
// Date/Time Formatting - Swiss German
// =============================================================================

/**
 * Format a date string to Swiss German format (DD.MM.YYYY)
 */
export function formatDateCH(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

/**
 * Format a time string to Swiss German format (HH:MM Uhr)
 */
export function formatTimeCH(timeString: string | undefined | null): string {
  if (!timeString) return "-";
  // Validate format: expect at least HH:MM
  if (timeString.length < 5) return timeString;
  // Extract HH:MM safely
  const match = /^(\d{1,2}):(\d{2})/.exec(timeString);
  if (!match) return timeString;
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes} Uhr`;
}

// =============================================================================
// Number Validation Helpers
// =============================================================================

/**
 * Safely parse a number with bounds and fallback
 */
export function safeParseNumber(
  value: string | number | null | undefined,
  min: number,
  max: number,
  defaultVal: number
): number {
  if (value === null || value === undefined || value === '') return defaultVal;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return defaultVal;
  return Math.max(min, Math.min(max, num));
}

/**
 * Safely parse an integer with bounds and fallback
 */
export function safeParseInt(
  value: string | number | null | undefined,
  min: number,
  max: number,
  defaultVal: number
): number {
  if (value === null || value === undefined || value === '') return defaultVal;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!Number.isFinite(num)) return defaultVal;
  return Math.max(min, Math.min(max, Math.floor(num)));
}
