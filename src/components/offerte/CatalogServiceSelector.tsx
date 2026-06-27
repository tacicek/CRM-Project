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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ServiceItem } from "@/types/leistungskatalog";
import { getCategoryLabel, getServiceTypeLabel } from "@/constants/service-catalog";
import { SERVICE_ORDER } from "@/lib/offerServiceType";

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
  const [services, setServices]       = useState<ServiceItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openServices, setOpenServices] = useState<Set<string>>(new Set()); // açık (expanded) service-section'lar

  const serviceTypeCandidates = useMemo(() => getServiceTypeCandidates(serviceType), [serviceType]);
  const excludedIdSet = useMemo(() => new Set(excludeServiceIds), [excludeServiceIds]);

  const loadServices = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Multi-service: tüm şirket kataloğunu yükle (service_type filtresi YOK).
      // serviceType prop artık filtre değil → primary tespiti + default-open için.
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

  // 2-seviye gruplama: service_type (üst) → category (alt). Katalog RAW service_type'ı kullanılır
  // (klaviertransport/moebellift kendi bölümü). Item'lar zaten kendi service_type'ını taşır.
  const groupedByService = useMemo(() => {
    const acc: Record<string, Record<string, ServiceItem[]>> = {};
    for (const s of available) {
      if (!acc[s.service_type]) acc[s.service_type] = {};
      if (!acc[s.service_type][s.category]) acc[s.service_type][s.category] = [];
      acc[s.service_type][s.category].push(s);
    }
    return acc;
  }, [available]);

  // Primary servis = lead'in service_type'ı (candidates'tan, katalogda mevcut olan).
  const primaryServiceType = useMemo(() => {
    const candSet = new Set(serviceTypeCandidates);
    return Object.keys(groupedByService).find(k => candSet.has(k)) ?? null;
  }, [groupedByService, serviceTypeCandidates]);

  // Sıra: primary önce, sonra SERVICE_ORDER, sonra diğerleri (ilk-görülme).
  const orderedServiceKeys = useMemo(() => {
    const keys = Object.keys(groupedByService);
    const rank = (k: string) => {
      if (k === primaryServiceType) return -1;
      const i = SERVICE_ORDER.indexOf(k as (typeof SERVICE_ORDER)[number]);
      return i === -1 ? SERVICE_ORDER.length + keys.indexOf(k) : i;
    };
    return [...keys].sort((a, b) => rank(a) - rank(b));
  }, [groupedByService, primaryServiceType]);

  // Default: primary açık, diğerleri kapalı (dialog her açıldığında).
  useEffect(() => {
    if (open && primaryServiceType) setOpenServices(new Set([primaryServiceType]));
  }, [open, primaryServiceType]);

  const toggleService = (st: string) => {
    setOpenServices(prev => {
      const next = new Set(prev);
      if (next.has(st)) { next.delete(st); } else { next.add(st); }
      return next;
    });
  };

  const searchActive = searchTerm.trim().length > 0;

  // Bir servisin (o an görünen — arama filtreli) seçilebilir item'ları.
  const serviceItemsOf = (st: string): ServiceItem[] =>
    Object.values(groupedByService[st] ?? {}).flat();

  const allSelectedInService = (st: string): boolean => {
    const its = serviceItemsOf(st);
    return its.length > 0 && its.every(s => selectedIds.has(s.id));
  };

  // Per-service select-all / aufheben (arama aktifken sadece eşleşenleri etkiler — görünen set).
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
            Leistung auswählen
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tippen Sie auf eine Leistung um sie auszuwählen
          </p>
        </DialogHeader>

        {/* ── Search ── */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Leistung suchen…"
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
              <p className="font-medium mb-1">Kein Katalog vorhanden</p>
              <p className="text-sm text-muted-foreground mb-4">
                Richten Sie zuerst Ihren Leistungskatalog ein.
              </p>
              <Link to="/firma/leistungskatalog" onClick={() => onOpenChange(false)}>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Leistungskatalog einrichten
                </Button>
              </Link>
            </div>
          ) : available.length === 0 && alreadyAdded.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm px-6">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Keine Leistungen gefunden
            </div>
          ) : (
            <div className="divide-y">

              {/* Available — service_type (collapsible) → category → items */}
              {orderedServiceKeys.map((st) => {
                const categories = groupedByService[st];
                const serviceCount = Object.values(categories).reduce((n, arr) => n + arr.length, 0);
                // Arama aktifken eşleşen servisler otomatik açık (manuel openServices BOZULMAZ — render override).
                const isServiceOpen = searchActive || openServices.has(st);
                const allSel = allSelectedInService(st);
                return (
                <div key={st}>
                  {/* Service-section header: sol=collapse toggle, sağ=per-service select-all (nested button YOK) */}
                  <div className="w-full px-4 py-2.5 bg-secondary/10 flex items-center justify-between gap-2 sticky top-0 z-20 border-b">
                    <button
                      type="button"
                      onClick={() => toggleService(st)}
                      disabled={searchActive}
                      className="flex items-center gap-2 text-sm font-semibold flex-1 min-w-0 text-left hover:opacity-80 disabled:opacity-100 disabled:cursor-default"
                    >
                      {isServiceOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <span className="truncate">{getServiceTypeLabel(st)}</span>
                      {st === primaryServiceType && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">Anfrage</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] shrink-0">{serviceCount}</Badge>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSelectService(st)}
                      className="text-xs text-secondary hover:text-secondary/80 underline shrink-0"
                    >
                      {allSel ? "Auswahl aufheben" : `Alle (${serviceCount})`}
                    </button>
                  </div>

                  {/* Categories within this service (only when expanded) */}
                  {isServiceOpen && Object.entries(categories).map(([category, items]) => (
                    <div key={category}>
                      {/* Category header */}
                      <div className="px-4 py-2 bg-muted flex items-center justify-between border-b">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {getCategoryLabel(category)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {items.length}
                        </Badge>
                      </div>

                      {/* Items */}
                      {items.map(service => {
                    const isSelected = selectedIds.has(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggle(service.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "bg-emerald-50"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Checkbox visual */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border"
                        }`}>
                          {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                        </div>

                        {/* Name + description */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight ${isSelected ? "text-emerald-800" : ""}`}>
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {service.description}
                            </p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          {service.default_price > 0 ? (
                            <>
                              <p className={`text-sm font-semibold ${isSelected ? "text-emerald-700" : ""}`}>
                                CHF {service.default_price.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{service.unit}</p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">{service.unit || "—"}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                    </div>
                  ))}
                </div>
                );
              })}

              {/* Already added section — at the bottom, clearly separated */}
              {alreadyAdded.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/20 border-t-2 border-dashed flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground">
                      Bereits in dieser Offerte vorhanden ({alreadyAdded.length})
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
                      <span className="text-[10px] text-muted-foreground shrink-0">In Offerte</span>
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
            {/* Global clear (servis-başına seçim service-header'larında) */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Auswahl aufheben ({selectedIds.size})
                </button>
              ) : null}
            </div>

            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                className="gap-1.5 min-w-[120px]"
              >
                <Plus className="w-4 h-4" />
                {selectedIds.size > 0
                  ? `${selectedIds.size} hinzufügen`
                  : "Auswählen"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
