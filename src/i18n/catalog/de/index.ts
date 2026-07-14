/**
 * German is the SOURCE OF TRUTH for the key set.
 *
 * `fr` and `en` are typed as `Record<keyof typeof de, string>`, so a key added here
 * and forgotten there is a compile error — not a German string that silently shows
 * up in a French offer.
 *
 * Namespaces are separate files so that translation work can proceed in parallel
 * without contending on one giant module.
 */
import { common } from "@/i18n/catalog/de/common";
import { domain } from "@/i18n/catalog/de/domain";
import { document } from "@/i18n/catalog/de/document";
import { publicPages } from "@/i18n/catalog/de/publicPages";
import { nav } from "@/i18n/catalog/de/nav";
import { settings } from "@/i18n/catalog/de/settings";
import { offer } from "@/i18n/catalog/de/offer";
import { lead } from "@/i18n/catalog/de/lead";
import { auftrag } from "@/i18n/catalog/de/auftrag";
import { invoice } from "@/i18n/catalog/de/invoice";
import { calendar } from "@/i18n/catalog/de/calendar";
import { catalog } from "@/i18n/catalog/de/catalog";
import { misc } from "@/i18n/catalog/de/misc";
import { inventory } from "@/i18n/catalog/de/inventory";

export const de = {
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
