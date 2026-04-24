import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Search, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Swiss Cantons with German names
const CANTON_NAMES: Record<string, string> = {
  AG: "Aargau",
  AI: "Appenzell Innerrhoden",
  AR: "Appenzell Ausserrhoden",
  BE: "Bern",
  BL: "Basel-Landschaft",
  BS: "Basel-Stadt",
  FR: "Freiburg",
  GE: "Genf",
  GL: "Glarus",
  GR: "Graubünden",
  JU: "Jura",
  LU: "Luzern",
  NE: "Neuenburg",
  NW: "Nidwalden",
  OW: "Obwalden",
  SG: "St. Gallen",
  SH: "Schaffhausen",
  SO: "Solothurn",
  SZ: "Schwyz",
  TG: "Thurgau",
  TI: "Tessin",
  UR: "Uri",
  VD: "Waadt",
  VS: "Wallis",
  ZG: "Zug",
  ZH: "Zürich",
};

interface PlzData {
  plz: string;
  city: string;
  canton: string | null;
}

interface PlzCoverage {
  id: string;
  plz: string;
  radius_km: number | null;
  is_active: boolean;
}

interface KantonPlzSelectorProps {
  companyId: string;
  existingCoverages: PlzCoverage[];
  onCoverageChange: () => void;
}

export function KantonPlzSelector({
  companyId,
  existingCoverages,
  onCoverageChange,
}: KantonPlzSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [plzData, setPlzData] = useState<PlzData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlzs, setSelectedPlzs] = useState<Set<string>>(new Set());
  const [pendingPlzs, setPendingPlzs] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Group PLZ by canton
  const plzByKanton = useMemo(() => {
    const grouped: Record<string, PlzData[]> = {};
    
    plzData.forEach((item) => {
      const canton = item.canton || "XX";
      if (!grouped[canton]) {
        grouped[canton] = [];
      }
      grouped[canton].push(item);
    });

    // Sort PLZ within each canton
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.plz.localeCompare(b.plz)));

    return grouped;
  }, [plzData]);

  // Sorted cantons
  const sortedCantons = useMemo(() => {
    return Object.keys(plzByKanton)
      .filter((k) => k !== "XX")
      .sort((a, b) => (CANTON_NAMES[a] || a).localeCompare(CANTON_NAMES[b] || b));
  }, [plzByKanton]);

  // Filter PLZ based on search
  const filteredPlzByKanton = useMemo(() => {
    if (!searchQuery.trim()) return plzByKanton;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, PlzData[]> = {};

    Object.entries(plzByKanton).forEach(([canton, plzList]) => {
      const matches = plzList.filter(
        (p) =>
          p.plz.includes(query) ||
          p.city.toLowerCase().includes(query) ||
          (CANTON_NAMES[canton] || "").toLowerCase().includes(query)
      );
      if (matches.length > 0) {
        filtered[canton] = matches;
      }
    });

    return filtered;
  }, [plzByKanton, searchQuery]);

  const loadPlzData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Supabase has a default limit of 1000 rows - we need all PLZ data (~4400 rows)
      // Use pagination to fetch all data in batches
      let allData: PlzData[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("swiss_plz")
          .select("plz, city, canton")
          .order("plz")
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Loaded ${allData.length} PLZ entries from database`);

      // Remove duplicates (some PLZ have multiple cities)
      const uniquePlz = new Map<string, PlzData>();
      allData.forEach((item) => {
        if (!uniquePlz.has(item.plz)) {
          uniquePlz.set(item.plz, item);
        }
      });

      console.log(`After deduplication: ${uniquePlz.size} unique PLZ codes`);
      setPlzData(Array.from(uniquePlz.values()));
    } catch (error) {
      console.error("Error loading PLZ data:", error);
      toast({
        title: "Fehler",
        description: "PLZ-Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadPlzData();
      // Initialize selected PLZs from existing coverages
      const existing = new Set(existingCoverages.map((c) => c.plz));
      setSelectedPlzs(existing);
      setPendingPlzs(new Set());
    }
     
  }, [open, existingCoverages, loadPlzData]);

  const togglePlz = (plz: string) => {
    const newPending = new Set(pendingPlzs);
    const isCurrentlySelected = selectedPlzs.has(plz);
    const isPendingAdd = pendingPlzs.has(plz) && !isCurrentlySelected;
    const isPendingRemove = pendingPlzs.has(plz) && isCurrentlySelected;

    if (isCurrentlySelected) {
      // Already selected - toggle pending remove
      if (isPendingRemove) {
        newPending.delete(plz);
      } else {
        newPending.add(plz);
      }
    } else {
      // Not selected - toggle pending add
      if (isPendingAdd) {
        newPending.delete(plz);
      } else {
        newPending.add(plz);
      }
    }

    setPendingPlzs(newPending);
  };

  const selectAllInKanton = (canton: string) => {
    const kantonPlzs = plzByKanton[canton] || [];
    const newPending = new Set(pendingPlzs);

    kantonPlzs.forEach((p) => {
      if (!selectedPlzs.has(p.plz)) {
        newPending.add(p.plz);
      }
    });

    setPendingPlzs(newPending);
  };

  const deselectAllInKanton = (canton: string) => {
    const kantonPlzs = plzByKanton[canton] || [];
    const newPending = new Set(pendingPlzs);

    kantonPlzs.forEach((p) => {
      if (selectedPlzs.has(p.plz)) {
        newPending.add(p.plz);
      } else {
        newPending.delete(p.plz);
      }
    });

    setPendingPlzs(newPending);
  };

  const isPlzSelected = (plz: string) => {
    const isCurrentlySelected = selectedPlzs.has(plz);
    const isPending = pendingPlzs.has(plz);

    if (isCurrentlySelected && isPending) return false; // Will be removed
    if (!isCurrentlySelected && isPending) return true; // Will be added
    return isCurrentlySelected;
  };

  const getCountForKanton = (canton: string) => {
    const kantonPlzs = plzByKanton[canton] || [];
    return kantonPlzs.filter((p) => isPlzSelected(p.plz)).length;
  };

  const saveChanges = async () => {
    if (pendingPlzs.size === 0) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      pendingPlzs.forEach((plz) => {
        if (selectedPlzs.has(plz)) {
          toRemove.push(plz);
        } else {
          toAdd.push(plz);
        }
      });

      // Remove PLZs
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("company_plz_coverage")
          .delete()
          .eq("company_id", companyId)
          .in("plz", toRemove);

        if (error) throw error;
      }

      // Add PLZs
      if (toAdd.length > 0) {
        const newCoverages = toAdd.map((plz) => ({
          company_id: companyId,
          plz,
          radius_km: 0,
          is_active: true,
        }));

        const { error } = await supabase
          .from("company_plz_coverage")
          .insert(newCoverages);

        if (error) throw error;
      }

      toast({
        title: "Gespeichert",
        description: `${toAdd.length} PLZ hinzugefügt, ${toRemove.length} PLZ entfernt.`,
      });

      onCoverageChange();
      setOpen(false);
    } catch (error) {
      console.error("Error saving PLZ coverage:", error);
      toast({
        title: "Fehler",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const pendingAddCount = Array.from(pendingPlzs).filter((p) => !selectedPlzs.has(p)).length;
  const pendingRemoveCount = Array.from(pendingPlzs).filter((p) => selectedPlzs.has(p)).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <MapPin className="w-4 h-4 mr-2" />
          PLZ nach Kanton auswählen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            PLZ nach Kanton auswählen
          </DialogTitle>
          <DialogDescription>
            Wählen Sie die PLZ-Gebiete in denen Sie tätig sind. Klicken Sie auf einen Kanton um alle PLZ zu sehen.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="PLZ, Stadt oder Kanton suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="secondary">
            {selectedPlzs.size + pendingAddCount - pendingRemoveCount} PLZ ausgewählt
          </Badge>
          {pendingAddCount > 0 && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
              +{pendingAddCount} neu
            </Badge>
          )}
          {pendingRemoveCount > 0 && (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
              -{pendingRemoveCount} entfernt
            </Badge>
          )}
        </div>

        {/* Canton List - Native scroll for better compatibility */}
        <div className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {sortedCantons.map((canton) => {
                const kantonPlzs = filteredPlzByKanton[canton];
                if (!kantonPlzs) return null;

                const totalPlzs = plzByKanton[canton]?.length || 0;
                const selectedCount = getCountForKanton(canton);

                return (
                  <AccordionItem key={canton} value={canton}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {canton}
                          </Badge>
                          <span className="font-medium">{CANTON_NAMES[canton]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={selectedCount > 0 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {selectedCount} / {totalPlzs}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {/* Quick Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllInKanton(canton)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Alle auswählen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deselectAllInKanton(canton)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Alle abwählen
                          </Button>
                        </div>

                        {/* PLZ Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {kantonPlzs.map((item) => {
                            const isSelected = isPlzSelected(item.plz);
                            const isPendingChange = pendingPlzs.has(item.plz);
                            const wasSelected = selectedPlzs.has(item.plz);

                            return (
                              <button
                                key={item.plz}
                                onClick={() => togglePlz(item.plz)}
                                className={`
                                  flex items-center gap-2 p-2 rounded-lg border text-left text-sm
                                  transition-colors hover:bg-accent
                                  ${isSelected ? "bg-primary/5 border-primary" : "bg-card border-border"}
                                  ${isPendingChange && !wasSelected ? "ring-2 ring-green-500/50" : ""}
                                  ${isPendingChange && wasSelected ? "ring-2 ring-red-500/50 opacity-60" : ""}
                                `}
                              >
                                <Checkbox checked={isSelected} className="pointer-events-none" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono font-medium">{item.plz}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {item.city}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={saveChanges} disabled={isSaving || pendingPlzs.size === 0}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Änderungen speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


