 
import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AdminRole } from "@/lib/adminPermissions";
import { isOwnerEmail } from "@/lib/ownerUtils";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdminLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  adminRole: AdminRole | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const APP_URL = import.meta.env.VITE_APP_URL;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const hasCheckedAdminRef = useRef(false);

  useEffect(() => {
    const checkAdminRole = async (uid: string) => {
      // Only show loading spinner on the very first check.
      // Subsequent calls (e.g. TOKEN_REFRESHED) update silently in the background
      // to prevent unmounting the layout and losing dialog/form state.
      if (!hasCheckedAdminRef.current) {
        setIsAdminLoading(true);
      }
      try {
        // Fetch user's roles from user_roles table
        // User may have multiple roles (e.g., both admin and moderator)
        const { data: rolesData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        
        if (error) {
          console.error("[useAuth] Error fetching roles:", error);
          setIsAdmin(false);
          setAdminRole(null);
          return;
        }
        
        const roles = rolesData?.map(r => r.role) || [];
        
        if (roles.includes("super_admin")) {
          setIsAdmin(true);
          setAdminRole("super_admin");
        } else if (roles.includes("admin")) {
          setIsAdmin(true);
          setAdminRole("admin");
        } else if (roles.includes("moderator")) {
          setIsAdmin(true);
          setAdminRole("moderator");
        } else {
          setIsAdmin(false);
          setAdminRole(null);
        }
      } catch (e) {
        console.error("[useAuth] Exception:", e);
        setIsAdmin(false);
        setAdminRole(null);
      } finally {
        hasCheckedAdminRef.current = true;
        setIsAdminLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Handle password recovery - redirect to reset password page
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/auth/reset-password';
        return;
      }
      
      if (session?.user) {
        setIsOwner(isOwnerEmail(session.user.email));
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
        setIsOwner(false);
        setAdminRole(null);
        setIsAdminLoading(false);
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsOwner(isOwnerEmail(session.user.email));
        checkAdminRole(session.user.id);
      } else {
        setIsAdminLoading(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear state immediately before signOut to prevent race conditions
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsOwner(false);
    setAdminRole(null);
    
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const baseUrl = APP_URL?.trim() ? APP_URL.replace(/\/$/, "") : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAdminLoading,
      isAdmin,
      isOwner,
      adminRole,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
