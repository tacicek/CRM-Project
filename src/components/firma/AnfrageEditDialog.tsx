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
import { getServiceLabel } from "@/lib/serviceLabels";
import { syncLeadDetailedFormData } from "@/lib/leadDetailedFormSync";
import type { TablesUpdate } from "@/integrations/supabase/types";

// The dialog edits far more columns than the list page declares — the list
// fetches with select("*"), so the full row is present at runtime.
export interface AnfrageEditLead {
  id: string;
  service_type: string;
  detailed_form_data: Record<string, unknown> | null;
}

type FieldValue = string | number | boolean | null;

interface SelectOption {
  value: string;
  label: string;
}

interface FieldDef {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "plz"
    | "date"
    | "textarea"
    | "yesno"
    | "yesno-unknown"
    | "checkbox"
    | "select";
  options?: SelectOption[];
  step?: string;
  placeholder?: string;
  full?: boolean;
}

interface SectionDef {
  title: string;
  fields: FieldDef[];
}

const CONTACT_SECTION: SectionDef = {
  title: "Kontakt",
  fields: [
    { key: "customer_first_name", label: "Vorname", type: "text" },
    { key: "customer_last_name", label: "Nachname", type: "text" },
    { key: "customer_email", label: "E-Mail", type: "text" },
    { key: "customer_phone", label: "Telefon", type: "text", placeholder: "+41 79 123 45 67" },
    { key: "preferred_date", label: "Wunschtermin", type: "date" },
    { key: "description", label: "Beschreibung / Notizen", type: "textarea", full: true },
  ],
};

const fromAddressFields = (title: string): SectionDef => ({
  title,
  fields: [
    { key: "from_street", label: "Strasse", type: "text" },
    { key: "from_house_number", label: "Hausnummer", type: "text" },
    { key: "from_plz", label: "PLZ", type: "plz" },
    { key: "from_city", label: "Ort", type: "text" },
  ],
});

const UMZUG_SECTIONS: SectionDef[] = [
  {
    title: "Auszugsadresse",
    fields: [
      ...fromAddressFields("").fields,
      { key: "from_floor", label: "Etage", type: "number" },
      { key: "from_has_lift", label: "Lift vorhanden?", type: "yesno" },
      { key: "from_has_estrich", label: "Estrich vorhanden?", type: "yesno-unknown" },
      { key: "from_has_keller", label: "Keller vorhanden?", type: "yesno-unknown" },
      { key: "from_rooms", label: "Zimmer", type: "number", step: "0.5" },
      { key: "from_living_space_m2", label: "Wohnfläche (m²)", type: "number" },
    ],
  },
  {
    title: "Einzugsadresse",
    fields: [
      { key: "to_street", label: "Strasse", type: "text" },
      { key: "to_house_number", label: "Hausnummer", type: "text" },
      { key: "to_plz", label: "PLZ", type: "plz" },
      { key: "to_city", label: "Ort", type: "text" },
      { key: "to_floor", label: "Etage", type: "number" },
      { key: "to_has_lift", label: "Lift vorhanden?", type: "yesno" },
    ],
  },
  {
    title: "Zusatzleistungen",
    fields: [
      { key: "packing_service_needed", label: "Einpackservice", type: "checkbox" },
      { key: "cleaning_service_needed", label: "Reinigung", type: "checkbox" },
      { key: "storage_needed", label: "Einlagerung", type: "checkbox" },
    ],
  },
];

const REINIGUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("Reinigungsadresse"),
  {
    title: "Objektdetails",
    fields: [
      {
        key: "property_type",
        label: "Objekttyp",
        type: "select",
        options: [
          { value: "Wohnung", label: "Wohnung" },
          { value: "Haus", label: "Haus" },
          { value: "Studio", label: "Studio" },
          { value: "Büro", label: "Büro" },
        ],
      },
      { key: "from_rooms", label: "Zimmer", type: "number", step: "0.5" },
      { key: "from_living_space_m2", label: "Wohnfläche (m²)", type: "number" },
      { key: "bathroom_count", label: "Badezimmer", type: "number" },
      {
        key: "kitchen_type",
        label: "Küchentyp",
        type: "select",
        options: [
          { value: "offen", label: "Offene Küche" },
          { value: "geschlossen", label: "Geschlossene Küche" },
          { value: "kochnische", label: "Kochnische" },
        ],
      },
    ],
  },
  {
    title: "Zusätzliche Bereiche",
    fields: [
      { key: "has_balcony", label: "Balkon/Terrasse", type: "checkbox" },
      { key: "has_garage", label: "Garage", type: "checkbox" },
      { key: "has_basement", label: "Keller", type: "checkbox" },
      { key: "has_attic", label: "Estrich/Dachboden", type: "checkbox" },
    ],
  },
];

const RAEUMUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("Räumungsadresse"),
  {
    title: "Räumungsdetails",
    fields: [
      {
        key: "clearing_type",
        label: "Räumungsart",
        type: "select",
        options: [
          { value: "Wohnungsräumung", label: "Wohnungsräumung" },
          { value: "Hausräumung", label: "Hausräumung" },
          { value: "Kellerräumung", label: "Kellerräumung" },
          { value: "Dachbodenräumung", label: "Dachbodenräumung" },
          { value: "Büroräumung", label: "Büroräumung" },
        ],
      },
      {
        key: "property_type",
        label: "Objekttyp",
        type: "select",
        options: [
          { value: "Wohnung", label: "Wohnung" },
          { value: "Haus", label: "Haus" },
          { value: "Keller", label: "Keller" },
          { value: "Estrich", label: "Estrich" },
        ],
      },
      { key: "from_rooms", label: "Zimmer", type: "number", step: "0.5" },
      {
        key: "estimated_volume",
        label: "Geschätztes Volumen",
        type: "select",
        options: [
          { value: "klein", label: "Klein (wenige Gegenstände)" },
          { value: "mittel", label: "Mittel (teilmöbliert)" },
          { value: "gross", label: "Gross (vollmöbliert)" },
          { value: "sehr_gross", label: "Sehr gross (überfüllt)" },
        ],
      },
      { key: "has_heavy_items", label: "Schwere Gegenstände vorhanden", type: "checkbox" },
      { key: "heavy_items_description", label: "Schwere Gegenstände (Beschreibung)", type: "textarea", full: true },
    ],
  },
];

const ENTSORGUNG_SECTIONS: SectionDef[] = [
  fromAddressFields("Entsorgungsadresse"),
  {
    title: "Entsorgungsdetails",
    fields: [
      {
        key: "disposal_type",
        label: "Entsorgungsart",
        type: "select",
        options: [
          { value: "Sperrmüll", label: "Sperrmüll" },
          { value: "Elektroschrott", label: "Elektroschrott" },
          { value: "Bauschutt", label: "Bauschutt" },
          { value: "Hausrat", label: "Hausrat" },
          { value: "Möbel", label: "Möbel" },
          { value: "Gemischt", label: "Gemischt" },
        ],
      },
      {
        key: "estimated_volume",
        label: "Geschätztes Volumen",
        type: "select",
        options: [
          { value: "klein", label: "Klein (1-2 m³)" },
          { value: "mittel", label: "Mittel (3-5 m³)" },
          { value: "gross", label: "Gross (6-10 m³)" },
          { value: "sehr_gross", label: "Sehr gross (10+ m³)" },
        ],
      },
      { key: "items_description", label: "Beschreibung der Gegenstände", type: "textarea", full: true },
    ],
  },
];

const LAGERUNG_SECTIONS: SectionDef[] = [
  {
    title: "Abholadresse",
    fields: [
      { key: "pickup_street", label: "Strasse", type: "text" },
      { key: "pickup_house_number", label: "Hausnummer", type: "text" },
      { key: "from_plz", label: "PLZ", type: "plz" },
      { key: "from_city", label: "Ort", type: "text" },
      { key: "pickup_floor", label: "Etage", type: "number" },
      { key: "pickup_has_lift", label: "Lift vorhanden?", type: "yesno" },
    ],
  },
  {
    title: "Lagerungsdetails",
    fields: [
      {
        key: "storage_duration",
        label: "Lagerdauer",
        type: "select",
        options: [
          { value: "kurzfristig", label: "Kurzfristig (wenige Tage)" },
          { value: "1-3_monate", label: "1-3 Monate" },
          { value: "3-6_monate", label: "3-6 Monate" },
          { value: "6-12_monate", label: "6-12 Monate" },
          { value: "langfristig", label: "Langfristig (1+ Jahr)" },
        ],
      },
      {
        key: "storage_volume",
        label: "Volumen",
        type: "select",
        options: [
          { value: "klein", label: "Klein (1-5 m³)" },
          { value: "mittel", label: "Mittel (5-15 m³)" },
          { value: "gross", label: "Gross (15-30 m³)" },
          { value: "sehr_gross", label: "Sehr gross (30+ m³)" },
        ],
      },
      {
        key: "access_frequency",
        label: "Zugriffshäufigkeit",
        type: "select",
        options: [
          { value: "nie", label: "Kein Zugriff nötig" },
          { value: "selten", label: "Selten" },
          { value: "monatlich", label: "Monatlich" },
          { value: "wöchentlich", label: "Wöchentlich" },
        ],
      },
      { key: "needs_climate_control", label: "Klimatisierter Lagerraum benötigt", type: "checkbox" },
      { key: "storage_items_description", label: "Was wird eingelagert?", type: "textarea", full: true },
    ],
  },
];

const KLAVIER_SECTIONS: SectionDef[] = [
  {
    title: "Abholadresse",
    fields: [
      ...fromAddressFields("").fields,
      { key: "from_floor", label: "Etage", type: "number" },
      { key: "from_has_lift", label: "Lift vorhanden?", type: "yesno" },
    ],
  },
  {
    title: "Lieferadresse",
    fields: [
      { key: "to_street", label: "Strasse", type: "text" },
      { key: "to_house_number", label: "Hausnummer", type: "text" },
      { key: "to_plz", label: "PLZ", type: "plz" },
      { key: "to_city", label: "Ort", type: "text" },
      { key: "to_floor", label: "Etage", type: "number" },
      { key: "to_has_lift", label: "Lift vorhanden?", type: "yesno" },
    ],
  },
  {
    title: "Klavierdetails",
    fields: [
      {
        key: "piano_type",
        label: "Klaviertyp",
        type: "select",
        options: [
          { value: "klavier", label: "Klavier (aufrecht)" },
          { value: "fluegel", label: "Flügel" },
          { value: "e_piano", label: "E-Piano" },
          { value: "keyboard", label: "Keyboard" },
        ],
      },
      { key: "piano_brand", label: "Marke", type: "text", placeholder: "z.B. Steinway, Yamaha" },
      { key: "piano_weight_kg", label: "Gewicht (kg)", type: "number" },
      {
        key: "staircase_type",
        label: "Treppentyp",
        type: "select",
        options: [
          { value: "keine", label: "Keine Treppe" },
          { value: "gerade", label: "Gerade Treppe" },
          { value: "kurvig", label: "Kurvige Treppe" },
          { value: "wendel", label: "Wendeltreppe" },
        ],
      },
      { key: "staircase_width_cm", label: "Treppenbreite (cm)", type: "number" },
      { key: "window_access_possible", label: "Fensterzugang möglich (für Kran)", type: "checkbox" },
    ],
  },
];

const MOEBELLIFT_SECTIONS: SectionDef[] = [
  fromAddressFields("Einsatzadresse"),
  {
    title: "Möbellift-Details",
    fields: [
      { key: "moebellift_floor", label: "Stockwerk", type: "number" },
      { key: "moebellift_item_dimensions", label: "Abmessungen", type: "text", placeholder: "z.B. 200×90×60 cm" },
      { key: "moebellift_item_description", label: "Was wird transportiert?", type: "textarea", full: true },
    ],
  },
];

const DEFAULT_SECTIONS: SectionDef[] = [
  fromAddressFields("Adresse (von)"),
  {
    title: "Adresse (nach)",
    fields: [
      { key: "to_street", label: "Strasse", type: "text" },
      { key: "to_house_number", label: "Hausnummer", type: "text" },
      { key: "to_plz", label: "PLZ", type: "plz" },
      { key: "to_city", label: "Ort", type: "text" },
    ],
  },
];

function getServiceSections(serviceType: string): SectionDef[] {
  const type = serviceType?.toLowerCase() ?? "";
  if (type.includes("umzug")) return UMZUG_SECTIONS;
  if (type.includes("reinigung")) return REINIGUNG_SECTIONS;
  if (type.includes("raeumung")) return RAEUMUNG_SECTIONS;
  if (type.includes("entsorgung")) return ENTSORGUNG_SECTIONS;
  if (type.includes("lagerung")) return LAGERUNG_SECTIONS;
  if (type.includes("klavier")) return KLAVIER_SECTIONS;
  if (type.includes("moebellift")) return MOEBELLIFT_SECTIONS;
  return DEFAULT_SECTIONS;
}

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
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    const phone = typeof form.customer_phone === "string" ? form.customer_phone.trim() : "";
    if (phone && !isValidSwissPhone(phone)) {
      toast({
        title: "Ungültige Telefonnummer",
        description: "Bitte geben Sie eine gültige Schweizer Telefonnummer ein (z.B. +41 79 123 45 67).",
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
            title: "Ungültige PLZ",
            description: `${section.title}: PLZ muss 4-stellig sein.`,
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

      toast({ title: "Gespeichert", description: "Die Anfrage wurde aktualisiert." });
      onSaved();
    } catch (err) {
      console.error("Error updating lead:", err);
      toast({
        title: "Fehler",
        description: "Die Anfrage konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: FieldDef) => {
    const value = form[field.key];

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
              {field.label}
            </label>
          </div>
        );
      case "yesno":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Select
              value={value === true ? "yes" : "no"}
              onValueChange={(v) => setValue(field.key, v === "yes")}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "yesno-unknown":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Select
              value={value === true ? "yes" : value === false ? "no" : "unknown"}
              onValueChange={(v) => setValue(field.key, v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unbekannt</SelectItem>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "select":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Select
              value={typeof value === "string" ? value : ""}
              onValueChange={(v) => setValue(field.key, v)}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "date":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
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
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={typeof value === "string" ? value : ""}
              placeholder={field.placeholder}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
          </div>
        );
      case "number":
        return (
          <div key={field.key}>
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Input
              className="mt-1 h-9"
              type="number"
              step={field.step}
              value={typeof value === "number" ? value : ""}
              placeholder={field.placeholder}
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
            <Label className="text-[13px] text-folk-ink3">{field.label}</Label>
            <Input
              className="mt-1 h-9"
              value={typeof value === "string" ? value : ""}
              placeholder={field.placeholder}
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
            Anfrage bearbeiten
          </DialogTitle>
          <DialogDescription className="text-[14px] text-folk-ink3">
            {getServiceLabel(lead.service_type)} — Korrekturen werden direkt auf der Anfrage gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {sections.map((section, idx) => (
            <div key={section.title}>
              {idx > 0 && <Separator className="mb-5 bg-folk-line-soft" />}
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">
                {section.title}
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
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-4 text-[15px] font-semibold text-white hover:bg-folk-ink2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
