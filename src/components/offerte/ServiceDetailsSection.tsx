import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Calendar, Home, Truck, Info, Package, Sparkles, Trash2, 
  Warehouse, Piano, MoveUp, Navigation, Clock, Building, Users,
  Bath, Wind, CheckCircle, XCircle, AlertTriangle,
  Box, Shield, Wrench
} from "lucide-react";

// Import type definitions
import type { ReinigungAnfrage } from "@/types/reinigung";
import type { UmzugAnfrage, PropertyDetails } from "@/types/umzug";
import type { RaeumungAnfrage } from "@/types/raeumung";
import type { KlaviertransportAnfrage } from "@/types/klaviertransport";
import type { MoebelliftAnfrage } from "@/types/moebellift";
import { type LagerungAnfrage, storageDurationLabels } from "@/types/lagerung";

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
  const d = _data as unknown as Record<string, unknown>;
  const unterkunftLabels: Record<string, string> = {
    haus: "Haus", wohnung: "Wohnung", wg: "WG-Zimmer", wg_zimmer: "WG-Zimmer", lager: "Lager", buero: "Büro"
  };
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
        <SectionHeader icon={Home} title="Objekt" color="text-purple-600" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {unterkunft && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">Unterkunft</p>
              <p className="font-bold text-purple-600">{unterkunftLabels[unterkunft] || unterkunft}</p>
            </div>
          )}
          {zimmer && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">Zimmer</p>
              <p className="font-bold text-purple-600">{String(zimmer)}</p>
            </div>
          )}
          {m2 && (
            <div className="text-center p-2 bg-white rounded border">
              <p className="text-xs text-muted-foreground">Fläche</p>
              <p className="font-bold text-purple-600">{m2} m²</p>
            </div>
          )}
        </div>
      </div>

      {/* Badezimmer */}
      {(bad !== undefined || wc !== undefined) && (
        <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-100">
          <SectionHeader icon={Bath} title="Nasszellen" color="text-cyan-600" />
          <div className="grid grid-cols-2 gap-2 text-center">
            {bad !== undefined && (
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-cyan-600">{bad}</p>
                <p className="text-xs text-muted-foreground">Badezimmer</p>
              </div>
            )}
            {wc !== undefined && (
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-cyan-600">{wc}</p>
                <p className="text-xs text-muted-foreground">WC</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zusätzliche Räume */}
      {((rooms && rooms.length > 0) || balkon) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={Building} title="Zusätzliche Räume" color="text-blue-600" />
          <div className="flex flex-wrap gap-2">
            {rooms?.map(r => <Badge key={r} variant="outline" className="bg-white">{r}</Badge>)}
            {balkon && !rooms?.includes("balkon") && <Badge variant="outline" className="bg-white">🌴 Balkon</Badge>}
          </div>
        </div>
      )}

      {/* Fenster */}
      {totalFenster > 0 && (
        <div className="p-3 bg-sky-50 rounded-lg border border-sky-100">
          <SectionHeader icon={Wind} title="Fenster" color="text-sky-600" />
          <div className="flex flex-wrap gap-2">
            {fenNormal > 0 && <Badge variant="outline" className="bg-white">{fenNormal}x Normal</Badge>}
            {fenGross > 0 && <Badge variant="outline" className="bg-white">{fenGross}x Gross</Badge>}
            {fenTuer > 0 && <Badge variant="outline" className="bg-white">{fenTuer}x Fenstertür</Badge>}
            {storenCount !== undefined && storenCount > 0 && <Badge variant="outline" className="bg-white">{storenCount}x Storen</Badge>}
          </div>
        </div>
      )}

      {/* Besonderheiten */}
      {besArray.length > 0 && (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <SectionHeader icon={AlertTriangle} title="Besonderheiten" color="text-yellow-600" />
          <div className="flex flex-wrap gap-2">
            {besArray.map(b => <Badge key={b} className="bg-yellow-100 text-yellow-700">{b}</Badge>)}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Sparkles} title="Zusatzleistungen" color="text-green-600" />
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
  const propertyLabels: Record<string, string> = {
    haus: "Haus", wohnung: "Wohnung", wg_zimmer: "WG-Zimmer", lager: "Lager", buero: "Büro"
  };
  const floorLabels: Record<string, string> = {
    basement: "Untergeschoss", ground_floor: "Erdgeschoss", raised_ground: "Hochparterre",
    floor_1: "1. Stock", floor_2: "2. Stock", floor_3: "3. Stock", floor_4: "4. Stock", floor_5_plus: "5.+ Stock"
  };
  const liftLabels: Record<string, string> = {
    none: "Kein Lift", small_elevator: "Kleiner Lift", large_elevator: "Grosser Lift", cargo_elevator: "Warenlift"
  };

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
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{property.anzahl_zimmer} Zi.</Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{property.wohnflaeche_m2} m²</Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{floorLabels[property.stockwerk] || property.stockwerk}</Badge>
          <Badge variant={property.lift?.vorhanden ? "default" : "secondary"} className="text-[10px] sm:text-xs px-1.5 py-0">
            {property.lift?.vorhanden ? liftLabels[property.lift.typ || 'none'] || 'Lift' : 'Ohne Lift'}
          </Badge>
        </div>
        {property.parkplatz && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">
            📍 Parkplatz: {property.parkplatz.distanz_meter}m | Stufen: {property.parkplatz.stufen?.replace('steps_', '').replace('_', '-')}
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
        {data.auszug && <PropertyCard property={data.auszug} title="🔴 Auszug (Von)" color="bg-red-50 border-red-100" />}
        {data.einzug && <PropertyCard property={data.einzug} title="🟢 Einzug (Nach)" color="bg-green-50 border-green-100" />}
      </div>

      {/* Moving Details */}
      {data.umzug_details && (
        <div className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={Calendar} title="Umzugsdetails" color="text-blue-600" />
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Datum</p>
              <p className="font-bold text-blue-600 text-xs sm:text-sm">{data.umzug_details.datum ? new Date(data.umzug_details.datum).toLocaleDateString('de-CH') : '-'}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Flexibilität</p>
              <p className="font-bold text-blue-600 text-[10px] sm:text-xs">{data.umzug_details.flexibilitaet?.replace('flex_', '±').replace('_', ' ')}</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Startzeit</p>
              <p className="font-bold text-blue-600 text-xs sm:text-sm">{data.umzug_details.startzeit || 'Flexibel'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory - Clear, consolidated display */}
      {data.inventar && (
        <div className="p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-100">
          <SectionHeader icon={Box} title="Inventar" color="text-orange-600" />
          
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-orange-600">{data.inventar.geschaetzte_kartons || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Kartons</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-purple-600">{data.inventar.items?.reduce((sum, item) => sum + item.anzahl, 0) || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Möbelstücke</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-white rounded border">
              <p className="text-base sm:text-lg font-bold text-red-600">{data.inventar.schwere_gegenstaende?.filter(i => i.anzahl > 0).length || 0}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Spezial</p>
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
                  📦 KARTONS IM DETAIL ({data.inventar.geschaetzte_kartons || boxItems.reduce((s, i) => s + i.anzahl, 0)} Stück)
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
                    Geschätzt: {data.inventar.geschaetzte_kartons} Kartons (keine Detailaufteilung)
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
            
            // Define categories with keywords
            const categories = [
              { name: "WOHNZIMMER", keywords: ['Sofa', 'Sessel', 'Couchtisch', 'TV', 'Bücherregal', 'Vitrine', 'Sideboard', 'Regal'], icon: "🛋️" },
              { name: "SCHLAFZIMMER", keywords: ['Bett', 'Nachttisch', 'Kleiderschrank', 'Kommode', 'Schrank'], icon: "🛏️" },
              { name: "ESSZIMMER", keywords: ['Esstisch', 'Stuhl', 'Buffet'], icon: "🍽️" },
              { name: "KÜCHE / GERÄTE", keywords: ['Kühlschrank', 'Gefrierschrank', 'Waschmaschine', 'Trockner', 'Geschirrspüler', 'Mikrowelle', 'Backofen', 'Herd'], icon: "🍳" },
              { name: "BÜRO", keywords: ['Schreibtisch', 'Bürostuhl', 'Aktenschrank', 'Drucker', 'Computer'], icon: "💼" },
              { name: "SONSTIGES", keywords: ['Fahrrad', 'E-Bike', 'Motorrad', 'Pflanzen', 'Lampe', 'Spiegel', 'Teppich'], icon: "🚲" },
            ];
            
            const usedItems = new Set<string>();
            
            return (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                  🪑 MÖBELSTÜCKE IM DETAIL ({consolidated.reduce((s, i) => s + i.anzahl, 0)} Stück)
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
                      <div key={cat.name} className="p-2 bg-white rounded-lg border">
                        <p className="text-[10px] text-muted-foreground font-bold mb-2">{cat.icon} {cat.name}</p>
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
                        <p className="text-[10px] text-muted-foreground font-bold mb-2">📋 WEITERE</p>
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
          <SectionHeader icon={AlertTriangle} title="Kostenpflichtige Extras" color="text-red-600" />
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
              <span className="text-xs text-red-600 font-semibold">TOTAL EXTRAS:</span>
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
          <SectionHeader icon={Wrench} title="Zusatzleistungen" color="text-green-600" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.zusatzleistungen.verpackung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Package className="w-4 h-4 text-green-600" />
                <span className="text-sm">Verpackung {data.zusatzleistungen.verpackung.umfang === 'nur_fragiles' ? '(nur Fragiles)' : '(Komplett)'}</span>
              </div>
            )}
            {data.zusatzleistungen.auspacken && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Box className="w-4 h-4 text-green-600" />
                <span className="text-sm">Auspacken</span>
              </div>
            )}
            {data.zusatzleistungen.moebelmontage && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Wrench className="w-4 h-4 text-green-600" />
                <span className="text-sm">Möbelmontage / Demontage</span>
              </div>
            )}
            {data.zusatzleistungen.endreinigung && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Sparkles className="w-4 h-4 text-green-600" />
                <span className="text-sm">Endreinigung</span>
              </div>
            )}
            {data.zusatzleistungen.entsorgung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Trash2 className="w-4 h-4 text-green-600" />
                <span className="text-sm">Entsorgung ({data.zusatzleistungen.entsorgung.volumen_m3} m³)</span>
              </div>
            )}
            {data.zusatzleistungen.zwischenlagerung?.aktiv && (
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Warehouse className="w-4 h-4 text-green-600" />
                <span className="text-sm">Zwischenlagerung ({data.zusatzleistungen.zwischenlagerung.dauer_wochen} Wochen)</span>
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
                    <p className="font-semibold text-amber-700">Möbellift benötigt</p>
                    <p className="text-xs text-amber-600">
                      {data.zusatzleistungen.moebellift.standort === 'auszug' && 'Am Auszugsort'}
                      {data.zusatzleistungen.moebellift.standort === 'einzug' && 'Am Einzugsort'}
                      {data.zusatzleistungen.moebellift.standort === 'beide' && 'An beiden Standorten'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">EXTRA</Badge>
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
        <SectionHeader icon={Trash2} title="Anfrage-Art" color="text-red-600" />
        <div className="flex flex-wrap gap-2">
          {svcType && <Badge className="bg-red-100 text-red-700 text-sm">{svcType === "raeumung" ? "🏚️ Räumung" : svcType === "entsorgung" ? "🗑️ Entsorgung" : svcType}</Badge>}
          {rart && <Badge variant="outline">{rart}</Badge>}
        </div>
      </div>

      {/* Objekt & Adresse */}
      {(adresse || m2 || stock) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title="Objekt & Adresse" color="text-blue-600" />
          {adresse && <p className="font-medium text-sm">{adresse}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            {m2 && <Badge variant="outline">{m2} m²</Badge>}
            {stock && <Badge variant="outline">{stock}</Badge>}
            {lift !== undefined && <Badge variant={lift ? "default" : "secondary"}>{lift ? "✓ Lift" : "✗ Kein Lift"}</Badge>}
            {vol && <Badge variant="outline">Volumen: {vol}</Badge>}
          </div>
        </div>
      )}

      {/* Zustand */}
      {(zustand || schwer) && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <SectionHeader icon={AlertTriangle} title="Zustand" color="text-amber-600" />
          <div className="flex flex-wrap gap-2">
            {zustand && <Badge className="bg-amber-100 text-amber-700">{zustand}</Badge>}
            {dring && <Badge className="bg-orange-100 text-orange-700">Dringlichkeit: {dring}</Badge>}
            {schwer && <Badge className="bg-red-100 text-red-700">⚠️ Schwere Gegenstände</Badge>}
            {schwerItems.map(item => <Badge key={item} variant="outline">{item}</Badge>)}
          </div>
        </div>
      )}

      {/* Entsorgung Details */}
      {(entCats.length > 0 || menge) && (
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
          <SectionHeader icon={Trash2} title="Entsorgung" color="text-orange-600" />
          <div className="flex flex-wrap gap-2">
            {entCats.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
            {menge && <Badge variant="outline">Menge: {menge}</Badge>}
            {eAdresse && <p className="w-full text-sm text-gray-600 mt-1">Abholadresse: {eAdresse}</p>}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Wrench} title="Zusatzleistungen" color="text-green-600" />
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
  const d = _data as unknown as Record<string, unknown>;
  const dl = d.dl as string | undefined;
  const inst = d.inst as string | undefined;
  const vonAdresse = [d.vonStr, d.vonNr, d.vonPlz, d.vonOrt].filter(Boolean).join(" ");
  const nachAdresse = [d.nachStr, d.nachNr, d.nachPlz, d.nachOrt].filter(Boolean).join(" ");
  const intAdresse = [d.intStr, d.intNr, d.intPlz, d.intOrt].filter(Boolean).join(" ");
  const zusArray = Array.isArray(d.zus) ? d.zus as string[] : [];
  const dlLabels: Record<string, string> = {
    transport: "🚚 Transport", intern: "🔄 Interne Verschiebung",
    entsorgung: "♻️ Entsorgung", einlagerung: "📦 Einlagerung"
  };

  return (
    <div className="space-y-4">
      {/* Instrument & Service */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <SectionHeader icon={Piano} title="Instrument & Service" color="text-amber-600" />
        <div className="flex flex-wrap gap-2">
          {inst && <Badge className="bg-amber-100 text-amber-700">{inst}</Badge>}
          {dl && <Badge variant="outline">{dlLabels[dl] || dl}</Badge>}
        </div>
      </div>

      {/* Von-Adresse */}
      {vonAdresse && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
          <SectionHeader icon={MapPin} title="📦 Abholort" color="text-red-600" />
          <p className="font-medium text-sm">{vonAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.vonStock && <Badge variant="outline">{String(d.vonStock)}</Badge>}
            {d.vonLift !== undefined && (
              <Badge variant={(d.vonLift as boolean) ? "default" : "secondary"}>
                {d.vonLift ? "✓ Lift" : "✗ Kein Lift"}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Nach-Adresse (transport) */}
      {nachAdresse && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={MapPin} title="🏠 Lieferort" color="text-green-600" />
          <p className="font-medium text-sm">{nachAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.nachStock && <Badge variant="outline">{String(d.nachStock)}</Badge>}
            {d.nachLift !== undefined && (
              <Badge variant={(d.nachLift as boolean) ? "default" : "secondary"}>
                {d.nachLift ? "✓ Lift" : "✗ Kein Lift"}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Intern (internal move) */}
      {intAdresse && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title="🔄 Intern (Von → Nach)" color="text-blue-600" />
          <p className="font-medium text-sm">{intAdresse}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.internVonStock && <Badge variant="outline">Von: {String(d.internVonStock)}</Badge>}
            {d.internNachStock && <Badge variant="outline">Nach: {String(d.internNachStock)}</Badge>}
            {d.internLift !== undefined && (
              <Badge variant={(d.internLift as boolean) ? "default" : "secondary"}>
                {d.internLift ? "✓ Lift" : "✗ Kein Lift"}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <SectionHeader icon={Sparkles} title="Zusatzleistungen" color="text-purple-600" />
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
  const richtungLabel = richtung === "hoch" ? "⬆️ Hinauf" : richtung === "runter" ? "⬇️ Hinunter" : richtung === "beides" ? "↕️ Beides" : richtung;
  const purposeLabels: Record<string, string> = {
    umzug: "Umzug", einzelstueck: "Einzelstück", baumaterial: "Baumaterial",
    handwerker: "Handwerker", entsorgung: "Entsorgung", sonstiges: "Sonstiges"
  };

  return (
    <div className="space-y-4">
      {/* Einsatz-Details */}
      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <SectionHeader icon={MoveUp} title="Möbellift-Einsatz" color="text-indigo-600" />
        <div className="flex flex-wrap gap-2">
          {zweck && <Badge className="bg-indigo-100 text-indigo-700">{purposeLabels[zweck] || zweck}</Badge>}
          {was && <Badge variant="outline">{was}</Badge>}
          {dl && <Badge variant="outline">{dl}</Badge>}
          {richtung && <Badge variant="outline">{richtungLabel}</Badge>}
          {dauer && <Badge variant="outline">Dauer: {dauer}</Badge>}
        </div>
      </div>

      {/* Einsatzort */}
      {(adresse || stock || zugang) && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title="Einsatzort" color="text-blue-600" />
          {adresse && <p className="font-medium text-sm">{adresse}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            {stock && <Badge variant="outline">{stock}</Badge>}
            {zugang && <Badge variant="outline">Zugang: {zugang}</Badge>}
          </div>
        </div>
      )}

      {/* Zusatzleistungen */}
      {zusArray.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <SectionHeader icon={Wrench} title="Zusatzleistungen" color="text-green-600" />
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

  const lartLabels: Record<string, string> = {
    moebel: "🪑 Möbellagerung", keller: "🏠 Kellerlager", estrich: "🏚️ Estrichlager",
    selfstorage: "📦 Self-Storage", temporary: "Kurzfristig", long_term: "Langfristig",
    climate_controlled: "Klimatisiert"
  };

  return (
    <div className="space-y-4">
      {/* Lagerungsdetails */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <SectionHeader icon={Warehouse} title="Lagerungsdetails" color="text-amber-600" />
        <div className="flex flex-wrap gap-2">
          {lart && <Badge className="bg-amber-100 text-amber-700">{lartLabels[lart] || lart}</Badge>}
          {grosse && <Badge variant="outline">Grösse: {grosse}</Badge>}
          {dauer && <Badge variant="outline">Dauer: {storageDurationLabels[dauer] || dauer}</Badge>}
          {startMode && startMode !== "sofort" && startDate && (
            <Badge variant="outline">Ab: {new Date(startDate).toLocaleDateString("de-CH")}</Badge>
          )}
          {startMode === "sofort" && <Badge variant="outline">Start: Sofort</Badge>}
        </div>
      </div>

      {/* Abholadresse */}
      {displayAdresse && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title="Abholadresse" color="text-blue-600" />
          <p className="font-medium text-sm">{displayAdresse}</p>
        </div>
      )}

      {/* Was eingelagert werden soll */}
      {wasText && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <SectionHeader icon={Box} title="Was wird eingelagert?" color="text-gray-600" />
          <p className="text-sm text-muted-foreground">{wasText}</p>
        </div>
      )}

      {/* Optionen */}
      <div className="flex flex-wrap gap-2">
        {abholung && <Badge className="bg-purple-100 text-purple-700"><Truck className="w-3 h-3 mr-1" />Abholservice</Badge>}
        {versicherung && <Badge className="bg-green-100 text-green-700"><Shield className="w-3 h-3 mr-1" />Versicherung</Badge>}
        {ruecklieferung && <Badge className="bg-blue-100 text-blue-700"><Truck className="w-3 h-3 mr-1" />Rücklieferung</Badge>}
      </div>
    </div>
  );
};

// SPEZIALTRANSPORT DETAILED SECTION
const DetailedSpezialTransportSection = ({ data }: { data: Record<string, unknown> }) => {
  const kat = data.kat as string | undefined;
  const detailAnswer = data.detailAnswer;

  const vonAdresse = [data.vonStr, data.vonNr, data.vonPlz, data.vonOrt].filter(Boolean).join(" ");
  const nachAdresse = [data.nachStr, data.nachNr, data.nachPlz, data.nachOrt].filter(Boolean).join(" ");

  const formatDetail = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-4">
      {/* Kategorie */}
      {kat && (
        <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">Kategorie</p>
          <p className="text-sm font-medium text-gray-800">{kat}</p>
          {detailAnswer !== null && detailAnswer !== undefined && (
            <p className="text-sm text-gray-600 mt-1">Detail: {formatDetail(detailAnswer)}</p>
          )}
        </div>
      )}

      {/* Adressen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vonAdresse && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">📦 Von (Abholung)</p>
            <p className="text-sm text-gray-700">{vonAdresse}</p>
            {data.vonStock && <p className="text-xs text-gray-500 mt-0.5">Stockwerk: {String(data.vonStock)}</p>}
            {typeof data.vonLift === "boolean" && (
              <p className="text-xs text-gray-500">Lift: {data.vonLift ? "Ja" : "Nein"}</p>
            )}
          </div>
        )}
        {nachAdresse && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">🏠 Nach (Lieferung)</p>
            <p className="text-sm text-gray-700">{nachAdresse}</p>
            {data.nachStock && <p className="text-xs text-gray-500 mt-0.5">Stockwerk: {String(data.nachStock)}</p>}
            {typeof data.nachLift === "boolean" && (
              <p className="text-xs text-gray-500">Lift: {data.nachLift ? "Ja" : "Nein"}</p>
            )}
          </div>
        )}
      </div>

      {/* Datum / Flexibilität */}
      {(data.flex || data.offerten) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {data.flex && (
            <div>
              <span className="text-muted-foreground">Flexibilität: </span>
              <span>{data.flex === "fix" ? "Fixer Termin" : data.flex === "week" ? "Innerhalb 1 Woche" : data.flex === "month" ? "Innerhalb 1 Monat" : String(data.flex)}</span>
            </div>
          )}
          {data.offerten && (
            <div>
              <span className="text-muted-foreground">Gewünschte Offerten: </span>
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
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
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
          Allgemeine Ansicht für {serviceType || "unbekannten Service"}
        </p>
      </div>

      {/* Address Section */}
      {addressFields.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <SectionHeader icon={MapPin} title="Adresse" color="text-blue-600" />
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
          <SectionHeader icon={Users} title="Kontakt" color="text-green-600" />
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
          <SectionHeader icon={Calendar} title="Termin" color="text-purple-600" />
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
          <SectionHeader icon={Info} title="Weitere Details" color="text-gray-600" />
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
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("de-CH", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getServiceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('umzug')) return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('reinigung')) return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('raeumung') || t.includes('räumung')) return <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('entsorgung')) return <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('lagerung')) return <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('klaviertransport') || t.includes('klavier')) return <Piano className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('moebellift') || t.includes('möbellift')) return <MoveUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
    if (t.includes('spezialtransport')) return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />;
    return <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />;
  };

  const isMovingService = ["umzug", "moving", "Umzug"].some((s) =>
    lead.service_type?.toLowerCase().includes(s.toLowerCase())
  );

  const getFloorLabel = (floor: number | null | undefined, hasLift: boolean | null | undefined) => {
    if (floor === null || floor === undefined) return null;
    const floorText = floor === 0 ? "EG" : `${floor}. Stock`;
    const liftText = hasLift ? "mit Lift" : "ohne Lift";
    return `${floorText} (${liftText})`;
  };

  const getRoomsLabel = (rooms: number | null | undefined, m2: number | null | undefined) => {
    const parts = [];
    if (rooms) parts.push(`${rooms}-Zimmer`);
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
        const volLabels: Record<string, string> = {klein:"Klein",mittel:"Mittel",gross:"Gross","sehr-gross":"Sehr gross"};
        const flexLabels: Record<string, string> = {fix:"Festes Datum","3":"± 3 Tage","7":"± 1 Woche","14":"± 2 Wochen"};
        const stockOpts = ["UG","EG","HP","1. OG","2. OG","3. OG","4. OG","5. OG","6. OG","7. OG","8. OG","9. OG","10. OG","11–15. OG","15.+ OG"];
        const svc = (lead.additional_services_umzug as Record<string, unknown>) || {};
        const d = data as Record<string, unknown>;
        return (
          <div className="space-y-3">
            {/* Von → Nach */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">📦 Von (Auszug)</p>
                <p className="text-sm font-medium">
                  {(d.von as Record<string,unknown>)?.country && (d.von as Record<string,unknown>).country !== "CH"
                    ? <>{(d.von as Record<string,unknown>).country}: {lead.from_city}</>
                    : <>{lead.from_plz && <span className="font-mono text-xs text-amber-600 mr-1">{lead.from_plz}</span>}{lead.from_city}</>
                  }
                </p>
                <div className="flex flex-wrap gap-1 text-xs">
                  {typeof d.von_stock === "number" && <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{stockOpts[d.von_stock]}</span>}
                  <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{d.von_lift ? "🛗 Lift" : "Kein Lift"}</span>
                  {d.von_zimmer && <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{String(d.von_zimmer)} Zimmer</span>}
                  {d.von_m2 ? <span className="px-1.5 py-0.5 rounded bg-white border border-amber-200">{String(d.von_m2)} m²</span> : null}
                </div>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1.5">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider">🏠 Nach (Einzug)</p>
                {(d.nach as Record<string,unknown>)?.unknown
                  ? <p className="text-sm text-slate-400 italic">Noch nicht bekannt</p>
                  : <>
                      <p className="text-sm font-medium">
                        {(d.nach as Record<string,unknown>)?.country && (d.nach as Record<string,unknown>).country !== "CH"
                          ? <>{(d.nach as Record<string,unknown>).country}: {lead.to_city}</>
                          : <>{lead.to_plz && <span className="font-mono text-xs text-green-600 mr-1">{lead.to_plz}</span>}{lead.to_city}</>
                        }
                      </p>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {typeof d.nach_stock === "number" && <span className="px-1.5 py-0.5 rounded bg-white border border-green-200">{stockOpts[d.nach_stock]}</span>}
                        <span className="px-1.5 py-0.5 rounded bg-white border border-green-200">{d.nach_lift ? "🛗 Lift" : "Kein Lift"}</span>
                      </div>
                    </>
                }
              </div>
            </div>
            {/* Umfang + Flexibilität */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-[10px] text-slate-400 mb-0.5">Umfang</p>
                <p className="font-semibold text-sm text-blue-700">{volLabels[String(d.vol)] || "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 mb-0.5">Datum</p>
                <p className="font-semibold text-sm">{d.dateUnknown ? "Offen" : lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString("de-CH") : "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 mb-0.5">Flexibilität</p>
                <p className="font-semibold text-xs">{flexLabels[String(lead.moving_flexibility || d.flex)] || "—"}</p>
              </div>
            </div>
            {/* Sperrgut */}
            {(svc.sperrgut as Record<string,unknown>)?.aktiv && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">🎹 Schwere / Sperrige Gegenstände</p>
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
                {(svc.verpackung as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">📦 Verpackung</Badge>}
                {svc.moebelmontage && <Badge variant="secondary" className="text-xs">🔧 Möbelmontage</Badge>}
                {svc.endreinigung && <Badge variant="secondary" className="text-xs">🧹 Endreinigung</Badge>}
                {(svc.entsorgung as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">🗑️ Entsorgung</Badge>}
                {(svc.zwischenlagerung as Record<string,unknown>)?.aktiv && (
                  <Badge variant="secondary" className="text-xs">
                    🏭 Lagerung{(svc.zwischenlagerung as Record<string,unknown>)?.dauer_wochen ? ` · ${(svc.zwischenlagerung as Record<string,unknown>).dauer_wochen} Wo.` : ""}
                  </Badge>
                )}
                {(svc.moebellift as Record<string,unknown>)?.aktiv && <Badge variant="secondary" className="text-xs">🏗️ Möbellift</Badge>}
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
            <span className="whitespace-nowrap">Vollständige Anfrage-Details</span>
          </div>
          {/* Badges row - always below title for consistent layout */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5 max-w-[120px] sm:max-w-none truncate">
              {lead.service_type.replace(/_/g, ' ')}
            </Badge>
            {hasDetailedData && (
              <Badge variant="default" className="text-[10px] sm:text-xs px-2 py-0.5 bg-green-600 whitespace-nowrap">
                ✓ Detailformular
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
                  <span className="text-[10px] font-bold uppercase tracking-wider">Kundenbemerkung</span>
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
                    {Number(lead.distance_km).toFixed(1)} km Entfernung
                  </p>
                  {lead.estimated_duration_minutes && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      ca. {lead.estimated_duration_minutes} Min. Fahrzeit
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 hidden sm:flex">
                  <Truck className="w-3 h-3 mr-1" />
                  Transport
                </Badge>
              </div>
            )}

            {/* Addresses */}
            {isMovingService && lead.to_city ? (
              <div className="space-y-2 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-white border border-secondary/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">Auszugsadresse</h4>
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
                    <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">Einzugsadresse</h4>
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
                  <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">Adresse</h4>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider">Datum</span>
                </div>
                <p className="text-sm font-semibold">{formatDate(lead.preferred_date)}</p>
                {lead.preferred_time_slot && <p className="text-xs text-muted-foreground">{lead.preferred_time_slot}</p>}
              </div>

              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Home className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Objekt</span>
                </div>
                <p className="text-sm font-semibold">{lead.property_type || 'Wohnung'}</p>
                <p className="text-xs text-muted-foreground">{getRoomsLabel(lead.from_rooms, lead.from_living_space_m2) || '-'}</p>
              </div>
            </div>

            {/* Special Items */}
            {lead.special_items && lead.special_items.length > 0 && (
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Spezial-Gegenstände</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider">Spezifische Details</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {lead.bathroom_count && <p><span className="text-muted-foreground">Badezimmer:</span> {lead.bathroom_count}</p>}
                  {lead.kitchen_type && <p><span className="text-muted-foreground">Küchen-Typ:</span> {lead.kitchen_type}</p>}
                  {lead.has_balcony && <p><span className="text-muted-foreground">Balkon:</span> Ja</p>}
                  {lead.clearing_type && <p><span className="text-muted-foreground">Räumungsart:</span> {lead.clearing_type}</p>}
                  {lead.estimated_volume && <p><span className="text-muted-foreground">Volumen:</span> {lead.estimated_volume}</p>}
                  {lead.has_heavy_items && <p className="text-red-600 font-semibold">⚠️ Schwere Gegenstände</p>}
                  {lead.disposal_type && <p><span className="text-muted-foreground">Entsorgungsart:</span> {lead.disposal_type}</p>}
                  {lead.storage_duration && <p><span className="text-muted-foreground">Dauer:</span> {lead.storage_duration}</p>}
                  {lead.access_frequency && <p><span className="text-muted-foreground">Zugriff:</span> {lead.access_frequency}</p>}
                  {lead.piano_type && <p><span className="text-muted-foreground">Klavier-Typ:</span> {lead.piano_type}</p>}
                  {lead.piano_weight_kg && <p><span className="text-muted-foreground">Gewicht:</span> {lead.piano_weight_kg}kg</p>}
                  {lead.moebellift_floor && <p><span className="text-muted-foreground">Stockwerk:</span> {lead.moebellift_floor}</p>}
                </div>
              </div>
            )}

            {/* Extra Services */}
            {(lead.packing_service_needed || lead.cleaning_service_needed || lead.storage_needed || lead.piano_transport_needed) && (
              <div className="flex flex-wrap gap-2">
                {lead.packing_service_needed && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Einpacken</Badge>}
                {lead.cleaning_service_needed && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Reinigung</Badge>}
                {lead.storage_needed && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Lagerung</Badge>}
                {lead.piano_transport_needed && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Klavier</Badge>}
              </div>
            )}

            {/* Description */}
            {lead.description && (
              <div className="p-3 bg-white rounded-lg border border-secondary/10 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Kundenbemerkung</span>
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
