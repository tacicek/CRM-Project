import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Loader2, Eye, EyeOff, Copy, Check } from "lucide-react";

const passwordSchema = z.object({
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben").max(100),
});

interface ResetPasswordDialogProps {
  userId: string;
  companyName: string;
  userEmail: string;
  currentUserId?: string;
}

const ResetPasswordDialog = ({ userId, companyName, userEmail, currentUserId }: ResetPasswordDialogProps) => {
  const isOwnAccount = currentUserId === userId;
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let newPassword = "";
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPassword);
    setShowPassword(true);
    setError("");
  };

  const copyCredentials = async () => {
    const text = `E-Mail: ${userEmail}\nPasswort: ${password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = passwordSchema.safeParse({ password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Session check:', { session, sessionError });
      
      if (sessionError || !session?.access_token) {
        console.error("No valid session for admin-reset-password");
        setError("Sitzung abgelaufen. Bitte melden Sie sich erneut an.");
        return;
      }

      console.log('Calling admin-reset-password function...');
      console.log('Token being sent (first 50 chars):', session.access_token.substring(0, 50));
      console.log('Token length:', session.access_token.length);
      console.log('User ID to reset:', userId);

      const { data, error: resetError } = await supabase.functions.invoke(
        "admin-reset-password",
        {
          body: {
            userId,
            newPassword: password,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      console.log('admin-reset-password response:', { data, error: resetError });

      if (resetError || data?.error) {
        throw new Error(data?.error || resetError?.message || "Passwort konnte nicht zurückgesetzt werden");
      }

      toast({
        title: "Passwort zurückgesetzt",
        description: (
          <div className="space-y-2">
            <p>Das Passwort für <strong>{companyName}</strong> wurde geändert.</p>
            <div className="bg-muted p-3 rounded-md text-sm mt-2">
              <p><strong>Neue Login-Daten:</strong></p>
              <p>E-Mail: {userEmail}</p>
              <p>Passwort: {password}</p>
            </div>
          </div>
        ),
        duration: 15000,
      });

      setPassword("");
      setOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Passwort konnte nicht zurückgesetzt werden.";
      console.error("Error resetting password:", error);
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOwnAccount) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        title="Eigenes Passwort kann nicht hier geändert werden"
        disabled
        className="opacity-50 cursor-not-allowed"
      >
        <Key className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Passwort zurücksetzen">
          <Key className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
          <DialogDescription>
            Neues Passwort für <strong>{companyName}</strong> setzen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input value={userEmail} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Neues Passwort *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Mindestens 8 Zeichen"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generieren
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {password && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={copyCredentials}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Login-Daten kopieren
                </>
              )}
            </Button>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !password}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Passwort ändern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
