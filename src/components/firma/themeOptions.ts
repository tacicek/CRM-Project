import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/translator";
import type { ThemePreference } from "@/lib/theme";

export type ThemeOption = {
  value: ThemePreference;
  icon: LucideIcon;
  labelKey: MessageKey;
};

/**
 * Die drei Wahlmöglichkeiten des Erscheinungsbilds — nur Daten.
 *
 * Getrennt von der Darstellung, weil der Umschalter an zwei Stellen mit
 * unterschiedlicher Auszeichnung erscheint: als `DropdownMenuItem` im
 * Aufklappmenü der Kopfleiste und als Sheet-Zeile im Mehr-Sheet der
 * Mobilansicht. Radix' Menüeinträge verlangen den Kontext ihres Menüs und
 * werfen ausserhalb — eine gemeinsame Komponente ginge also nicht, eine
 * zweite Liste liefe auseinander.
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: "light", icon: Sun, labelKey: "nav.theme.light" },
  { value: "dark", icon: Moon, labelKey: "nav.theme.dark" },
  { value: "system", icon: Monitor, labelKey: "nav.theme.system" },
];
