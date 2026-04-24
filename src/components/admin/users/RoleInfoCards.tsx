import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Shield, Check, X } from "lucide-react";
import { AdminRole, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS } from "@/lib/adminPermissions";

interface RoleInfoCardsProps {
  userCountsByRole: Record<string, number>;
}

const ROLE_PERMISSIONS: Record<AdminRole, Array<{ label: string; allowed: boolean }>> = {
  super_admin: [
    { label: "Voller Systemzugriff", allowed: true },
    { label: "Benutzerverwaltung", allowed: true },
    { label: "Rollenverwaltung", allowed: true },
  ],
  admin: [
    { label: "Voller Funktionszugriff", allowed: true },
    { label: "Keine Benutzerverwaltung", allowed: false },
  ],
  moderator: [
    { label: "Dashboard anzeigen", allowed: true },
    { label: "Leads anzeigen", allowed: true },
    { label: "Blog verwalten", allowed: true },
    { label: "Kein Zugriff auf Firmen", allowed: false },
    { label: "Kein Zugriff auf Einstellungen", allowed: false },
  ],
};

export function RoleInfoCards({ userCountsByRole }: RoleInfoCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {(["super_admin", "admin", "moderator"] as AdminRole[]).map((role) => {
        const colors = ROLE_COLORS[role];
        const userCount = userCountsByRole[role] ?? 0;
        const Icon = role === "super_admin" || role === "admin" ? ShieldCheck : Shield;
        const permissions = ROLE_PERMISSIONS[role];

        return (
          <Card key={role} className={`${colors.border} border-2`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-lg ${colors.text} flex items-center gap-2`}>
                  <Icon className="w-5 h-5" />
                  {ROLE_LABELS[role]}
                </CardTitle>
                <Badge variant="outline">{userCount} Benutzer</Badge>
              </div>
              <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Berechtigungen:</p>
                <div className="flex flex-wrap gap-1">
                  {permissions.map((perm) => (
                    <Badge
                      key={perm.label}
                      variant="outline"
                      className={`text-xs ${
                        perm.allowed
                          ? "bg-green-500/10 text-green-600 border-green-500/30"
                          : "bg-red-500/10 text-red-600 border-red-500/30"
                      }`}
                    >
                      {perm.allowed ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                      {perm.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
