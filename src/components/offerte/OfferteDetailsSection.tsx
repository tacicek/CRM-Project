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
  Sparkles,
  Plus,
  X,
  Loader2,
  CreditCard
} from "lucide-react";
import { useI18n, useT } from "@/i18n/useI18n";
import { getServiceLabel } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/translator";

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
  customerNumber: string;
  customerSalutation: string;
  
  // Timing
  serviceStartTime: string;
  serviceEndTime: string;
  
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

// `value` is the stored enum written to offer_details / offers.customer_salutation &
// payment_method — it stays exactly as-is (SurchargeEditor-style axis split). Only the
// operator-facing `labelKey` is resolved with the dashboard locale at render time.
const SALUTATIONS: { value: string; labelKey: MessageKey }[] = [
  { value: "Frau", labelKey: "domain.salutation.frau" },
  { value: "Herr", labelKey: "domain.salutation.herr" },
  { value: "Firma", labelKey: "offer.details.salutation.firma" },
  { value: "", labelKey: "offer.details.salutation.none" },
];

const PAYMENT_METHODS: { value: string; labelKey: MessageKey }[] = [
  { value: "bar", labelKey: "offer.doc.paymentMethod.bar" },
  { value: "rechnung_14", labelKey: "offer.doc.paymentMethod.rechnung_14" },
  { value: "rechnung_30", labelKey: "offer.doc.paymentMethod.rechnung_30" },
  { value: "twint", labelKey: "offer.doc.paymentMethod.twint" },
  { value: "vorauskasse", labelKey: "offer.doc.paymentMethod.vorauskasse" },
  { value: "teilzahlung", labelKey: "offer.doc.paymentMethod.teilzahlung" },
];

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_OFFER_DETAILS: OfferDetails = {
  companyReference: "",
  customerNumber: "",
  customerSalutation: "",
  serviceStartTime: "",
  serviceEndTime: "",
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
  const t = useT();
  const { locale } = useI18n();
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
          <span className="text-sm font-semibold">{t("offer.details.header")}</span>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-muted-foreground/30">
            {t("common.optional")}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {isExpanded ? t("offer.form.agb.collapse") : t("offer.details.expand")}
        </span>
      </button>

      {isExpanded && (
        <CardContent className="px-4 pb-5 pt-0 space-y-5 border-t">

          {/* Quick Templates */}
          {templates.length > 0 && (
            <div className="pt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-semibold mb-2 text-amber-700">
                {t("offer.details.templates.quickTitle", { service: getServiceLabel(serviceType, locale) })}
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

          {/* ── Row 0: Kundennummer ── */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {t("offer.details.field.customerNumber")}
              </Label>
              <Input
                value={details.customerNumber}
                onChange={(e) => updateDetails("customerNumber", e.target.value)}
                placeholder={t("offer.details.placeholder.customerNumber")}
                className="h-10"
              />
            </div>
          </div>

          {/* ── Row 1: Reference & Salutation ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {t("offer.details.field.reference")}
              </Label>
              <Input
                value={details.companyReference}
                onChange={(e) => updateDetails("companyReference", e.target.value)}
                placeholder={t("offer.details.placeholder.reference")}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {t("offer.details.field.salutation")}
              </Label>
              <Select
                value={details.customerSalutation || "__none__"}
                onValueChange={(v) => updateDetails("customerSalutation", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={t("offer.details.salutation.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {SALUTATIONS.map((s) => (
                    <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>
                      {t(s.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Startzeit/Endzeit relocated to the always-visible "Offerten-Details" card
              (OfferteErstellen/Bearbeiten) so operators reliably see them — buried inside
              this collapsed "Erweiterte Details" panel they were routinely missed and never
              reached the PDF. Same service_start_time/service_end_time source of truth. */}

          {/* Row 3 (Zusatztermin) retired: superseded by per-service dates on the
              item groups (offer_items.scheduled_*) — N services instead of max 2, and the
              old fields never reached PDF/edit/customer view. */}

          {/* ── Row 4: Payment ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              {t("offer.details.field.paymentMethod")}
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
                    {t(m.labelKey)}
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
                {t("offer.details.field.highlighted")}
                <span className="text-muted-foreground font-normal">{t("offer.details.highlighted.hint")}</span>
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addHighlightedItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("common.add")}
              </Button>
            </div>

            {details.highlightedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2.5">
                <p className="text-xs text-amber-700/70 italic">
                  {t("offer.details.highlighted.empty")}
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
                      placeholder={t("offer.details.highlighted.placeholder")}
                      className="h-9 flex-1 bg-amber-50 border-amber-200"
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
              {t("offer.details.field.internalNotes")}
              <span className="font-normal">{t("offer.details.internalNotes.hint")}</span>
            </Label>
            <Textarea
              value={details.internalNotes}
              onChange={(e) => updateDetails("internalNotes", e.target.value)}
              placeholder={t("offer.details.internalNotes.placeholder")}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

        </CardContent>
      )}
    </Card>
  );
}
