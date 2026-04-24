/**
 * Feature flag file for the standalone CRM.
 * Set a flag to `false` to hide the corresponding sidebar nav item.
 * No other logic is affected — this is purely show/hide for navigation.
 */
export const MODULES = {
  leads: true,
  offers: true,
  contacts: true,
  reports: true,       // set false to hide dashboard stats
  calendar: true,
  team: true,
  checklist: true,
  serviceCatalog: true,
  pricing: true,
  orders: true,        // Aufträge
  inspections: true,   // Besichtigungen
  movingBoxes: true,   // Umzugsboxen
  receipts: true,      // Quittungen
  manualImport: true,
  archive: true,
  settings: true,
  integrations: false, // not yet implemented
} as const;

export type ModuleKey = keyof typeof MODULES;
