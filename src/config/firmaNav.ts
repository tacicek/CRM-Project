/**
 * The sidebar navigation of the CRM shell, as data.
 *
 * Extracted out of `FirmaLayout` for two reasons:
 *
 *  1. The Wiki validator has to prove that every visible CRM section has a help
 *     article. A duplicated list inside a 650-line component would drift silently;
 *     importing the real one cannot.
 *  2. `FirmaLayout` only decorates these entries with live badge counts. Keeping the
 *     static shape here leaves the component with rendering, not with data.
 *
 * Icons are typed `LucideIcon` components, never emoji: the sidebar sits next to
 * "Hilfe & Anleitung", whose icon has to be a real icon, and a single list may not mix
 * the two. The header page-title icon reads from the same entries, so a nav item and
 * its header title can never disagree.
 */
import {
  Archive,
  BellRing,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Eye,
  FileText,
  Hammer,
  Home,
  Inbox,
  ListChecks,
  Mail,
  MessagesSquare,
  Package,
  ReceiptText,
  Settings,
  Tag,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/config/modules";
import type { MessageKey } from "@/i18n/translator";

export type FirmaNavItem = {
  /** Catalog key — the label is resolved in the operator's dashboard locale at render time. */
  titleKey: MessageKey;
  url: string;
  icon: LucideIcon;
  /**
   * `null` means the entry has no feature flag and can never be hidden. Only "Hilfe &
   * Anleitung" uses it: help must stay reachable even when every other module is off,
   * and inventing a `MODULES.wiki` flag that must never be `false` would make
   * `modules.ts` dishonest.
   */
  moduleKey: ModuleKey | null;
  /**
   * Sichtbar in der Tab-Leiste der Mobilansicht. Genau vier Eintraege tragen
   * das Feld; der fuenfte Platz gehoert "Mehr".
   *
   * Ausdrueckliches Feld statt "die ersten vier Schnellzugriffe": ein
   * Umsortieren der Seitenleiste soll die Tab-Leiste nicht still veraendern.
   * Die Auswahl liest `@/lib/mobileNav`, nicht eine zweite Liste von Hand —
   * eine solche liefe auseinander und umginge die MODULES-Flags.
   */
  mobileTab?: boolean;
};

export type FirmaNavGroup = {
  id: string;
  labelKey: MessageKey;
  items: readonly FirmaNavItem[];
};

/** Pinned above the groups: the entries an operator opens many times a day. */
export const FIRMA_QUICK_LINKS: readonly FirmaNavItem[] = [
  { titleKey: "nav.overview", url: "/firma", icon: Home, moduleKey: "reports", mobileTab: true },
  { titleKey: "nav.anfragen", url: "/firma/anfragen", icon: Inbox, moduleKey: "manualImport", mobileTab: true },
  // Kein mobileTab: die Tab-Leiste hat vier Plaetze, und der E-Mail-Eingang
  // wird seltener geoeffnet als die uebrigen vier. Ueber das Mehr-Sheet
  // bleibt er erreichbar.
  { titleKey: "nav.emailImport", url: "/firma/email-import", icon: Mail, moduleKey: "inboundEmail" },
  // Offerten steht hier oben statt im Hauptbereich: es ist der meistbenutzte
  // Punkt der Seitenleiste und lag dort an siebter Stelle.
  { titleKey: "nav.offerten", url: "/firma/offerten", icon: FileText, moduleKey: "offers", mobileTab: true },
  { titleKey: "nav.kalender", url: "/firma/kalender", icon: CalendarDays, moduleKey: "calendar", mobileTab: true },
] as const;

export const FIRMA_NAV_GROUPS: readonly FirmaNavGroup[] = [
  {
    id: "hauptbereich",
    labelKey: "nav.group.hauptbereich",
    items: [
      { titleKey: "nav.kunden", url: "/firma/kunden", icon: Users, moduleKey: "contacts" },
      { titleKey: "nav.aufgaben", url: "/firma/aufgaben", icon: BellRing, moduleKey: "leads" },
      { titleKey: "nav.finanzen", url: "/firma/finanzen", icon: Wallet, moduleKey: "invoices" },
      { titleKey: "nav.faelle", url: "/firma/faelle", icon: Wrench, moduleKey: "orders" },
      { titleKey: "nav.posteingang", url: "/firma/posteingang", icon: MessagesSquare, moduleKey: "leads" },
      { titleKey: "nav.kennzahlen", url: "/firma/kennzahlen", icon: TrendingUp, moduleKey: "leads" },
      { titleKey: "nav.auftraege", url: "/firma/auftraege", icon: ClipboardCheck, moduleKey: "orders" },
      { titleKey: "nav.quittungen", url: "/firma/quittungen", icon: ReceiptText, moduleKey: "receipts" },
      { titleKey: "nav.rechnungen", url: "/firma/rechnungen", icon: CreditCard, moduleKey: "invoices" },
    ],
  },
  {
    id: "betrieb",
    labelKey: "nav.group.betrieb",
    items: [
      { titleKey: "nav.besichtigungen", url: "/firma/besichtigungen", icon: Eye, moduleKey: "inspections" },
      { titleKey: "nav.umzugsboxen", url: "/firma/umzugsboxen", icon: Package, moduleKey: "movingBoxes" },
      { titleKey: "nav.team", url: "/firma/team", icon: UsersRound, moduleKey: "team" },
      { titleKey: "nav.checkliste", url: "/firma/checkliste", icon: ListChecks, moduleKey: "checklist" },
    ],
  },
  {
    id: "verwaltung",
    labelKey: "nav.group.verwaltung",
    items: [
      { titleKey: "nav.leistungskatalog", url: "/firma/leistungskatalog", icon: Hammer, moduleKey: "serviceCatalog" },
      { titleKey: "nav.preisgestaltung", url: "/firma/preisgestaltung", icon: Tag, moduleKey: "pricing" },
      { titleKey: "nav.archiv", url: "/firma/datenarchiv", icon: Archive, moduleKey: "archive" },
      { titleKey: "nav.einstellungen", url: "/firma/einstellungen", icon: Settings, moduleKey: "settings" },
      { titleKey: "nav.hilfe", url: "/firma/hilfe", icon: CircleHelp, moduleKey: null },
    ],
  },
] as const;

/**
 * Every navigable entry, quick links first, in sidebar order.
 *
 * Used by the header page-title lookup and by the Wiki coverage validator. It is
 * deliberately *unfiltered*: a module flag hides a sidebar link but leaves the route
 * reachable by URL, so the header must still be able to name the page, and the Wiki
 * must still document it.
 */
export const FIRMA_NAV_ITEMS: readonly FirmaNavItem[] = [
  ...FIRMA_QUICK_LINKS,
  ...FIRMA_NAV_GROUPS.flatMap((group) => group.items),
] as const;

/** The default header icon when the current path matches no nav entry. */
export const FIRMA_FALLBACK_ICON: LucideIcon = Home;
