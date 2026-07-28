import type { LucideIcon } from "lucide-react";
import type { FirmaNavGroup, FirmaNavItem } from "@/config/firmaNav";
import type { MessageKey } from "@/i18n/translator";

export type SearchTarget = {
  url: string;
  titleKey: MessageKey;
  icon: LucideIcon;
};

const isVisible = (item: FirmaNavItem, modules: Record<string, boolean>) =>
  item.moduleKey === null || modules[item.moduleKey] === true;

/**
 * Alle erreichbaren Ziele, ohne Dubletten.
 *
 * Schnellzugriffe und Gruppen überschneiden sich nicht vollständig, können es
 * aber — deshalb wird über die URL entdoppelt, statt sich auf die Pflege der
 * Konfiguration zu verlassen.
 */
export const buildNavTargets = (
  groups: readonly FirmaNavGroup[],
  quickLinks: readonly FirmaNavItem[],
  modules: Record<string, boolean>,
): SearchTarget[] => {
  const seen = new Set<string>();

  return [...quickLinks, ...groups.flatMap((group) => group.items)]
    .filter((item) => isVisible(item, modules))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => ({ url: item.url, titleKey: item.titleKey, icon: item.icon }));
};

/**
 * `translate` wird hereingereicht statt importiert: die Funktion bleibt rein,
 * und dieselbe Suche findet in jeder Dashboard-Sprache die passenden Treffer —
 * gesucht wird über die angezeigte Beschriftung, nicht über den Schlüssel.
 */
export const filterTargets = (
  targets: readonly SearchTarget[],
  query: string,
  translate: (key: string) => string,
): SearchTarget[] => {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...targets];
  return targets.filter((target) => translate(target.titleKey).toLowerCase().includes(needle));
};
