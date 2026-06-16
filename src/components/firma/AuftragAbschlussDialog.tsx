import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuftragAbschlussInput {
  id: string;
  auftrag_nummer: string;
  title: string;
  pricing_type?: "fixed" | "hourly" | "estimate" | null;
  hourly_rate?: number | null;
  vat_rate?: number | null;
  total?: number | null;
  estimated_duration_minutes?: number | null;
}

interface AuftragAbschlussDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auftrag: AuftragAbschlussInput | null;
  onCompleted: () => void;
}

const formatChf = (amount: number): string =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);

export const AuftragAbschlussDialog = ({
  open,
  onOpenChange,
  auftrag,
  onCompleted,
}: AuftragAbschlussDialogProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [actualHours, setActualHours] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

  const isHourly = auftrag?.pricing_type === "hourly";

  // Vorbelegung: geschätzte Dauer als Startwert für tatsächliche Stunden
  useEffect(() => {
    if (open && auftrag) {
      const estHours = auftrag.estimated_duration_minutes
        ? (auftrag.estimated_duration_minutes / 60).toFixed(1)
        : "";
      setActualHours(isHourly ? estHours : "");
      setCompletionNotes("");
    }
  }, [open, auftrag, isHourly]);

  if (!auftrag) return null;

  const hourlyRate = auftrag.hourly_rate ?? 0;
  const vatRate = auftrag.vat_rate ?? 8.1;
  const hours = parseFloat(actualHours.replace(",", ".")) || 0;
  const computedSubtotal = isHourly ? hourlyRate * hours : null;
  const computedVat = computedSubtotal !== null ? computedSubtotal * (vatRate / 100) : null;
  const computedTotal = computedSubtotal !== null ? computedSubtotal + computedVat! : null;

  const handleConfirm = async () => {
    if (isSaving) return;

    if (isHourly && hours <= 0) {
      toast({
        title: "Stunden erforderlich",
        description: "Bitte geben Sie die tatsächlich geleisteten Stunden ein.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        status: "abgeschlossen",
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes.trim() || null,
      };

      // Bei Aufwand-Preis: Endpreis aus tatsächlichen Stunden berechnen
      if (isHourly && computedSubtotal !== null) {
        updateData.subtotal = Math.round(computedSubtotal * 100) / 100;
        updateData.vat_amount = Math.round(computedVat! * 100) / 100;
        updateData.total = Math.round(computedTotal! * 100) / 100;
      }

      const { error } = await supabase
        .from("auftraege")
        .update(updateData)
        .eq("id", auftrag.id);

      if (error) throw error;

      toast({
        title: "Auftrag abgeschlossen",
        description: isHourly
          ? `Endpreis: ${formatChf(computedTotal ?? 0)}`
          : "Der Auftrag wurde als erledigt markiert.",
      });
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error completing auftrag:", error);
      toast({
        title: "Fehler",
        description: "Auftrag konnte nicht abgeschlossen werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Auftrag abschliessen
          </DialogTitle>
          <DialogDescription>
            {auftrag.auftrag_nummer} · {auftrag.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isHourly ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Tatsächlich geleistete Stunden *
              </Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                inputMode="decimal"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="z.B. 4.5"
              />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Stundensatz</span>
                  <span>{formatChf(hourlyRate)}/h</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Zwischensumme ({hours || 0} h)</span>
                  <span>{formatChf(computedSubtotal ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>MwSt. ({vatRate}%)</span>
                  <span>{formatChf(computedVat ?? 0)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-amber-200 pt-1 font-bold">
                  <span>Endpreis</span>
                  <span className="text-emerald-700">{formatChf(computedTotal ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between font-medium">
                <span>Festpreis (Endbetrag)</span>
                <span className="text-emerald-700">{formatChf(auftrag.total ?? 0)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Abschluss-Notizen (optional)</Label>
            <Textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="z.B. Zusätzliche Leistungen, Besonderheiten beim Einsatz …"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Abschliessen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
