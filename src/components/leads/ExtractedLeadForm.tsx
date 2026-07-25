import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  MapPin,
  Calendar,
  Package,
  Home,
  Trash2,
  Piano,
  Warehouse,
  Languages,
} from "lucide-react";
import { LOCALES, LOCALE_NAMES } from "@/i18n/locale";
import { useI18n, useT } from "@/i18n/useI18n";
import { getAddressLabels } from "@/i18n/domain";
import type { ExtractedData } from "@/types/extractedLead";

export interface ExtractedLeadFormProps {
  data: ExtractedData;
  onChange: (field: keyof ExtractedData, value: string | number | boolean | null) => void;
}

/**
 * Editable form for AI-extracted lead data.
 *
 * Lifted out of ManualImport so the inbound-email review queue edits the very
 * same fields with the very same widgets. The brief for the inbound feature is
 * explicit about it — "do not build a second lead form" — and a second one would
 * drift from this within a release anyway.
 *
 * Presentation only: no fetching, no saving. The page that renders it owns the
 * state and the actions, because "save" means something different in an import
 * (create lead) than in a review (approve a mail).
 *
 * The language <Select> is the CUSTOMER's document locale, not the operator's
 * dashboard language — see src/i18n/README.md. The surrounding labels go through
 * useT() (dashboard axis); the option list deliberately does not.
 */
export const ExtractedLeadForm = ({
  data: extractedData,
  onChange: updateExtractedData,
}: ExtractedLeadFormProps) => {
  const t = useT();
  const { locale } = useI18n();

  const renderServiceFields = () => {
    if (!extractedData) return null;

    const serviceType = extractedData.detected_service_type;

    switch (serviceType) {
      case "umzug_privat":
      case "umzug_firma":
        return renderUmzugFields();
      case "reinigung":
        return renderReinigungFields();
      case "raeumung":
        return renderRaeumungFields();
      case "entsorgung":
        return renderEntsorgungFields();
      case "lagerung":
        return renderLagerungFields();
      case "klaviertransport":
        return renderKlaviertransportFields();
      case "moebellift":
        return renderMoebelliftFields();
      default:
        return renderUmzugFields(); // Default fallback
    }
  };

  const renderUmzugFields = () => (
    <>
      {/* From Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("umzug", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.hasEstrich")}</Label>
            <Select
              value={extractedData?.from_has_estrich === true ? "yes" : extractedData?.from_has_estrich === false ? "no" : "unknown"}
              onValueChange={(v) => updateExtractedData("from_has_estrich", v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t("common.unknown")}</SelectItem>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.hasKellerGarage")}</Label>
            <Select
              value={extractedData?.from_has_keller === true ? "yes" : extractedData?.from_has_keller === false ? "no" : "unknown"}
              onValueChange={(v) => updateExtractedData("from_has_keller", v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t("common.unknown")}</SelectItem>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.from_rooms ?? ""}
              onChange={(e) => updateExtractedData("from_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.livingSpace")}</Label>
            <Input
              type="number"
              value={extractedData?.from_living_space_m2 ?? ""}
              onChange={(e) => updateExtractedData("from_living_space_m2", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* To Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("umzug", locale).secondary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Services */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.extras")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "packing_service_needed", label: t("lead.extra.packing") },
            { key: "furniture_assembly_needed", label: t("lead.extra.furnitureAssembly") },
            { key: "cleaning_service_needed", label: t("lead.extra.cleaning") },
            { key: "storage_needed", label: t("lead.extra.storage") },
            { key: "piano_transport_needed", label: t("lead.extra.piano") },
          ].map((service) => (
            <div key={service.key} className="flex items-center space-x-2">
              <Checkbox
                id={service.key}
                checked={!!extractedData?.[service.key as keyof ExtractedData]}
                onCheckedChange={(checked) =>
                  updateExtractedData(service.key as keyof ExtractedData, !!checked)
                }
              />
              <label htmlFor={service.key} className="text-sm cursor-pointer">
                {service.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderReinigungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("reinigung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Property Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Home className="w-4 h-4" />
          {t("lead.section.propertyDetails")}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{t("lead.field.propertyType")}</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">{t("lead.option.property.wohnung")}</SelectItem>
                <SelectItem value="Haus">{t("lead.option.property.haus")}</SelectItem>
                <SelectItem value="Studio">{t("lead.option.property.studio")}</SelectItem>
                <SelectItem value="Büro">{t("lead.option.property.buero")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.livingSpace")}</Label>
            <Input
              type="number"
              value={extractedData?.living_space_m2 ?? ""}
              onChange={(e) => updateExtractedData("living_space_m2", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.bathrooms")}</Label>
            <Input
              type="number"
              value={extractedData?.bathroom_count ?? ""}
              onChange={(e) => updateExtractedData("bathroom_count", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.kitchenType")}</Label>
            <Select
              value={extractedData?.kitchen_type || ""}
              onValueChange={(v) => updateExtractedData("kitchen_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offen">{t("lead.option.kitchen.offen")}</SelectItem>
                <SelectItem value="geschlossen">{t("lead.option.kitchen.geschlossen")}</SelectItem>
                <SelectItem value="kochnische">{t("lead.option.kitchen.kochnische")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.cleaningType")}</Label>
            <Select
              value={extractedData?.cleaning_type || ""}
              onValueChange={(v) => updateExtractedData("cleaning_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Endreinigung">{t("lead.option.cleaning.end")}</SelectItem>
                <SelectItem value="Grundreinigung">{t("lead.option.cleaning.grund")}</SelectItem>
                <SelectItem value="Unterhaltsreinigung">{t("lead.option.cleaning.unterhalt")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Areas */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.additionalAreas")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "has_balcony", label: t("lead.extra.balcony") },
            { key: "has_garage", label: t("lead.extra.garage") },
            { key: "has_basement", label: t("lead.extra.basement") },
            { key: "has_attic", label: t("lead.extra.attic") },
          ].map((area) => (
            <div key={area.key} className="flex items-center space-x-2">
              <Checkbox
                id={area.key}
                checked={!!extractedData?.[area.key as keyof ExtractedData]}
                onCheckedChange={(checked) =>
                  updateExtractedData(area.key as keyof ExtractedData, !!checked)
                }
              />
              <label htmlFor={area.key} className="text-sm cursor-pointer">
                {area.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderRaeumungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("raeumung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Clearing Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {t("lead.section.clearingDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.clearingType")}</Label>
            <Select
              value={extractedData?.clearing_type || ""}
              onValueChange={(v) => updateExtractedData("clearing_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnungsräumung">{t("lead.option.clearing.wohnung")}</SelectItem>
                <SelectItem value="Hausräumung">{t("lead.option.clearing.haus")}</SelectItem>
                <SelectItem value="Kellerräumung">{t("lead.option.clearing.keller")}</SelectItem>
                <SelectItem value="Dachbodenräumung">{t("lead.option.clearing.dachboden")}</SelectItem>
                <SelectItem value="Büroräumung">{t("lead.option.clearing.buero")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.propertyType")}</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">{t("lead.option.property.wohnung")}</SelectItem>
                <SelectItem value="Haus">{t("lead.option.property.haus")}</SelectItem>
                <SelectItem value="Keller">{t("lead.option.property.keller")}</SelectItem>
                <SelectItem value="Estrich">{t("lead.option.property.estrich")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.estimatedVolume")}</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.clearingVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.clearingVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.clearingVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.clearingVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="has_heavy_items"
                checked={!!extractedData?.has_heavy_items}
                onCheckedChange={(checked) => updateExtractedData("has_heavy_items", !!checked)}
              />
              <label htmlFor="has_heavy_items" className="text-sm cursor-pointer">
                {t("lead.field.heavyItems")}
              </label>
            </div>
            {extractedData?.has_heavy_items && (
              <Textarea
                placeholder={t("lead.placeholder.heavyItems")}
                value={extractedData?.heavy_items_description || ""}
                onChange={(e) => updateExtractedData("heavy_items_description", e.target.value)}
                rows={2}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderEntsorgungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("entsorgung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Disposal Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {t("lead.section.disposalDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.disposalType")}</Label>
            <Select
              value={extractedData?.disposal_type || ""}
              onValueChange={(v) => updateExtractedData("disposal_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sperrmüll">{t("lead.option.disposal.sperrmuell")}</SelectItem>
                <SelectItem value="Elektroschrott">{t("lead.option.disposal.elektroschrott")}</SelectItem>
                <SelectItem value="Bauschutt">{t("lead.option.disposal.bauschutt")}</SelectItem>
                <SelectItem value="Hausrat">{t("lead.option.disposal.hausrat")}</SelectItem>
                <SelectItem value="Möbel">{t("lead.option.disposal.moebel")}</SelectItem>
                <SelectItem value="Gemischt">{t("lead.option.disposal.gemischt")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.estimatedVolume")}</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.disposalVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.disposalVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.disposalVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.disposalVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.itemsDescription")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.disposalItems")}
              value={extractedData?.items_description || ""}
              onChange={(e) => updateExtractedData("items_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderLagerungFields = () => (
    <>
      {/* Pickup Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("lagerung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.pickup_street || ""}
              onChange={(e) => updateExtractedData("pickup_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.pickup_house_number || ""}
              onChange={(e) => updateExtractedData("pickup_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.pickup_plz || ""}
              onChange={(e) => updateExtractedData("pickup_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.pickup_city || ""}
              onChange={(e) => updateExtractedData("pickup_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.pickup_floor ?? ""}
              onChange={(e) => updateExtractedData("pickup_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.pickup_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("pickup_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Storage Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Warehouse className="w-4 h-4" />
          {t("lead.section.storageDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.storageDuration")}</Label>
            <Select
              value={extractedData?.storage_duration || ""}
              onValueChange={(v) => updateExtractedData("storage_duration", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kurzfristig">{t("lead.option.storageDuration.kurzfristig")}</SelectItem>
                <SelectItem value="1-3_monate">{t("lead.option.storageDuration.m1_3")}</SelectItem>
                <SelectItem value="3-6_monate">{t("lead.option.storageDuration.m3_6")}</SelectItem>
                <SelectItem value="6-12_monate">{t("lead.option.storageDuration.m6_12")}</SelectItem>
                <SelectItem value="langfristig">{t("lead.option.storageDuration.langfristig")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.storageVolume")}</Label>
            <Select
              value={extractedData?.storage_volume || ""}
              onValueChange={(v) => updateExtractedData("storage_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.storageVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.storageVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.storageVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.storageVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.accessFrequency")}</Label>
            <Select
              value={extractedData?.access_frequency || ""}
              onValueChange={(v) => updateExtractedData("access_frequency", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nie">{t("lead.option.access.nie")}</SelectItem>
                <SelectItem value="selten">{t("lead.option.access.selten")}</SelectItem>
                <SelectItem value="monatlich">{t("lead.option.access.monatlich")}</SelectItem>
                <SelectItem value="wöchentlich">{t("lead.option.access.woechentlich")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="needs_climate_control"
              checked={!!extractedData?.needs_climate_control}
              onCheckedChange={(checked) => updateExtractedData("needs_climate_control", !!checked)}
            />
            <label htmlFor="needs_climate_control" className="text-sm cursor-pointer">
              {t("lead.field.climateControl")}
            </label>
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.storageItems")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.storageItems")}
              value={extractedData?.storage_items_description || ""}
              onChange={(e) => updateExtractedData("storage_items_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderKlaviertransportFields = () => (
    <>
      {/* From Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("klaviertransport", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* To Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("klaviertransport", locale).secondary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Piano Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Piano className="w-4 h-4" />
          {t("lead.section.pianoDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.pianoType")}</Label>
            <Select
              value={extractedData?.piano_type || ""}
              onValueChange={(v) => updateExtractedData("piano_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klavier">{t("lead.option.piano.klavier")}</SelectItem>
                <SelectItem value="fluegel">{t("lead.option.piano.fluegel")}</SelectItem>
                <SelectItem value="e_piano">{t("lead.option.piano.ePiano")}</SelectItem>
                <SelectItem value="keyboard">{t("lead.option.piano.keyboard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.pianoBrand")}</Label>
            <Input
              value={extractedData?.piano_brand || ""}
              onChange={(e) => updateExtractedData("piano_brand", e.target.value)}
              placeholder={t("lead.placeholder.pianoBrand")}
            />
          </div>
          <div>
            <Label>{t("lead.field.pianoWeight")}</Label>
            <Input
              type="number"
              value={extractedData?.piano_weight_kg ?? ""}
              onChange={(e) => updateExtractedData("piano_weight_kg", e.target.value ? parseInt(e.target.value) : null)}
              placeholder={t("lead.placeholder.pianoWeight")}
            />
          </div>
          <div>
            <Label>{t("lead.field.staircaseType")}</Label>
            <Select
              value={extractedData?.staircase_type || ""}
              onValueChange={(v) => updateExtractedData("staircase_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keine">{t("lead.option.staircase.keine")}</SelectItem>
                <SelectItem value="gerade">{t("lead.option.staircase.gerade")}</SelectItem>
                <SelectItem value="kurvig">{t("lead.option.staircase.kurvig")}</SelectItem>
                <SelectItem value="wendel">{t("lead.option.staircase.wendel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.staircaseWidth")}</Label>
            <Input
              type="number"
              value={extractedData?.staircase_width_cm ?? ""}
              onChange={(e) => updateExtractedData("staircase_width_cm", e.target.value ? parseInt(e.target.value) : null)}
              placeholder={t("lead.placeholder.staircaseWidth")}
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="window_access_possible"
              checked={!!extractedData?.window_access_possible}
              onCheckedChange={(checked) => updateExtractedData("window_access_possible", !!checked)}
            />
            <label htmlFor="window_access_possible" className="text-sm cursor-pointer">
              {t("lead.field.windowAccess")}
            </label>
          </div>
        </div>
      </div>
    </>
  );

  const renderMoebelliftFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("moebellift", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Lift Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.liftDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.liftFloor")}</Label>
            <Input
              type="number"
              value={extractedData?.moebellift_floor ?? ""}
              onChange={(e) => updateExtractedData("moebellift_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.direction")}</Label>
            <Select
              value={extractedData?.direction || ""}
              onValueChange={(v) => updateExtractedData("direction", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoch">{t("lead.option.direction.hoch")}</SelectItem>
                <SelectItem value="runter">{t("lead.option.direction.runter")}</SelectItem>
                <SelectItem value="beides">{t("lead.option.direction.beides")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.dimensions")}</Label>
            <Input
              value={extractedData?.moebellift_item_dimensions || ""}
              onChange={(e) => updateExtractedData("moebellift_item_dimensions", e.target.value)}
              placeholder={t("lead.placeholder.dimensions")}
            />
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.liftItems")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.liftItems")}
              value={extractedData?.moebellift_item_description || ""}
              onChange={(e) => updateExtractedData("moebellift_item_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div className="space-y-8">
      {/* Contact Information (Common for all) */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <User className="w-4 h-4" />
          {t("lead.import.contactInfo")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.firstName")}</Label>
            <Input
              value={extractedData.first_name || ""}
              onChange={(e) => updateExtractedData("first_name", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.lastName")}</Label>
            <Input
              value={extractedData.last_name || ""}
              onChange={(e) => updateExtractedData("last_name", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.email")}</Label>
            <Input
              type="email"
              value={extractedData.email || ""}
              onChange={(e) => updateExtractedData("email", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.phone")}</Label>
            <Input
              value={extractedData.phone || ""}
              onChange={(e) => updateExtractedData("phone", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Customer language (DOCUMENT locale) — explicitly NOT the operator's
          dashboard language. Everything the customer receives is written in it. */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Languages className="w-4 h-4" />
          {t("lead.import.languageSection")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customer-language">{t("lead.import.languageLabel")}</Label>
            <Select
              value={extractedData.language}
              onValueChange={(v) => updateExtractedData("language", v)}
            >
              <SelectTrigger id="customer-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* The option list is the CUSTOMER's language axis — the endonym
                    (LOCALE_NAMES) is intentionally not routed through useT(). */}
                {LOCALES.map((customerLocale) => (
                  <SelectItem key={customerLocale} value={customerLocale}>
                    {LOCALE_NAMES[customerLocale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="self-end pb-2 text-xs text-muted-foreground">
            {t("lead.import.languageHint")}
          </p>
        </div>
      </div>

      <Separator />

      {/* Date & Time (Common for all) */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {t("lead.import.appointment")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.import.preferredDate")}</Label>
            <DatePicker
              value={extractedData.preferred_date || ""}
              onChange={(value) => updateExtractedData("preferred_date", value)}
            />
          </div>
          <div>
            <Label>{t("lead.import.preferredTime")}</Label>
            <Input
              type="text"
              placeholder={t("lead.placeholder.preferredTime")}
              value={extractedData.preferred_time || ""}
              onChange={(e) => updateExtractedData("preferred_time", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Service-specific fields */}
      {renderServiceFields()}

      <Separator />

      {/* Special Notes (Common for all) */}
      <div>
        <Label>{t("lead.import.specialNotes")}</Label>
        <Textarea
          value={extractedData.special_notes || ""}
          onChange={(e) => updateExtractedData("special_notes", e.target.value)}
          rows={4}
          className="mt-2"
        />
      </div>    </div>
  );
};

export default ExtractedLeadForm;
