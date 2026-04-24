// =============================================================================
// OFFERTE DETAILS SECTION - Customer-Facing Only
// =============================================================================
// This component handles ONLY customer-facing offer details.
// Team assignment, vehicles, and resources belong in the AUFTRÄGE (Jobs) system.
// =============================================================================

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, 
  Clock, 
  Calendar,
  Sparkles,
  Plus,
  X,
  Loader2,
  CreditCard
} from "lucide-react";
import { getServiceLabel } from "@/lib/serviceLabels";

// =============================================================================
// TYPES - Customer-Facing Only
// =============================================================================

interface ServiceTemplate {
  id: string;
  service_type: string;
  template_key: string;
  name: string;
  description: string;
  default_details: Record<string, unknown>;
  default_highlighted_items: string[];
}

/**
 * Customer-facing offer details only.
 * NO team/vehicle/resource fields - those belong in Aufträge system.
 */
export interface OfferDetails {
  // Reference & Salutation
  companyReference: string;
  customerSalutation: string;
  
  // Timing
  serviceStartTime: string;
  serviceEndTime: string;
  secondaryServiceDate: string;
  secondaryServiceType: string;
  
  // Service Details (customer-visible)
  serviceDetails: {
    propertyType: string;
    livingSpaceM2: number | null;
    volumeM3: number | null;
    distanceKm: number | null;
    [key: string]: unknown;
  };
  
  // Highlighted Items (shown prominently to customer)
  highlightedItems: string[];
  
  // Payment
  paymentMethod: string;
  
  // Internal Notes (for company only, not shown to customer)
  internalNotes: string;
}

interface OfferteDetailsSectionProps {
  companyId: string;
  serviceType: string;
  leadData: {
    from_floor?: number | null;
    from_has_lift?: boolean | null;
    from_rooms?: number | null;
    from_living_space_m2?: number | null;
    to_floor?: number | null;
    to_has_lift?: boolean | null;
  };
  details: OfferDetails;
  onChange: (details: OfferDetails) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SALUTATIONS = [
  { value: "Frau", label: "Frau" },
  { value: "Herr", label: "Herr" },
  { value: "Firma", label: "Firma" },
  { value: "", label: "Keine Anrede" },
];

const PAYMENT_METHODS = [
  { value: "bar", label: "Barzahlung nach Ausführung" },
  { value: "rechnung_14", label: "Rechnung (14 Tage)" },
  { value: "rechnung_30", label: "Rechnung (30 Tage)" },
  { value: "twint", label: "TWINT" },
  { value: "vorauskasse", label: "Vorauskasse" },
  { value: "teilzahlung", label: "Teilzahlung (50% Anzahlung)" },
];

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_OFFER_DETAILS: OfferDetails = {
  companyReference: "",
  customerSalutation: "",
  serviceStartTime: "",
  serviceEndTime: "",
  secondaryServiceDate: "",
  secondaryServiceType: "",
  serviceDetails: {
    propertyType: "",
    livingSpaceM2: null,
    volumeM3: null,
    distanceKm: null,
  },
  highlightedItems: [],
  paymentMethod: "bar",
  internalNotes: "",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function OfferteDetailsSection({
  companyId,
  serviceType,
  leadData: _leadData,
  details,
  onChange,
}: OfferteDetailsSectionProps) {
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !serviceType) {
        setLoading(false);
        return;
      }
      
      try {
        // Try to load templates (this table might not exist yet)
        const templatesRes = await supabase
          .from("service_detail_templates")
          .select("*")
          .eq("service_type", serviceType)
          .eq("is_active", true)
          .order("display_order");

        if (templatesRes.data) setTemplates(templatesRes.data as ServiceTemplate[]);
      } catch {
        // Table doesn't exist yet, ignore
        console.log("service_detail_templates table not found");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [companyId, serviceType]);

  const applyTemplate = (template: ServiceTemplate) => {
    onChange({
      ...details,
      serviceDetails: {
        ...details.serviceDetails,
        ...(template.default_details as Record<string, unknown>),
      },
      highlightedItems: template.default_highlighted_items || [],
    });
  };

  const updateDetails = (field: string, value: unknown) => {
    onChange({
      ...details,
      [field]: value,
    });
  };

  const addHighlightedItem = () => {
    onChange({
      ...details,
      highlightedItems: [...details.highlightedItems, ""],
    });
  };

  const updateHighlightedItem = (index: number, value: string) => {
    const updated = [...details.highlightedItems];
    updated[index] = value;
    onChange({
      ...details,
      highlightedItems: updated,
    });
  };

  const removeHighlightedItem = (index: number) => {
    onChange({
      ...details,
      highlightedItems: details.highlightedItems.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* ─── Header (always visible) ─── */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold">Erweiterte Details</span>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-muted-foreground/30">
            Optional
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {isExpanded ? "Einklappen ↑" : "Erweitern ↓"}
        </span>
      </button>

      {isExpanded && (
        <CardContent className="px-4 pb-5 pt-0 space-y-5 border-t">

          {/* Quick Templates */}
          {templates.length > 0 && (
            <div className="pt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold mb-2 text-amber-700 dark:text-amber-300">
                Schnellvorlagen – {getServiceLabel(serviceType)}
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template)}
                    className="text-xs h-7 border-amber-300"
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Row 1: Reference & Salutation ── */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Unsere Referenz
              </Label>
              <Input
                value={details.companyReference}
                onChange={(e) => updateDetails("companyReference", e.target.value)}
                placeholder="z.B. Max Mustermann"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Kundenanrede
              </Label>
              <Select
                value={details.customerSalutation || "__none__"}
                onValueChange={(v) => updateDetails("customerSalutation", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Anrede wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {SALUTATIONS.map((s) => (
                    <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Row 2: Time ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Servicezeit
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Startzeit</span>
                <Input
                  type="time"
                  value={details.serviceStartTime}
                  onChange={(e) => updateDetails("serviceStartTime", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Endzeit (optional)</span>
                <Input
                  type="time"
                  value={details.serviceEndTime}
                  onChange={(e) => updateDetails("serviceEndTime", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* ── Row 3: Secondary date + service ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Zusatztermin
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Datum (optional)</span>
                <Input
                  type="date"
                  value={details.secondaryServiceDate}
                  onChange={(e) => updateDetails("secondaryServiceDate", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Zusatzservice</span>
                <Select
                  value={details.secondaryServiceType || "none"}
                  onValueChange={(v) => updateDetails("secondaryServiceType", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Kein Zusatzservice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Zusatzservice</SelectItem>
                    <SelectItem value="reinigung">Reinigung</SelectItem>
                    <SelectItem value="entsorgung">Entsorgung</SelectItem>
                    <SelectItem value="lagerung">Lagerung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Row 4: Payment ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              Zahlungsmethode
            </Label>
            <Select
              value={details.paymentMethod}
              onValueChange={(v) => updateDetails("paymentMethod", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Row 5: Highlighted items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Hervorgehobene Punkte
                <span className="text-muted-foreground font-normal">(für Kunde sichtbar)</span>
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addHighlightedItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                Hinzufügen
              </Button>
            </div>

            {details.highlightedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 px-3 py-2.5">
                <p className="text-xs text-amber-700/70 dark:text-amber-400/70 italic">
                  Noch keine hervorgehobenen Punkte — erscheinen gelb markiert in der Offerte.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {details.highlightedItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <Input
                      value={item}
                      onChange={(e) => updateHighlightedItem(index, e.target.value)}
                      placeholder="z.B. inkl. Möbel einwickeln mit Stretchfolie"
                      className="h-9 flex-1 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHighlightedItem(index)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Row 6: Internal notes ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              Interne Notizen
              <span className="font-normal">(nicht sichtbar für Kunde)</span>
            </Label>
            <Textarea
              value={details.internalNotes}
              onChange={(e) => updateDetails("internalNotes", e.target.value)}
              placeholder="Notizen für Ihr Team…"
              rows={3}
              className="text-sm resize-none"
            />
          </div>

        </CardContent>
      )}
    </Card>
  );
}
