import type { de } from "@/i18n/catalog/de";
import { common } from "@/i18n/catalog/fr/common";
import { domain } from "@/i18n/catalog/fr/domain";
import { document } from "@/i18n/catalog/fr/document";
import { publicPages } from "@/i18n/catalog/fr/publicPages";
import { nav } from "@/i18n/catalog/fr/nav";
import { settings } from "@/i18n/catalog/fr/settings";
import { offer } from "@/i18n/catalog/fr/offer";
import { lead } from "@/i18n/catalog/fr/lead";
import { auftrag } from "@/i18n/catalog/fr/auftrag";
import { invoice } from "@/i18n/catalog/fr/invoice";
import { calendar } from "@/i18n/catalog/fr/calendar";
import { catalog } from "@/i18n/catalog/fr/catalog";
import { misc } from "@/i18n/catalog/fr/misc";
import { inventory } from "@/i18n/catalog/fr/inventory";

export const fr: Record<keyof typeof de, string> = {
  ...common,
  ...domain,
  ...document,
  ...publicPages,
  ...nav,
  ...settings,
  ...offer,
  ...lead,
  ...auftrag,
  ...invoice,
  ...calendar,
  ...catalog,
  ...misc,
  ...inventory,
};
