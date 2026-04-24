import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeleteCompanyDialogProps {
  companyId: string;
  companyName: string;
  userId: string;
  onSuccess: () => void;
}

const DeleteCompanyDialog = ({ companyId: _companyId, companyName, userId, onSuccess }: DeleteCompanyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirmText !== companyName) {
      toast({
        title: "Bestätigung fehlgeschlagen",
        description: "Bitte geben Sie den Firmennamen korrekt ein.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error("No valid session for admin-delete-user");
        toast({
          title: "Sitzung abgelaufen",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        return;
      }

      console.log('Calling admin-delete-user function...');
      console.log('Token being sent (first 50 chars):', session.access_token.substring(0, 50));
      console.log('User ID to delete:', userId);

      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Firma konnte nicht gelöscht werden");
      }

      toast({
        title: "Firma gelöscht",
        description: `${companyName} wurde erfolgreich gelöscht.`,
      });

      setOpen(false);
      setConfirmText("");
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Ein Fehler ist aufgetreten";
      console.error("Error deleting company:", error);
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) setConfirmText("");
    }}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Firma löschen"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Firma unwiderruflich löschen?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden. Folgende Daten werden gelöscht:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Firmenprofil und alle Einstellungen</li>
              <li>Alle Leads und Lead-Zuweisungen</li>
              <li>Alle Offerten und Termine</li>
              <li>Team-Mitglieder und Ressourcen</li>
              <li>Benutzer-Login und Zugang</li>
            </ul>
            <div className="pt-2">
              <p className="text-sm font-medium mb-2">
                Bitte geben Sie <span className="font-bold text-foreground">{companyName}</span> ein, um zu bestätigen:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={companyName}
                className="mt-1"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting || confirmText !== companyName}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird gelöscht...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Endgültig löschen
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCompanyDialog;
