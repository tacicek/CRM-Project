// Pre-built checklist templates for different service types
import type { Json } from "@/integrations/supabase/types";

export interface ChecklistSection {
  id: string;
  timeline: string;
  items: string[];
  order: number;
}

const isChecklistRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Read boundary — the inverse of `checklistSectionsToJson`. Narrows a raw `Json` sections
 * value into `ChecklistSection[]`, or `null` when it is absent/empty OR malformed (both mean
 * "no checklist attachment"). Fail-closed: a non-array, or ANY malformed section, yields null
 * — never a silent `[]` or a partially-filtered list. Fresh objects; input not mutated.
 */
export function parseChecklistSections(raw: unknown): ChecklistSection[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ChecklistSection[] = [];
  for (const s of raw) {
    if (!isChecklistRecord(s)) return null;
    if (typeof s.id !== "string" || typeof s.timeline !== "string") return null;
    if (!Array.isArray(s.items) || !s.items.every((i): i is string => typeof i === "string")) return null;
    if (typeof s.order !== "number" || !Number.isFinite(s.order)) return null;
    out.push({ id: s.id, timeline: s.timeline, items: [...s.items], order: s.order });
  }
  return out;
}

/**
 * Serialize the domain `ChecklistSection[]` into the `checklist_templates.sections` JSONB
 * column shape without a cast. Each section becomes a fresh anonymous literal carrying only
 * the canonical keys (id, timeline, items, order); `items` is a fresh copy. Section and item
 * order are preserved, values are unchanged, and the input is not mutated. `order` is always
 * an internal finite index (see getEmptySection / reorder), so no per-value guard is needed.
 */
export function checklistSectionsToJson(sections: ChecklistSection[]): Json {
  return sections.map((section): Json => ({
    id: section.id,
    timeline: section.timeline,
    items: [...section.items],
    order: section.order,
  }));
}

export interface ChecklistTemplate {
  title: string;
  subtitle: string;
  service_type: string;
  sections: ChecklistSection[];
}

const generateId = () => `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const CHECKLIST_TEMPLATES: Record<string, ChecklistTemplate> = {
  umzug: {
    title: "Zügel-Countdown",
    subtitle: "Gut geplant ist halb gezügelt. Wer sich sorgfältig und frühzeitig vorbereitet, spart Zeit und Geld.",
    service_type: "umzug",
    sections: [
      {
        id: generateId(),
        timeline: "Bis vier Wochen vor dem Umzug",
        order: 1,
        items: [
          "Beim Arbeitgeber den gesetzlichen Umzugs-Freitag einfordern.",
          "Schäden an der alten Wohnung der Verwaltung melden.",
          "Umzugsfirma beauftragen.",
          "Reinigungsfirma beauftragen oder Helfer organisieren.",
          "Wohnung, Estrich und Keller entrümpeln."
        ]
      },
      {
        id: generateId(),
        timeline: "Zwei Wochen vor dem Umzug",
        order: 2,
        items: [
          "Notwendige Reparaturen vornehmen.",
          "Verpackungsmaterial beschaffen.",
          "Parkplätze für Transportfahrzeug reservieren.",
          "Unterbringung für Kinder oder Haustiere organisieren."
        ]
      },
      {
        id: generateId(),
        timeline: "Eine Woche vor dem Umzug",
        order: 3,
        items: [
          "Wohnungsabgabe mit Vermieter besprechen.",
          "Restliche Gegenstände verpacken und beschriften.",
          "Wertgegenstände und Dokumente separat vorbereiten.",
          "Möbel demontieren.",
          "Adressänderung vorbereiten."
        ]
      },
      {
        id: generateId(),
        timeline: "Am Umzugstag",
        order: 4,
        items: [
          "Zählerstände notieren.",
          "Zugangswege freihalten.",
          "Umzugsschäden sofort dokumentieren.",
          "Wohnungsabgabe mit Protokoll durchführen."
        ]
      },
      {
        id: generateId(),
        timeline: "Nach dem Umzug",
        order: 5,
        items: [
          "Schäden am Umzugsgut innerhalb von 2 Tagen melden.",
          "Neue Wohnung auf Mängel prüfen.",
          "Bei der Gemeinde ummelden.",
          "Sich bei Nachbarn vorstellen."
        ]
      }
    ]
  },
  
  reinigung: {
    title: "Reinigungs-Checkliste",
    subtitle: "Schritt für Schritt zur perfekten Wohnungsabgabe.",
    service_type: "reinigung",
    sections: [
      {
        id: generateId(),
        timeline: "Vor der Reinigung",
        order: 1,
        items: [
          "Reinigungstermin bestätigen.",
          "Wohnung vollständig räumen.",
          "Groben Schmutz entfernen.",
          "Schlüssel und Zugang organisieren."
        ]
      },
      {
        id: generateId(),
        timeline: "Am Reinigungstag",
        order: 2,
        items: [
          "Strom und Wasser verfügbar halten.",
          "Problemzonen kennzeichnen.",
          "Abnahme-Termin koordinieren."
        ]
      },
      {
        id: generateId(),
        timeline: "Nach der Reinigung",
        order: 3,
        items: [
          "Wohnung mit Vermieter abnehmen.",
          "Abnahmeprotokoll unterschreiben.",
          "Schlüssel übergeben."
        ]
      }
    ]
  },
  
  entsorgung: {
    title: "Entsorgungs-Checkliste",
    subtitle: "Ordentlich entrümpeln und fachgerecht entsorgen.",
    service_type: "entsorgung",
    sections: [
      {
        id: generateId(),
        timeline: "Vor der Entsorgung",
        order: 1,
        items: [
          "Gegenstände sortieren.",
          "Wertvolles separieren.",
          "Termin mit Entsorgungsfirma vereinbaren.",
          "Parkplatz reservieren."
        ]
      },
      {
        id: generateId(),
        timeline: "Am Entsorgungstag",
        order: 2,
        items: [
          "Gegenstände zugänglich bereitstellen.",
          "Dokumente nochmals prüfen.",
          "Entsorgungsnachweis entgegennehmen."
        ]
      }
    ]
  },
  
  lagerung: {
    title: "Lagerungs-Checkliste",
    subtitle: "Sicher und organisiert einlagern.",
    service_type: "lagerung",
    sections: [
      {
        id: generateId(),
        timeline: "Vor der Einlagerung",
        order: 1,
        items: [
          "Inventarliste erstellen.",
          "Empfindliche Gegenstände verpacken.",
          "Möbel reinigen und trocknen.",
          "Elektronikgeräte dokumentieren."
        ]
      },
      {
        id: generateId(),
        timeline: "Bei der Einlagerung",
        order: 2,
        items: [
          "Kartons beschriften.",
          "Schwere Gegenstände unten lagern.",
          "Fotos vom Zustand machen."
        ]
      }
    ]
  }
};

export const getEmptySection = (order: number): ChecklistSection => ({
  id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  timeline: "",
  items: [""],
  order
});

export const getEmptyTemplate = (serviceType: string): ChecklistTemplate => ({
  title: "",
  subtitle: "",
  service_type: serviceType,
  sections: [getEmptySection(1)]
});

/**
 * Clean sections by removing empty timelines and items
 * Used before saving, copying, or generating PDFs
 */
export const cleanSections = (sections: ChecklistSection[]): ChecklistSection[] => {
  return sections
    .filter(s => s.timeline.trim())
    .map(s => ({
      ...s,
      items: s.items.filter(item => item.trim())
    }))
    .filter(s => s.items.length > 0);
};
