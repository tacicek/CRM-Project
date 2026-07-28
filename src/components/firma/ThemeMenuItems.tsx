import { Monitor, Moon, Sun } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/i18n/useI18n";
import type { ThemePreference } from "@/lib/theme";
import type { MessageKey } from "@/i18n/translator";

type Option = {
  value: ThemePreference;
  icon: typeof Sun;
  labelKey: MessageKey;
};

const OPTIONS: readonly Option[] = [
  { value: "light", icon: Sun, labelKey: "nav.theme.light" },
  { value: "dark", icon: Moon, labelKey: "nav.theme.dark" },
  { value: "system", icon: Monitor, labelKey: "nav.theme.system" },
];

/**
 * Der Theme-Umschalter als Menüblock.
 *
 * Eigene Datei, weil der Kopfbereich von FirmaLayout zwei sich ausschliessende
 * Aufklappmenüs hat — eines für den Firmenwechsel, eines für das Profil. Nur
 * eines wird gerendert. Läge der Umschalter nur im Profilmenü, käme ein
 * Benutzer mit Zugriff auf mehrere Firmen nie an ihn heran.
 *
 * Wird in Durchgang 2 auch vom Mehr-Sheet der Mobilansicht benutzt.
 */
export const ThemeMenuItems = () => {
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">
        {t("nav.theme.label")}
      </DropdownMenuLabel>
      {OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onClick={() => setTheme(option.value)}
          className="cursor-pointer gap-2"
        >
          <option.icon
            className={`h-4 w-4 ${theme === option.value ? "text-folk-mint" : "text-folk-ink3"}`}
          />
          <span className="flex-1">{t(option.labelKey)}</span>
          {theme === option.value && (
            <span className="rounded-full bg-folk-mint-bg px-1.5 py-0.5 text-xs text-folk-mint">
              {t("nav.state.on")}
            </span>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );
};
