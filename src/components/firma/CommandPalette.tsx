import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS } from "@/config/firmaNav";
import { MODULES } from "@/config/modules";
import { useT } from "@/i18n/useI18n";
import { buildNavTargets, filterTargets } from "@/lib/searchTargets";

/**
 * Die Kommandopalette — auf dem Desktop mittig über ⌘K / Strg+K, auf dem
 * Telefon derselbe Dialog über den Lupen-Knopf der Kopfleiste.
 *
 * Bis hierher war die Anzeige eine Attrappe: die Seitenleiste zeigte ein
 * `<span>` mit einem `<kbd>`, ohne Handler dahinter. `cmdk` und
 * `components/ui/command` lagen bereits im Projekt.
 *
 * Gesucht wird über die **angezeigte** Beschriftung, nicht über den
 * Katalogschlüssel — sonst fände ein französisch eingestelltes Dashboard
 * seine eigenen Menüpunkte nicht.
 */
export const CommandPalette = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const targets = useMemo(
    () => buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, MODULES),
    [],
  );

  const results = useMemo(
    () => filterTargets(targets, query, (key) => t(key as Parameters<typeof t>[0])),
    [targets, query, t],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onOpenChange(!open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Beim Schliessen zuruecksetzen, damit die naechste Suche leer beginnt.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t("nav.searchPlaceholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t("nav.search.empty")}</CommandEmpty>
        <CommandGroup heading={t("nav.menu")}>
          {results.map((target) => (
            <CommandItem
              key={target.url}
              // `value` steuert die Auswahl in cmdk; die URL ist eindeutig.
              value={`${t(target.titleKey)} ${target.url}`}
              onSelect={() => go(target.url)}
              className="cursor-pointer gap-2"
            >
              <target.icon className="h-4 w-4 shrink-0 text-folk-ink3" strokeWidth={1.8} />
              <span className="flex-1">{t(target.titleKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
