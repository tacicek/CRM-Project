import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AdminRole, ROLE_LABELS } from "@/lib/adminPermissions";
import { useDebouncedCallback } from "use-debounce";
import { AdminUser, PendingRoleChange, NewUserFormState, initialNewUserState, MIN_PASSWORD_LENGTH } from "./types";
import { isValidAdminUser, isValidEmail, getUserFriendlyError } from "./utils";
import { isOwnerEmail } from "@/lib/ownerUtils";
import { logAdminAction } from "@/lib/auditLogger";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleChangeConfirmOpen, setRoleChangeConfirmOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [newUser, setNewUser] = useState<NewUserFormState>(initialNewUserState);

  const { toast } = useToast();
  const { user: currentUser, adminRole, isOwner } = useAuth();

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Debounced search
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
  }, 300);

  const fetchUsers = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator", "super_admin"]);

      if (!isMountedRef.current) return;
      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setUsers([]);
        return;
      }

      const adminUserIds = roles.map((r) => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", adminUserIds)
        .order("created_at", { ascending: false });

      if (!isMountedRef.current) return;
      if (profilesError) throw profilesError;

      const adminUsers: AdminUser[] = (profiles || [])
        .map((profile) => {
          const userRole = roles.find((r) => r.user_id === profile.id);
          return {
            id: profile.id,
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            created_at: profile.created_at,
            role: userRole?.role as AdminRole,
          };
        })
        .filter(isValidAdminUser)
        .filter((u) => !isOwnerEmail(u.email));

      setUsers(adminUsers);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === "AbortError") return;

      console.error("Error fetching admin users:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const requestRoleChange = useCallback(
    (userId: string, newRole: AdminRole, currentRole: AdminRole, userName: string) => {
      if (updatingRoleUserId) return;

      if (!isOwner) {
        if (userId === currentUser?.id) {
          toast({ title: "Nicht erlaubt", description: "Sie können Ihre eigene Rolle nicht ändern.", variant: "destructive" });
          return;
        }
        if (adminRole !== "super_admin") {
          toast({ title: "Nicht erlaubt", description: "Nur Super Admins können Rollen ändern.", variant: "destructive" });
          return;
        }
        if (currentRole === "super_admin") {
          toast({ title: "Nicht erlaubt", description: "Super Admin Rollen können nicht geändert werden.", variant: "destructive" });
          return;
        }
        if (newRole === "super_admin") {
          toast({ title: "Nicht erlaubt", description: "Super Admin Rolle kann nicht zugewiesen werden.", variant: "destructive" });
          return;
        }
      }

      setPendingRoleChange({ userId, newRole, currentRole, userName });
      setRoleChangeConfirmOpen(true);
    },
    [updatingRoleUserId, currentUser?.id, adminRole, isOwner, toast]
  );

  const confirmRoleChange = useCallback(async () => {
    if (!pendingRoleChange) return;

    const { userId, newRole, currentRole } = pendingRoleChange;
    setRoleChangeConfirmOpen(false);
    setUpdatingRoleUserId(userId);

    const previousUsers = [...users];
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("role", currentRole);

      if (!isMountedRef.current) return;
      if (error) throw error;

      logAdminAction({
        action: "role_changed",
        entity_type: "user",
        entity_id: userId,
        details: { from_role: currentRole, to_role: newRole },
      });

      toast({ title: "Rolle aktualisiert", description: `Die Benutzerrolle wurde zu "${ROLE_LABELS[newRole]}" geändert.` });
    } catch (error) {
      if (!isMountedRef.current) return;
      setUsers(previousUsers);
      console.error("Error updating role:", error);
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) {
        setUpdatingRoleUserId(null);
        setPendingRoleChange(null);
      }
    }
  }, [pendingRoleChange, users, toast]);

  const createUser = useCallback(async () => {
    if (isCreating) return;

    const trimmedEmail = newUser.email.trim();
    if (!trimmedEmail) {
      toast({ title: "Validierung", description: "E-Mail ist erforderlich.", variant: "destructive" });
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      toast({ title: "Validierung", description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.", variant: "destructive" });
      return;
    }
    if (!newUser.password) {
      toast({ title: "Validierung", description: "Passwort ist erforderlich.", variant: "destructive" });
      return;
    }
    if (newUser.password.length < MIN_PASSWORD_LENGTH) {
      toast({ title: "Validierung", description: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`, variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" });
        if (isMountedRef.current) setIsCreating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: trimmedEmail, password: newUser.password, firstName: newUser.firstName.trim(), lastName: newUser.lastName.trim(), role: newUser.role },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!isMountedRef.current) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      logAdminAction({
        action: "user_created",
        entity_type: "user",
        details: { email: trimmedEmail, role: newUser.role },
      });

      toast({ title: "Benutzer erstellt", description: `${trimmedEmail} wurde als ${ROLE_LABELS[newUser.role]} erstellt.` });
      setIsCreateDialogOpen(false);
      setNewUser(initialNewUserState);
      setShowPassword(false);
      fetchUsers();
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      console.error("Error creating user:", error);
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setIsCreating(false);
    }
  }, [isCreating, newUser, toast, fetchUsers]);

  const deleteUser = useCallback(async () => {
    if (isDeleting || !userToDelete) return;

    if (userToDelete.id === currentUser?.id) {
      toast({ title: "Nicht erlaubt", description: "Sie können sich nicht selbst löschen.", variant: "destructive" });
      return;
    }

    setIsDeleting(true);
    const previousUsers = [...users];
    setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        setUsers(previousUsers);
        toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: userToDelete.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!isMountedRef.current) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      logAdminAction({
        action: "user_deleted",
        entity_type: "user",
        entity_id: userToDelete.id,
        details: { email: userToDelete.email, role: userToDelete.role },
      });

      toast({ title: "Benutzer gelöscht", description: `${userToDelete.email || "Benutzer"} wurde erfolgreich gelöscht.` });
      setUserToDelete(null);
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      setUsers(previousUsers);
      console.error("Error deleting user:", error);
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setIsDeleting(false);
    }
  }, [isDeleting, userToDelete, currentUser?.id, users, toast]);

  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const resetUserPassword = useCallback(async () => {
    if (!passwordResetUser || !newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({ title: "Validierung", description: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`, variant: "destructive" });
      return;
    }
    setIsResettingPassword(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: passwordResetUser.id, newPassword },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!isMountedRef.current) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      logAdminAction({
        action: "password_reset",
        entity_type: "user",
        entity_id: passwordResetUser.id,
        details: { email: passwordResetUser.email },
      });

      toast({ title: "Passwort zurückgesetzt", description: `Das Passwort für ${passwordResetUser.email} wurde erfolgreich geändert.` });
      setPasswordResetUser(null);
      setNewPassword("");
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      console.error("Error resetting password:", error);
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setIsResettingPassword(false);
    }
  }, [passwordResetUser, newPassword, toast]);

  const handleCreateDialogClose = useCallback((open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setNewUser(initialNewUserState);
      setShowPassword(false);
    }
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        ROLE_LABELS[user.role]?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const userCountsByRole = useMemo(
    () => ({
      super_admin: users.filter((u) => u.role === "super_admin").length,
      admin: users.filter((u) => u.role === "admin").length,
      moderator: users.filter((u) => u.role === "moderator").length,
    }),
    [users]
  );

  return {
    // Data
    users,
    filteredUsers,
    userCountsByRole,
    isLoading,

    // Search
    searchInputValue,
    setSearchInputValue,
    debouncedSetSearch,
    searchQuery,
    setSearchQuery,

    // Create user
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isCreating,
    showPassword,
    setShowPassword,
    newUser,
    setNewUser,
    createUser,
    handleCreateDialogClose,

    // Delete user
    userToDelete,
    setUserToDelete,
    isDeleting,
    deleteUser,

    // Role change
    updatingRoleUserId,
    roleChangeConfirmOpen,
    setRoleChangeConfirmOpen,
    pendingRoleChange,
    setPendingRoleChange,
    requestRoleChange,
    confirmRoleChange,

    // Password reset (owner only)
    passwordResetUser,
    setPasswordResetUser,
    newPassword,
    setNewPassword,
    isResettingPassword,
    resetUserPassword,

    // Actions
    fetchUsers,

    // Auth context
    currentUser,
    adminRole,
    isOwner,
  };
}
