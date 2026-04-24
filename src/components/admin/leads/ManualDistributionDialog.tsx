import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Search, Building2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead, LeadDistribution } from "./types";

interface Company {
  id: string;
  company_name: string;
  email: string;
  city: string | null;
  plz: string | null;
  is_verified: boolean | null;
}

interface Assignment {
  company_id: string;
  token_cost: number;
}

interface ManualDistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  distributions: LeadDistribution[];
  onSuccess: () => void;
}

export function ManualDistributionDialog({
  open,
  onOpenChange,
  lead,
  distributions,
  onSuccess,
}: ManualDistributionDialogProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [isSending, setIsSending] = useState(false);

  const defaultTokenCost = lead.token_cost ?? 10;

  // Quota: how many active (sent/accepted) distributions already exist
  const activeDistCount = distributions.filter(
    (d) => d.status === "sent" || d.status === "accepted"
  ).length;
  const maxCompanies = lead.max_companies || 5;
  const remainingSlots = Math.max(0, maxCompanies - activeDistCount);

  // Set of company IDs that already have a distribution
  const alreadyDistributedIds = new Set(distributions.map((d) => d.company_id));

  // ------------------------------------------------------------------
  // Load verified companies
  // ------------------------------------------------------------------
  const fetchCompanies = useCallback(async () => {
    setIsLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, company_name, email, city, plz, is_verified")
        .order("company_name");

      if (error) {
        console.error("Companies fetch error:", error);
        throw error;
      }
      // Filter verified companies client-side (avoids RLS issues in admin context)
      const verified = (data ?? []).filter((c) => c.is_verified !== false);
      setCompanies(verified);
    } catch (err) {
      console.error(err);
      toast.error("Firmenliste konnte nicht geladen werden");
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      setSearchQuery("");
      setAssignments({});
    }
  }, [open, fetchCompanies]);

  // ------------------------------------------------------------------
  // Filtered list
  // ------------------------------------------------------------------
  const filtered = companies.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.plz ?? "").toLowerCase().includes(q)
    );
  });

  // ------------------------------------------------------------------
  // Toggle company selection
  // ------------------------------------------------------------------
  const toggleCompany = (company: Company) => {
    setAssignments((prev) => {
      if (prev[company.id]) {
        const next = { ...prev };
        delete next[company.id];
        return next;
      }
      if (Object.keys(prev).length >= remainingSlots) {
        toast.warning(
          `Maximal ${remainingSlots} weitere Firma${remainingSlots === 1 ? "" : "en"} möglich (${maxCompanies} Plätze, ${activeDistCount} bereits vergeben)`
        );
        return prev;
      }
      return {
        ...prev,
        [company.id]: { company_id: company.id, token_cost: defaultTokenCost },
      };
    });
  };

  const updateTokenCost = (companyId: string, value: number) => {
    setAssignments((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], token_cost: Math.max(1, value) },
    }));
  };

  const selectedCount = Object.keys(assignments).length;

  // ------------------------------------------------------------------
  // Send
  // ------------------------------------------------------------------
  const handleSend = async () => {
    if (selectedCount === 0) return;
    setIsSending(true);
    try {
      // Refresh session to ensure we have a valid non-expired token
      await supabase.auth.refreshSession();

      const { data, error } = await supabase.functions.invoke("admin-assign-lead", {
        body: {
          lead_id: lead.id,
          assignments: Object.values(assignments),
        },
      });

      if (error) {
        const errorBody = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(errorBody);
      }
      if (data?.error) throw new Error(data.error);

      const distributed: number = data?.distributed ?? 0;
      const skipped: number = data?.skipped ?? 0;

      if (distributed > 0) {
        toast.success(
          `Lead an ${distributed} Firma${distributed === 1 ? "" : "en"} gesendet` +
          (skipped > 0 ? ` (${skipped} bereits vorhanden)` : "")
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.warning("Keine neuen Verteilungen — alle Firmen waren bereits zugewiesen.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-600" />
            Manuell verteilen
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5">
              <p>
                Lead <strong>{lead.slug || lead.id.slice(0, 8)}</strong> — Firmen auswählen und
                Token-Kosten festlegen.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={remainingSlots > 0 ? "secondary" : "destructive"} className="font-mono">
                  {activeDistCount} / {maxCompanies}
                </Badge>
                {remainingSlots > 0
                  ? `${remainingSlots} ${remainingSlots === 1 ? "Platz" : "Plätze"} frei`
                  : "Kontingent voll — keine weiteren Firmen möglich"}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Firma suchen…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected count + quota */}
        {selectedCount > 0 && (
          <Alert className="bg-violet-50 border-violet-200 py-2">
            <CheckCircle2 className="h-4 w-4 text-violet-600" />
            <AlertDescription className="text-violet-800 text-sm">
              <strong>{selectedCount}</strong> / {remainingSlots} Firma{remainingSlots === 1 ? "" : "en"} ausgewählt
            </AlertDescription>
          </Alert>
        )}

        {/* Quota full warning */}
        {remainingSlots <= 0 && (
          <Alert className="bg-destructive/10 border-destructive/30 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive text-sm">
              Kontingent voll ({maxCompanies} / {maxCompanies}). Keine weiteren Firmen möglich.
            </AlertDescription>
          </Alert>
        )}

        {/* Company list */}
        <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
          {isLoadingCompanies ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              {searchQuery ? "Keine Firmen gefunden." : "Keine verifizierten Firmen vorhanden."}
            </div>
          ) : (
            filtered.map((company) => {
              const isAlreadyDistributed = alreadyDistributedIds.has(company.id);
              const isSelected = !!assignments[company.id];
              const tokenCost = assignments[company.id]?.token_cost ?? defaultTokenCost;
              const isDisabled = isAlreadyDistributed || (remainingSlots <= 0 && !isSelected);

              return (
                <div
                  key={company.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isAlreadyDistributed
                      ? "opacity-50 bg-muted/30"
                      : isSelected
                        ? "bg-violet-50/50 dark:bg-violet-950/20"
                        : "hover:bg-muted/40"
                  }`}
                >
                  <Checkbox
                    id={`company-${company.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleCompany(company)}
                    disabled={isDisabled}
                  />
                  <label
                    htmlFor={`company-${company.id}`}
                    className={`flex-1 min-w-0 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {company.company_name}
                      {isAlreadyDistributed && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          bereits verteilt
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {company.email}
                      {company.city && <> · {company.plz ? `${company.plz} ` : ""}{company.city}</>}
                    </div>
                  </label>

                  {/* Token cost input — only shown when selected */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        value={tokenCost}
                        onChange={(e) =>
                          updateTokenCost(company.id, parseInt(e.target.value) || 1)
                        }
                        className="w-20 h-7 text-sm text-center"
                        min={1}
                        max={500}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">Token</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          {selectedCount === 0 && remainingSlots > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-auto">
              <AlertTriangle className="w-3.5 h-3.5" />
              Mindestens eine Firma auswählen
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedCount === 0 || remainingSlots <= 0}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Building2 className="w-4 h-4 mr-2" />
            )}
            {isSending
              ? "Wird gesendet…"
              : `An ${selectedCount > 0 ? selectedCount : "…"} Firma${selectedCount === 1 ? "" : "en"} senden`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
