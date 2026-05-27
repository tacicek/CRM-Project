// =============================================================================
// ANFRAGE OVERVIEW - Clean Display of Lead/Request Data
// =============================================================================
// Shows all relevant anfrage (lead) data in organized, readable cards.
// Used in Offerte creation to reference the original customer request.
// =============================================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Home,
  Building2,
  Calendar,
  Package,
  Truck,
  Sparkles,
  Piano,
  Trash2,
  Warehouse,
  PaintBucket,
  ArrowRight,
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { getServiceLabel } from "@/lib/serviceLabels";

// =============================================================================
// TYPES
// =============================================================================

interface Lead {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  // Origin address
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz: string;
  from_city: string;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  // Destination address
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  // Scheduling
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  // Property
  property_type?: string | null;
  // Services
  packing_service_needed?: boolean | null;
  cleaning_service_needed?: boolean | null;
  storage_needed?: boolean | null;
  piano_transport_needed?: boolean | null;
  // Distance
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  // Description
  description?: string | null;
  // Reinigung fields
  bathroom_count?: number | null;
  kitchen_type?: string | null;
  has_balcony?: boolean | null;
  has_garage?: boolean | null;
  has_basement?: boolean | null;
  has_attic?: boolean | null;
  cleaning_windows?: boolean | null;
  // Räumung fields
  clearing_type?: string | null;
  estimated_volume?: string | null;
  has_heavy_items?: boolean | null;
  heavy_items_description?: string | null;
  // Entsorgung fields
  disposal_type?: string | null;
  items_description?: string | null;
  // Lagerung fields
  storage_duration?: string | null;
  storage_volume?: string | null;
  access_frequency?: string | null;
  needs_climate_control?: boolean | null;
  storage_items_description?: string | null;
  // Klaviertransport fields
  piano_type?: string | null;
  piano_brand?: string | null;
  piano_weight_kg?: number | null;
  staircase_type?: string | null;
  staircase_width_cm?: number | null;
  staircase_turns?: number | null;
  window_access_possible?: boolean | null;
  // Möbellift fields
  moebellift_floor?: number | null;
  moebellift_item_description?: string | null;
  moebellift_item_dimensions?: string | null;
  // Others
  special_items?: string[] | null;
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_floor?: number | null;
  pickup_has_lift?: boolean | null;
}

interface AnfrageOverviewProps {
  lead: Lead;
  compact?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getServiceIcon = (serviceType: string) => {
  const iconMap: Record<string, typeof Truck> = {
    umzug: Truck,
    reinigung: Sparkles,
    raeumung: Trash2,
    entsorgung: Trash2,
    lagerung: Warehouse,
    klaviertransport: Piano,
    moebellift: Building2,
    malerarbeit: PaintBucket,
  };
  return iconMap[serviceType.split("_")[0]] || Package;
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const _formatTimeSlot = (slot: string | null | undefined) => {
  const slots: Record<string, string> = {
    morning: "Morgens (08:00 - 12:00)",
    afternoon: "Nachmittags (12:00 - 17:00)",
    evening: "Abends (17:00 - 20:00)",
    flexible: "Flexibel",
  };
  return slot ? slots[slot] || slot : null;
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AnfrageOverview({ lead, compact: _compact = false }: AnfrageOverviewProps) {
  const ServiceIcon = getServiceIcon(lead.service_type);
  const isUmzug = lead.service_type?.includes("umzug");
  const isReinigung = lead.service_type?.includes("reinigung");
  const isRaeumung = lead.service_type?.includes("raeumung") || lead.service_type?.includes("entsorgung");
  const isLagerung = lead.service_type?.includes("lagerung");
  const isKlavier = lead.service_type?.includes("klavier");
  
  return (
    <div className="space-y-4">
      {/* Customer & Service Header */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-secondary" />
              Kundeninformationen
            </CardTitle>
            <Badge className="gap-1">
              <ServiceIcon className="w-3 h-3" />
              {getServiceLabel(lead.service_type)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium text-sm">
                {lead.customer_first_name} {lead.customer_last_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefon
              </p>
              <p className="font-medium text-sm">{lead.customer_phone}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-Mail
              </p>
              <p className="font-medium text-sm truncate">{lead.customer_email}</p>
            </div>
            {lead.preferred_date && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Wunschtermin
                </p>
                <p className="font-medium text-sm">{formatDate(lead.preferred_date)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Addresses - Umzug specific */}
      {isUmzug && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              Adressen
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              {/* From Address */}
              <div className="flex-1 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-red-700">
                    VON (Auszugsadresse)
                  </span>
                </div>
                <p className="font-medium text-sm">
                  {lead.from_street} {lead.from_house_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lead.from_plz} {lead.from_city}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lead.from_floor !== null && lead.from_floor !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      {lead.from_floor}. Stock
                    </Badge>
                  )}
                  {lead.from_has_lift !== null && (
                    <Badge 
                      variant={lead.from_has_lift ? "default" : "secondary"} 
                      className="text-xs gap-1"
                    >
                      {lead.from_has_lift ? (
                        <><CheckCircle2 className="w-3 h-3" /> Lift</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Kein Lift</>
                      )}
                    </Badge>
                  )}
                  {lead.from_rooms && (
                    <Badge variant="outline" className="text-xs">
                      {lead.from_rooms} Zimmer
                    </Badge>
                  )}
                  {lead.from_living_space_m2 && (
                    <Badge variant="outline" className="text-xs">
                      {lead.from_living_space_m2} m²
                    </Badge>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden sm:flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
              </div>

              {/* To Address */}
              <div className="flex-1 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-green-700">
                    NACH (Einzugsadresse)
                  </span>
                </div>
                <p className="font-medium text-sm">
                  {lead.to_street} {lead.to_house_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lead.to_plz} {lead.to_city}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lead.to_floor !== null && lead.to_floor !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      {lead.to_floor}. Stock
                    </Badge>
                  )}
                  {lead.to_has_lift !== null && (
                    <Badge 
                      variant={lead.to_has_lift ? "default" : "secondary"} 
                      className="text-xs gap-1"
                    >
                      {lead.to_has_lift ? (
                        <><CheckCircle2 className="w-3 h-3" /> Lift</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Kein Lift</>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Distance Info */}
            {lead.distance_km && (
              <div className="mt-3 p-2 bg-muted/50 rounded-lg flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Entfernung</span>
                <span className="font-medium text-sm">{lead.distance_km} km</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Property Address - Non-Umzug services */}
      {!isUmzug && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              Adresse
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium text-sm">
                {lead.from_street} {lead.from_house_number}
              </p>
              <p className="text-sm text-muted-foreground">
                {lead.from_plz} {lead.from_city}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {lead.from_floor !== null && lead.from_floor !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    {lead.from_floor}. Stock
                  </Badge>
                )}
                {lead.from_rooms && (
                  <Badge variant="outline" className="text-xs">
                    {lead.from_rooms} Zimmer
                  </Badge>
                )}
                {lead.from_living_space_m2 && (
                  <Badge variant="outline" className="text-xs">
                    {lead.from_living_space_m2} m²
                  </Badge>
                )}
                {lead.property_type && (
                  <Badge variant="secondary" className="text-xs">
                    {lead.property_type}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reinigung specific details */}
      {isReinigung && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Reinigungsdetails
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {lead.bathroom_count && (
                <div className="p-2 bg-muted/50 rounded-lg text-center">
                  <p className="text-lg font-bold">{lead.bathroom_count}</p>
                  <p className="text-xs text-muted-foreground">Badezimmer</p>
                </div>
              )}
              {lead.kitchen_type && (
                <div className="p-2 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm font-medium">{lead.kitchen_type}</p>
                  <p className="text-xs text-muted-foreground">Küche</p>
                </div>
              )}
              <div className="col-span-2 flex flex-wrap gap-2">
                {lead.has_balcony && <Badge variant="outline" className="text-xs">Balkon</Badge>}
                {lead.has_garage && <Badge variant="outline" className="text-xs">Garage</Badge>}
                {lead.has_basement && <Badge variant="outline" className="text-xs">Keller</Badge>}
                {lead.has_attic && <Badge variant="outline" className="text-xs">Dachboden</Badge>}
                {lead.cleaning_windows && <Badge className="text-xs">Fensterreinigung</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Räumung/Entsorgung specific details */}
      {isRaeumung && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-orange-500" />
              Räumungsdetails
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              {lead.clearing_type && (
                <div>
                  <p className="text-xs text-muted-foreground">Räumungsart</p>
                  <p className="font-medium text-sm">{lead.clearing_type}</p>
                </div>
              )}
              {lead.estimated_volume && (
                <div>
                  <p className="text-xs text-muted-foreground">Geschätztes Volumen</p>
                  <p className="font-medium text-sm">{lead.estimated_volume}</p>
                </div>
              )}
              {lead.has_heavy_items && (
                <div className="col-span-2">
                  <Badge variant="destructive" className="text-xs">Schwere Gegenstände</Badge>
                  {lead.heavy_items_description && (
                    <p className="text-sm mt-1">{lead.heavy_items_description}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lagerung specific details */}
      {isLagerung && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-purple-500" />
              Lagerungsdetails
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              {lead.storage_duration && (
                <div>
                  <p className="text-xs text-muted-foreground">Dauer</p>
                  <p className="font-medium text-sm">{lead.storage_duration}</p>
                </div>
              )}
              {lead.storage_volume && (
                <div>
                  <p className="text-xs text-muted-foreground">Volumen</p>
                  <p className="font-medium text-sm">{lead.storage_volume}</p>
                </div>
              )}
              {lead.access_frequency && (
                <div>
                  <p className="text-xs text-muted-foreground">Zugang</p>
                  <p className="font-medium text-sm">{lead.access_frequency}</p>
                </div>
              )}
              {lead.needs_climate_control && (
                <Badge className="text-xs w-fit">Klimatisiert</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Klaviertransport specific details */}
      {isKlavier && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Piano className="w-4 h-4 text-amber-500" />
              Klavierdetails
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lead.piano_type && (
                <div>
                  <p className="text-xs text-muted-foreground">Typ</p>
                  <p className="font-medium text-sm">{lead.piano_type}</p>
                </div>
              )}
              {lead.piano_brand && (
                <div>
                  <p className="text-xs text-muted-foreground">Marke</p>
                  <p className="font-medium text-sm">{lead.piano_brand}</p>
                </div>
              )}
              {lead.piano_weight_kg && (
                <div>
                  <p className="text-xs text-muted-foreground">Gewicht</p>
                  <p className="font-medium text-sm">{lead.piano_weight_kg} kg</p>
                </div>
              )}
              {lead.staircase_type && (
                <div>
                  <p className="text-xs text-muted-foreground">Treppenhaus</p>
                  <p className="font-medium text-sm">{lead.staircase_type}</p>
                </div>
              )}
              {lead.window_access_possible && (
                <Badge variant="secondary" className="text-xs w-fit">Fensterzugang möglich</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requested Additional Services */}
      {(lead.packing_service_needed || lead.cleaning_service_needed || lead.storage_needed || lead.piano_transport_needed) && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-secondary" />
              Gewünschte Zusatzleistungen
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {lead.packing_service_needed && (
                <Badge className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verpackungsservice
                </Badge>
              )}
              {lead.cleaning_service_needed && (
                <Badge className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Reinigung
                </Badge>
              )}
              {lead.storage_needed && (
                <Badge className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Lagerung
                </Badge>
              )}
              {lead.piano_transport_needed && (
                <Badge className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Klaviertransport
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Special Items */}
      {lead.special_items && lead.special_items.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-500" />
              Besondere Gegenstände
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {lead.special_items.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Description/Notes */}
      {lead.description && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              Kundenhinweise
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
              {lead.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AnfrageOverview;

