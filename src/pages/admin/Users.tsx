/**
 * Admin Users Page
 * 
 * Manages admin/moderator/super_admin users and their roles.
 * 
 * Refactored: Logic extracted to useAdminUsers hook, UI split into sub-components.
 * Previous: ~1186 lines -> Current: ~120 lines
 */

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, UserPlus, Users, Search, KeyRound, Eye, EyeOff } from "lucide-react";
import { ROLE_LABELS } from "@/lib/adminPermissions";

import { useAdminUsers } from "@/components/admin/users/useAdminUsers";
import { RoleInfoCards } from "@/components/admin/users/RoleInfoCards";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { CreateUserDialog } from "@/components/admin/users/CreateUserDialog";

const AdminUsers = () => {
  const {
    filteredUsers, userCountsByRole, isLoading,
    searchInputValue, setSearchInputValue, debouncedSetSearch, searchQuery, setSearchQuery,
    isCreateDialogOpen, isCreating, showPassword, setShowPassword, newUser, setNewUser,
    createUser, handleCreateDialogClose,
    userToDelete, setUserToDelete, isDeleting, deleteUser,
    updatingRoleUserId, roleChangeConfirmOpen, setRoleChangeConfirmOpen,
    pendingRoleChange, setPendingRoleChange, requestRoleChange, confirmRoleChange,
    passwordResetUser, setPasswordResetUser, newPassword, setNewPassword,
    isResettingPassword, resetUserPassword,
    fetchUsers, currentUser, adminRole, isOwner,
  } = useAdminUsers();

  const [showResetPassword, setShowResetPassword] = useState(false);

  return (
    <>
      <Helmet>
        <title>Admin-Benutzer | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-primary shrink-0" />
                Admin-Benutzer
              </h2>
              <p className="text-muted-foreground text-sm">Verwalten Sie Admin-Benutzer und deren Rollen</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchUsers} disabled={isLoading} className="flex-1 sm:flex-none">
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Aktualisieren</span>
              </Button>
              {(adminRole === "super_admin" || isOwner) && (
                <Button onClick={() => handleCreateDialogClose(true)} className="flex-1 sm:flex-none">
                  <UserPlus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Neuer Admin-Benutzer</span>
                  <span className="sm:hidden">Neu</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Benutzer suchen..."
              value={searchInputValue}
              onChange={(e) => {
                setSearchInputValue(e.target.value);
                debouncedSetSearch(e.target.value);
              }}
              className="pl-10"
              aria-label="Benutzer suchen"
            />
          </div>

          {/* Role Info Cards */}
          <RoleInfoCards userCountsByRole={userCountsByRole} />

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Admin-Benutzer ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Nur Benutzer mit Admin- oder Moderator-Rollen werden hier angezeigt. Firmen-Benutzer finden Sie unter "Firmen".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersTable
                filteredUsers={filteredUsers}
                isLoading={isLoading}
                searchQuery={searchQuery}
                adminRole={adminRole}
                currentUser={currentUser}
                updatingRoleUserId={updatingRoleUserId}
                isDeleting={isDeleting}
                isOwner={isOwner}
                onRequestRoleChange={requestRoleChange}
                onSetUserToDelete={setUserToDelete}
                onSetPasswordResetUser={(user) => { setPasswordResetUser(user); setNewPassword(""); setShowResetPassword(false); }}
                onClearSearch={() => { setSearchInputValue(""); setSearchQuery(""); }}
                onOpenCreateDialog={() => handleCreateDialogClose(true)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={isCreateDialogOpen}
          onOpenChange={handleCreateDialogClose}
          newUser={newUser}
          setNewUser={setNewUser}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          isCreating={isCreating}
          onCreateUser={createUser}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Admin-Benutzer löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie den Benutzer <strong>{userToDelete?.email}</strong> wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={deleteUser} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Löschen...</> : "Löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Role Change Confirmation Dialog */}
        <AlertDialog open={roleChangeConfirmOpen} onOpenChange={(open) => {
          if (!open) setPendingRoleChange(null);
          setRoleChangeConfirmOpen(open);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rolle ändern?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie die Rolle von <strong>{pendingRoleChange?.userName}</strong> von{" "}
                <strong>{pendingRoleChange ? ROLE_LABELS[pendingRoleChange.currentRole] : ""}</strong> zu{" "}
                <strong>{pendingRoleChange ? ROLE_LABELS[pendingRoleChange.newRole] : ""}</strong> ändern?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRoleChange(null)}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRoleChange}>Rolle ändern</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Reset Dialog (Owner only) */}
        <AlertDialog open={!!passwordResetUser} onOpenChange={(open) => { if (!open) { setPasswordResetUser(null); setNewPassword(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                Passwort zurücksetzen
              </AlertDialogTitle>
              <AlertDialogDescription>
                Neues Passwort für <strong>{passwordResetUser?.email}</strong> festlegen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="relative">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Neues Passwort (min. 8 Zeichen)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-destructive mt-1">Mindestens 8 Zeichen erforderlich</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResettingPassword} onClick={() => { setPasswordResetUser(null); setNewPassword(""); }}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={resetUserPassword}
                disabled={isResettingPassword || newPassword.length < 8}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isResettingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Wird gespeichert...</> : "Passwort speichern"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </>
  );
};

export default AdminUsers;
