/**
 * Validation and sanitization helpers
 */

/**
 * Validate email format
 * Returns true if email is empty (optional field) or valid format
 */
export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Sanitize phone number - remove non-digit characters except leading +
 * Returns null if empty
 */
export function sanitizePhone(phone: string): string | null {
  if (!phone || !phone.trim()) return null;
  // Keep leading + if exists, remove all other non-digits
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '') || null;
  }
  return trimmed.replace(/\D/g, '') || null;
}

/**
 * Parse capacity value (m³)
 * Returns null for empty/invalid, otherwise the parsed number
 */
export function parseCapacity(value: string): number | null {
  if (!value || !value.trim()) return null;
  const num = parseFloat(value.trim());
  return isNaN(num) || num < 0 ? null : num;
}

/**
 * Parse quantity value
 * Returns 1 for empty/invalid, otherwise the parsed positive integer
 */
export function parseQuantity(value: string): number {
  if (!value || !value.trim()) return 1;
  const num = parseInt(value.trim(), 10);
  return isNaN(num) || num < 1 ? 1 : num;
}

/**
 * Parse time string to minutes since midnight
 * Returns null if invalid format
 */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length < 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  return hours * 60 + minutes;
}

/**
 * Calculate hours between two time strings
 * Returns 0 if invalid
 */
export function calculateHoursBetween(startTime: string | null, endTime: string | null): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  
  if (start === null || end === null) return 0;
  
  const diff = end - start;
  return diff > 0 ? diff / 60 : 0;
}

/**
 * Validate that end time is after start time
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  
  if (start === null || end === null) return false;
  return end > start;
}

/**
 * Get initials from first and last name
 * Returns "?" for empty values
 */
export function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = firstName?.[0] || '?';
  const last = lastName?.[0] || '?';
  return `${first}${last}`;
}
