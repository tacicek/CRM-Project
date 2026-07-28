import { MoreHorizontal } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { FIRMA_QUICK_LINKS } from "@/config/firmaNav";
import { MODULES } from "@/config/modules";
import { useT } from "@/i18n/useI18n";
import { findActiveTabUrl, selectTabItems } from "@/lib/mobileNav";

/**
 * Die Tab-Leiste der Mobilansicht: vier Ziele aus der Konfiguration, der
 * fünfte Platz öffnet das Mehr-Sheet.
 *
 * Drei Punkte, die hier nicht kosmetisch sind:
 *
 *  - `shell-tablet:hidden` statt `md:hidden` — `md` sind 768px, die Shell
 *    schaltet aber bei 820px, so wie `useBreakpoint`. Mit `md` widersprächen
 *    sich Darstellung und Verhalten zwischen 768 und 820px.
 *  - Die Spaltenzahl folgt der tatsächlichen Anzahl. Ein abgeschaltetes Modul
 *    entfernt seinen Tab; eine feste `grid-cols-5` liesse eine Lücke.
 *  - Der untere Innenabstand rechnet `env(safe-area-inset-bottom)` ein, sonst
 *    liegt die Leiste auf iPhones unter dem Home-Indikator.
 */
export const BottomTabBar = ({ onOpenMore }: { onOpenMore: () => void }) => {
  const t = useT();
  const { pathname } = useLocation();

  const items = selectTabItems(FIRMA_QUICK_LINKS, MODULES);
  const activeUrl = findActiveTabUrl(
    pathname,
    items.map((item) => item.url),
  );

  return (
    <nav
      aria-label={t("nav.mobile.tabbar")}
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-folk-line bg-folk-bg/95 backdrop-blur shell-tablet:hidden print:hidden"
      style={{
        gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))`,
        paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
      }}
    >
      {items.map((item) => {
        const active = item.url === activeUrl;
        return (
          <NavLink
            key={item.url}
            to={item.url}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-1 pt-2 text-[9.5px] ${
              active ? "font-bold text-folk-ink" : "font-medium text-folk-ink4"
            }`}
          >
            <item.icon
              className="h-[18px] w-[18px]"
              strokeWidth={active ? 2.2 : 1.8}
              aria-hidden="true"
            />
            <span className="truncate px-0.5">{t(item.titleKey)}</span>
          </NavLink>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        aria-label={t("nav.mobile.openMore")}
        className="flex min-h-[44px] flex-col items-center justify-center gap-1 pt-2 text-[9.5px] font-medium text-folk-ink4"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        <span>{t("nav.mobile.more")}</span>
      </button>
    </nav>
  );
};
