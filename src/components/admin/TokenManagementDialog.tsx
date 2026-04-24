import { useState, useCallback } from "react";

const MAX_MANUAL_TOKENS = 10000;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Coins, Loader2, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TokenManagementDialogProps {
  companyId: string;
  companyName: string;
  currentBalance: number;
  onSuccess: () => void;
}

const TokenManagementDialog = ({
  companyId,
  companyName,
  currentBalance,
  onSuccess,
}: TokenManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(true);
  const { toast } = useToast();

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset all form state on close to avoid stale mode on next open
      setAmount("");
      setDescription("");
      setIsAdding(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tokenAmount = parseInt(amount);
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      toast({
        title: "Ungültiger Betrag",
        description: "Bitte geben Sie eine positive Zahl ein.",
        variant: "destructive",
      });
      return;
    }

    if (tokenAmount > MAX_MANUAL_TOKENS) {
      toast({
        title: "Betrag zu hoch",
        description: `Maximal ${MAX_MANUAL_TOKENS.toLocaleString("de-CH")} Token pro Transaktion erlaubt.`,
        variant: "destructive",
      });
      return;
    }

    const actualAmount = isAdding ? tokenAmount : -tokenAmount;
    const newBalance = currentBalance + actualAmount;

    if (newBalance < 0) {
      toast({
        title: "Nicht genügend Token",
        description: `Die Firma hat nur ${currentBalance} Token.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // ATOMIC: Use DB function to prevent race conditions on balance updates
      // Note: Type will be recognized after running `supabase gen types` post-migration
      const { data: result, error: rpcError } = await supabase.rpc(
        "atomic_adjust_token_balance" as never,
        {
          p_company_id: companyId,
          p_amount: actualAmount,
          p_type: isAdding ? "credit" : "debit",
          p_description: description || (isAdding ? "Admin Gutschrift" : "Admin Abbuchung"),
        } as never
      );

      if (rpcError) throw rpcError;
      
      const typedResult = result as unknown as { success: boolean; error?: string; new_balance: number; previous_balance: number } | null;
      if (!typedResult?.success) {
        throw new Error(typedResult?.error || "Balance update failed");
      }

      const actualNewBalance = typedResult.new_balance;

      // Send email notification for manual token addition
      if (isAdding) {
        try {
          await supabase.functions.invoke("send-token-notification", {
            body: {
              companyId,
              type: "manual_add",
              previousBalance: typedResult.previous_balance,
              newBalance: actualNewBalance,
              amount: tokenAmount,
              description: description || "Admin Gutschrift",
            },
          });
        } catch (emailError) {
          console.error("Failed to send token notification email:", emailError);
          // Don't fail the operation if email fails
        }
      }

      toast({
        title: isAdding ? "Token hinzugefügt" : "Token abgezogen",
        description: `${tokenAmount} Token wurden ${isAdding ? "gutgeschrieben" : "abgezogen"}. Neuer Stand: ${actualNewBalance}`,
      });

      handleOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating tokens:", error);
      toast({
        title: "Fehler",
        description: "Token konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Token verwalten">
          <Coins className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-secondary" />
            Token verwalten
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">Firma</p>
            <p className="font-medium">{companyName}</p>
            <p className="text-sm text-muted-foreground mt-2">Aktuelles Guthaben</p>
            <p className="text-2xl font-bold text-accent">{currentBalance} Token</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isAdding ? "default" : "outline"}
                className="flex-1"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
              <Button
                type="button"
                variant={!isAdding ? "default" : "outline"}
                className="flex-1"
                onClick={() => setIsAdding(false)}
              >
                <Minus className="w-4 h-4 mr-2" />
                Abziehen
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Anzahl Token</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="z.B. 50"
                min="1"
                max={MAX_MANUAL_TOKENS}
                step="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="z.B. Bonus für Neukunden"
                rows={2}
              />
            </div>

            {amount && parseInt(amount) > 0 && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
                <p className="text-sm">
                  Neuer Stand nach {isAdding ? "Gutschrift" : "Abbuchung"}:{" "}
                  <span className="font-bold">
                    {currentBalance + (isAdding ? parseInt(amount) : -parseInt(amount))} Token
                  </span>
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Speichern
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenManagementDialog;
