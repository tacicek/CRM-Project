import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, Loader2 } from "lucide-react";

export function LeadBulkActionsBar({
  selectedCount,
  isProcessing,
  onDeselectAll,
  onOpenVerify,
  onOpenReject,
}: {
  selectedCount: number;
  isProcessing: boolean;
  onDeselectAll: () => void;
  onOpenVerify: () => void;
  onOpenReject: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <Card className="border-secondary">
      <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{selectedCount} ausgew&auml;hlt</Badge>
          <Button variant="ghost" size="sm" onClick={onDeselectAll}>
            Auswahl aufheben
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onOpenVerify}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Alle verifizieren
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onOpenReject}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            Alle ablehnen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BulkVerifyDialog({
  open,
  onOpenChange,
  selectedCount,
  isProcessing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Massenverifizierung best&auml;tigen</AlertDialogTitle>
          <AlertDialogDescription>
            Sie sind dabei, <strong>{selectedCount} Leads</strong> zu verifizieren und an passende Firmen zu verteilen.
            Diese Aktion kann nicht r&uuml;ckg&auml;ngig gemacht werden.
            <br /><br />
            <span className="text-amber-600">
              Hinweis: Leads ohne passende Firmen werden verifiziert, aber nicht verteilt.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {selectedCount} Leads verifizieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BulkRejectDialog({
  open,
  onOpenChange,
  selectedCount,
  isProcessing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isProcessing: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Massenablehnung best&auml;tigen</AlertDialogTitle>
          <AlertDialogDescription>
            Sie sind dabei, <strong>{selectedCount} Leads</strong> als Spam abzulehnen.
            Diese Aktion kann nicht r&uuml;ckg&auml;ngig gemacht werden.
            <br /><br />
            Alle ausgew&auml;hlten Leads werden mit dem Grund &quot;Massenablehnung als Spam&quot; markiert.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            {selectedCount} Leads ablehnen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
