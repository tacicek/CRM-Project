import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { OfferItem } from "./OfferteItemRow";
import { getAddressLabels, getAppointmentLabel, getLetterSalutation, getServiceLabel } from "@/i18n/domain";
import { itemAmountDisplay } from "@/lib/offerPricing";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import { formatCurrency as formatCurrencyI18n, formatDate as formatDateI18n, formatNumber, formatPercent } from "@/i18n/format";

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
  /**
   * Sprache des DOKUMENTS (offers.language / lead.language) — NICHT die des Dashboards.
   *
   * Dieses Panel zeigt, was der KUNDE bekommt. Zeichnete es sich in der Sprache des
   * Operators, sähe eine französische Firma einen französischen Rahmen um deutsche Daten
   * (Titel, Einheiten, Zahlungskondition) — und hielte die Offerte für französisch,
   * obwohl der Kunde eine deutsche erhält. Genau dieser Fehler ist aufgetreten.
   */
  documentLocale: Locale;
  company: Company | null;
  lead: Lead;
  title: string;
  items: OfferItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  /** Obergrenzen der Blind-/Stunden-Spanne (nur fixed+range). null = keine Spanne. */
  maxSubtotal?: number | null;
  maxVat?: number | null;
  maxTotal?: number | null;
  /** rate-Posten vorhanden → Aggregat-Box ausblenden, RATE_AGGREGATE_NOTE zeigen. */
  hasRateItem?: boolean;
  /** Computed surcharge amounts, rendered between Zwischensumme and MwSt. */
  surcharges?: { label: string; amount: number }[];
  /** Preismodell — mirrors the PDF/OfferView so the preview stays WYSIWYG. */
  priceModel?: 'pauschal' | 'stundenansatz' | 'kostendach';
  hourlyRate?: number | null;
  kostendachMax?: number | null;
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
  maxSubtotal = null,
  maxVat = null,
  maxTotal = null,
  hasRateItem = false,
  surcharges,
  priceModel = 'pauschal',
  hourlyRate = null,
  kostendachMax = null,
  serviceDate,
  validUntil,
  paymentTerms,
  termsAndConditions,
  offerNumber,
  offerDetails,
  documentLocale,
}: OfferteLivePreviewProps) => {
  // WYSIWYG-Vorschau des KUNDEN-Dokuments → Dokumentsprache, exakt wie das PDF.
  // Kein useT() hier: das wäre die Sprache des Operators und würde ihm eine Offerte in
  // seiner eigenen Sprache zeigen, die der Kunde nie zu sehen bekommt.
  const { t, locale, dateLocale } = documentI18nFor(documentLocale);

  const formatCurrency = (amount: number) => formatCurrencyI18n(amount, locale);

  const formatDate = (dateString: string) => (dateString ? formatDateI18n(dateString, locale) : "-");

  const formatDateWithDay = (dateString: string) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "PPPP", { locale: dateLocale });
  };

  const formatTime = (time: string) => (time ? t("doc.time.oclock", { time }) : "");

  // Determine service type display
  const serviceTypeLabel = getServiceLabel(lead.service_type, locale);
  const hasSecondaryService = offerDetails?.secondaryServiceType && offerDetails?.secondaryServiceDate;
  const secondaryServiceLabel = hasSecondaryService ? getServiceLabel(offerDetails.secondaryServiceType!, locale) : "";

  // Build title based on services
  const displayTitle = title || (hasSecondaryService
    ? `${t("doc.offer.titleFor", { service: serviceTypeLabel })} / ${secondaryServiceLabel}`
    : t("doc.offer.titleFor", { service: serviceTypeLabel }));

  // Check if we need address display (for moving and some transport services)
  const needsAddressDisplay = ["umzug", "umzug_privat", "umzug_firma", "klaviertransport", "usm_transport", "wasserbett_transport"].some(
    (s) => lead.service_type?.toLowerCase().includes(s.toLowerCase())
  );
  const addressLabels = getAddressLabels(lead.service_type, locale);

  // Customer salutation (raw stored value, printed as-is in the header block below)
  const salutation = offerDetails?.customerSalutation || "";

  // Floor and lift info
  const fromFloor = offerDetails?.serviceDetails?.floors?.from ?? lead.from_floor;
  const toFloor = offerDetails?.serviceDetails?.floors?.to ?? lead.to_floor;
  const fromHasLift = offerDetails?.serviceDetails?.lifts?.from ?? lead.from_has_lift;
  const toHasLift = offerDetails?.serviceDetails?.lifts?.to ?? lead.to_has_lift;

  // Property info
  const propertyType = offerDetails?.serviceDetails?.propertyType ||
    (lead.from_rooms ? t("offer.preview.propertyRooms", { rooms: lead.from_rooms }) : "");
  const livingSpace = offerDetails?.serviceDetails?.livingSpaceM2 ?? lead.from_living_space_m2;

  return (
    <div className="bg-white p-4 text-[9px] leading-relaxed border rounded-lg shadow-sm max-h-[600px] overflow-y-auto">
      {/* Header with Reference Info */}
      <div className="border-b-2 border-foreground pb-2 mb-3">
        <div className="flex justify-between items-start">
          {/* Left - Company Info */}
          <div className="space-y-0.5">
            <p className="font-bold text-[8px] text-muted-foreground">{t("offer.details.field.reference")}:</p>
            <p className="text-[9px]">{offerDetails?.companyReference || company?.company_name}</p>
            <p className="font-bold text-[8px] text-muted-foreground mt-1">{t("offer.preview.yourReference")}:</p>
            <p className="text-[9px]">{lead.customer_phone}</p>
            <p className="text-[9px]">{lead.customer_email}</p>
            {company?.mwst_number && (
              <p className="text-[9px] mt-2">
                {t("offer.form.company.vat", { number: company.mwst_number })}
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
                <p className="font-bold text-[10px]">{t("doc.offer.numbered", { number: offerNumber })}</p>
              )}
              <p className="text-[9px]">{formatDateWithDay(new Date().toISOString().split("T")[0])}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="font-bold text-[14px] mb-2">{displayTitle}</h2>

      {/* Greeting */}
      <p className="text-[9px] mb-1">{getLetterSalutation(offerDetails?.customerSalutation, lead.customer_last_name, locale)}</p>
      <p className="text-[9px] mb-3 text-muted-foreground">
        {t("doc.offer.intro")}
      </p>

      {/* Address Display - for Moving Services */}
      {needsAddressDisplay && lead.to_city && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="font-bold text-[10px] border-b pb-1 mb-1">{addressLabels.primary}</p>
            <p className="text-[9px]">
              {fromFloor !== null && fromFloor !== undefined ? t("offer.leadDetail.floor.nth", { floor: fromFloor }) : ""}
              {fromFloor !== null && fromFloor !== undefined ? ` (${fromHasLift ? t("offer.leadDetail.floor.withLift") : t("offer.leadDetail.floor.withoutLift")})` : ""}
            </p>
            <p className="text-[9px]">{lead.from_street} {lead.from_house_number}</p>
            <p className="text-[9px]">{lead.from_plz} {lead.from_city}</p>
          </div>
          <div>
            <p className="font-bold text-[10px] border-b pb-1 mb-1">{addressLabels.secondary}</p>
            <p className="text-[9px]">
              {toFloor !== null && toFloor !== undefined ? t("offer.leadDetail.floor.nth", { floor: toFloor }) : ""}
              {toFloor !== null && toFloor !== undefined ? ` (${toHasLift ? t("offer.leadDetail.floor.withLift") : t("offer.leadDetail.floor.withoutLift")})` : ""}
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
            <span className="font-bold w-28 text-[9px]">{getAppointmentLabel(lead.service_type, locale)}:</span>
            <span className="text-[9px]">{formatDateWithDay(serviceDate)}</span>
          </div>
        )}

        {offerDetails?.serviceStartTime && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{t("offer.preview.arrivalTime")}:</span>
            <span className="text-[9px]">{formatTime(offerDetails.serviceStartTime)}</span>
          </div>
        )}

        {/* Property Info */}
        {(propertyType || livingSpace) && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{t("offer.create.overview.object")}:</span>
            <span className="text-[9px]">
              {propertyType}{livingSpace ? ` ${livingSpace} m²` : ""}
            </span>
          </div>
        )}

        {/* Resources - Vehicles & Personnel */}
        {offerDetails?.resources?.vehicles && offerDetails.resources.vehicles.length > 0 && (
          <div className="flex">
            <span className="font-bold w-28 text-[9px]">{t("offer.preview.rateLabel")}:</span>
            <span className="text-[9px]">
              {offerDetails.resources.vehicles.map((v, i) => (
                <span key={i}>
                  {v.count > 1 ? `${v.count}x ` : ""}{v.type}
                  {i < offerDetails.resources!.vehicles!.length - 1 ? ", " : ""}
                </span>
              ))}
              {offerDetails.resources.personnel && offerDetails.resources.personnel.count > 0 && (
                <span> {t("offer.preview.withCrew", { count: offerDetails.resources.personnel.count })}</span>
              )}
              <span> {t("offer.preview.vatIncluded", { rate: formatPercent(vatRate, locale) })}</span>
            </span>
          </div>
        )}

        {/* Highlighted Items */}
        {offerDetails?.highlightedItems && offerDetails.highlightedItems.length > 0 && (
          <div className="space-y-0.5 mt-1">
            {offerDetails.highlightedItems.map((item, index) => (
              <div key={index} className="bg-yellow-100 px-1.5 py-0.5 text-[8px] font-medium">
                {item.startsWith("inkl.") ? item : `${t("offer.preview.inclPrefix")} ${item}`}
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
              <span className="text-[9px]">{t("offer.preview.dateToBeAnnounced")}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28 text-[9px]">{t("offer.preview.handoverLabel", { service: secondaryServiceLabel })}:</span>
              <span className="text-[9px]">{formatDateWithDay(offerDetails.secondaryServiceDate!)}</span>
            </div>
          </>
        )}
      </div>

      {/* Items Table */}
      <div className="border rounded overflow-hidden mb-3">
        <div className="bg-secondary text-secondary-foreground p-1.5 text-[8px] font-bold grid grid-cols-12 gap-1">
          <div className="col-span-1">{t("offer.detail.column.position")}</div>
          <div className="col-span-7">{t("common.description")}</div>
          <div className="col-span-2 text-right">{t("offer.detail.column.quantity")}</div>
          <div className="col-span-2 text-right">{t("offer.detail.column.price")}</div>
        </div>
        {items.map((item) => {
          // SINGLE SOURCE: Betragsdarstellung ueber itemAmountDisplay (kein amount_basis im
          // Formular-Item → Legacy-Ableitung; sobald 3d das Feld ergaenzt, wirkt rate automatisch).
          const te = item.timeEstimate;
          const display = itemAmountDisplay({
            priceType: item.priceType,
            amountBasis: item.amountBasis ?? null,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            unit: item.unit,
            timeEstimate:
              te && te.minHours && te.hourlyRate
                ? { minHours: Number(te.minHours), maxHours: Number(te.maxHours), hourlyRate: Number(te.hourlyRate) }
                : null,
          });
          return (
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
              {display.kind === "free" || display.kind === "rate" ? "-" : `${item.quantity} ${item.unit}`}
            </div>
            <div className="col-span-2 text-right font-medium">
              {display.kind === "free"
                ? item.priceType === "inkl" ? t("doc.offer.includedShort") : t("common.optional")
                : display.kind === "range"
                ? `${formatCurrency(display.min)}–${formatCurrency(display.max)}`
                : display.kind === "rate"
                ? `${formatCurrency(display.unitPrice)}/${display.unit}`
                : formatCurrency(display.amount)}
            </div>
          </div>
          );
        })}
      </div>

      {/* Totals — bei rate-Posten keine Aggregat-Box, nur Hinweis */}
      {hasRateItem ? (
        <div className="mb-3 text-[8px] text-muted-foreground leading-tight">
          {t("doc.offer.rateAggregateNote")}
        </div>
      ) : (
        <div className="flex justify-end mb-3">
          <div className="w-36 space-y-0.5 text-[8px]">
            <div className="flex justify-between">
              <span>{t("doc.offer.subtotal")}:</span>
              <span>{maxSubtotal !== null ? `${formatCurrency(subtotal)}–${formatCurrency(maxSubtotal)}` : formatCurrency(subtotal)}</span>
            </div>
            {surcharges?.map((s, i) => (
              <div key={i} className="flex justify-between">
                <span>{s.label || t("doc.offer.surcharge")}:</span>
                <span>{formatCurrency(s.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>{t("offer.detail.vatRow", { rate: formatPercent(vatRate, locale) })}:</span>
              <span>{maxVat !== null ? `${formatCurrency(vatAmount)}–${formatCurrency(maxVat)}` : formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-[10px] border-t pt-1">
              <span>{t("doc.offer.glance.total")}:</span>
              <span>{maxTotal !== null ? `${formatCurrency(total)}–${formatCurrency(maxTotal)}` : formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Preismodell — mirrors ServiceTable/OfferView so the preview matches the sent offer */}
      {priceModel === "stundenansatz" && hourlyRate !== null && (
        <div className="mb-3 rounded border border-sky-300 bg-sky-50 p-2 text-[8px]">
          <p className="font-bold text-sky-700">
            {t("doc.offer.priceModel")} {t("doc.offer.hourlyRate", { rate: formatNumber(Number(hourlyRate), locale) })}
          </p>
          <p className="text-muted-foreground">
            {t("doc.offer.hourlyRateNote")}
          </p>
        </div>
      )}
      {priceModel === "kostendach" && hourlyRate !== null && kostendachMax !== null && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-[8px]">
          <p className="font-bold text-amber-800">
            {t("doc.offer.priceModel")} {t("doc.offer.hourlyWithCap", { rate: formatNumber(Number(hourlyRate), locale), cap: formatNumber(Number(kostendachMax), locale) })}
          </p>
          <p className="text-amber-800">
            {t("doc.offer.costCapNote", { cap: formatNumber(Number(kostendachMax), locale) })}
          </p>
        </div>
      )}

      {/* Payment Terms */}
      <div className="p-2 bg-muted/50 rounded text-[8px] mb-3">
        <p className="font-bold">{t("doc.offer.paymentTerms")}</p>
        <p>{paymentTerms}</p>
      </div>

      {/* Valid Until — only shown when explicitly set */}
      {validUntil && (
        <p className="text-[8px] text-muted-foreground text-center mb-3">
          {t("doc.offer.offerValidUntil", { date: formatDate(validUntil) })}
        </p>
      )}

      {/* Page 2 Preview - Terms and Conditions */}
      {termsAndConditions && (
        <>
          <div className="border-t-2 border-dashed border-muted-foreground/30 my-3 pt-3">
            <p className="text-[7px] text-muted-foreground text-center mb-2">
              {t("offer.preview.page2Marker")}
            </p>
          </div>
          <div className="p-2 bg-muted/30 rounded text-[8px]">
            <p className="font-bold text-[10px] mb-2">{t("offer.form.agb.title")}</p>
            <p className="text-muted-foreground whitespace-pre-line line-clamp-6">
              {termsAndConditions}
            </p>
            {termsAndConditions.length > 300 && (
              <p className="text-[7px] text-muted-foreground italic mt-1">
                {t("offer.preview.fullTextInPdf")}
              </p>
            )}
          </div>
        </>
      )}

      {/* Page 3 Preview - Acceptance */}
      <div className="border-t-2 border-dashed border-muted-foreground/30 my-3 pt-3">
        <p className="text-[7px] text-muted-foreground text-center mb-2">
          {t("offer.preview.page3Marker")}
        </p>
      </div>
      <div className="p-2 bg-muted/30 rounded text-[8px] space-y-2">
        <p className="font-bold text-[10px] text-center">{t("doc.offer.confirm.title")}</p>
        <p className="text-muted-foreground text-[7px]">
          {t("offer.preview.confirmGrant", { company: company?.company_name || "..." })}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="space-y-1">
            <p className="text-[7px] text-muted-foreground">{t("doc.offer.confirm.placeDate")}:</p>
            <div className="border-b border-foreground/50 h-4"></div>
            <p className="text-[6px] text-muted-foreground">{t("offer.preview.signatureCustomer")}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[7px] text-muted-foreground">{t("doc.offer.confirm.placeDate")}:</p>
            <div className="border-b border-foreground/50 h-4"></div>
            <p className="text-[6px] text-muted-foreground">{t("offer.preview.signatureContractor")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
