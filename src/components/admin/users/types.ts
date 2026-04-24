import { AdminRole } from "@/lib/adminPermissions";

export interface AdminUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  role: AdminRole;
}

export interface NewUserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
}

export interface PendingRoleChange {
  userId: string;
  newRole: AdminRole;
  currentRole: AdminRole;
  userName: string;
}

export const MIN_PASSWORD_LENGTH = 8;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const initialNewUserState: NewUserFormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "moderator" as AdminRole,
};
