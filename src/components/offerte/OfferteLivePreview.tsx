import { cn } from "@/lib/utils";
import type { OfferItem } from "./OfferteItemRow";
import { getServiceLabel } from "@/lib/serviceLabels";

interface Company {
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email: string;
  website?: string | null;
  mwst_number?: string | null;
  logo_url?: string | null;
}

interface Lead {
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
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
}

interface OfferDetails {
  companyReference?: string;
  customerSalutation?: string;
  serviceStartTime?: string;
  serviceEndTime?: string;
  secondaryServiceDate?: string;
  secondaryServiceType?: string;
  serviceDetails?: {
    propertyType?: string;
    livingSpaceM2?: number | null;
    volumeM3?: number | null;
    distanceKm?: number | null;
    floors?: { from: number | null; to: number | null };
    lifts?: { from: boolean; to: boolean };
    [key: string]: unknown;
  };
  resources?: {
    vehicles?: Array<{ type: string; sizeM3: number; count: number }>;
    personnel?: { count: number; description: string };
    equipment?: string[];
  };
  highlightedItems?: string[];
  paymentMethod?: string;
}

interface OfferteLivePreviewProps {
  company: Company | null;
  lead: Lead;
  title: string;
  items: OfferItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  serviceDate: string;
  validUntil: string;
  paymentTerms: string;
  termsAndConditions?: string;
  offerNumber?: number;
  offerDetails?: OfferDetails;
}

export const OfferteLivePreview = ({
  company,
  lead,
  title,
  items,
  subtotal,
  vatRate,
  vatAmount,
  total,
  serviceDate,
  validUntil,
  paymentTerms,
  termsAndConditions,
  offerNumber,
  offerDetails,
}: OfferteLivePreviewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateWithDay = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const dayName = date.toLocaleDateString("de-CH", { weekday: "long" });
    const formattedDate = date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return `${dayName}, ${formattedDate}`;
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    return `${time} Uhr`;
  };

  // Determine service type display
  const serviceTypeLabel = getServiceLabel(lead.service_type);
  const hasSecondaryService = offerDetails?.secondaryServiceType && offerDetails?.secondaryServiceDate;
  const secondaryServiceLabel = hasSecondaryService ? getServiceLabel(offerDetails.secondaryServiceType!) : "";

  // Build title based on services
  const displayTitle = title || (hasSecondaryService 
    ? `${serviceTypeLabel}s- und ${secondaryServiceLabel}sofferte`
    : `${serviceTypeLabel}sofferte`);

  // Check if we need address display (for moving and some transport services)
  const needsAddressDisplay = ["umzug", "umzug_privat", "umzug_firma", "klaviertransport", "usm_transport", "wasserbett_transport"].some(
    (s) => lead.service_type?.toLowerCase().includes(s.toLowerCase())
  );

  // Customer salutation
  const salutation = offerDetails?.customerSalutation || "";
  const customerName = `${salutation ? salutation + " " : ""}${lead.customer_first_name} ${lead.customer_last_name}`;

  // Floor and lift info
  const fromFloor = offerDetails?.serviceDetails?.floors?.from ?? lead.from_floor;
  const toFloor = offerDetails?.serviceDetails?.floors?.to ?? lead.to_floor;
  const fromHasLift = offerDetails?.serviceDetails?.lifts?.from ?? lead.from_has_lift;
  const toHasLift = offerDetails?.serviceDetails?.lifts?.to ?? lead.to_has_lift;

  // Property info
  const propertyType = offerDetails?.serviceDetails?.propertyType || 
    (lead.from_rooms ? `${lead.from_rooms}-Zimmer-Wohnung` : "");
  const livingSpace = offerDetails?.serviceDetails?.livingSpaceM2 ?? lead.from_living_space_m2;

  return (
    <div className="bg-white p-4 text-[9px] leading-relaxed border rounded-lg shadow-sm max-h-[600px] overflow-y-auto">
      {/* Header with Reference Info */}
      <div className="border-b-2 border-foreground pb-2 mb-3">
        <div className="flex justify-between items-start">
          {/* Left - Company Info */}
          <div className="space-y-0.5">
            <p className="font-bold text-[8px] text-muted-foreground">Unsere Referenz:</p>
            <p className="text-[9px]">{offerDetails?.companyReference || company?.company_name}</p>
            <p className="font-bold text-[8px] text-muted-foreground mt-1">Ihre Referenz:</p>
            <p className="text-[9px]">{lead.customer_phone}</p>
            <p className="text-[9px]">{lead.customer_email}</p>
            {company?.mwst_number && (
              <p className="text-[9px] mt-2">
                <span className="font-bold">Mwst:</span> {company.mwst_number}
              </p>
            )}
          </div>

          {/* Right - Customer & Offer Info */}
          <div className="text-right">
            <p className="text-[9px]">{salutation}</p>
            <p className="font-medium text-[10px]">{lead.customer_first_name} {lead.customer_last_name}</p>
            <p className="text-[9px]">{lead.from_street} {lead.from_house_number}</p>
            <p className="text-[9px]">{lead.from_plz} {lead.from_city}</p>
            
            <div className="mt-3 text-left">
              {offerNumber && (
                <p className="font-bold text-[10px]">Offerte Nr. #{offerNumber}</p>
              )}
              <p className="text-[9px]">{formatDateWithDay(new Date().toISOString().split("T")[0])}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="font-bold text-[14px] mb-2">{displayTitle}</h2>
      
      {/* Greeting */}
      <p className="text-[9px] mb-1">Sehr geehrte{salutation === "Herr" ? "r" : ""} {customerName}</p>
      <p className="text-[9px] mb-3 text-muted-foreground">
        Vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen heute die folgende Offerte unterbreiten zu dürfen
      </p>

      {/* Address Display - for Moving Services */}
      {needsAddressDisplay && lead.to_city && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="font-bold text-[10px] border-b pb-1 mb-1">Auszugsadresse</p>
            <p className="text-[9px]">
              {fromFloor !== null && fromFloor !== undefined ? `${fromFloor}. Stock` : ""} 
              {fromFloor !== null && fromFloor !== undefined ? ` ${fromHasLift ? "(mit Lift)" : "(ohne Lift)"}` : ""}
            </p>
            <p className="text-[9px]">{lead.from_street} {lead.from_house_number}</p>
            <p className="text-[9px]">{lead.from_plz} {lead.from_city}</p>
          </div>
          <div>
            <p className="font-bold text-[10px] border-b pb-1 mb-1">Einzugsadresse</p>
            <p className="text-[9px]">
              {toFloor !== null && toFloor !== undefined ? `${toFloor}. Stock` : ""} 
              {toFloor !== null && toFloor !== undefined ? ` ${toHasLift ? "(mit Lift)" : "(ohne Lift)"}` : ""}
            </p>
            <p className="text-[9px]">{lead.to_street} {lead.to_house_number}</p>
            <p className="text-[9px]">{lead.to_plz} {lead.to_city}</p>
          </div>
        </div>
      )}

      {/* Service Details Table */}
      <div className="border-t border-b py-2 mb-3 space-y-1.5">
        {/* Service Date & Time */}
        {serviceDate && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{serviceTypeLabel}stermin:</span>
            <span className="text-[9px]">{formatDateWithDay(serviceDate)}</span>
          </div>
        )}
        
        {offerDetails?.serviceStartTime && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">Beginn bei Kunde:</span>
            <span className="text-[9px]">{formatTime(offerDetails.serviceStartTime)}</span>
          </div>
        )}

        {/* Property Info */}
        {(propertyType || livingSpace) && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{serviceTypeLabel}sgut:</span>
            <span className="text-[9px]">
              {propertyType}{livingSpace ? ` ${livingSpace} m²` : ""}
            </span>
          </div>
        )}

        {/* Resources - Vehicles & Personnel */}
        {offerDetails?.resources?.vehicles && offerDetails.resources.vehicles.length > 0 && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{serviceTypeLabel}starif:</span>
            <span className="text-[9px]">
              {offerDetails.resources.vehicles.map((v, i) => (
                <span key={i}>
                  {v.count > 1 ? `${v.count}x ` : ""}{v.type}
                  {i < offerDetails.resources!.vehicles!.length - 1 ? ", " : ""}
                </span>
              ))}
              {offerDetails.resources.personnel && offerDetails.resources.personnel.count > 0 && (
                <span> mit {offerDetails.resources.personnel.count} Mitarbeiter</span>
              )}
              <span> Inkl. {vatRate}% Mwst</span>
            </span>
          </div>
        )}

        {/* Highlighted Items */}
        {offerDetails?.highlightedItems && offerDetails.highlightedItems.length > 0 && (
          <div className="space-y-0.5 mt-1">
            {offerDetails.highlightedItems.map((item, index) => (
              <div key={index} className="bg-yellow-100 px-1.5 py-0.5 text-[8px] font-medium">
                {item.startsWith("inkl.") ? item : `inkl. ${item}`}
              </div>
            ))}
          </div>
        )}

        {/* Secondary Service Date */}
        {hasSecondaryService && (
          <>
            <div className="border-t my-2" />
            <div className="flex">
              <span className="font-bold w-28 text-[9px]">{secondaryServiceLabel}:</span>
              <span className="text-[9px]">Bitte Datum mitteilen</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28 text-[9px]">{secondaryServiceLabel} Abgabe:</span>
              <span className="text-[9px]">{formatDateWithDay(offerDetails.secondaryServiceDate!)}</span>
            </div>
          </>
        )}
      </div>

      {/* Items Table */}
      <div className="border rounded overflow-hidden mb-3">
        <div className="bg-secondary text-secondary-foreground p-1.5 text-[8px] font-bold grid grid-cols-12 gap-1">
          <div className="col-span-1">Pos.</div>
          <div className="col-span-7">Beschreibung</div>
          <div className="col-span-2 text-right">Menge</div>
          <div className="col-span-2 text-right">Preis</div>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "p-1.5 grid grid-cols-12 gap-1 border-t text-[8px]",
              item.highlighted && "bg-yellow-100"
            )}
          >
            <div className="col-span-1">{item.position}</div>
            <div className="col-span-7">
              <p className="font-medium">{item.description || "-"}</p>
              {item.details.filter(Boolean).map((detail, i) => (
                <p key={i} className="text-muted-foreground italic text-[7px]">
                  • {detail}
                </p>
              ))}
            </div>
            <div className="col-span-2 text-right">
              {item.priceType !== "inkl" ? `${item.quantity} ${item.unit}` : "-"}
            </div>
            <div className="col-span-2 text-right font-medium">
              {item.priceType === "inkl"
                ? "Inkl."
                : item.priceType === "optional"
                ? "Optional"
                : formatCurrency(item.quantity * item.unit_price)}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-3">
        <div className="w-36 space-y-0.5 text-[8px]">
          <div className="flex justify-between">
            <span>Zwischensumme:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>MwSt. ({vatRate}%):</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-[10px] border-t pt-1">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Terms */}
      <div className="p-2 bg-muted/50 rounded text-[8px] mb-3">
        <p className="font-bold">Zahlungskondition:</p>
        <p>{paymentTerms}</p>
      </div>

      {/* Valid Until — only shown when explicitly set */}
      {validUntil && (
        <p className="text-[8px] text-muted-foreground text-center mb-3">
          Diese Offerte ist gültig bis {formatDate(validUntil)}
        </p>
      )}

      {/* Page 2 Preview - Terms and Conditions */}
      {termsAndConditions && (
        <>
          <div className="border-t-2 border-dashed border-muted-foreground/30 my-3 pt-3">
            <p className="text-[7px] text-muted-foreground text-center mb-2">
              — Seite 2: Geschäftsbedingungen —
            </p>
          </div>
          <div className="p-2 bg-muted/30 rounded text-[8px]">
            <p className="font-bold text-[10px] mb-2">Allgemeine Geschäftsbedingungen</p>
            <p className="text-muted-foreground whitespace-pre-line line-clamp-6">
              {termsAndConditions}
            </p>
            {termsAndConditions.length > 300 && (
              <p className="text-[7px] text-muted-foreground italic mt-1">
                ... (vollständiger Text im PDF)
              </p>
            )}
          </div>
        </>
      )}

      {/* Page 3 Preview - Acceptance */}
      <div className="border-t-2 border-dashed border-muted-foreground/30 my-3 pt-3">
        <p className="text-[7px] text-muted-foreground text-center mb-2">
          — Seite 3: Auftragsbestätigung —
        </p>
      </div>
      <div className="p-2 bg-muted/30 rounded text-[8px] space-y-2">
        <p className="font-bold text-[10px] text-center">Auftragsbestätigung</p>
        <p className="text-muted-foreground text-[7px]">
          Hiermit erteile ich der Firma {company?.company_name || "..."} den in dieser Offerte beschriebenen Auftrag.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="space-y-1">
            <p className="text-[7px] text-muted-foreground">Ort, Datum:</p>
            <div className="border-b border-foreground/50 h-4"></div>
            <p className="text-[6px] text-muted-foreground">Unterschrift Auftraggeber</p>
          </div>
          <div className="space-y-1">
            <p className="text-[7px] text-muted-foreground">Ort, Datum:</p>
            <div className="border-b border-foreground/50 h-4"></div>
            <p className="text-[6px] text-muted-foreground">Unterschrift Auftragnehmer</p>
          </div>
        </div>
      </div>
    </div>
  );
};
