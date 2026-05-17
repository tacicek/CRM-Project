import { z } from "zod";

// ---------------------------------------------------------------------------
// Password reset URL
// ---------------------------------------------------------------------------

/**
 * Builds the `redirectTo` URL used in Supabase's `resetPasswordForEmail`.
 */
export function getResetPasswordUrl(
  appUrl: string | undefined,
  origin: string = typeof window !== "undefined" ? window.location.origin : ""
): string {
  const base = appUrl?.trim() ? appUrl.replace(/\/$/, "") : origin;
  return `${base}/auth/reset-password`;
}

// ---------------------------------------------------------------------------
// Form validation schemas
// ---------------------------------------------------------------------------

export const emailSchema = z.string().email("Ungültige E-Mail-Adresse");
export const loginPasswordSchema = z.string().min(6, "Passwort muss mindestens 6 Zeichen haben");
export const resetPasswordSchema = z.string().min(8, "Passwort muss mindestens 8 Zeichen haben");

export type AuthMode = "login" | "forgot";

export interface AuthFormErrors {
  email?: string;
  password?: string;
}

export function validateAuthForm(
  email: string,
  password: string,
  mode: AuthMode
): AuthFormErrors {
  const errors: AuthFormErrors = {};

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    errors.email = emailResult.error.errors[0].message;
  }

  if (mode !== "forgot") {
    const passwordResult = loginPasswordSchema.safeParse(password);
    if (!passwordResult.success) {
      errors.password = passwordResult.error.errors[0].message;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Reset-password form validation
// ---------------------------------------------------------------------------

export interface ResetPasswordErrors {
  password?: string;
  confirmPassword?: string;
}

export function validateResetPasswordForm(
  password: string,
  confirmPassword: string
): ResetPasswordErrors {
  const errors: ResetPasswordErrors = {};

  const passwordResult = resetPasswordSchema.safeParse(password);
  if (!passwordResult.success) {
    errors.password = passwordResult.error.errors[0].message;
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwörter stimmen nicht überein";
  }

  return errors;
}
