import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Loader2,
  ClipboardList,
  Package,
  Check,
  CheckCircle2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ServiceItem } from "@/types/leistungskatalog";
import { getServiceTypeLabel } from "@/constants/service-catalog";
import { SERVICE_ORDER } from "@/lib/offerServiceType";
import { derivePriceTypeFromCatalog } from "@/lib/offerPricing";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";

interface CatalogServiceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  serviceType: string;
  onServicesSelected: (services: ServiceItem[]) => void;
  excludeServiceIds?: string[];
}

const getServiceTypeCandidates = (rawServiceType: string): string[] => {
  const value = (rawServiceType || "").toLowerCase().trim();
  if (!value) return [];
  const candidates = new Set<string>([value]);
  const mappings: Record<string, string> = {
    umzug_privat: "umzug", umzug_firma: "umzug", umzug_buero: "umzug",
    umzug_international: "umzug", privatumzug: "umzug", firmenumzug: "umzug",
    reinigung_end: "reinigung", reinigung_grund: "reinigung",
    reinigung_fenster: "reinigung", endreinigung: "reinigung",
    raeumung_wohnung: "raeumung", raeumung_haus: "raeumung",
    entruempelung: "raeumung", transport_klavier: "klaviertransport",
    transport_moebel: "umzug",
  };
  if (mappings[value]) candidates.add(mappings[value]);
  if (value.startsWith("umzug_"))          candidates.add("umzug");
  if (value.startsWith("reinigung_"))      candidates.add("reinigung");
  if (value.startsWith("raeumung_"))       candidates.add("raeumung");
  if (value.startsWith("entsorgung_"))     candidates.add("entsorgung");
  if (value.startsWith("lagerung_"))       candidates.add("lagerung");
  if (value.includes("klavier"))           candidates.add("klaviertransport");
  if (value.startsWith("moebellift_"))     candidates.add("moebellift");
  if (value.startsWith("malerarbeit_"))    candidates.add("malerarbeit");
  return Array.from(candidates);
};

export function CatalogServiceSelector({
  open,
  onOpenChange,
  companyId,
  serviceType,
  onServicesSelected,
  excludeServiceIds = [],
}: CatalogServiceSelectorProps) {
  const t = useT();
  const { locale } = useI18n();
  const [services, setServices]       = useState<ServiceItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenServices, setHiddenServices] = useState<Set<string>>(new Set()); // services hidden via × (Faz 2: re-added through a dropdown)

  const serviceTypeCandidates = useMemo(() => getServiceTypeCandidates(serviceType), [serviceType]);
  const excludedIdSet = useMemo(() => new Set(excludeServiceIds), [excludeServiceIds]);

  const loadServices = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Multi-service: load the entire company catalog (NO service_type filter).
      // The serviceType prop is no longer a filter → used for primary detection + default-open.
      const { data, error } = await supabase
        .from("company_service_items")
        .select("*")
        .eq("company_id", companyId)
        .order("service_type")
        .order("category")
        .order("display_order");
      if (error) throw error;
      setServices(data || []);
    } catch (e) {
      console.error("Error loading services:", e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      loadServices();
      setSelectedIds(new Set());
      setSearchTerm("");
      setHiddenServices(new Set());
    }
  }, [open, loadServices]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleConfirm = () => {
    onServicesSelected(services.filter(s => selectedIds.has(s.id)));
    onOpenChange(false);
  };

  // Filtered list — exclude already-added ones, put them at the bottom
  const { available, alreadyAdded } = useMemo(() => {
    const all = services.filter(s => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    });
    return {
      available:    all.filter(s => !excludedIdSet.has(s.id)),
      alreadyAdded: all.filter(s =>  excludedIdSet.has(s.id)),
    };
  }, [services, searchTerm, excludedIdSet]);

  // 2-level grouping: service_type (top) → category (bottom). Uses the catalog RAW service_type
  // (klaviertransport/moebellift as its own section). Items already carry their own service_type.
  const groupedByService = useMemo(() => {
    const acc: Record<string, Record<string, ServiceItem[]>> = {};
    for (const s of available) {
      if (!acc[s.service_type]) acc[s.service_type] = {};
      if (!acc[s.service_type][s.category]) acc[s.service_type][s.category] = [];
      acc[s.service_type][s.category].push(s);
    }
    return acc;
  }, [available]);

  // Primary service = the lead's service_type (from candidates, whichever exists in the catalog).
  const primaryServiceType = useMemo(() => {
    const candSet = new Set(serviceTypeCandidates);
    return Object.keys(groupedByService).find(k => candSet.has(k)) ?? null;
  }, [groupedByService, serviceTypeCandidates]);

  // Order: primary first, then SERVICE_ORDER, then the rest (first-seen).
  const orderedServiceKeys = useMemo(() => {
    const keys = Object.keys(groupedByService);
    const rank = (k: string) => {
      if (k === primaryServiceType) return -1;
      const i = SERVICE_ORDER.indexOf(k as (typeof SERVICE_ORDER)[number]);
      return i === -1 ? SERVICE_ORDER.length + keys.indexOf(k) : i;
    };
    return [...keys].sort((a, b) => rank(a) - rank(b));
  }, [groupedByService, primaryServiceType]);

  // The selectable items of a service (currently visible — search-filtered).
  const serviceItemsOf = (st: string): ServiceItem[] =>
    Object.values(groupedByService[st] ?? {}).flat();

  // × → hide the service. Also clear the hidden service's selections (so an unseen item is not accidentally added).
  const hideService = (st: string) => {
    const ids = new Set(serviceItemsOf(st).map(s => s.id));
    setHiddenServices(prev => new Set(prev).add(st));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  };

  const allSelectedInService = (st: string): boolean => {
    const its = serviceItemsOf(st);
    return its.length > 0 && its.every(s => selectedIds.has(s.id));
  };

  // Per-service select-all / deselect (when search is active only affects matches — the visible set).
  const toggleSelectService = (st: string) => {
    const its = serviceItemsOf(st);
    const allSel = its.length > 0 && its.every(s => selectedIds.has(s.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      its.forEach(s => { if (allSel) next.delete(s.id); else next.add(s.id); });
      return next;
    });
  };

  const clearAll = () => setSelectedIds(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4 text-secondary" />
            {t("offer.catalogSelector.title")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("offer.catalogSelector.subtitle")}
          </p>
        </DialogHeader>

        {/* ── Search ── */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("offer.catalogSelector.searchPlaceholder")}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium mb-1">{t("offer.catalogSelector.empty.title")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("offer.catalogSelector.empty.description")}
              </p>
              <Link to="/firma/leistungskatalog" onClick={() => onOpenChange(false)}>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("offer.catalogSelector.empty.action")}
                </Button>
              </Link>
            </div>
          ) : available.length === 0 && alreadyAdded.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm px-6">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
              {t("offer.catalogSelector.noResults")}
            </div>
          ) : (
            <div className="divide-y">

              {/* Available — service_type header → flat 3-column item grid (offerio.png). Items hidden via × are skipped. */}
              {orderedServiceKeys.filter(st => !hiddenServices.has(st)).map((st) => {
                const categories = groupedByService[st];
                const serviceCount = Object.values(categories).reduce((n, arr) => n + arr.length, 0);
                const allSel = allSelectedInService(st);
                return (
                <div key={st}>
                  {/* Service-section header (offerio.png): Label + Anzahl-Badge | select-all + ×.
                      Status (auf Anfrage/inklusive) ist PER-ITEM im Grid (Katalog ist pro Service gemischt). */}
                  <div className="w-full px-4 py-2.5 bg-secondary/10 flex items-center justify-between gap-2 sticky top-0 z-20 border-b">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate">{getServiceTypeLabel(st, locale)}</span>
                      <Badge className="text-[10px] shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">{serviceCount}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectService(st)}
                        className="text-xs text-secondary hover:text-secondary/80 underline"
                      >
                        {allSel ? t("offer.catalogSelector.deselectAll") : t("offer.catalogSelector.selectAll", { count: serviceCount })}
                      </button>
                      <button
                        type="button"
                        onClick={() => hideService(st)}
                        aria-label={t("offer.catalogSelector.hideService")}
                        className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Items — flat 3-column grid (offerio.png). Category subheader entfernt;
                      Kategorie-Daten fliessen weiter via handleCatalogServicesSelected →
                      selectedLeistungen (kein Datenverlust, nur visuell). */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                      {serviceItemsOf(st).map(service => {
                        const isSelected = selectedIds.has(service.id);
                        // Per-item Status (derivePriceTypeFromCatalog single source): optional→auf Anfrage,
                        // inkl→inklusive, paid→small price. Instead of a single-type badge on the header (mixed catalog).
                        const pt = derivePriceTypeFromCatalog(service);
                        const itemStatus =
                          pt === "optional" ? { text: t("domain.priceModel.onRequest"), cls: "text-emerald-600" }
                          : pt === "inkl"   ? { text: t("offer.catalogSelector.status.included"), cls: "text-sky-600" }
                          : service.default_price > 0
                            ? { text: formatCurrency(service.default_price, locale), cls: "text-muted-foreground" }
                            : null;
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggle(service.id)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-300"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            {/* Checkbox visual (emerald) */}
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-border"
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </div>

                            {/* Name + per-item Status-Label (klein, unter dem Namen, kompakt) */}
                            <span className="flex-1 min-w-0">
                              <span className={`block text-xs font-medium leading-tight ${isSelected ? "text-emerald-800" : ""}`}>
                                {service.name}
                              </span>
                              {itemStatus && (
                                <span className={`block text-[10px] leading-tight truncate ${itemStatus.cls}`}>
                                  {itemStatus.text}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                </div>
                );
              })}

              {/* Already added section — at the bottom, clearly separated */}
              {alreadyAdded.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/20 border-t-2 border-dashed flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground">
                      {t("offer.catalogSelector.alreadyAdded", { count: alreadyAdded.length })}
                    </span>
                  </div>
                  {alreadyAdded.map(service => (
                    <div
                      key={service.id}
                      className="flex items-center gap-3 px-4 py-3 opacity-40"
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 bg-muted">
                        <Check className="w-3 h-3 text-muted-foreground/60" strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-through">{service.name}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{t("offer.catalogSelector.inOffer")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-4 py-3 border-t bg-background">
          <div className="flex items-center justify-between w-full gap-3">
            {/* Global clear (per-service selection lives in the service headers) */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {t("offer.catalogSelector.clearSelection", { count: selectedIds.size })}
                </button>
              ) : null}
            </div>

            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                className="gap-1.5 min-w-[120px]"
              >
                <Plus className="w-4 h-4" />
                {selectedIds.size > 0
                  ? t("offer.catalogSelector.addCount", { count: selectedIds.size })
                  : t("offer.catalogSelector.addSelect")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
