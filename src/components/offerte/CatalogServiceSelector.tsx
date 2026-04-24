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
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ServiceItem } from "@/types/leistungskatalog";
import { getCategoryLabel } from "@/constants/service-catalog";

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

  const serviceTypeCandidates = useMemo(() => getServiceTypeCandidates(serviceType), [serviceType]);
  const excludedIdSet = useMemo(() => new Set(excludeServiceIds), [excludeServiceIds]);

  const loadServices = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_service_items")
        .select("*")
        .eq("company_id", companyId)
        .in("service_type", serviceTypeCandidates.length > 0 ? serviceTypeCandidates : [serviceType])
        .order("category")
        .order("display_order");
      if (error) throw error;
      setServices(data || []);
    } catch (e) {
      console.error("Error loading services:", e);
    } finally {
      setLoading(false);
    }
  }, [companyId, serviceType, serviceTypeCandidates]);

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

  // Group available by category
  const grouped = useMemo(() =>
    available.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {} as Record<string, ServiceItem[]>),
    [available]
  );

  const selectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      available.forEach(s => next.add(s.id));
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

              {/* Available services grouped by category */}
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  {/* Category header */}
                  <div className="px-4 py-2 bg-muted flex items-center justify-between sticky top-0 z-10 border-b">
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
                            ? "bg-emerald-50 dark:bg-emerald-950/20"
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
                          <p className={`text-sm font-medium leading-tight ${isSelected ? "text-emerald-800 dark:text-emerald-200" : ""}`}>
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
            {/* Select all / clear */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Auswahl aufheben
                </button>
              ) : available.length > 0 ? (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-secondary hover:text-secondary/80 underline"
                >
                  Alle auswählen ({available.length})
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
