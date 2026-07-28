import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { THEME_OPTIONS } from "@/components/firma/themeOptions";
import { FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, type FirmaNavItem } from "@/config/firmaNav";
import { MODULES } from "@/config/modules";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

const isVisible = (item: FirmaNavItem) => item.moduleKey === null || MODULES[item.moduleKey];

/**
 * Schnellzugriffe ohne eigenen Tab. Ohne diese Zeile wäre der E-Mail-Eingang
 * auf dem Telefon unerreichbar: er steht in den Schnellzugriffen, nicht in den
 * Gruppen, und trägt bewusst kein `mobileTab`.
 */
const untabbedQuickLinks = FIRMA_QUICK_LINKS.filter(
  (item) => item.mobileTab !== true && isVisible(item),
);

const NavRow = ({ item, onNavigate }: { item: FirmaNavItem; onNavigate: () => void }) => {
  const t = useT();
  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      className="flex min-h-[48px] items-center gap-3 border-b border-folk-line-soft px-3.5 text-[13.5px] text-folk-ink2 last:border-b-0 active:bg-folk-bg-warm"
    >
      <item.icon
        className="h-4 w-4 shrink-0 text-folk-ink3"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{t(item.titleKey)}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-folk-ink4" aria-hidden="true" />
    </Link>
  );
};

const Group = ({
  labelKey,
  items,
  onNavigate,
}: {
  labelKey: MessageKey;
  items: readonly FirmaNavItem[];
  onNavigate: () => void;
}) => {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <section className="mb-4">
      <h3 className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-folk-ink4">
        {t(labelKey)}
      </h3>
      <div className="overflow-hidden rounded-xl border border-folk-line bg-folk-card">
        {items.map((item) => (
          <NavRow key={item.url} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
};

/** Der Theme-Umschalter als Sheet-Zeilen — dieselben Daten wie im Aufklappmenü. */
const ThemeRows = () => {
  const { theme, setTheme } = useTheme();
  const t = useT();
  return (
    <section className="mb-4">
      <h3 className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-folk-ink4">
        {t("nav.theme.label")}
      </h3>
      <div className="overflow-hidden rounded-xl border border-folk-line bg-folk-card">
        {THEME_OPTIONS.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className="flex min-h-[48px] w-full items-center gap-3 border-b border-folk-line-soft px-3.5 text-left text-[13.5px] text-folk-ink2 last:border-b-0 active:bg-folk-bg-warm"
            >
              <option.icon
                className={`h-4 w-4 shrink-0 ${active ? "text-folk-mint" : "text-folk-ink3"}`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="flex-1">{t(option.labelKey)}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-folk-mint" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
};

/**
 * Die vollständige Navigation als Bottom-Sheet.
 *
 * Der Inhalt kommt aus `firmaNav.ts`, nicht aus einer zweiten Liste: der
 * Wiki-Validator liest dieselbe Datei, und die MODULES-Flags müssen greifen.
 *
 * `DrawerContent` bringt `mt-24` und den Ziehgriff bereits mit — das Sheet
 * bedeckt nie den ganzen Bildschirm, der abgedunkelte Streifen oben bleibt
 * sichtbar. Deshalb wird hier nichts an der Höhe geschraubt; nur der
 * Innenbereich scrollt, mit `overscroll-contain`, damit die Seite darunter
 * still bleibt.
 */
export const MoreSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useT();
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-folk-line bg-folk-bg shell-tablet:hidden">
        <DrawerTitle className="sr-only">{t("nav.menu")}</DrawerTitle>
        <div className="max-h-[70dvh] overflow-y-auto overscroll-contain px-3 pb-8 pt-4">
          <Group
            labelKey="nav.mobile.quickAccess"
            items={untabbedQuickLinks}
            onNavigate={close}
          />
          {FIRMA_NAV_GROUPS.map((group) => (
            <Group
              key={group.id}
              labelKey={group.labelKey}
              items={group.items.filter(isVisible)}
              onNavigate={close}
            />
          ))}
          <ThemeRows />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
