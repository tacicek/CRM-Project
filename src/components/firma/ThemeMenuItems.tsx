import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { THEME_OPTIONS } from "@/components/firma/themeOptions";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/i18n/useI18n";

/**
 * Der Theme-Umschalter als Block im Aufklappmenü der Kopfleiste.
 *
 * Eigene Komponente, weil die Kopfleiste zwei sich ausschliessende
 * Aufklappmenüs hat — eines für den Firmenwechsel, eines für das Profil. Nur
 * eines wird gerendert. Läge der Umschalter nur im Profilmenü, käme ein
 * Benutzer mit Zugriff auf mehrere Firmen nie an ihn heran.
 *
 * Für die Mobilansicht gibt es eine eigene Auszeichnung im Mehr-Sheet:
 * `DropdownMenuItem` verlangt den Kontext seines Menüs. Geteilt werden die
 * Daten über `@/components/firma/themeOptions`.
 */
export const ThemeMenuItems = () => {
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">
        {t("nav.theme.label")}
      </DropdownMenuLabel>
      {THEME_OPTIONS.map((option) => (
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
