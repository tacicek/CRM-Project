const OWNER_EMAIL = "tuncaycicek@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export { OWNER_EMAIL };
