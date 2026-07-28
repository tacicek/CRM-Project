/**
 * The icons the Wiki is allowed to use, as an explicit typed registry.
 *
 * Explicit rather than `lucide-react`'s dynamic-import map for two reasons: a bundler
 * cannot tree-shake an icon chosen by arbitrary string at runtime, and a typo in an
 * article would become a blank space at runtime instead of a compile error.
 *
 * Where the real CRM screen already has an icon, the article reuses it, so the picture
 * in the reader's head matches the picture on screen.
 */
import {
  Archive,
  BellRing,
  BookOpen,
  CalendarDays,
  CircleAlert,
  CircleHelp,
  ClipboardCheck,
  Compass,
  CreditCard,
  Eye,
  FileText,
  Hammer,
  Home,
  Inbox,
  Info,
  Languages,
  LifeBuoy,
  ListChecks,
  LogIn,
  Mail,
  MessagesSquare,
  Package,
  Printer,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  TrendingUp,
  TriangleAlert,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";

export const WIKI_ICONS = {
  // Sections — deliberately the same icons the sidebar uses.
  home: Home,
  inbox: Inbox,
  mail: Mail,
  offer: FileText,
  calendar: CalendarDays,
  customers: Users,
  tasks: BellRing,
  finance: Wallet,
  cases: Wrench,
  threads: MessagesSquare,
  kpi: TrendingUp,
  orders: ClipboardCheck,
  receipts: ReceiptText,
  invoices: CreditCard,
  inspections: Eye,
  boxes: Package,
  team: UsersRound,
  checklist: ListChecks,
  catalog: Hammer,
  pricing: Tag,
  archive: Archive,
  settings: Settings,

  // Wiki chrome and article furniture.
  help: CircleHelp,
  guide: BookOpen,
  start: Compass,
  signIn: LogIn,
  language: Languages,
  search: Search,
  print: Printer,
  zoom: ZoomIn,
  tip: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  permission: ShieldCheck,
  support: LifeBuoy,
} as const satisfies Record<string, LucideIcon>;

export type WikiIconKey = keyof typeof WIKI_ICONS;

export const WIKI_ICON_KEYS = Object.keys(WIKI_ICONS) as readonly WikiIconKey[];

/** Resolve an icon key to its component. Total by construction — no runtime fallback. */
export const wikiIcon = (key: WikiIconKey): LucideIcon => WIKI_ICONS[key];

/** The icon a callout of each tone renders. Paired with a word, never colour alone. */
export const CALLOUT_ICON = {
  tip: WIKI_ICONS.tip,
  warning: WIKI_ICONS.warning,
  danger: WIKI_ICONS.danger,
  permission: WIKI_ICONS.permission,
} as const satisfies Record<string, LucideIcon>;
