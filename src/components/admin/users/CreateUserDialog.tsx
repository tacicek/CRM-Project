import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, UserPlus, Shield, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { AdminRole } from "@/lib/adminPermissions";
import { NewUserFormState, MIN_PASSWORD_LENGTH } from "./types";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newUser: NewUserFormState;
  setNewUser: (user: NewUserFormState) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  isCreating: boolean;
  onCreateUser: () => Promise<void>;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  newUser,
  setNewUser,
  showPassword,
  setShowPassword,
  isCreating,
  onCreateUser,
}: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Neuen Admin-Benutzer erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Benutzer mit Admin- oder Moderator-Rechten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                placeholder="Max"
                value={newUser.firstName}
                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input
                id="lastName"
                placeholder="Muster"
                value={newUser.lastName}
                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail *</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@beispiel.ch"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="pr-10"
                aria-describedby="password-hint"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newUser.password && newUser.password.length < MIN_PASSWORD_LENGTH && (
              <p id="password-hint" className="text-xs text-amber-600">
                Noch {MIN_PASSWORD_LENGTH - newUser.password.length} Zeichen erforderlich
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rolle *</Label>
            <Select
              value={newUser.role}
              onValueChange={(value) => setNewUser({ ...newUser, role: value as AdminRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-medium">Moderator</div>
                      <div className="text-xs text-muted-foreground">Kann Leads prüfen und Blog verwalten</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-xs text-muted-foreground">Voller Zugriff (ohne Benutzerverwaltung)</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Abbrechen
          </Button>
          <Button
            onClick={onCreateUser}
            disabled={isCreating || !newUser.email.trim() || !newUser.password}
            aria-busy={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Erstellen...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Benutzer erstellen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
