import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * Dashboard language switcher.
 *
 * Changes only what THIS user sees. The company-wide default lives in
 * Einstellungen; picking "follow company" here clears the personal override.
 *
 * It deliberately says so in the hint text: an operator switching the dashboard to
 * English must not believe they have just switched their customers' documents to
 * English too.
 */
export const LanguageSwitcher = () => {
  const { locale, companyLocale, override, setOverride, t } = useI18n();

  const select = (next: Locale | null) => setOverride(next);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={t("common.language.dashboard")}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline uppercase text-xs font-medium">{locale}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("common.language.dashboard")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => select(l)}
            className={cn("cursor-pointer", override === l && "font-semibold")}
          >
            <span className="flex-1">{LOCALE_NAMES[l]}</span>
            {locale === l && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => select(null)}
          className={cn("cursor-pointer", !override && "font-semibold")}
        >
          {t("common.language.followCompany", { language: LOCALE_NAMES[companyLocale] })}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground leading-snug">
          {t("common.language.hint")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
