import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getResetPasswordUrl } from "@/lib/authUtils";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface AuthContextType {
  /** Authenticated Supabase user, or null when signed out. */
  user: User | null;
  /** Active Supabase session, or null when signed out. */
  session: Session | null;
  /** True while the initial session check is in progress. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Auth state subscription
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Referenz-stabiler User: onAuthStateChange feuert bei jedem Tab-Fokus
    // (TOKEN_REFRESHED/SIGNED_IN) und liefert dabei ein NEUES User-Objekt für denselben
    // User. Würden wir es ungeprüft setzen, ändert sich die Objekt-Identität → alle
    // [user]-Effekte der App (CompanyProvider-Refetch, Seiten-Initial-Loads) laufen
    // erneut, FirmaLayout zeigt den Vollbild-Loader und unmountet die offene Seite —
    // Formulareingaben gehen verloren. Gleicher User (id) → alte Referenz behalten.
    const applyUser = (nextUser: User | null) => {
      setUser((prev) => (prev && nextUser && prev.id === nextUser.id ? prev : nextUser));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      applyUser(newSession?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        window.location.href = "/auth/reset-password";
        return;
      }

      setIsLoading(false);
    });

    // Eager session restore on mount
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      applyUser(existingSession?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // -------------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------------

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectTo = getResetPasswordUrl(import.meta.env.VITE_APP_URL);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
