import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getServiceLabel } from "@/i18n/domain";
import { syncLeadDetailedFormData } from "@/lib/leadDetailedFormSync";
import { LOCALES, LOCALE_NAMES, toLocale } from "@/i18n/locale";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";
import type { TablesUpdate } from "@/integrations/supabase/types";

// The dialog edits far more columns than the list page declares — the list
// fetches with select("*"), so the full row is present at runtime.
export interface AnfrageEditLead {
  id: string;
  service_type: string;
  detailed_form_data: Record<string, unknown> | null;
}

type FieldValue = string | number | boolean | null;

/**
 * The option `value` is the German token that is written to the DB column
 * (property_type, disposal_type, …) and read back by the offer calculator and the
 * PDFs. Only `labelKey` is translated — the stored value must stay stable.
 */
interface SelectOption {
  value: string;
  labelKey: MessageKey;
}

interface FieldDef {
  key: string;
  labelKey: MessageKey;
  type:
    | "text"
    | "number"
    | "plz"
    | "date"
    | "textarea"
    | "yesno"
    | "yesno-unknown"
    | "checkbox"
    | "select"
    // DOCUMENT locale (de/fr/en). Its own type because the column is NOT NULL: unlike a
    // plain "select" it must never serialize to null, and it is always narrowed via toLocale.
    | "locale";
  options?: SelectOption[];
  step?: string;
  placeholderKey?: MessageKey;
  full?: boolean;
  /** Helper line under the input — used where the field's meaning is easy to misread. */
  hintKey?: MessageKey;
}

interface SectionDef {
  titleKey: MessageKey;
  fields: FieldDef[];
}

const CONTACT_SECTION: SectionDef = {
  titleKey: "lead.section.contact",
  fields: [
    { key: "customer_first_name", labelKey: "common.firstName", type: "text" },
    { key: "customer_last_name", labelKey: "common.lastName", type: "text" },
    { key: "customer_email", labelKey: "common.email", type: "text" },
    { key: "customer_phone", labelKey: "common.phone", type: "text", placeholderKey: "lead.placeholder.phone" },
    { key: "preferred_date", labelKey: "lead.field.preferredDate", type: "date" },
    {
      // CUSTOMER language, not the dashboard language: the label is translated for the
      // operator, the value stays the captured locale of the customer.
      key: "language",
      labelKey: "lead.field.customerLanguage",
      type: "locale",
      hintKey: "lead.field.customerLanguageHint",
    },
    { key: "description", labelKey: "lead.field.descriptionNotes", type: "textarea", full: true },
  ],
};

const fromAddressFields = (titleKey: MessageKey): SectionDef => ({
  titleKey,
  fields: [
    { key: "from_street", labelKey: "common.street", type: "text" },
    { key: "from_house_number", labelKey: "common.houseNumber", type: "text" },
    { key: "from_plz", labelKey: "common.plz", type: "plz" },
    { key: "from_city", labelKey: "common.city", type: "text" },
  ],
});

const UMZUG_SECTIONS: SectionDef[] = [
  {
    titleKey: "domain.address.umzug.primary",
    fields: [
      ...fromAddressFields("domain.address.umzug.primary").fields,
      { key: "from_floor", labelKey: "lead.field.floor", type: "number" },
      { key: "from_has_lift", labelKey: "lead.field.hasLift", type: "yesno" },
      { key: "from_has_estrich", labelKey: "lead.field.hasEstrich", type: "yesno-unknown" },
      { key: "from_has_keller", labelKey: "lead.field.hasKeller", type: "yesno-unknown" },
      { key: "from_rooms", labelKey: "lead.field.rooms", type: "number", step: "0.5" },
      { key: "from_living_space_m2", labelKey: "lead.field.livingSpace", type: "number" },
    ],
  },
  {
    titleKey: "domain.address.umzug.secondary",
    fields: [
      { key: "to_street", labelKey: "common.street", type: "text" },
      { key: "to_house_number", labelKey: "common.houseNumber", type: "text" },
      { key: "to_plz", labelKey: "common.plz", type: "plz" },
      { key: "to_city", labelKey: "common.city", type: "text" },
      { key: "to_floor", labelKey: "lead.field.floor", type: "number" },
      { key: "to_has_lift", labelKey: "lead.field.hasLift", type: "yesno" },
    ],
  },
  {
    titleKey: "lead.section.extras",
    fields: [
      { key: "packing_service_needed", labelKey: "lead.extra.packing", type: "checkbox" },
      { key: "cleaning_service_needed", labelKey: "lead.extra.cleaning", type: "checkbox" },
      { key: "storage_needed", labelKey: "lead.extra.storage", type: "checkbox" },
    ],
  },
];

const REINIGUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("domain.address.reinigung.primary"),
  {
    titleKey: "lead.section.propertyDetails",
    fields: [
      {
        key: "property_type",
        labelKey: "lead.field.propertyType",
        type: "select",
        options: [
          { value: "Wohnung", labelKey: "lead.option.property.wohnung" },
          { value: "Haus", labelKey: "lead.option.property.haus" },
          { value: "Studio", labelKey: "lead.option.property.studio" },
          { value: "Büro", labelKey: "lead.option.property.buero" },
        ],
      },
      { key: "from_rooms", labelKey: "lead.field.rooms", type: "number", step: "0.5" },
      { key: "from_living_space_m2", labelKey: "lead.field.livingSpace", type: "number" },
      { key: "bathroom_count", labelKey: "lead.field.bathrooms", type: "number" },
      {
        key: "kitchen_type",
        labelKey: "lead.field.kitchenType",
        type: "select",
        options: [
          { value: "offen", labelKey: "lead.option.kitchen.offen" },
          { value: "geschlossen", labelKey: "lead.option.kitchen.geschlossen" },
          { value: "kochnische", labelKey: "lead.option.kitchen.kochnische" },
        ],
      },
    ],
  },
  {
    titleKey: "lead.section.additionalAreas",
    fields: [
      { key: "has_balcony", labelKey: "lead.extra.balcony", type: "checkbox" },
      { key: "has_garage", labelKey: "lead.extra.garage", type: "checkbox" },
      { key: "has_basement", labelKey: "lead.extra.basement", type: "checkbox" },
      { key: "has_attic", labelKey: "lead.extra.attic", type: "checkbox" },
    ],
  },
];

const RAEUMUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("domain.address.raeumung.primary"),
  {
    titleKey: "lead.section.clearingDetails",
    fields: [
      {
        key: "clearing_type",
        labelKey: "lead.field.clearingType",
        type: "select",
        options: [
          { value: "Wohnungsräumung", labelKey: "lead.option.clearing.wohnung" },
          { value: "Hausräumung", labelKey: "lead.option.clearing.haus" },
          { value: "Kellerräumung", labelKey: "lead.option.clearing.keller" },
          { value: "Dachbodenräumung", labelKey: "lead.option.clearing.dachboden" },
          { value: "Büroräumung", labelKey: "lead.option.clearing.buero" },
        ],
      },
      {
        key: "property_type",
        labelKey: "lead.field.propertyType",
        type: "select",
        options: [
          { value: "Wohnung", labelKey: "lead.option.property.wohnung" },
          { value: "Haus", labelKey: "lead.option.property.haus" },
          { value: "Keller", labelKey: "lead.option.property.keller" },
          { value: "Estrich", labelKey: "lead.option.property.estrich" },
        ],
      },
      { key: "from_rooms", labelKey: "lead.field.rooms", type: "number", step: "0.5" },
      {
        key: "estimated_volume",
        labelKey: "lead.field.estimatedVolume",
        type: "select",
        options: [
          { value: "klein", labelKey: "lead.option.clearingVolume.klein" },
          { value: "mittel", labelKey: "lead.option.clearingVolume.mittel" },
          { value: "gross", labelKey: "lead.option.clearingVolume.gross" },
          { value: "sehr_gross", labelKey: "lead.option.clearingVolume.sehrGross" },
        ],
      },
      { key: "has_heavy_items", labelKey: "lead.field.heavyItems", type: "checkbox" },
      {
        key: "heavy_items_description",
        labelKey: "lead.field.heavyItemsDescription",
        type: "textarea",
        full: true,
      },
    ],
  },
];

const ENTSORGUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("domain.address.entsorgung.secondary"),
  {
    titleKey: "lead.section.disposalDetails",
    fields: [
      {
        key: "disposal_type",
        labelKey: "lead.field.disposalType",
        type: "select",
        options: [
          { value: "Sperrmüll", labelKey: "lead.option.disposal.sperrmuell" },
          { value: "Elektroschrott", labelKey: "lead.option.disposal.elektroschrott" },
          { value: "Bauschutt", labelKey: "lead.option.disposal.bauschutt" },
          { value: "Hausrat", labelKey: "lead.option.disposal.hausrat" },
          { value: "Möbel", labelKey: "lead.option.disposal.moebel" },
          { value: "Gemischt", labelKey: "lead.option.disposal.gemischt" },
        ],
      },
      {
        key: "estimated_volume",
        labelKey: "lead.field.estimatedVolume",
        type: "select",
        options: [
          { value: "klein", labelKey: "lead.option.disposalVolume.klein" },
          { value: "mittel", labelKey: "lead.option.disposalVolume.mittel" },
          { value: "gross", labelKey: "lead.option.disposalVolume.gross" },
          { value: "sehr_gross", labelKey: "lead.option.disposalVolume.sehrGross" },
        ],
      },
      { key: "items_description", labelKey: "lead.field.itemsDescription", type: "textarea", full: true },
    ],
  },
];

const LAGERUNG_SECTIONS: SectionDef[] = [
  {
    titleKey: "domain.address.lagerung.primary",
    fields: [
      { key: "pickup_street", labelKey: "common.street", type: "text" },
      { key: "pickup_house_number", labelKey: "common.houseNumber", type: "text" },
      { key: "from_plz", labelKey: "common.plz", type: "plz" },
      { key: "from_city", labelKey: "common.city", type: "text" },
      { key: "pickup_floor", labelKey: "lead.field.floor", type: "number" },
      { key: "pickup_has_lift", labelKey: "lead.field.hasLift", type: "yesno" },
    ],
  },
  {
    titleKey: "lead.section.storageDetails",
    fields: [
      {
        key: "storage_duration",
        labelKey: "lead.field.storageDuration",
        type: "select",
        options: [
          { value: "kurzfristig", labelKey: "lead.option.storageDuration.kurzfristig" },
          { value: "1-3_monate", labelKey: "lead.option.storageDuration.m1_3" },
          { value: "3-6_monate", labelKey: "lead.option.storageDuration.m3_6" },
          { value: "6-12_monate", labelKey: "lead.option.storageDuration.m6_12" },
          { value: "langfristig", labelKey: "lead.option.storageDuration.langfristig" },
        ],
      },
      {
        key: "storage_volume",
        labelKey: "lead.field.storageVolume",
        type: "select",
        options: [
          { value: "klein", labelKey: "lead.option.storageVolume.klein" },
          { value: "mittel", labelKey: "lead.option.storageVolume.mittel" },
          { value: "gross", labelKey: "lead.option.storageVolume.gross" },
          { value: "sehr_gross", labelKey: "lead.option.storageVolume.sehrGross" },
        ],
      },
      {
        key: "access_frequency",
        labelKey: "lead.field.accessFrequency",
        type: "select",
        options: [
          { value: "nie", labelKey: "lead.option.access.nie" },
          { value: "selten", labelKey: "lead.option.access.selten" },
          { value: "monatlich", labelKey: "lead.option.access.monatlich" },
          { value: "wöchentlich", labelKey: "lead.option.access.woechentlich" },
        ],
      },
      { key: "needs_climate_control", labelKey: "lead.field.climateControl", type: "checkbox" },
      { key: "storage_items_description", labelKey: "lead.field.storageItems", type: "textarea", full: true },
    ],
  },
];

const KLAVIER_SECTIONS: SectionDef[] = [
  {
    titleKey: "domain.address.klaviertransport.primary",
    fields: [
      ...fromAddressFields("domain.address.klaviertransport.primary").fields,
      { key: "from_floor", labelKey: "lead.field.floor", type: "number" },
      { key: "from_has_lift", labelKey: "lead.field.hasLift", type: "yesno" },
    ],
  },
  {
    titleKey: "lead.section.deliveryAddress",
    fields: [
      { key: "to_street", labelKey: "common.street", type: "text" },
      { key: "to_house_number", labelKey: "common.houseNumber", type: "text" },
      { key: "to_plz", labelKey: "common.plz", type: "plz" },
      { key: "to_city", labelKey: "common.city", type: "text" },
      { key: "to_floor", labelKey: "lead.field.floor", type: "number" },
      { key: "to_has_lift", labelKey: "lead.field.hasLift", type: "yesno" },
    ],
  },
  {
    titleKey: "lead.section.pianoDetails",
    fields: [
      {
        key: "piano_type",
        labelKey: "lead.field.pianoType",
        type: "select",
        options: [
          { value: "klavier", labelKey: "lead.option.piano.klavier" },
          { value: "fluegel", labelKey: "lead.option.piano.fluegel" },
          { value: "e_piano", labelKey: "lead.option.piano.ePiano" },
          { value: "keyboard", labelKey: "lead.option.piano.keyboard" },
        ],
      },
      {
        key: "piano_brand",
        labelKey: "lead.field.pianoBrand",
        type: "text",
        placeholderKey: "lead.placeholder.pianoBrand",
      },
      { key: "piano_weight_kg", labelKey: "lead.field.pianoWeight", type: "number" },
      {
        key: "staircase_type",
        labelKey: "lead.field.staircaseType",
        type: "select",
        options: [
          { value: "keine", labelKey: "lead.option.staircase.keine" },
          { value: "gerade", labelKey: "lead.option.staircase.gerade" },
          { value: "kurvig", labelKey: "lead.option.staircase.kurvig" },
          { value: "wendel", labelKey: "lead.option.staircase.wendel" },
        ],
      },
      { key: "staircase_width_cm", labelKey: "lead.field.staircaseWidth", type: "number" },
      { key: "window_access_possible", labelKey: "lead.field.windowAccess", type: "checkbox" },
    ],
  },
];

const MOEBELLIFT_SECTIONS: SectionDef[] = [
  fromAddressFields("domain.address.moebellift.primary"),
  {
    titleKey: "lead.section.liftDetails",
    fields: [
      { key: "moebellift_floor", labelKey: "lead.field.liftFloor", type: "number" },
      {
        key: "moebellift_item_dimensions",
        labelKey: "lead.field.dimensions",
        type: "text",
        placeholderKey: "lead.placeholder.dimensions",
      },
      {
        key: "moebellift_item_description",
        labelKey: "lead.field.liftItems",
        type: "textarea",
        full: true,
      },
    ],
  },
];

const DEFAULT_SECTIONS: SectionDef[] = [
  fromAddressFields("lead.section.addressFrom"),
  {
    titleKey: "lead.section.addressTo",
    fields: [
      { key: "to_street", labelKey: "common.street", type: "text" },
      { key: "to_house_number", labelKey: "common.houseNumber", type: "text" },
      { key: "to_plz", labelKey: "common.plz", type: "plz" },
      { key: "to_city", labelKey: "common.city", type: "text" },
    ],
  },
];

const getServiceSections = (serviceType: string): SectionDef[] => {
  const type = serviceType?.toLowerCase() ?? "";
  if (type.includes("umzug")) return UMZUG_SECTIONS;
  if (type.includes("reinigung")) return REINIGUNG_SECTIONS;
  if (type.includes("raeumung")) return RAEUMUNG_SECTIONS;
  if (type.includes("entsorgung")) return ENTSORGUNG_SECTIONS;
  if (type.includes("lagerung")) return LAGERUNG_SECTIONS;
  if (type.includes("klavier")) return KLAVIER_SECTIONS;
  if (type.includes("moebellift")) return MOEBELLIFT_SECTIONS;
  return DEFAULT_SECTIONS;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidSwissPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  return /^(\+41|0041|0)[1-9]\d{8}$/.test(cleaned);
};

const formatSwissPhone = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cleaned.startsWith("0") && !cleaned.startsWith("00")) return "+41 " + cleaned.substring(1);
  if (cleaned.startsWith("0041")) return "+41 " + cleaned.substring(4);
  return phone;
};

const initFieldValue = (field: FieldDef, raw: unknown): FieldValue => {
  switch (field.type) {
    case "checkbox":
    case "yesno":
      return raw === true;
    case "yesno-unknown":
      return typeof raw === "boolean" ? raw : null;
    case "number":
      return typeof raw === "number" ? raw : null;
    case "locale":
      return toLocale(raw);
    default:
      return typeof raw === "string" ? raw : "";
  }
};

const serializeFieldValue = (field: FieldDef, value: FieldValue): FieldValue => {
  switch (field.type) {
    case "checkbox":
    case "yesno":
      return value === true;
    case "yesno-unknown":
      return typeof value === "boolean" ? value : null;
    case "number":
      return typeof value === "number" ? value : null;
    // NOT NULL column — always a valid locale, never null.
    case "locale":
      return toLocale(value);
    default: {
      const trimmed = typeof value === "string" ? value.trim() : "";
      return trimmed || null;
    }
  }
};

interface AnfrageEditDialogProps {
  lead: AnfrageEditLead;
  onClose: () => void;
  onSaved: () => void;
}

export default function AnfrageEditDialog({ lead, onClose, onSaved }: AnfrageEditDialogProps) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

  const sections = useMemo(
    () => [CONTACT_SECTION, ...getServiceSections(lead.service_type)],
    [lead.service_type],
  );

  const [form, setForm] = useState<Record<string, FieldValue>>(() => {
    // The row comes from select("*") — read editable columns dynamically.
    const source = lead as AnfrageEditLead & Record<string, unknown>;
    const initial: Record<string, FieldValue> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        initial[field.key] = initFieldValue(field, source[field.key]);
      }
    }
    return initial;
  });

  const setValue = (key: string, value: FieldValue) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (isSaving) return;

    const email = typeof form.customer_email === "string" ? form.customer_email.trim() : "";
    if (email && !EMAIL_RE.test(email)) {
      toast({
        title: t("lead.validation.invalidEmail"),
        description: t("lead.validation.invalidEmailHint"),
        variant: "destructive",
      });
      return;
    }

    const phone = typeof form.customer_phone === "string" ? form.customer_phone.trim() : "";
    if (phone && !isValidSwissPhone(phone)) {
      toast({
        title: t("lead.validation.invalidPhone"),
        description: t("lead.validation.invalidPhoneHint"),
        variant: "destructive",
      });
      return;
    }

    for (const section of sections) {
      for (const field of section.fields) {
        if (field.type !== "plz") continue;
        const value = typeof form[field.key] === "string" ? (form[field.key] as string).trim() : "";
        if (value && !/^\d{4}$/.test(value)) {
          toast({
            title: t("lead.validation.invalidPlz"),
            description: t("lead.validation.invalidPlzSection", { section: t(section.titleKey) }),
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload: Record<string, FieldValue | Record<string, unknown>> = {};
      for (const section of sections) {
        for (const field of section.fields) {
          payload[field.key] = serializeFieldValue(field, form[field.key]);
        }
      }
      if (typeof payload.customer_phone === "string") {
        payload.customer_phone = formatSwissPhone(payload.customer_phone);
      }

      // Mirror edits into the form snapshot so downstream consumers
      // (Offerte calculator, detail views) see the corrected values too.
      const syncedDetailed = syncLeadDetailedFormData(lead.detailed_form_data, payload);
      if (syncedDetailed) {
        payload.detailed_form_data = syncedDetailed;
      }

      const { error } = await supabase
        .from("leads")
        .update(payload as TablesUpdate<"leads">)
        .eq("id", lead.id);

      if (error) throw error;

      toast({ title: t("lead.toast.savedTitle"), description: t("lead.edit.saved") });
      onSaved();
    } catch (err) {
      console.error("Error updating lead:", err);
      toast({
        title: t("common.error"),
        description: t("lead.edit.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: FieldDef) => {
    const value = form[field.key];
    const label = t(field.labelKey);
    const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined;

    switch (field.type) {
      case "checkbox":
        return (
          <div key={field.key} className="flex items-center space-x-2">
            <Checkbox
              id={`edit-${field.key}`}
              checked={value === true}
              onCheckedChange={(checked) => setValue(field.key, !!checked)}
            />
            <label htmlFor={`edit-${field.key}`} className="cursor-pointer text-[14px] text-folk-ink2">
              {label}
            </label>
          </div>
        );
      case "yesno":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Select
              value={value === true ? "yes" : "no"}
              onValueChange={(v) => setValue(field.key, v === "yes")}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "yesno-unknown":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Select
              value={value === true ? "yes" : value === false ? "no" : "unknown"}
              onValueChange={(v) => setValue(field.key, v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t("common.unknown")}</SelectItem>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "select":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Select
              value={typeof value === "string" ? value : ""}
              onValueChange={(v) => setValue(field.key, v)}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "locale":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            {/* The VALUE is the customer's language and is never derived from the dashboard
                locale — LOCALE_NAMES are endonyms, each language shown in itself. */}
            <Select
              value={toLocale(value)}
              onValueChange={(v) => setValue(field.key, toLocale(v))}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((localeOption) => (
                  <SelectItem key={localeOption} value={localeOption}>
                    {LOCALE_NAMES[localeOption]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.hintKey && (
              <p className="mt-1 text-[12px] leading-snug text-folk-ink4">{t(field.hintKey)}</p>
            )}
          </div>
        );
      case "date":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <DatePicker
              className="mt-1"
              value={typeof value === "string" ? value : ""}
              onChange={(v) => setValue(field.key, v)}
            />
          </div>
        );
      case "textarea":
        return (
          <div key={field.key} className={field.full ? "sm:col-span-2" : undefined}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={typeof value === "string" ? value : ""}
              placeholder={placeholder}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
          </div>
        );
      case "number":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Input
              className="mt-1 h-9"
              type="number"
              step={field.step}
              value={typeof value === "number" ? value : ""}
              placeholder={placeholder}
              onChange={(e) =>
                setValue(
                  field.key,
                  e.target.value
                    ? field.step
                      ? parseFloat(e.target.value)
                      : parseInt(e.target.value)
                    : null,
                )
              }
            />
          </div>
        );
      default:
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{label}</Label>
            <Input
              className="mt-1 h-9"
              value={typeof value === "string" ? value : ""}
              placeholder={placeholder}
              maxLength={field.type === "plz" ? 4 : undefined}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
          </div>
        );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-xl border-folk-line bg-folk-card">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold tracking-tight text-folk-ink">
            {t("lead.edit.title")}
          </DialogTitle>
          <DialogDescription className="text-[14px] text-folk-ink3">
            {t("lead.edit.description", { service: getServiceLabel(lead.service_type, locale) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {sections.map((section, idx) => (
            <div key={section.titleKey}>
              {idx > 0 && <Separator className="mb-5 bg-folk-line-soft" />}
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">
                {t(section.titleKey)}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.fields.map(renderField)}
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-lg border-folk-line bg-folk-card px-4 text-[15px] text-folk-ink2 hover:bg-folk-bg-warm"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-4 text-[15px] font-semibold text-white hover:bg-folk-ink2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
