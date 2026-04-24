import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Shield, ShieldCheck, UserPlus, Users, Mail, KeyRound } from "lucide-react";
import { AdminRole, ROLE_LABELS, ROLE_COLORS } from "@/lib/adminPermissions";
import { AdminUser } from "./types";
import { formatDateSafe } from "./utils";
import type { User } from "@supabase/supabase-js";

interface UsersTableProps {
  filteredUsers: AdminUser[];
  isLoading: boolean;
  searchQuery: string;
  adminRole: AdminRole | null;
  currentUser: User | null;
  updatingRoleUserId: string | null;
  isDeleting: boolean;
  isOwner: boolean;
  onRequestRoleChange: (userId: string, newRole: AdminRole, currentRole: AdminRole, userName: string) => void;
  onSetUserToDelete: (user: AdminUser) => void;
  onSetPasswordResetUser: (user: AdminUser) => void;
  onClearSearch: () => void;
  onOpenCreateDialog: () => void;
}

function RoleBadge({ role }: { role: AdminRole }) {
  const colors = ROLE_COLORS[role];
  const Icon = role === "super_admin" || role === "admin" ? ShieldCheck : Shield;
  return (
    <Badge className={`${colors.bg} ${colors.text} ${colors.border}`}>
      <Icon className="w-3 h-3 mr-1" />
      {ROLE_LABELS[role]}
    </Badge>
  );
}

function getUserName(user: AdminUser): string {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ""} ${user.last_name || ""}`.trim();
  }
  return user.email || "Benutzer";
}

function RoleSelect({ user, currentUser, updatingRoleUserId, isOwner, onRequestRoleChange }: {
  user: AdminUser;
  currentUser: User | null;
  updatingRoleUserId: string | null;
  isOwner: boolean;
  onRequestRoleChange: UsersTableProps["onRequestRoleChange"];
}) {
  return (
    <Select
      value={user.role}
      onValueChange={(value) => onRequestRoleChange(user.id, value as AdminRole, user.role, getUserName(user))}
      disabled={(!isOwner && user.id === currentUser?.id) || updatingRoleUserId === user.id}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="moderator">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            Moderator
          </div>
        </SelectItem>
        <SelectItem value="admin">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            Admin
          </div>
        </SelectItem>
        {isOwner && (
          <SelectItem value="super_admin">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              Super Admin
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// Loading skeleton
function TableSkeleton({ canManage }: { canManage: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Benutzer</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Rolle</TableHead>
            <TableHead>Erstellt</TableHead>
            {canManage && (
              <>
                <TableHead>Rolle ändern</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              {canManage && (
                <>
                  <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Empty state
function EmptyState({ searchQuery, canManage, onClearSearch, onOpenCreateDialog }: {
  searchQuery: string;
  canManage: boolean;
  onClearSearch: () => void;
  onOpenCreateDialog: () => void;
}) {
  return (
    <div className="text-center py-12">
      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground">
        {searchQuery ? "Keine Benutzer gefunden" : "Keine Admin-Benutzer vorhanden"}
      </p>
      {searchQuery && (
        <Button variant="link" className="mt-2" onClick={onClearSearch}>
          Suche zurücksetzen
        </Button>
      )}
      {!searchQuery && canManage && (
        <Button className="mt-4" onClick={onOpenCreateDialog}>
          <UserPlus className="w-4 h-4 mr-2" />
          Ersten Admin erstellen
        </Button>
      )}
    </div>
  );
}

export function UsersTable({
  filteredUsers, isLoading, searchQuery, adminRole, currentUser,
  updatingRoleUserId, isDeleting, isOwner, onRequestRoleChange, onSetUserToDelete,
  onSetPasswordResetUser, onClearSearch, onOpenCreateDialog,
}: UsersTableProps) {
  const canManage = adminRole === "super_admin" || isOwner;
  if (isLoading) return <TableSkeleton canManage={canManage} />;
  if (filteredUsers.length === 0) return <EmptyState searchQuery={searchQuery} canManage={canManage} onClearSearch={onClearSearch} onOpenCreateDialog={onOpenCreateDialog} />;

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredUsers.map((user) => (
          <div key={`mobile-${user.id}`} className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  user.role === "super_admin" ? "bg-red-500/10 text-red-600" :
                  user.role === "admin" ? "bg-orange-500/10 text-orange-600" :
                  "bg-amber-500/10 text-amber-600"
                }`}>
                  {(user.first_name?.[0] || user.email?.[0] || "?").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {user.first_name || user.last_name
                      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                      : <span className="text-muted-foreground">Kein Name</span>}
                    {user.id === currentUser?.id && <Badge variant="outline" className="text-xs">Sie</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{user.email || "-"}</div>
                </div>
              </div>
              <RoleBadge role={user.role} />
            </div>

            {canManage && (isOwner || (user.role !== "super_admin" && user.id !== currentUser?.id)) && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Rolle ändern:</span>
                <RoleSelect user={user} currentUser={currentUser} updatingRoleUserId={updatingRoleUserId} isOwner={isOwner} onRequestRoleChange={onRequestRoleChange} />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">Erstellt: {formatDateSafe(user.created_at)}</span>
              <div className="flex gap-1">
                {isOwner && user.id !== currentUser?.id && (
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onSetPasswordResetUser(user)}>
                    <KeyRound className="w-4 h-4 mr-1" />
                    Passwort
                  </Button>
                )}
                {canManage && (isOwner || (user.role !== "super_admin" && user.id !== currentUser?.id)) && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onSetUserToDelete(user)} disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Löschen
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benutzer</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Erstellt</TableHead>
              {canManage && (
                <>
                  <TableHead>Rolle ändern</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const canEditThisUser = isOwner || (user.role !== "super_admin" && user.id !== currentUser?.id);
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        user.role === "super_admin" ? "bg-red-500/10 text-red-600" :
                        user.role === "admin" ? "bg-orange-500/10 text-orange-600" :
                        "bg-amber-500/10 text-amber-600"
                      }`}>
                        {(user.first_name?.[0] || user.email?.[0] || "?").toUpperCase()}
                      </div>
                      <div>
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : <span className="text-muted-foreground">Kein Name</span>}
                        {user.id === currentUser?.id && <Badge variant="outline" className="ml-2 text-xs">Sie</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {user.email || "-"}
                    </div>
                  </TableCell>
                  <TableCell><RoleBadge role={user.role} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateSafe(user.created_at)}</TableCell>
                  {canManage && (
                    <>
                      <TableCell>
                        {canEditThisUser ? (
                          <RoleSelect user={user} currentUser={currentUser} updatingRoleUserId={updatingRoleUserId} isOwner={isOwner} onRequestRoleChange={onRequestRoleChange} />
                        ) : (
                          <div className="text-sm text-muted-foreground italic">Geschützt</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isOwner && user.id !== currentUser?.id && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => onSetPasswordResetUser(user)}
                              aria-label={`Passwort für ${user.email || "Benutzer"} zurücksetzen`}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          )}
                          {canEditThisUser && user.id !== currentUser?.id ? (
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onSetUserToDelete(user)}
                              disabled={isDeleting}
                              aria-label={`${user.email || "Benutzer"} löschen`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            !isOwner && <div className="text-sm text-muted-foreground italic">-</div>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
