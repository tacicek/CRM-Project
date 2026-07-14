import type { de } from "@/i18n/catalog/de";
import { common } from "@/i18n/catalog/en/common";
import { domain } from "@/i18n/catalog/en/domain";
import { document } from "@/i18n/catalog/en/document";
import { publicPages } from "@/i18n/catalog/en/publicPages";
import { nav } from "@/i18n/catalog/en/nav";
import { settings } from "@/i18n/catalog/en/settings";
import { offer } from "@/i18n/catalog/en/offer";
import { lead } from "@/i18n/catalog/en/lead";
import { auftrag } from "@/i18n/catalog/en/auftrag";
import { invoice } from "@/i18n/catalog/en/invoice";
import { calendar } from "@/i18n/catalog/en/calendar";
import { catalog } from "@/i18n/catalog/en/catalog";
import { misc } from "@/i18n/catalog/en/misc";
import { inventory } from "@/i18n/catalog/en/inventory";

export const en: Record<keyof typeof de, string> = {
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
