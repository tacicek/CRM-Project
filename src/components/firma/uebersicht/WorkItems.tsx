import {
  Building2,
  Home,
  Package,
  Paintbrush,
  Piano,
  Sparkles,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatAmount } from "@/i18n/format";
import { getServiceLabel } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/translator";
import type { WorkItem, WorkItemStatus } from "@/types/uebersicht";

export type WorkItemsVariant = "grid" | "list";

type StatusLook = {
  /** Farbe des Punktes und der Pille. */
  dot: string;
  pill: string;
  labelKey: MessageKey;
  actionKey: MessageKey;
  /** Nur `neu` bekommt die gefüllte Hauptaktion — alles andere ist Nacharbeit. */
  filled: boolean;
};

const LOOK: Record<WorkItemStatus, StatusLook> = {
  neu: {
    dot: "bg-folk-coral",
    pill: "bg-folk-coral-bg text-folk-coral",
    labelKey: "uebersicht.status.neu",
    actionKey: "uebersicht.action.offerteErstellen",
    filled: true,
  },
  offeriert: {
    dot: "bg-folk-mint",
    pill: "bg-folk-mint-bg text-folk-mint",
    labelKey: "uebersicht.status.offeriert",
    actionKey: "uebersicht.action.nachfassen",
    filled: false,
  },
  ueberfaellig: {
    dot: "bg-folk-lemon",
    pill: "bg-folk-lemon-bg text-folk-lemon",
    labelKey: "uebersicht.status.ueberfaellig",
    actionKey: "uebersicht.action.nachfassen",
    filled: false,
  },
  abgelehnt: {
    dot: "bg-folk-ink4",
    pill: "bg-folk-bg-warm text-folk-ink3",
    labelKey: "uebersicht.status.abgelehnt",
    actionKey: "uebersicht.action.oeffnen",
    filled: false,
  },
  gewonnen: {
    dot: "bg-folk-mint",
    pill: "bg-folk-mint-bg text-folk-mint",
    labelKey: "uebersicht.status.gewonnen",
    actionKey: "uebersicht.action.planen",
    filled: false,
  },
};

/**
 * Icons statt Emoji: `firmaNav.ts` hält fest, dass in dieser Oberfläche keine
 * Emoji als Bedeutungsträger stehen, und eine Liste darf beides nicht mischen.
 */
const SERVICE_ICON: Record<string, LucideIcon> = {
  privatumzug: Home,
  firmenumzug: Building2,
  reinigung: Sparkles,
  entsorgung: Package,
  raeumung: Package,
  klaviertransport: Piano,
  moebellift: Truck,
  lagerung: Warehouse,
  malerarbeit: Paintbrush,
};

const iconFor = (serviceType: string | null): LucideIcon =>
  SERVICE_ICON[(serviceType ?? "").toLowerCase()] ?? Truck;

const Dot = ({ status }: { status: WorkItemStatus }) => (
  <span
    className={`h-[7px] w-[7px] shrink-0 rounded-full ${LOOK[status].dot}`}
    aria-hidden="true"
  />
);

/**
 * Ein Vorgang.
 *
 * Layout über CSS, nicht über JS: unter 820px eine gestapelte Karte mit einer
 * vollbreiten Hauptaktion, darüber die Rasterkarte. Würde die Anordnung an
 * einem Breakpoint-Hook hängen, flackerte sie beim ersten Render und bräche
 * beim Vorab-Rendern, wo es kein `window` gibt.
 *
 * Der Status steht **nie allein in der Farbe** — jeder Punkt trägt daneben
 * seinen Text.
 */
const Card = ({ item, onOpen, onAct }: { item: WorkItem; onOpen: () => void; onAct: () => void }) => {
  const t = useT();
  const { locale } = useI18n();
  const look = LOOK[item.status];
  const Icon = iconFor(item.serviceType);

  const statusText =
    item.status === "ueberfaellig" && item.daysOpen !== null
      ? t(look.labelKey, { days: String(item.daysOpen) })
      : t(look.labelKey);

  return (
    <div className="rounded-2xl border border-folk-line bg-folk-card p-4 transition-colors shell-tablet:rounded-xl shell-tablet:p-5 [@media(hover:hover)]:hover:border-folk-line-hard">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-folk-mint-bg shell-tablet:h-[34px] shell-tablet:w-[34px]">
          <Icon className="h-4 w-4 text-folk-mint" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-folk-ink shell-tablet:text-[13.5px]">
            {getServiceLabel(item.serviceType, locale)}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-folk-ink4">
            {[item.from, item.to].filter(Boolean).join(" → ")}
            {item.amountChf !== null && ` · CHF ${formatAmount(item.amountChf, locale)}`}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${look.pill}`}>
          {t(`uebersicht.filter.${item.status === "ueberfaellig" ? "offeriert" : item.status}` as MessageKey)}
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-folk-ink3">
        <Dot status={item.status} />
        <span className="truncate">{statusText}</span>
      </div>

      <button
        type="button"
        onClick={onAct}
        className={`mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl text-[13.5px] font-semibold transition-colors shell-tablet:min-h-0 shell-tablet:w-auto shell-tablet:rounded-lg shell-tablet:px-3 shell-tablet:py-1.5 shell-tablet:text-[12px] ${
          look.filled
            ? "bg-folk-mint text-folk-bg"
            : "border border-folk-line text-folk-ink2"
        }`}
      >
        {t(look.actionKey)}
      </button>
    </div>
  );
};

/** Eine Zeile der Statusliste — dieselben Daten, dichtere Auszeichnung. */
const Row = ({ item, onOpen, onAct }: { item: WorkItem; onOpen: () => void; onAct: () => void }) => {
  const t = useT();
  const { locale } = useI18n();
  const look = LOOK[item.status];

  const statusText =
    item.status === "ueberfaellig" && item.daysOpen !== null
      ? t(look.labelKey, { days: String(item.daysOpen) })
      : t(look.labelKey);

  return (
    <div className="flex items-center gap-3 border-b border-folk-line px-4 py-3.5 last:border-b-0 [@media(hover:hover)]:hover:bg-folk-bg-warm">
      <Dot status={item.status} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13.5px] font-semibold text-folk-ink">
          {getServiceLabel(item.serviceType, locale)}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10.5px] lowercase text-folk-ink4">
          {[item.from, item.to].filter(Boolean).join(" → ")}
          {item.amountChf !== null && ` · chf ${formatAmount(item.amountChf, locale)}`}
        </span>
      </button>
      <span className="hidden shrink-0 text-[12px] text-folk-ink3 shell-tablet:block">
        {statusText}
      </span>
      <button
        type="button"
        onClick={onAct}
        className="shrink-0 rounded-lg border border-folk-line px-3 py-2 text-[11px] font-semibold text-folk-ink2"
      >
        {t(look.actionKey)}
      </button>
    </div>
  );
};

/**
 * Die Vorgänge.
 *
 * `variant` kommt vom Theme (hell → Raster, dunkel → Liste) und bleibt trotzdem
 * eine Prop: so lässt sich die Kopplung später lösen, ohne die Komponente
 * umzubauen.
 */
export const WorkItems = ({
  items,
  variant,
}: {
  items: readonly WorkItem[];
  variant: WorkItemsVariant;
}) => {
  const navigate = useNavigate();

  const open = (item: WorkItem) => navigate(`/firma/anfragen?lead=${item.leadId}`);
  const act = (item: WorkItem) =>
    item.status === "neu"
      ? navigate(`/firma/offerte-erstellen?lead=${item.leadId}`)
      : navigate(`/firma/anfragen?lead=${item.leadId}`);

  if (variant === "list") {
    return (
      <div className="overflow-hidden rounded-2xl border border-folk-line bg-folk-card shell-tablet:rounded-xl">
        {items.map((item) => (
          <Row key={item.id} item={item} onOpen={() => open(item)} onAct={() => act(item)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 shell-tablet:grid-cols-2 shell-tablet:gap-3.5 shell-desktop:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id} item={item} onOpen={() => open(item)} onAct={() => act(item)} />
      ))}
    </div>
  );
};
