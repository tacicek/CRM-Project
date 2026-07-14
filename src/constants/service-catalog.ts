/**
 * Shared constants for Leistungskatalog (Service Catalog) module
 * Used by: Leistungskatalog.tsx, CatalogServiceSelector.tsx, LeistungsuebersichtSection.tsx
 *
 * LANGUAGE AXES — do not conflate them:
 *
 *  • Structure (value, icon, color) is language-free and lives here.
 *  • Labels shown to the OPERATOR are resolved from the message catalog and always take a
 *    `locale` (the dashboard locale). Never re-declare a German label in this module.
 *  • The German texts inside PREDEFINED_TEMPLATES.services are CONTENT, not chrome: they are
 *    seeded into `company_service_items.name/description`, which stay the German source of
 *    truth and the fallback for the `translations` JSONB column. They must remain German
 *    regardless of the operator's dashboard language.
 */
import type { ComponentType } from "react";
import {
  Truck,
  Droplets,
  Trash,
  Trash2,
  Box,
  Piano,
  ArrowUpDown,
  Paintbrush,
  Armchair,
  BedDouble,
  Package,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Locale } from "@/i18n/locale";
import { getServiceLabel } from "@/i18n/domain";
import { createTranslator, type MessageKey } from "@/i18n/translator";
import type { CategoryConfig, PredefinedTemplate } from "@/types/leistungskatalog";

type Icon = ComponentType<{ className?: string }>;

/** A catalog service type. The label comes from the message catalog, never from this object. */
export interface ServiceType {
  value: string;
  icon: Icon;
  color: string;
}

/**
 * Default price constants
 */
export const DEFAULT_PRICES = {
  STORAGE_PER_M3: 25.00,
  CLIMATE_STORAGE_PER_M3: 35.00,
  PACKAGING_MATERIAL: 5.00,
  CARPET_CLEANING_PER_M2: 5.00,
  SPECIAL_WASTE_PER_KG: 5.00,
  CONTAINER_PER_DAY: 50.00,
  PIANO_STAIRS_PER_FLOOR: 50.00,
  PIANO_CRANE: 400.00,
  PIANO_TUNING: 180.00,
  LIFT_EXTRA_HOUR: 150.00,
  WEEKEND_SURCHARGE: 100.00,
  BALCONY_CLEANING: 80.00,
  CELLAR_CLEANING: 50.00,
  CELLAR_CLEARING: 150.00,
  END_CLEANING: 450.00,
  ROOM_CLEARING_CLEANING: 350.00,
  SPECIAL_TRANSPORT: 200.00,
  DISPOSAL_PER_M3: 50.00,
} as const;

/**
 * Input validation constants
 */
export const VALIDATION = {
  MIN_PRICE: 0,
  MIN_QUANTITY: 0.5,
  DEFAULT_QUANTITY: 1,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

/**
 * Service types with icons and colors
 */
export const SERVICE_TYPES: ServiceType[] = [
  { value: "umzug", icon: Truck, color: "from-blue-500 to-blue-600" },
  { value: "reinigung", icon: Droplets, color: "from-cyan-500 to-cyan-600" },
  { value: "raeumung", icon: Trash, color: "from-orange-500 to-orange-600" },
  { value: "entsorgung", icon: Trash2, color: "from-red-500 to-red-600" },
  { value: "lagerung", icon: Box, color: "from-purple-500 to-purple-600" },
  { value: "klaviertransport", icon: Piano, color: "from-amber-500 to-amber-600" },
  { value: "moebellift", icon: ArrowUpDown, color: "from-green-500 to-green-600" },
  { value: "malerarbeit", icon: Paintbrush, color: "from-pink-500 to-pink-600" },
  { value: "usm_transport", icon: Armchair, color: "from-indigo-500 to-indigo-600" },
  { value: "wasserbett_transport", icon: BedDouble, color: "from-teal-500 to-teal-600" },
];

/**
 * Service categories.
 *
 * `label` is a LEGACY German fallback: src/components/offerte/LeistungsuebersichtSection.tsx
 * still renders `cat.label` directly. Every localized surface must call `getCategoryLabel()`.
 * Delete the field once that component reads the catalog.
 */
export const CATEGORIES: CategoryConfig[] = [
  { value: "transport", label: "Transport", icon: Truck },
  { value: "personal", label: "Personal", icon: Package },
  { value: "verpackung", label: "Verpackung", icon: Box },
  { value: "entsorgung", label: "Entsorgung", icon: Trash2 },
  { value: "reinigung", label: "Reinigung", icon: Droplets },
  { value: "versicherung", label: "Versicherung", icon: ShieldCheck },
  { value: "lagerung", label: "Lagerung", icon: Layers },
  { value: "spezial", label: "Spezialleistungen", icon: Sparkles },
];

/**
 * Billing units. The values are persisted in `company_service_items.unit` — do not rename
 * them; the human-readable form comes from `getUnitLabel()`.
 */
export const UNITS = [
  "Pauschal",
  "Stunde",
  "m3",
  "m2",
  "Zimmer",
  "Stück",
  "kg",
  "km",
  "Tag",
  "Inklusiv",
  "Stockwerk",
] as const;

/**
 * Predefined packages for a quick start.
 *
 * `name` / `description` are a LEGACY German fallback for the not-yet-localized
 * LeistungsuebersichtSection; localized surfaces call `getPackageName()` /
 * `getPackageDescription()`. The texts inside `services` are DB content (German source of
 * truth, see the module header) and are seeded as written.
 */
export const PREDEFINED_TEMPLATES: Record<string, PredefinedTemplate> = {
  umzug_standard: {
    name: "Standard Umzug",
    description: "Grundlegende Umzugsleistungen",
    serviceType: "umzug",
    icon: Truck,
    color: "from-blue-500 to-blue-600",
    services: [
      { category: "transport", name: "Möbeltransport mit Lastwagen", description: "25m³ Möbelwagen mit professioneller Ausstattung", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "personal", name: "3 Umzugsmitarbeiter", description: "Erfahrenes Team für sicheren Transport", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "verpackung", name: "Möbel einwickeln mit Stretchfolie und Decken", description: "Professioneller Schutz für Ihre Möbel", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "personal", name: "De- und Remontage der Möbel", description: "Fachgerechte Demontage und Wiederaufbau", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "versicherung", name: "Haftpflichtversicherung", description: "Versicherungsschutz gemäss OR", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "versicherung", name: "Transportversicherung bis CHF 200'000", description: "Umfassender Versicherungsschutz", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Anfahrt und Abfahrt", description: "Keine versteckten Kosten", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "verpackung", name: "Zusätzliches Verpackungsmaterial", description: "Kartons, Klebeband, Luftpolsterfolie", unit: "Stück", default_price: DEFAULT_PRICES.PACKAGING_MATERIAL, is_default_included: false, is_optional: true },
      { category: "lagerung", name: "Zwischenlagerung", description: "Sichere Lagerung bei Bedarf", unit: "m3", default_price: DEFAULT_PRICES.STORAGE_PER_M3, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Piano-/Tresor-Transport", description: "Spezialausrüstung für schwere Gegenstände", unit: "Pauschal", default_price: DEFAULT_PRICES.SPECIAL_TRANSPORT, is_default_included: false, is_optional: true },
      { category: "entsorgung", name: "Entsorgung von Altmöbeln", description: "Umweltgerechte Entsorgung", unit: "m3", default_price: DEFAULT_PRICES.DISPOSAL_PER_M3, is_default_included: false, is_optional: true },
      { category: "reinigung", name: "Endreinigung alte Wohnung", description: "Mit Abnahmegarantie", unit: "Pauschal", default_price: DEFAULT_PRICES.END_CLEANING, is_default_included: false, is_optional: true },
    ]
  },
  reinigung_komplett: {
    name: "Komplett Reinigung",
    description: "Umfassende Reinigungsleistungen mit Abnahmegarantie",
    serviceType: "reinigung",
    icon: Droplets,
    color: "from-cyan-500 to-cyan-600",
    services: [
      { category: "reinigung", name: "Endreinigung mit Abnahmegarantie", description: "Garantierte Abnahme durch Vermieter", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Fensterreinigung innen und aussen", description: "Alle Fenster streifenfrei gereinigt", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Küche komplett", description: "Backofen, Kühlschrank, Schränke", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Badezimmer und WC", description: "Sanitäre Anlagen, Fliesen, Armaturen", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Böden (alle Räume)", description: "Staubsaugen, wischen, polieren", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Wände und Decken", description: "Entstaubung und Fleckenentfernung", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Storen und Rollläden", description: "Reinigung der Storen innen und aussen", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Einbauschränke", description: "Reinigung aller Schränke innen und aussen", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Teppichreinigung", description: "Professionelle Tiefenreinigung", unit: "m2", default_price: DEFAULT_PRICES.CARPET_CLEANING_PER_M2, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Balkon/Terrasse Hochdruckreinigung", description: "Mit Spezialgerät", unit: "Pauschal", default_price: DEFAULT_PRICES.BALCONY_CLEANING, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Keller/Estrich", description: "Zusätzliche Räume", unit: "Pauschal", default_price: DEFAULT_PRICES.CELLAR_CLEANING, is_default_included: false, is_optional: true },
    ]
  },
  raeumung_standard: {
    name: "Standard Räumung",
    description: "Komplette Haushalts- und Wohnungsräumung",
    serviceType: "raeumung",
    icon: Trash,
    color: "from-orange-500 to-orange-600",
    services: [
      { category: "transport", name: "Räumung aller Gegenstände", description: "Vollständige Räumung der Liegenschaft", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "personal", name: "Professionelles Räumungsteam", description: "Erfahrene Mitarbeiter für effiziente Arbeit", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Fachgerechte Entsorgung", description: "Umweltgerechte Entsorgung aller Materialien", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Sperrmüll-Entsorgung", description: "Entsorgung von Sperrgut und Möbeln", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Elektrogeräte-Entsorgung", description: "Fachgerechte Entsorgung von Elektronik", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Anfahrt und Abtransport", description: "Inklusive Transportkosten", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Wertgegenstände sichten", description: "Prüfung auf verwertbare Gegenstände", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Besenreine Übergabe", description: "Grobe Reinigung nach Räumung", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "reinigung", name: "Endreinigung", description: "Komplette Reinigung der Räumlichkeiten", unit: "Pauschal", default_price: DEFAULT_PRICES.ROOM_CLEARING_CLEANING, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Entrümpelung Keller/Estrich", description: "Zusätzliche Räume", unit: "Pauschal", default_price: DEFAULT_PRICES.CELLAR_CLEARING, is_default_included: false, is_optional: true },
    ]
  },
  entsorgung_standard: {
    name: "Standard Entsorgung",
    description: "Professionelle Entsorgungsleistungen",
    serviceType: "entsorgung",
    icon: Trash2,
    color: "from-red-500 to-red-600",
    services: [
      { category: "entsorgung", name: "Haushaltsabfall-Entsorgung", description: "Entsorgung von Haushaltsmüll", unit: "m3", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Sperrmüll-Entsorgung", description: "Möbel, Matratzen, grosse Gegenstände", unit: "m3", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Elektroschrott", description: "Fernseher, Computer, Haushaltsgeräte", unit: "Stück", default_price: 0, is_default_included: true },
      { category: "transport", name: "Abholung vor Ort", description: "Wir holen alles direkt bei Ihnen ab", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Container-Bereitstellung", description: "Falls benötigt", unit: "Tag", default_price: DEFAULT_PRICES.CONTAINER_PER_DAY, is_default_included: false, is_optional: true },
      { category: "personal", name: "Tragservice", description: "Wir tragen die Gegenstände zum Fahrzeug", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "entsorgung", name: "Sondermüll-Entsorgung", description: "Farben, Chemikalien, Batterien", unit: "kg", default_price: DEFAULT_PRICES.SPECIAL_WASTE_PER_KG, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Entsorgungsnachweis", description: "Dokumentation der fachgerechten Entsorgung", unit: "Inklusiv", default_price: 0, is_default_included: true },
    ]
  },
  lagerung_standard: {
    name: "Standard Lagerung",
    description: "Sichere Lagerlösungen für Ihre Gegenstände",
    serviceType: "lagerung",
    icon: Box,
    color: "from-purple-500 to-purple-600",
    services: [
      { category: "lagerung", name: "Lagerraum-Miete", description: "Trockener, sicherer Lagerraum", unit: "m3", default_price: DEFAULT_PRICES.STORAGE_PER_M3, is_default_included: true },
      { category: "versicherung", name: "Lagerversicherung", description: "Versicherungsschutz für eingelagerte Gegenstände", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "lagerung", name: "Klimatisierte Lagerung", description: "Temperatur- und feuchtigkeitskontrolliert", unit: "m3", default_price: DEFAULT_PRICES.CLIMATE_STORAGE_PER_M3, is_default_included: false, is_optional: true },
      { category: "transport", name: "Abholung und Einlagerung", description: "Transport zum Lager inklusive", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "transport", name: "Auslieferung nach Lagerung", description: "Transport vom Lager zu Ihnen", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "verpackung", name: "Verpackungsmaterial", description: "Kartons und Schutzmaterialien", unit: "Stück", default_price: 3.00, is_default_included: false, is_optional: true },
      { category: "lagerung", name: "24/7 Zugang", description: "Jederzeit Zugang zu Ihren Sachen", unit: "Inklusiv", default_price: 0, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Inventarliste", description: "Detaillierte Auflistung aller eingelagerten Gegenstände", unit: "Inklusiv", default_price: 0, is_default_included: true },
    ]
  },
  klaviertransport_standard: {
    name: "Standard Klaviertransport",
    description: "Professioneller Transport von Klavieren und Flügeln",
    serviceType: "klaviertransport",
    icon: Piano,
    color: "from-amber-500 to-amber-600",
    services: [
      { category: "transport", name: "Klaviertransport", description: "Sicherer Transport mit Spezialfahrzeug", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "personal", name: "Spezialisiertes Team", description: "Erfahrene Klaviertransporteure", unit: "Pauschal", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Spezialausrüstung", description: "Klavierroller, Gurte, Schutzdecken", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "verpackung", name: "Schutzverpackung", description: "Vollständiger Schutz des Instruments", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "versicherung", name: "Transportversicherung", description: "Voller Versicherungsschutz", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Anfahrt und Abfahrt", description: "Inklusive Transportweg", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Treppenhaus-Transport", description: "Spezialtechnik für enge Treppenhäuser", unit: "Stockwerk", default_price: DEFAULT_PRICES.PIANO_STAIRS_PER_FLOOR, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Kranservice", description: "Für Flügel oder schwer zugängliche Orte", unit: "Pauschal", default_price: DEFAULT_PRICES.PIANO_CRANE, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Stimmen nach Transport", description: "Empfohlen nach jedem Transport", unit: "Pauschal", default_price: DEFAULT_PRICES.PIANO_TUNING, is_default_included: false, is_optional: true },
    ]
  },
  moebellift_standard: {
    name: "Standard Möbellift",
    description: "Möbellift-Service für grosse und schwere Gegenstände",
    serviceType: "moebellift",
    icon: ArrowUpDown,
    color: "from-green-500 to-green-600",
    services: [
      { category: "transport", name: "Möbellift-Miete", description: "Professioneller Möbellift mit Bedienpersonal", unit: "Stunde", default_price: 0, is_default_included: true },
      { category: "personal", name: "Bedienung durch Fachpersonal", description: "Erfahrene Möbellift-Spezialisten", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Anlieferung und Abholung", description: "Transport des Möbellifts", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Aufbau und Abbau", description: "Fachgerechte Installation", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "versicherung", name: "Haftpflichtversicherung", description: "Versicherungsschutz inklusive", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Maximale Höhe 25m", description: "Bis zum 8. Stockwerk", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "transport", name: "Tragkraft bis 400kg", description: "Für schwere Möbelstücke geeignet", unit: "Inklusiv", default_price: 0, is_default_included: true },
      { category: "spezial", name: "Zusätzliche Stunden", description: "Bei längeren Einsätzen", unit: "Stunde", default_price: DEFAULT_PRICES.LIFT_EXTRA_HOUR, is_default_included: false, is_optional: true },
      { category: "spezial", name: "Wochenend-Zuschlag", description: "Samstag und Sonntag", unit: "Pauschal", default_price: DEFAULT_PRICES.WEEKEND_SURCHARGE, is_default_included: false, is_optional: true },
    ]
  },
};

/**
 * Service types the domain vocabulary (`domain.service.*`) does not carry. Everything else
 * resolves through `getServiceLabel`, so the same label is used on the dashboard, in PDFs
 * and in e-mails.
 */
const CATALOG_SERVICE_TYPE_KEYS: Record<string, MessageKey> = {
  usm_transport: "catalog.serviceType.usmTransport",
  wasserbett_transport: "catalog.serviceType.wasserbettTransport",
};

const CATEGORY_KEYS: Record<string, MessageKey> = {
  transport: "catalog.category.transport",
  personal: "catalog.category.personal",
  verpackung: "catalog.category.verpackung",
  entsorgung: "catalog.category.entsorgung",
  reinigung: "catalog.category.reinigung",
  versicherung: "catalog.category.versicherung",
  lagerung: "catalog.category.lagerung",
  spezial: "catalog.category.spezial",
};

const UNIT_KEYS: Record<string, MessageKey> = {
  Pauschal: "catalog.unit.pauschal",
  Stunde: "catalog.unit.stunde",
  m3: "catalog.unit.m3",
  m2: "catalog.unit.m2",
  Zimmer: "catalog.unit.zimmer",
  Stück: "catalog.unit.stueck",
  kg: "catalog.unit.kg",
  km: "catalog.unit.km",
  Tag: "catalog.unit.tag",
  Inklusiv: "catalog.unit.inklusiv",
  Stockwerk: "catalog.unit.stockwerk",
};

const PACKAGE_NAME_KEYS: Record<string, MessageKey> = {
  umzug_standard: "catalog.package.umzug_standard.name",
  reinigung_komplett: "catalog.package.reinigung_komplett.name",
  raeumung_standard: "catalog.package.raeumung_standard.name",
  entsorgung_standard: "catalog.package.entsorgung_standard.name",
  lagerung_standard: "catalog.package.lagerung_standard.name",
  klaviertransport_standard: "catalog.package.klaviertransport_standard.name",
  moebellift_standard: "catalog.package.moebellift_standard.name",
};

const PACKAGE_DESCRIPTION_KEYS: Record<string, MessageKey> = {
  umzug_standard: "catalog.package.umzug_standard.description",
  reinigung_komplett: "catalog.package.reinigung_komplett.description",
  raeumung_standard: "catalog.package.raeumung_standard.description",
  entsorgung_standard: "catalog.package.entsorgung_standard.description",
  lagerung_standard: "catalog.package.lagerung_standard.description",
  klaviertransport_standard: "catalog.package.klaviertransport_standard.description",
  moebellift_standard: "catalog.package.moebellift_standard.description",
};

/**
 * Helper function to get service type config (icon + color, no label)
 */
export function getServiceTypeConfig(typeValue: string): ServiceType {
  return SERVICE_TYPES.find(t => t.value === typeValue) || SERVICE_TYPES[0];
}

/**
 * Helper function to get category icon
 */
export function getCategoryIcon(categoryValue: string): Icon {
  return CATEGORIES.find(c => c.value === categoryValue)?.icon || Package;
}

/** "Umzug" · "Déménagement" · "Removal" — falls back to the raw value for unknown types. */
export function getServiceTypeLabel(typeValue: string, locale: Locale): string {
  const key = CATALOG_SERVICE_TYPE_KEYS[typeValue];
  return key ? createTranslator(locale)(key) : getServiceLabel(typeValue, locale);
}

/** "Verpackung" · "Emballage" · "Packing" */
export function getCategoryLabel(categoryValue: string, locale: Locale): string {
  const key = CATEGORY_KEYS[categoryValue];
  return key ? createTranslator(locale)(key) : categoryValue;
}

/** "pro Stunde" · "par heure" · "per hour" */
export function getUnitLabel(unitValue: string, locale: Locale): string {
  const key = UNIT_KEYS[unitValue];
  return key ? createTranslator(locale)(key) : unitValue;
}

/** Display name of a predefined package. */
export function getPackageName(packageKey: string, locale: Locale): string {
  const key = PACKAGE_NAME_KEYS[packageKey];
  return key ? createTranslator(locale)(key) : packageKey;
}

/** Display description of a predefined package. */
export function getPackageDescription(packageKey: string, locale: Locale): string {
  const key = PACKAGE_DESCRIPTION_KEYS[packageKey];
  return key ? createTranslator(locale)(key) : "";
}
