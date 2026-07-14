import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Calendar, Home, Truck, Info, Package, Sparkles, Trash2,
  Warehouse, Piano, MoveUp, Navigation, Clock, Building, Users,
  Bath, Wind, CheckCircle, XCircle, AlertTriangle,
  Box, Shield, Wrench
} from "lucide-react";
import { format } from "date-fns";
import { useI18n, useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

// Import type definitions
import type { ReinigungAnfrage } from "@/types/reinigung";
import type { UmzugAnfrage, PropertyDetails } from "@/types/umzug";
import type { RaeumungAnfrage } from "@/types/raeumung";
import type { KlaviertransportAnfrage } from "@/types/klaviertransport";
import type { MoebelliftAnfrage } from "@/types/moebellift";
import type { LagerungAnfrage } from "@/types/lagerung";

interface Lead {
  service_type: string;
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz: string;
  from_city: string;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  property_type?: string | null;
  packing_service_needed?: boolean | null;
  cleaning_service_needed?: boolean | null;
  storage_needed?: boolean | null;
  piano_transport_needed?: boolean | null;
  description?: string | null;
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  bathroom_count?: number | null;
  kitchen_type?: string | null;
  has_balcony?: boolean | null;
  has_garage?: boolean | null;
  has_basement?: boolean | null;
  has_attic?: boolean | null;
  clearing_type?: string | null;
  estimated_volume?: string | null;
  has_heavy_items?: boolean | null;
  heavy_items_description?: string | null;
  disposal_type?: string | null;
  items_description?: string | null;
  storage_duration?: string | null;
  storage_volume?: string | null;
  access_frequency?: string | null;
  needs_climate_control?: boolean | null;
  storage_items_description?: string | null;
  piano_type?: string | null;
  piano_brand?: string | null;
  piano_weight_kg?: number | null;
  staircase_type?: string | null;
  staircase_width_cm?: number | null;
  staircase_turns?: number | null;
  window_access_possible?: boolean | null;
  moebellift_floor?: number | null;
  moebellift_item_description?: string | null;
  moebellift_item_dimensions?: string | null;
  special_items?: string[] | null;
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_floor?: number | null;
  pickup_has_lift?: boolean | null;
  // NEW: Detailed wizard form data
  detailed_form_data?: Record<string, unknown> | null;
  form_version?: number | null;
  cleaning_windows?: boolean | null;
  moving_flexibility?: string | null;
  additional_services_umzug?: Record<string, unknown> | null;
}

interface ServiceDetailsSectionProps {
  lead: Lead;
}

// Helper Components
const _InfoRow = ({ label, value, icon: Icon }: { label: string; value: string | number | undefined | null; icon?: React.ElementType }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
};

const _BooleanBadge = ({ value, labelTrue, labelFalse }: { value: boolean | undefined | null; labelTrue: string; labelFalse: string }) => {
  if (value === undefined || value === null) return null;
  return (
    <Badge variant={value ? "default" : "secondary"} className={`text-xs ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
      {value ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {value ? labelTrue : labelFalse}
    </Badge>
  );
};

const SectionHeader = ({ icon: Icon, title, color = "text-blue-600" }: { icon: React.ElementType; title: string; color?: string }) => (
  <div className={`flex items-center gap-2 mb-3 ${color}`}>
    <Icon className="w-4 h-4" />
    <h4 className="font-semibold text-sm uppercase tracking-wide">{title}</h4>
  </div>
);

// REINIGUNG DETAILED SECTION
const DetailedReinigungSection = ({ data: _data }: { data: ReinigungAnfrage }) => {
  const t = useT();
  const d = _data as unknown as Record<string, unknown>;
  const unterkunftLabelKeys: Record<string, MessageKey> = {
    haus: "offer.leadDetail.accommodation.haus",
    wohnung: "offer.leadDetail.accommodation.wohnung",
    wg: "offer.leadDetail.accommodation.wg",
    wg_zimmer: "offer.leadDetail.accommodation.wg",
    lager: "offer.leadDetail.accommodation.lager",
    buero: "offer.leadDetail.accommodation.buero",
  };
  const unterkunftLabel = (key: string): string => (unterkunftLabelKeys[key] ? t(unterkunftLabelKeys[key]) : key);
  // New wizard fields (fallback to old wizard fields)
  const unterkunft = (d.unterkunft || d.unterkunft_art) as string | undefined;
  const m2 = (d.m2 || d.wohnflaeche_m2) as number | undefined;
  const zimmer = (d.zimmer || d.zimmer_anzahl) as string | number | undefined;
  const bad = d.bad as number | undefined;
  const wc = d.wc as number | undefined;
  const rooms = d.rooms as string[] | undefined;
  const balkon = d.balkon as boolean | undefined;
  const fenNormal = (d.fen_normal as number) || 0;
  const fenGross = (d.fen_gross as number) || 0;
  const fenTuer = (d.fen_tuer as number) || 0;
  const totalFenster = fenNormal + fenGross + fenTuer;
  const storenCount = d.storen_count as number | undefined;
  const besArray = Array.isArray(d.besonderheiten) ? d.besonderheiten as string[] : [];
  const zusArray = Array.isArray(d.zusatzleistungen) ? d.zusatzleistungen as string[] : [];

  return (
    <div className="space-y-4">
      {/* Objekt */}
      <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
        <SectionHeader icon={Home} title={t("offer.leadDetail.section.object")} color="text-purple-600" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {unterkunft && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">{t("offer.leadDetail.field.accommodation")}</p>
              <p className="font-bold text-purple-600">{unterkunftLabel(unterkunft)}</p>
            </div>
          )}
          {zimmer && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">{t("offer.leadDetail.field.rooms")}</p>
              <p className="font-bold text-purple-600">{String(zimmer)}</p>
            </div>
          )}
          {m2 && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">{t("offer.leadDetail.field.area")}</p>
              <p className="font-bold text-purple-600">{m2} m²</p>
            </div>
          )}
        </div>
      </div>

      {/* Badezimmer */}
      {(bad !== undefined || wc !== undefined) && (
        <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-100">
          <SectionHeader icon={Bath} title={t("offer.leadDetail.section.wetRooms")} color="text-cyan-600" />
          <div className="grid grid-cols-2 gap-2 text-center">
            {bad !== undefined && (
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-cyan-600">{bad}</p>
                <p className="text-xs text-muted-foreground">{t("offer.leadDetail.field.bathroomsShort")}</p>
              </div>
            )}
            {wc !== undefined && (
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-cyan-600">{wc}</p>
                <p className="text-xs text-muted-foreground">{t("offer.leadDetail.field.toilet")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zusätzliche Räume */}
      {((rooms && rooms.length > 0) || balkon) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={Building} title={t("offer.leadDetail.section.extraRooms")} color="text-blue-600" />
          <div className="flex flex-wrap gap-2">
            {rooms?.map(r => <Badge key={r} variant="outline" className="bg-white">{r}</Badge>)}
            {balkon && !rooms?.includes("balkon") && <Badge variant="outline" className="bg-white">{t("offer.leadDetail.badge.balcony")}</Badge>}
          </div>
        </div>
      )}

      {/* Fenster */}
      {totalFenster > 0 && (
        <div className="p-3 bg-sky-50 rounded-lg border border-sky-100">
          <SectionHeader icon={Wind} title={t("offer.leadDetail.section.windows")} color="text-sky-600" />
          <div className="flex flex-wrap gap-2">
            {fenNormal > 0 && <Badge variant="outline" className="bg-white">{t("offer.leadDetail.badge.normalWindow", { count: fenNormal })}</Badge>}
            {fenGross > 0 && <Badge variant="outline" className="bg-white">{t("offer.leadDetail.badge.largeWindow", { count: fenGross })}</Badge>}
            {fenTuer > 0 && <Badge variant="outline" className="bg-white">{t("offer.leadDetail.badge.doorWindow", { count: fenTuer })}</Badge>}
            {storenCount !== undefined && storenCount > 0 && <Badge variant="outline" className="bg-white">{t("offer.leadDetail.badge.shutters", { count: storenCount })}</Badge>}
          </div>
        </div>
      )}

      {/* Besonderheiten */}
      {besArray.length > 0 && (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <SectionHeader icon={AlertTriangle} title={t("offer.leadDetail.section.specials")} color="text-yellow-600" />
          <div className="flex flex-wrap gap-2">
            {besArray.map(b => <Badge key={b} className="bg-yellow-100 text-yellow-700">{b}</Badge>)}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Sparkles} title={t("offer.leadDetail.section.extraServices")} color="text-green-600" />
          <div className="flex flex-wrap gap-2">
            {zusArray.map(z => <Badge key={z} className="bg-green-100 text-green-700">{z}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
};

// UMZUG DETAILED SECTION
const DetailedUmzugSection = ({ data }: { data: UmzugAnfrage }) => {
  const t = useT();
  const { dateLocale } = useI18n();
  const propertyLabelKeys: Record<string, MessageKey> = {
    haus: "offer.leadDetail.accommodation.haus",
    wohnung: "offer.leadDetail.accommodation.wohnung",
    wg_zimmer: "offer.leadDetail.accommodation.wg",
    lager: "offer.leadDetail.accommodation.lager",
    buero: "offer.leadDetail.accommodation.buero",
  };
  const propertyLabels: Record<string, string> = Object.fromEntries(
    Object.entries(propertyLabelKeys).map(([k, key]) => [k, t(key)]),
  );
  const floorLabelKeys: Record<string, MessageKey> = {
    basement: "offer.leadDetail.floorType.basement",
    ground_floor: "offer.leadDetail.floorType.groundFloor",
    raised_ground: "offer.leadDetail.floorType.raisedGround",
    floor_1: "offer.leadDetail.floorType.floor1",
    floor_2: "offer.leadDetail.floorType.floor2",
    floor_3: "offer.leadDetail.floorType.floor3",
    floor_4: "offer.leadDetail.floorType.floor4",
    floor_5_plus: "offer.leadDetail.floorType.floor5plus",
  };
  const floorLabels: Record<string, string> = Object.fromEntries(
    Object.entries(floorLabelKeys).map(([k, key]) => [k, t(key)]),
  );
  const liftLabelKeys: Record<string, MessageKey> = {
    none: "offer.leadDetail.liftType.none",
    small_elevator: "offer.leadDetail.liftType.small",
    large_elevator: "offer.leadDetail.liftType.large",
    cargo_elevator: "offer.leadDetail.liftType.cargo",
  };
  const liftLabels: Record<string, string> = Object.fromEntries(
    Object.entries(liftLabelKeys).map(([k, key]) => [k, t(key)]),
  );

  const PropertyCard = ({ property, title, color }: { property: PropertyDetails; title: string; color: string }) => (
    <div className={`p-2 sm:p-3 rounded-lg border ${color}`}>
      <h5 className="font-semibold text-xs sm:text-sm mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="truncate">{title}</span>
      </h5>
      <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
        <p className="font-medium truncate">{property.adresse?.strasse} {property.adresse?.hausnummer}</p>
        <p className="text-muted-foreground">{property.adresse?.plz} {property.adresse?.ort}</p>
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1.5 sm:mt-2">
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{propertyLabels[property.property_type] || property.property_type}</Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{t("offer.leadDetail.rooms.count", { rooms: property.anzahl_zimmer })}</Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{property.wohnflaeche_m2} m²</Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{floorLabels[property.stockwerk] || property.stockwerk}</Badge>
          <Badge variant={property.lift?.vorhanden ? "default" : "secondary"} className="text-[10px] sm:text-xs px-1.5 py-0">
            {property.lift?.vorhanden ? liftLabels[property.lift.typ || 'none'] || t("offer.leadDetail.liftType.withLift") : t("offer.leadDetail.liftType.withoutLift")}
          </Badge>
        </div>
        {property.parkplatz && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">
            📍 {t("offer.leadDetail.parkingInfo", {
              distance: property.parkplatz.distanz_meter,
              steps: property.parkplatz.stufen?.replace('steps_', '').replace('_', '-') ?? "",
            })}
            {property.parkplatz.weg_beeintraechtigt && " ⚠️"}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Addresses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.auszug && <PropertyCard property={data.auszug} title={t("offer.leadDetail.section.moveOut")} color="bg-red-50 border-red-100" />}
        {data.einzug && <PropertyCard property={data.einzug} title={t("offer.leadDetail.section.moveIn")} color="bg-green-50 border-green-100" />}
      </div>

      {/* Moving Details */}
      {data.umzug_details && (
        <div className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={Calendar} title={t("offer.leadDetail.section.moveDetails")} color="text-blue-600" />
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.date")}</p>
              <p className="font-bold text-blue-600 text-xs sm:text-sm">{data.umzug_details.datum ? format(new Date(data.umzug_details.datum), "dd.MM.yyyy", { locale: dateLocale }) : '-'}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.flexibility")}</p>
              <p className="font-bold text-blue-600 text-[10px] sm:text-xs">{data.umzug_details.flexibilitaet?.replace('flex_', '±').replace('_', ' ')}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.startTime")}</p>
              <p className="font-bold text-blue-600 text-xs sm:text-sm">{data.umzug_details.startzeit || t("offer.leadDetail.value.flexible")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory - Clear, consolidated display */}
      {data.inventar && (
        <div className="p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-100">
          <SectionHeader icon={Box} title={t("offer.leadDetail.section.inventory")} color="text-orange-600" />

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-orange-600">{data.inventar.geschaetzte_kartons || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.boxes")}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-purple-600">{data.inventar.items?.reduce((sum, item) => sum + item.anzahl, 0) || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.furniture")}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-red-600">{data.inventar.schwere_gegenstaende?.filter(i => i.anzahl > 0).length || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("offer.leadDetail.field.special")}</p>
            </div>
          </div>

          {/* Box Types - Extract from items array */}
          {(() => {
            const boxItems = data.inventar.items?.filter(item => 
              item.name.toLowerCase().includes('karton') || 
              item.name.toLowerCase().includes('box')
            ).filter(item => item.anzahl > 0) || [];
            
            if (boxItems.length === 0 && !data.inventar.geschaetzte_kartons) return null;
            
            return (
              <div className="mb-4 p-3 bg-white rounded-lg border">
                <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                  {t("offer.leadDetail.boxesDetail", { count: data.inventar.geschaetzte_kartons || boxItems.reduce((s, i) => s + i.anzahl, 0) })}
                </p>
                {boxItems.length > 0 ? (
                  <div className="space-y-1">
                    {boxItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-dashed last:border-0">
                        <span className="text-sm">{item.name}</span>
                        <Badge variant="secondary" className="font-bold">{item.anzahl}x</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("offer.leadDetail.boxesEstimate", { count: data.inventar.geschaetzte_kartons })}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Furniture - Consolidated and clear (excluding boxes) */}
          {(() => {
            // Filter out boxes from furniture list
            const furnitureItems = data.inventar.items?.filter(item => 
              item.anzahl > 0 && 
              !item.name.toLowerCase().includes('karton') && 
              !item.name.toLowerCase().includes('box')
            ) || [];
            
            if (furnitureItems.length === 0) return null;
            
            // Consolidate items by name (in case same item appears multiple times)
            const consolidated = furnitureItems.reduce((acc, item) => {
              const existing = acc.find(i => i.name === item.name);
              if (existing) {
                existing.anzahl += item.anzahl;
              } else {
                acc.push({ ...item });
              }
              return acc;
            }, [] as typeof furnitureItems);
            
            // Define categories with keywords. `keywords` matches against item.name, which is
            // always German inventory content from the wizard (not localised) — keep as-is.
            // Only `labelKey` (the section heading) is resolved with the dashboard locale.
            const categories: { labelKey: MessageKey; keywords: string[]; icon: string }[] = [
              { labelKey: "offer.leadDetail.category.livingRoom", keywords: ['Sofa', 'Sessel', 'Couchtisch', 'TV', 'Bücherregal', 'Vitrine', 'Sideboard', 'Regal'], icon: "🛋️" },
              { labelKey: "offer.leadDetail.category.bedroom", keywords: ['Bett', 'Nachttisch', 'Kleiderschrank', 'Kommode', 'Schrank'], icon: "🛏️" },
              { labelKey: "offer.leadDetail.category.diningRoom", keywords: ['Esstisch', 'Stuhl', 'Buffet'], icon: "🍽️" },
              { labelKey: "offer.leadDetail.category.kitchen", keywords: ['Kühlschrank', 'Gefrierschrank', 'Waschmaschine', 'Trockner', 'Geschirrspüler', 'Mikrowelle', 'Backofen', 'Herd'], icon: "🍳" },
              { labelKey: "offer.leadDetail.category.office", keywords: ['Schreibtisch', 'Bürostuhl', 'Aktenschrank', 'Drucker', 'Computer'], icon: "💼" },
              { labelKey: "offer.leadDetail.category.other", keywords: ['Fahrrad', 'E-Bike', 'Motorrad', 'Pflanzen', 'Lampe', 'Spiegel', 'Teppich'], icon: "🚲" },
            ];

            const usedItems = new Set<string>();

            return (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                  {t("offer.leadDetail.furnitureDetail", { count: consolidated.reduce((s, i) => s + i.anzahl, 0) })}
                </p>

                <div className="space-y-2">
                  {categories.map(cat => {
                    const catItems = consolidated.filter(item =>
                      cat.keywords.some(k => item.name.toLowerCase().includes(k.toLowerCase())) &&
                      !usedItems.has(item.name)
                    );

                    if (catItems.length === 0) return null;

                    catItems.forEach(i => usedItems.add(i.name));

                    return (
                      <div key={cat.labelKey} className="p-2 bg-white rounded-lg border">
                        <p className="text-[10px] text-muted-foreground font-bold mb-2">{cat.icon} {t(cat.labelKey)}</p>
                        <div className="space-y-1">
                          {catItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-0.5">
                              <span className="text-sm">{item.name}</span>
                              <Badge variant="outline" className="font-bold text-purple-700 bg-purple-50">{item.anzahl}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Any uncategorized items */}
                  {(() => {
                    const uncategorized = consolidated.filter(item => !usedItems.has(item.name));
                    if (uncategorized.length === 0) return null;
                    return (
                      <div className="p-2 bg-white rounded-lg border">
                        <p className="text-[10px] text-muted-foreground font-bold mb-2">{t("offer.leadDetail.category.more")}</p>
                        <div className="space-y-1">
                          {uncategorized.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-0.5">
                              <span className="text-sm">{item.name}</span>
                              <Badge variant="outline" className="font-bold">{item.anzahl}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* KOSTENPFLICHTIGE EXTRAS - Heavy Items with Pricing */}
      {data.inventar?.schwere_gegenstaende && data.inventar.schwere_gegenstaende.filter(i => i.anzahl > 0).length > 0 && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <SectionHeader icon={AlertTriangle} title={t("offer.leadDetail.section.paidExtras")} color="text-red-600" />
          <div className="space-y-2">
            {data.inventar.schwere_gegenstaende.filter(item => item.anzahl > 0).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-red-100">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">{item.anzahl}x</Badge>
                  <span className="font-medium text-sm">{item.name}</span>
                </div>
                {item.aufpreis_chf && (
                  <span className="font-bold text-red-600">+CHF {item.aufpreis_chf}</span>
                )}
              </div>
            ))}
            <div className="pt-2 border-t border-red-200 flex justify-between items-center">
              <span className="text-xs text-red-600 font-semibold">{t("offer.leadDetail.totalExtras")}</span>
              <span className="font-bold text-red-700 text-lg">
                +CHF {data.inventar.schwere_gegenstaende.filter(i => i.anzahl > 0).reduce((sum, i) => sum + (i.anzahl * (i.aufpreis_chf || 0)), 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ZUSATZLEISTUNGEN - Additional Services */}
      {data.zusatzleistungen && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Wrench} title={t("offer.leadDetail.section.extraServices")} color="text-green-600" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.zusatzleistungen.verpackung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Package className="w-4 h-4 text-green-600" />
                <span className="text-sm">
                  {t("offer.leadDetail.packing", {
                    scope: data.zusatzleistungen.verpackung.umfang === 'nur_fragiles'
                      ? t("offer.leadDetail.packing.fragileOnly")
                      : t("offer.leadDetail.packing.complete"),
                  })}
                </span>
              </div>
            )}
            {data.zusatzleistungen.auspacken && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Box className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("offer.leadDetail.unpacking")}</span>
              </div>
            )}
            {data.zusatzleistungen.moebelmontage && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Wrench className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("offer.leadDetail.furnitureAssembly")}</span>
              </div>
            )}
            {data.zusatzleistungen.endreinigung && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Sparkles className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("offer.leadDetail.finalCleaning")}</span>
              </div>
            )}
            {data.zusatzleistungen.entsorgung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Trash2 className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("offer.leadDetail.disposalWithVolume", { volume: data.zusatzleistungen.entsorgung.volumen_m3 })}</span>
              </div>
            )}
            {data.zusatzleistungen.zwischenlagerung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Warehouse className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("offer.leadDetail.interimStorage", { weeks: data.zusatzleistungen.zwischenlagerung.dauer_wochen })}</span>
              </div>
            )}
          </div>

          {/* Möbellift - Separate prominent display */}
          {data.zusatzleistungen.moebellift?.aktiv && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MoveUp className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-700">{t("offer.leadDetail.liftRequired")}</p>
                    <p className="text-xs text-amber-600">
                      {data.zusatzleistungen.moebellift.standort === 'auszug' && t("offer.leadDetail.liftLocation.moveOut")}
                      {data.zusatzleistungen.moebellift.standort === 'einzug' && t("offer.leadDetail.liftLocation.moveIn")}
                      {data.zusatzleistungen.moebellift.standort === 'beide' && t("offer.leadDetail.liftLocation.both")}
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">{t("offer.leadDetail.extraBadge")}</Badge>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// RÄUMUNG DETAILED SECTION
const DetailedRaeumungSection = ({ data: _data }: { data: RaeumungAnfrage }) => {
  const t = useT();
  const d = _data as unknown as Record<string, unknown>;
  // New wizard field names
  const svcType = d.svcType as string | undefined;
  const rart = d.rart as string | undefined;
  const m2 = d.m2 as number | undefined;
  const adresse = [d.str, d.nr, d.plz, d.ort].filter(Boolean).join(" ");
  const stock = d.stock as string | undefined;
  const lift = d.lift as boolean | undefined;
  const vol = d.vol as string | undefined;
  const dring = d.dring as string | undefined;
  const schwer = d.schwer as boolean | undefined;
  const schwerItems = Array.isArray(d.schwerItems) ? d.schwerItems as string[] : [];
  const zustand = d.zustand as string | undefined;
  const zusArray = Array.isArray(d.zus) ? d.zus as string[] : [];
  const entCats = Array.isArray(d.entCats) ? d.entCats as string[] : [];
  const menge = d.menge as string | undefined;
  const eAdresse = [d.eStr, d.eNr, d.ePlz, d.eOrt].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      {/* Service Typ */}
      <div className="p-3 bg-red-50 rounded-lg border border-red-100">
        <SectionHeader icon={Trash2} title={t("offer.leadDetail.requestType")} color="text-red-600" />
        <div className="flex flex-wrap gap-2">
          {svcType && <Badge className="bg-red-100 text-red-700 text-sm">{svcType === "raeumung" ? t("offer.leadDetail.requestType.raeumung") : svcType === "entsorgung" ? t("offer.leadDetail.requestType.entsorgung") : svcType}</Badge>}
          {rart && <Badge variant="outline">{rart}</Badge>}
        </div>
      </div>

      {/* Objekt & Adresse */}
      {(adresse || m2 || stock) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.propertyAddress")} color="text-blue-600" />
          {adresse && <p className="font-medium text-sm">{adresse}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            {m2 && <Badge variant="outline">{m2} m²</Badge>}
            {stock && <Badge variant="outline">{stock}</Badge>}
            {lift !== undefined && <Badge variant={lift ? "default" : "secondary"}>{lift ? t("offer.leadDetail.lift.yes") : t("offer.leadDetail.lift.no")}</Badge>}
            {vol && <Badge variant="outline">{t("offer.leadDetail.field.volumeLabel", { value: vol })}</Badge>}
          </div>
        </div>
      )}

      {/* Zustand */}
      {(zustand || schwer) && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <SectionHeader icon={AlertTriangle} title={t("offer.leadDetail.section.condition")} color="text-amber-600" />
          <div className="flex flex-wrap gap-2">
            {zustand && <Badge className="bg-amber-100 text-amber-700">{zustand}</Badge>}
            {dring && <Badge className="bg-orange-100 text-orange-700">{t("offer.leadDetail.field.urgency", { value: dring })}</Badge>}
            {schwer && <Badge className="bg-red-100 text-red-700">{t("offer.leadDetail.heavyItemsWarning")}</Badge>}
            {schwerItems.map(item => <Badge key={item} variant="outline">{item}</Badge>)}
          </div>
        </div>
      )}

      {/* Entsorgung Details */}
      {(entCats.length > 0 || menge) && (
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
          <SectionHeader icon={Trash2} title={t("offer.leadDetail.section.disposal")} color="text-orange-600" />
          <div className="flex flex-wrap gap-2">
            {entCats.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
            {menge && <Badge variant="outline">{t("offer.leadDetail.field.amount", { value: menge })}</Badge>}
            {eAdresse && <p className="w-full text-sm text-gray-600 mt-1">{t("offer.leadDetail.field.pickupAddress", { address: eAdresse })}</p>}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Wrench} title={t("offer.leadDetail.section.extraServices")} color="text-green-600" />
          <div className="flex flex-wrap gap-2">
            {zusArray.map(z => <Badge key={z} className="bg-green-100 text-green-700">{z}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
};

// KLAVIERTRANSPORT DETAILED SECTION
const DetailedKlaviertransportSection = ({ data: _data }: { data: KlaviertransportAnfrage }) => {
  const t = useT();
  const d = _data as unknown as Record<string, unknown>;
  const dl = d.dl as string | undefined;
  const inst = d.inst as string | undefined;
  const vonAdresse = [d.vonStr, d.vonNr, d.vonPlz, d.vonOrt].filter(Boolean).join(" ");
  const nachAdresse = [d.nachStr, d.nachNr, d.nachPlz, d.nachOrt].filter(Boolean).join(" ");
  const intAdresse = [d.intStr, d.intNr, d.intPlz, d.intOrt].filter(Boolean).join(" ");
  const zusArray = Array.isArray(d.zus) ? d.zus as string[] : [];
  const dlLabelKeys: Record<string, MessageKey> = {
    transport: "offer.leadDetail.service.transport",
    intern: "offer.leadDetail.service.internal",
    entsorgung: "offer.leadDetail.service.disposal",
    einlagerung: "offer.leadDetail.service.storage",
  };

  return (
    <div className="space-y-4">
      {/* Instrument & Service */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <SectionHeader icon={Piano} title={t("offer.leadDetail.section.instrumentService")} color="text-amber-600" />
        <div className="flex flex-wrap gap-2">
          {inst && <Badge className="bg-amber-100 text-amber-700">{inst}</Badge>}
          {dl && <Badge variant="outline">{dlLabelKeys[dl] ? t(dlLabelKeys[dl]) : dl}</Badge>}
        </div>
      </div>

      {/* Von-Adresse */}
      {vonAdresse && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.pickupLocation")} color="text-red-600" />
          <p className="font-medium text-sm">{vonAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.vonStock && <Badge variant="outline">{String(d.vonStock)}</Badge>}
            {d.vonLift !== undefined && (
              <Badge variant={(d.vonLift as boolean) ? "default" : "secondary"}>
                {d.vonLift ? t("offer.leadDetail.lift.yes") : t("offer.leadDetail.lift.no")}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Nach-Adresse (transport) */}
      {nachAdresse && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.deliveryLocation")} color="text-green-600" />
          <p className="font-medium text-sm">{nachAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.nachStock && <Badge variant="outline">{String(d.nachStock)}</Badge>}
            {d.nachLift !== undefined && (
              <Badge variant={(d.nachLift as boolean) ? "default" : "secondary"}>
                {d.nachLift ? t("offer.leadDetail.lift.yes") : t("offer.leadDetail.lift.no")}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Intern (internal move) */}
      {intAdresse && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.internal")} color="text-blue-600" />
          <p className="font-medium text-sm">{intAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.internVonStock && <Badge variant="outline">{t("offer.leadDetail.field.fromShort", { value: String(d.internVonStock) })}</Badge>}
            {d.internNachStock && <Badge variant="outline">{t("offer.leadDetail.field.toShort", { value: String(d.internNachStock) })}</Badge>}
            {d.internLift !== undefined && (
              <Badge variant={(d.internLift as boolean) ? "default" : "secondary"}>
                {d.internLift ? t("offer.leadDetail.lift.yes") : t("offer.leadDetail.lift.no")}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <SectionHeader icon={Sparkles} title={t("offer.leadDetail.section.extraServices")} color="text-purple-600" />
          <div className="flex flex-wrap gap-2">
            {zusArray.map(z => <Badge key={z} className="bg-purple-100 text-purple-700">{z}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
};

// MÖBELLIFT DETAILED SECTION
const DetailedMoebelliftSection = ({ data: _data }: { data: MoebelliftAnfrage }) => {
  const t = useT();
  const d = _data as unknown as Record<string, unknown>;
  // New wizard field names
  const zweck = d.zweck as string | undefined;
  const was = d.was as string | undefined;
  const dl = d.dl as string | undefined;
  const richtung = d.richtung as string | undefined;
  const adresse = [d.str, d.nr, d.plz, d.ort].filter(Boolean).join(" ");
  const stock = d.stock as string | undefined;
  const zugang = d.zugang as string | undefined;
  const dauer = d.dauer as string | undefined;
  const zusArray = Array.isArray(d.zus) ? d.zus as string[] : [];
  const richtungLabel = richtung === "hoch" ? t("offer.leadDetail.direction.up") : richtung === "runter" ? t("offer.leadDetail.direction.down") : richtung === "beides" ? t("offer.leadDetail.direction.both") : richtung;
  const purposeLabelKeys: Record<string, MessageKey> = {
    umzug: "offer.leadDetail.purpose.umzug",
    einzelstueck: "offer.leadDetail.purpose.einzelstueck",
    baumaterial: "offer.leadDetail.purpose.baumaterial",
    handwerker: "offer.leadDetail.purpose.handwerker",
    entsorgung: "offer.leadDetail.purpose.entsorgung",
    sonstiges: "offer.leadDetail.purpose.sonstiges",
  };

  return (
    <div className="space-y-4">
      {/* Einsatz-Details */}
      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <SectionHeader icon={MoveUp} title={t("offer.leadDetail.section.liftDeployment")} color="text-indigo-600" />
        <div className="flex flex-wrap gap-2">
          {zweck && <Badge className="bg-indigo-100 text-indigo-700">{purposeLabelKeys[zweck] ? t(purposeLabelKeys[zweck]) : zweck}</Badge>}
          {was && <Badge variant="outline">{was}</Badge>}
          {dl && <Badge variant="outline">{dl}</Badge>}
          {richtung && <Badge variant="outline">{richtungLabel}</Badge>}
          {dauer && <Badge variant="outline">{t("offer.leadDetail.field.duration")} {dauer}</Badge>}
        </div>
      </div>

      {/* Einsatzort */}
      {(adresse || stock || zugang) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.deploymentSite")} color="text-blue-600" />
          {adresse && <p className="font-medium text-sm">{adresse}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            {stock && <Badge variant="outline">{stock}</Badge>}
            {zugang && <Badge variant="outline">{t("offer.leadDetail.field.accessMethod", { value: zugang })}</Badge>}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Wrench} title={t("offer.leadDetail.section.extraServices")} color="text-green-600" />
          <div className="flex flex-wrap gap-2">
            {zusArray.map(z => <Badge key={z} className="bg-green-100 text-green-700">{z}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
};

// LAGERUNG DETAILED SECTION
const DetailedLagerungSection = ({ data }: { data: LagerungAnfrage | Record<string, unknown> }) => {
  const t = useT();
  const { dateLocale } = useI18n();
  const d = data as Record<string, unknown>;
  // New wizard field names (fallback to old names)
  const lart = (d.lart || d.storage_type) as string | undefined;
  const grosse = (d.grosse || d.storage_volume) as string | undefined;
  const dauer = (d.dauer || d.storage_duration) as string | undefined;
  const startMode = d.startMode as string | undefined;
  const startDate = (d.startDate || d.preferred_start_date) as string | undefined;
  const abholung = (d.abholung || d.pickup_service) as boolean | undefined;
  const versicherung = (d.versicherung || d.insurance_needed) as boolean | undefined;
  const ruecklieferung = d.ruecklieferung as boolean | undefined;
  const wasText = (d.wasText || d.storage_items_description) as string | undefined;
  const pickupAdresse = [d.pStr, d.pNr, d.pPlz, d.pOrt].filter(Boolean).join(" ");
  // Old format fallback
  const oldPickupAdresse = [d.pickup_street, d.pickup_house_number, d.pickup_plz, d.pickup_city].filter(Boolean).join(" ");
  const displayAdresse = pickupAdresse || oldPickupAdresse;

  const lartLabelKeys: Record<string, MessageKey> = {
    moebel: "offer.leadDetail.storageType.moebel",
    keller: "offer.leadDetail.storageType.keller",
    estrich: "offer.leadDetail.storageType.estrich",
    selfstorage: "offer.leadDetail.storageType.selfstorage",
    temporary: "offer.leadDetail.storageType.temporary",
    long_term: "offer.leadDetail.storageType.longTerm",
    climate_controlled: "offer.leadDetail.storageType.climateControlled",
  };
  // Storage duration tokens of the wizard. The German-only `storageDurationLabels` map in
  // @/types/lagerung cannot be used here — the dashboard renders in the operator's locale.
  const durationLabelKeys: Record<string, MessageKey> = {
    kurzfristig: "offer.leadDetail.storageDuration.kurzfristig",
    "1-3_monate": "offer.leadDetail.storageDuration.1to3",
    "3-6_monate": "offer.leadDetail.storageDuration.3to6",
    "6-12_monate": "offer.leadDetail.storageDuration.6to12",
    langfristig: "offer.leadDetail.storageDuration.langfristig",
  };

  return (
    <div className="space-y-4">
      {/* Lagerungsdetails */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <SectionHeader icon={Warehouse} title={t("offer.leadDetail.section.storageDetails")} color="text-amber-600" />
        <div className="flex flex-wrap gap-2">
          {lart && <Badge className="bg-amber-100 text-amber-700">{lartLabelKeys[lart] ? t(lartLabelKeys[lart]) : lart}</Badge>}
          {grosse && <Badge variant="outline">{t("offer.leadDetail.field.size", { value: grosse })}</Badge>}
          {dauer && <Badge variant="outline">{t("offer.leadDetail.field.duration")} {durationLabelKeys[dauer] ? t(durationLabelKeys[dauer]) : dauer}</Badge>}
          {startMode && startMode !== "sofort" && startDate && (
            <Badge variant="outline">{t("offer.leadDetail.field.startFrom", { date: format(new Date(startDate), "dd.MM.yyyy", { locale: dateLocale }) })}</Badge>
          )}
          {startMode === "sofort" && <Badge variant="outline">{t("offer.leadDetail.field.startImmediate")}</Badge>}
        </div>
      </div>

      {/* Abholadresse */}
      {displayAdresse && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.pickupAddress")} color="text-blue-600" />
          <p className="font-medium text-sm">{displayAdresse}</p>
        </div>
      )}

      {/* Was eingelagert werden soll */}
      {wasText && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <SectionHeader icon={Box} title={t("offer.leadDetail.section.storageContents")} color="text-gray-600" />
          <p className="text-sm text-muted-foreground">{wasText}</p>
        </div>
      )}

      {/* Optionen */}
      <div className="flex flex-wrap gap-2">
        {abholung && <Badge className="bg-purple-100 text-purple-700"><Truck className="w-3 h-3 mr-1" />{t("offer.leadDetail.pickupService")}</Badge>}
        {versicherung && <Badge className="bg-green-100 text-green-700"><Shield className="w-3 h-3 mr-1" />{t("offer.leadDetail.insurance")}</Badge>}
        {ruecklieferung && <Badge className="bg-blue-100 text-blue-700"><Truck className="w-3 h-3 mr-1" />{t("offer.leadDetail.returnDelivery")}</Badge>}
      </div>
    </div>
  );
};

// SPEZIALTRANSPORT DETAILED SECTION
const DetailedSpezialTransportSection = ({ data }: { data: Record<string, unknown> }) => {
  const t = useT();
  const kat = data.kat as string | undefined;
  const detailAnswer = data.detailAnswer;

  const vonAdresse = [data.vonStr, data.vonNr, data.vonPlz, data.vonOrt].filter(Boolean).join(" ");
  const nachAdresse = [data.nachStr, data.nachNr, data.nachPlz, data.nachOrt].filter(Boolean).join(" ");

  const formatDetail = (val: unknown): string => {
    if (val === null || val === undefined) return t("offer.leadDetail.noValue");
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-4">
      {/* Kategorie */}
      {kat && (
        <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">{t("offer.leadDetail.field.category")}</p>
          <p className="text-sm font-medium text-gray-800">{kat}</p>
          {detailAnswer !== null && detailAnswer !== undefined && (
            <p className="text-sm text-gray-600 mt-1">{t("offer.leadDetail.field.detail", { value: formatDetail(detailAnswer) })}</p>
          )}
        </div>
      )}

      {/* Adressen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vonAdresse && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">{t("offer.leadDetail.section.pickup")}</p>
            <p className="text-sm text-gray-700">{vonAdresse}</p>
            {data.vonStock && <p className="text-xs text-gray-500 mt-0.5">{t("offer.leadDetail.field.floorLabel", { value: String(data.vonStock) })}</p>}
            {typeof data.vonLift === "boolean" && (
              <p className="text-xs text-gray-500">{t("offer.leadDetail.field.liftLabel", { value: data.vonLift ? t("offer.leadDetail.value.yes") : t("offer.leadDetail.value.no") })}</p>
            )}
          </div>
        )}
        {nachAdresse && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">{t("offer.leadDetail.section.delivery")}</p>
            <p className="text-sm text-gray-700">{nachAdresse}</p>
            {data.nachStock && <p className="text-xs text-gray-500 mt-0.5">{t("offer.leadDetail.field.floorLabel", { value: String(data.nachStock) })}</p>}
            {typeof data.nachLift === "boolean" && (
              <p className="text-xs text-gray-500">{t("offer.leadDetail.field.liftLabel", { value: data.nachLift ? t("offer.leadDetail.value.yes") : t("offer.leadDetail.value.no") })}</p>
            )}
          </div>
        )}
      </div>

      {/* Datum / Flexibilität */}
      {(data.flex || data.offerten) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {data.flex && (
            <div>
              <span className="text-muted-foreground">{t("offer.leadDetail.field.flexibilityLabel")}</span>
              <span>{data.flex === "fix" ? t("offer.leadDetail.flex.fixed") : data.flex === "week" ? t("offer.leadDetail.flex.week") : data.flex === "month" ? t("offer.leadDetail.flex.month") : String(data.flex)}</span>
            </div>
          )}
          {data.offerten && (
            <div>
              <span className="text-muted-foreground">{t("offer.leadDetail.field.desiredOffers")}</span>
              <span>{String(data.offerten)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// GENERIC DETAILED SECTION - For any service type with detailed_form_data
const GenericDetailedSection = ({ data, serviceType }: { data: Record<string, unknown>; serviceType?: string }) => {
  const t = useT();
  // Filter out empty/null values and internal fields
  const filterData = (obj: Record<string, unknown>): [string, unknown][] => {
    return Object.entries(obj).filter(([key, value]) => {
      // Skip internal/empty fields
      if (value === null || value === undefined || value === "") return false;
      if (key.startsWith("_") || key === "id") return false;
      // Skip nested objects that are empty
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return false;
      return true;
    });
  };

  // Format field label nicely
  const formatLabel = (key: string): string => {
    return key
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (typeof value === "boolean") return value ? t("offer.leadDetail.value.yes") : t("offer.leadDetail.value.no");
    if (typeof value === "number") return value.toString();
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
    return String(value);
  };

  const entries = filterData(data);
  
  // Group fields by category
  const addressFields = entries.filter(([k]) => 
    k.includes("street") || k.includes("plz") || k.includes("city") || k.includes("floor") || k.includes("house")
  );
  const contactFields = entries.filter(([k]) => 
    k.includes("name") || k.includes("email") || k.includes("phone") || k.includes("salutation")
  );
  const dateFields = entries.filter(([k]) => 
    k.includes("date") || k.includes("time") || k.includes("termin")
  );
  const otherFields = entries.filter(([k]) => 
    !addressFields.some(([ak]) => ak === k) && 
    !contactFields.some(([ck]) => ck === k) && 
    !dateFields.some(([dk]) => dk === k)
  );

  return (
    <div className="space-y-4">
      <div className="p-2 bg-yellow-50 rounded border border-yellow-200 mb-4">
        <p className="text-xs text-yellow-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t("offer.leadDetail.genericFallback", { serviceType: serviceType || t("offer.leadDetail.unknownService") })}
        </p>
      </div>

      {/* Address Section */}
      {addressFields.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title={t("offer.leadDetail.section.address")} color="text-blue-600" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {addressFields.map(([key, value]) => (
              <div key={key}>
                <span className="text-xs text-muted-foreground">{formatLabel(key)}:</span>
                <p className="font-medium">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Section */}
      {contactFields.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Users} title={t("offer.leadDetail.section.contact")} color="text-green-600" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {contactFields.map(([key, value]) => (
              <div key={key}>
                <span className="text-xs text-muted-foreground">{formatLabel(key)}:</span>
                <p className="font-medium">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date/Time Section */}
      {dateFields.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <SectionHeader icon={Calendar} title={t("offer.leadDetail.section.appointment")} color="text-purple-600" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {dateFields.map(([key, value]) => (
              <div key={key}>
                <span className="text-xs text-muted-foreground">{formatLabel(key)}:</span>
                <p className="font-medium">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Details */}
      {otherFields.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <SectionHeader icon={Info} title={t("offer.leadDetail.section.otherDetails")} color="text-gray-600" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {otherFields.map(([key, value]) => (
              <div key={key} className={typeof value === "object" ? "col-span-2" : ""}>
                <span className="text-xs text-muted-foreground">{formatLabel(key)}:</span>
                {typeof value === "object" && !Array.isArray(value) ? (
                  <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">{formatValue(value)}</pre>
                ) : (
                  <p className="font-medium">{formatValue(value)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// MAIN COMPONENT
export const ServiceDetailsSection = ({ lead }: ServiceDetailsSectionProps) => {
  const t = useT();
  const { dateLocale } = useI18n();

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "EEE, dd. MMM yyyy", { locale: dateLocale });
  };

  const getServiceIcon = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('umzug')) return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('reinigung')) return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('raeumung') || lower.includes('räumung')) return <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('entsorgung')) return <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('lagerung')) return <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('klaviertransport') || lower.includes('klavier')) return <Piano className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('moebellift') || lower.includes('möbellift')) return <MoveUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (lower.includes('spezialtransport')) return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />;
    return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
  };

  const isMovingService = ["umzug", "moving", "Umzug"].some((s) =>
    lead.service_type?.toLowerCase().includes(s.toLowerCase())
  );

  const getFloorLabel = (floor: number | null | undefined, hasLift: boolean | null | undefined) => {
    if (floor === null || floor === undefined) return null;
    const floorText = floor === 0 ? t("offer.leadDetail.floor.groundFloor") : t("offer.leadDetail.floor.nth", { floor });
    const liftText = hasLift ? t("offer.leadDetail.floor.withLift") : t("offer.leadDetail.floor.withoutLift");
    return `${floorText} (${liftText})`;
  };

  const getRoomsLabel = (rooms: number | null | undefined, m2: number | null | undefined) => {
    const parts = [];
    if (rooms) parts.push(t("offer.leadDetail.rooms.count", { rooms }));
    if (m2) parts.push(`${m2} m²`);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  // Check for detailed form data (form_version 1=manual import, 2=wizard form)
  const hasDetailedData = (lead.form_version === 1 || lead.form_version === 2) && lead.detailed_form_data;
  const serviceType = lead.service_type?.toLowerCase();

  // Render detailed section based on service type
  const renderDetailedSection = () => {
    if (!hasDetailedData || !lead.detailed_form_data) return null;

    const data = lead.detailed_form_data;

    if (serviceType?.includes('reinigung')) {
      return <DetailedReinigungSection data={data as unknown as ReinigungAnfrage} />;
    }
    if (serviceType?.includes('umzug')) {
      // New 5-step wizard (form_version 2, uses von/nach/vol structure)
      if ('vol' in data) {
        const volLabelKeys: Record<string, MessageKey> = {
          klein: "offer.leadDetail.newWizard.volume.klein",
          mittel: "offer.leadDetail.newWizard.volume.mittel",
          gross: "offer.leadDetail.newWizard.volume.gross",
          "sehr-gross": "offer.leadDetail.newWizard.volume.sehrGross",
        };
        const flexLabelKeys: Record<string, MessageKey> = {
          fix: "offer.leadDetail.newWizard.flex.fix",
          "3": "offer.leadDetail.newWizard.flex.3",
          "7": "offer.leadDetail.newWizard.flex.7",
          "14": "offer.leadDetail.newWizard.flex.14",
        };
        // The wizard stores the floor as the INDEX of its picker, not as a number of floors:
        // 0 = basement, 1 = ground floor, 2 = raised ground floor, 3…12 = 1st…10th floor,
        // 13 = floors 11–15, 14 = floor 15 and above.
        const stockLabel = (index: number): string => {
          if (index === 0) return t("offer.leadDetail.floorType.basement");
          if (index === 1) return t("offer.leadDetail.floorType.groundFloor");
          if (index === 2) return t("offer.leadDetail.floorType.raisedGround");
          if (index >= 3 && index <= 12) return t("lead.floor.upper", { floor: index - 2 });
          if (index === 13) return t("offer.leadDetail.stock.range11to15");
          if (index === 14) return t("offer.leadDetail.stock.above15");
          return t("offer.leadDetail.noValue");
        };
        const svc = (lead.additional_services_umzug as Record<string, unknown>) || {};
        const d = data as Record<string, unknown>;
        return (
          <div className="space-y-3">
            {/* Von → Nach */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">{t("offer.leadDetail.newWizard.from")}</p>
                <p className="text-sm font-medium">
                  {(d.von as Record<string,unknown>)?.country && (d.von as Record<string,unknown>).country !== "CH"
                    ? <>{(d.von as Record<string,unknown>).country}: {lead.from_city}</>
                    : <>{lead.from_plz && <span className="font-mono text-xs text-amber-600 mr-1">{lead.from_plz}</span>}{lead.from_city}</>
                  }
                </p>
                <div className="flex flex-wrap gap-1 text-xs">
                  {typeof d.von_stock === "number" && <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{stockLabel(d.von_stock)}</span>}
                  <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{d.von_lift ? t("offer.leadDetail.newWizard.lift") : t("offer.leadDetail.newWizard.noLift")}</span>
                  {d.von_zimmer && <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{t("offer.leadDetail.newWizard.rooms", { count: String(d.von_zimmer) })}</span>}
                  {d.von_m2 ? <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{String(d.von_m2)} m²</span> : null}
                </div>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1.5">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider">{t("offer.leadDetail.newWizard.to")}</p>
                {(d.nach as Record<string,unknown>)?.unknown
                  ? <p className="text-sm text-slate-400 italic">{t("offer.leadDetail.newWizard.unknown")}</p>
                  : <>
                      <p className="text-sm font-medium">
                        {(d.nach as Record<string,unknown>)?.country && (d.nach as Record<string,unknown>).country !== "CH"
                          ? <>{(d.nach as Record<string,unknown>).country}: {lead.to_city}</>
                          : <>{lead.to_plz && <span className="font-mono text-xs text-green-600 mr-1">{lead.to_plz}</span>}{lead.to_city}</>
                        }
                      </p>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {typeof d.nach_stock === "number" && <span className="px-1.5 py-0.5 rounded bg-white border border-green-200">{stockLabel(d.nach_stock)}</span>}
                        <span className="px-1.5 py-0.5 rounded bg-white border border-green-200">{d.nach_lift ? t("offer.leadDetail.newWizard.lift") : t("offer.leadDetail.newWizard.noLift")}</span>
                      </div>
                    </>
                }
              </div>
            </div>
            {/* Umfang + Flexibilität */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-[10px] text-slate-400 mb-0.5">{t("offer.leadDetail.newWizard.scope")}</p>
                <p className="font-semibold text-sm text-blue-700">{volLabelKeys[String(d.vol)] ? t(volLabelKeys[String(d.vol)]) : t("offer.leadDetail.noValue")}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 mb-0.5">{t("offer.leadDetail.newWizard.date")}</p>
                <p className="font-semibold text-sm">{d.dateUnknown ? t("offer.leadDetail.newWizard.dateOpen") : lead.preferred_date ? format(new Date(lead.preferred_date), "dd.MM.yyyy", { locale: dateLocale }) : t("offer.leadDetail.noValue")}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 mb-0.5">{t("offer.leadDetail.newWizard.flexibility")}</p>
                <p className="font-semibold text-xs">{flexLabelKeys[String(lead.moving_flexibility || d.flex)] ? t(flexLabelKeys[String(lead.moving_flexibility || d.flex)]) : t("offer.leadDetail.noValue")}</p>
              </div>
            </div>
            {/* Sperrgut */}
            {(svc.sperrgut as Record<string,unknown>)?.aktiv && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">{t("offer.leadDetail.newWizard.heavyItems")}</p>
                <div className="flex flex-wrap gap-1">
                  {((svc.sperrgut as Record<string,unknown>)?.items as string[] || []).map((item: string) => (
                    <span key={item} className="px-1.5 py-0.5 rounded bg-white border border-amber-200 text-xs">{item}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Zusatzleistungen */}
            {Object.keys(svc).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(svc.verpackung as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">{t("offer.leadDetail.newWizard.packing")}</Badge>}
                {svc.moebelmontage && <Badge variant="secondary" className="text-xs">{t("offer.leadDetail.newWizard.assembly")}</Badge>}
                {svc.endreinigung && <Badge variant="secondary" className="text-xs">{t("offer.leadDetail.newWizard.cleaning")}</Badge>}
                {(svc.entsorgung as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">{t("offer.leadDetail.newWizard.disposal")}</Badge>}
                {(svc.zwischenlagerung as Record<string,unknown>)?.aktiv && (
                  <Badge variant="secondary" className="text-xs">
                    {t("offer.leadDetail.newWizard.storage")}{(svc.zwischenlagerung as Record<string,unknown>)?.dauer_wochen ? t("offer.leadDetail.newWizard.storageWeeks", { weeks: (svc.zwischenlagerung as Record<string,unknown>).dauer_wochen as number }) : ""}
                  </Badge>
                )}
                {(svc.moebellift as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">{t("offer.leadDetail.newWizard.moebellift")}</Badge>}
              </div>
            )}
          </div>
        );
      }
      // Old 17-step wizard (auszug/einzug structure)
      return <DetailedUmzugSection data={data as unknown as UmzugAnfrage} />;
    }
    if (serviceType?.includes('raeumung') || serviceType?.includes('räumung') || serviceType?.includes('entsorgung')) {
      return <DetailedRaeumungSection data={data as unknown as RaeumungAnfrage} />;
    }
    if (serviceType?.includes('klavier')) {
      return <DetailedKlaviertransportSection data={data as unknown as KlaviertransportAnfrage} />;
    }
    if (serviceType?.includes('moebellift') || serviceType?.includes('möbellift')) {
      return <DetailedMoebelliftSection data={data as unknown as MoebelliftAnfrage} />;
    }
    if (serviceType?.includes('lagerung')) {
      return <DetailedLagerungSection data={data as unknown as LagerungAnfrage} />;
    }
    if (serviceType?.includes('spezialtransport')) {
      return <DetailedSpezialTransportSection data={data as Record<string, unknown>} />;
    }

    // Fallback: Generic render for any service type with detailed_form_data
    return <GenericDetailedSection data={data} serviceType={lead.service_type} />;
  };

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="flex flex-col gap-2 text-secondary">
          {/* Title row */}
          <div className="flex items-center gap-2 text-sm sm:text-base">
            {getServiceIcon(lead.service_type)}
            <span className="whitespace-nowrap">{t("offer.leadDetail.title")}</span>
          </div>
          {/* Badges row - always below title for consistent layout */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5 max-w-[120px] sm:max-w-none truncate">
              {lead.service_type.replace(/_/g, ' ')}
            </Badge>
            {hasDetailedData && (
              <Badge variant="default" className="text-[10px] sm:text-xs px-2 py-0.5 bg-green-600 whitespace-nowrap">
                {t("offer.leadDetail.detailFormBadge")}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* DETAILED FORM DATA (form_version 2) */}
        {hasDetailedData ? (
          <>
            {renderDetailedSection()}

            {/* Customer Remarks */}
            {lead.description && (
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("offer.leadDetail.customerNote")}</span>
                </div>
                <p className="text-sm italic text-muted-foreground leading-relaxed">"{lead.description}"</p>
              </div>
            )}
          </>
        ) : (
          /* LEGACY FORM DATA (form_version 1 or null) */
          <>
            {/* Distance Banner (if available) */}
            {lead.distance_km && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                  <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-primary text-lg">
                    {t("offer.leadDetail.distance", { km: Number(lead.distance_km).toFixed(1) })}
                  </p>
                  {lead.estimated_duration_minutes && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {t("offer.leadDetail.driveTime", { minutes: lead.estimated_duration_minutes })}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 hidden sm:flex">
                  <Truck className="w-3 h-3 mr-1" />
                  {t("domain.service.transport")}
                </Badge>
              </div>
            )}

            {/* Addresses */}
            {isMovingService && lead.to_city ? (
              <div className="space-y-2 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-white border border-secondary/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">{t("domain.address.umzug.primary")}</h4>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{lead.from_street} {lead.from_house_number}</p>
                    <p>{lead.from_plz} {lead.from_city}</p>
                    {getFloorLabel(lead.from_floor, lead.from_has_lift) && (
                      <Badge variant="outline" className="text-[10px] mt-1 bg-red-50">{getFloorLabel(lead.from_floor, lead.from_has_lift)}</Badge>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-secondary/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">{t("domain.address.umzug.secondary")}</h4>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{lead.to_street} {lead.to_house_number}</p>
                    <p>{lead.to_plz} {lead.to_city}</p>
                    {getFloorLabel(lead.to_floor, lead.to_has_lift) && (
                      <Badge variant="outline" className="text-[10px] mt-1 bg-green-50">{getFloorLabel(lead.to_floor, lead.to_has_lift)}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-white border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-secondary" />
                  <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">{t("common.address")}</h4>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{lead.from_street} {lead.from_house_number}</p>
                  <p>{lead.from_plz} {lead.from_city}</p>
                  {getFloorLabel(lead.from_floor, lead.from_has_lift) && (
                    <Badge variant="outline" className="text-[10px] mt-1">{getFloorLabel(lead.from_floor, lead.from_has_lift)}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Date & Rooms */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("common.date")}</span>
                </div>
                <p className="text-sm font-semibold">{formatDate(lead.preferred_date)}</p>
                {lead.preferred_time_slot && <p className="text-xs text-muted-foreground">{lead.preferred_time_slot}</p>}
              </div>

              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Home className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("offer.leadDetail.object")}</span>
                </div>
                <p className="text-sm font-semibold">{lead.property_type || t("offer.leadDetail.defaultPropertyType")}</p>
                <p className="text-xs text-muted-foreground">{getRoomsLabel(lead.from_rooms, lead.from_living_space_m2) || '-'}</p>
              </div>
            </div>

            {/* Special Items */}
            {lead.special_items && lead.special_items.length > 0 && (
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("offer.leadDetail.specialItems")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lead.special_items.map((item, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{item}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Service Specific Details */}
            {(lead.bathroom_count || lead.clearing_type || lead.disposal_type || lead.storage_duration || lead.piano_type || lead.moebellift_floor) && (
              <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm space-y-2">
                <div className="flex items-center gap-2 mb-1 text-blue-600">
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("offer.leadDetail.specificDetails")}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {lead.bathroom_count && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.bathrooms")}</span> {lead.bathroom_count}</p>}
                  {lead.kitchen_type && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.kitchenType")}</span> {lead.kitchen_type}</p>}
                  {lead.has_balcony && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.balcony")}</span> {t("offer.leadDetail.value.yes")}</p>}
                  {lead.clearing_type && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.clearingType")}</span> {lead.clearing_type}</p>}
                  {lead.estimated_volume && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.volume")}</span> {lead.estimated_volume}</p>}
                  {lead.has_heavy_items && <p className="text-red-600 font-semibold">{t("offer.leadDetail.field.heavyItems")}</p>}
                  {lead.disposal_type && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.disposalType")}</span> {lead.disposal_type}</p>}
                  {lead.storage_duration && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.duration")}</span> {lead.storage_duration}</p>}
                  {lead.access_frequency && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.access")}</span> {lead.access_frequency}</p>}
                  {lead.piano_type && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.pianoType")}</span> {lead.piano_type}</p>}
                  {lead.piano_weight_kg && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.weight")}</span> {lead.piano_weight_kg}kg</p>}
                  {lead.moebellift_floor && <p><span className="text-muted-foreground">{t("offer.leadDetail.field.floor")}</span> {lead.moebellift_floor}</p>}
                </div>
              </div>
            )}

            {/* Extra Services */}
            {(lead.packing_service_needed || lead.cleaning_service_needed || lead.storage_needed || lead.piano_transport_needed) && (
              <div className="flex flex-wrap gap-2">
                {lead.packing_service_needed && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t("offer.leadDetail.extra.packing")}</Badge>}
                {lead.cleaning_service_needed && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{t("offer.leadDetail.extra.cleaning")}</Badge>}
                {lead.storage_needed && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{t("offer.leadDetail.extra.storage")}</Badge>}
                {lead.piano_transport_needed && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t("offer.leadDetail.extra.piano")}</Badge>}
              </div>
            )}

            {/* Description */}
            {lead.description && (
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t("offer.leadDetail.customerNote")}</span>
                </div>
                <p className="text-sm italic text-muted-foreground leading-relaxed">"{lead.description}"</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
