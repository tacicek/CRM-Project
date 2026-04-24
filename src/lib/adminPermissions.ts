/**
 * Admin Permission System
 * 
 * Role Hierarchy (highest to lowest):
 * 1. Super Admin - Full access, can manage all roles
 * 2. Admin - Most access, cannot manage users/roles
 * 3. Moderator - Limited access (leads, verification, blog)
 */

export type AdminRole = "super_admin" | "admin" | "moderator";

export type AdminPermission =
  | "dashboard.view"
  | "leads.view"
  | "leads.manage"
  | "companies.view"
  | "companies.manage"
  | "verification.view"
  | "verification.manage"
  | "forms.view"
  | "forms.manage"
  | "token_packages.view"
  | "token_packages.manage"
  | "pricing.view"
  | "pricing.manage"
  | "analytics.view"
  | "statistics.view"
  | "blog.view"
  | "blog.manage"
  | "email_logs.view"
  | "manual_import.view"
  | "manual_import.manage"
  | "users.view"
  | "users.manage"
  | "settings.view"
  | "settings.manage";

// Role permission definitions
const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  // Super Admin - full access to everything including user management
  super_admin: [
    "dashboard.view",
    "leads.view",
    "leads.manage",
    "companies.view",
    "companies.manage",
    "verification.view",
    "verification.manage",
    "forms.view",
    "forms.manage",
    "token_packages.view",
    "token_packages.manage",
    "pricing.view",
    "pricing.manage",
    "analytics.view",
    "statistics.view",
    "blog.view",
    "blog.manage",
    "email_logs.view",
    "manual_import.view",
    "manual_import.manage",
    "users.view",
    "users.manage", // Only super_admin can manage users
    "settings.view",
    "settings.manage",
  ],

  // Admin - full access except user management
  admin: [
    "dashboard.view",
    "leads.view",
    "leads.manage",
    "companies.view",
    "companies.manage",
    "verification.view",
    "verification.manage",
    "forms.view",
    "forms.manage",
    "token_packages.view",
    "token_packages.manage",
    "pricing.view",
    "pricing.manage",
    "analytics.view",
    "statistics.view",
    "blog.view",
    "blog.manage",
    "email_logs.view",
    "manual_import.view",
    "manual_import.manage",
    "users.view", // Can view but NOT manage
    "settings.view",
    "settings.manage",
  ],
  
  // Moderator - limited access to leads, verification, and blog
  moderator: [
    "dashboard.view",
    "leads.view",
    "leads.manage",
    "verification.view",
    "verification.manage",
    "blog.view",
    "blog.manage",
    "settings.view",
    "settings.manage",
  ],
};

// Role hierarchy levels (higher = more power)
export const ROLE_LEVELS: Record<AdminRole, number> = {
  super_admin: 100,
  admin: 50,
  moderator: 10,
};

// Human-readable role names
export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
};

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Voller Zugriff inkl. Benutzerverwaltung",
  admin: "Voller Zugriff ohne Benutzerverwaltung",
  moderator: "Kann Anfragen verifizieren und Blog verwalten",
};

// Role colors for UI
export const ROLE_COLORS: Record<AdminRole, { bg: string; text: string; border: string }> = {
  super_admin: {
    bg: "bg-red-500/10",
    text: "text-red-600",
    border: "border-red-500/30",
  },
  admin: {
    bg: "bg-orange-500/10",
    text: "text-orange-600",
    border: "border-orange-500/30",
  },
  moderator: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    border: "border-amber-500/30",
  },
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role is a valid admin role (not a company user)
 */
export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "super_admin" || role === "admin" || role === "moderator";
}

/**
 * Get the level of a role (higher = more power)
 */
export function getRoleLevel(role: AdminRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_LEVELS[role] || 0;
}

/**
 * Check if a role can modify another role
 * Rule: You can only modify users with LOWER role levels
 */
export function canModifyRole(myRole: AdminRole | null | undefined, targetRole: AdminRole | null | undefined): boolean {
  if (!myRole) return false;
  
  // Only super_admin can modify roles
  if (myRole !== "super_admin") return false;
  
  // Can modify any role below super_admin
  const targetLevel = targetRole ? getRoleLevel(targetRole) : 0;
  return targetLevel < ROLE_LEVELS.super_admin;
}

/**
 * Get roles that a user can assign to others
 */
export function getAssignableRoles(myRole: AdminRole | null | undefined): AdminRole[] {
  if (!myRole || myRole !== "super_admin") return [];
  
  // Super admin can assign admin and moderator (not super_admin)
  return ["admin", "moderator"];
}

/**
 * Menu items configuration with required permissions
 */
export interface AdminMenuItem {
  title: string;
  url: string;
  icon: string;
  permission: AdminPermission;
  badge?: string;
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { title: "Dashboard", url: "/admin", icon: "LayoutDashboard", permission: "dashboard.view" },
  { title: "Verifizierung", url: "/admin/verification", icon: "ShieldCheck", permission: "verification.view" },
  { title: "Leads", url: "/admin/leads", icon: "FileText", permission: "leads.view" },
  { title: "Formulare", url: "/admin/forms", icon: "FormInput", permission: "forms.view" },
  { title: "Firmen", url: "/admin/companies", icon: "Building2", permission: "companies.view" },
  { title: "Token-Pakete", url: "/admin/token-packages", icon: "Coins", permission: "token_packages.view" },
  { title: "Preisgestaltung", url: "/admin/pricing", icon: "BadgeEuro", permission: "pricing.view" },
  { title: "Analytics", url: "/admin/analytics", icon: "BarChart3", permission: "analytics.view" },
  { title: "Statistiken", url: "/admin/statistics", icon: "PieChart", permission: "statistics.view" },
  { title: "Blog", url: "/admin/blog", icon: "BookOpen", permission: "blog.view" },
  { title: "E-Mail-Protokoll", url: "/admin/email-logs", icon: "Mail", permission: "email_logs.view" },
  { title: "Manueller Import", url: "/admin/manual-import", icon: "Upload", permission: "manual_import.view" },
  { title: "Benutzer", url: "/admin/users", icon: "Users", permission: "users.view" },
  { title: "Einstellungen", url: "/admin/settings", icon: "Settings", permission: "settings.view" },
];

/**
 * Get menu items that a role has access to
 */
export function getAccessibleMenuItems(role: AdminRole | null | undefined): AdminMenuItem[] {
  if (!role) return [];
  return ADMIN_MENU_ITEMS.filter(item => hasPermission(role, item.permission));
}
