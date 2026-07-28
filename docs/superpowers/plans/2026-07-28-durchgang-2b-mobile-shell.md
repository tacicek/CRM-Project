# Durchgang 2b — Mobile Shell sichtbar machen: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unter 820px ersetzen Tab-Leiste, Mehr-Sheet, Such-Sheet und FAB die heutige Seitenleisten-Schublade. Die in 2a gebaute `BottomTabBar` wird sichtbar.

**Architecture:** Alles Neue leitet sich aus `firmaNav.ts` ab und baut auf vorhandenen Primitiven auf — `vaul`-`Drawer` für die Sheets, `cmdk` für die Suche. Die bestehende Kopfleiste wird **angepasst, nicht ersetzt**: sie trägt bereits Benachrichtigungen, Sprachumschalter und Hilfe-Knopf, die eine neu gebaute Mobilleiste verlieren würde.

**Tech Stack:** React 18, TypeScript strict, Tailwind 3.4.17, `vaul`, `cmdk`, `lucide-react`. Keine neuen Abhängigkeiten.

## Global Constraints

Wie Durchgang 1 und 2a, insbesondere:

- **Gate:** `npm run type-check` sauber · `npm test` grün (Stand: 815) · `npx eslint <angefasste Dateien>` null Fehler · `npx eslint .` bleibt bei **88 Fehlern / 2 Warnungen**.
- **Keine hartkodierten UI-Texte** — Schlüssel in `src/i18n/catalog/{de,fr,en}/nav.ts`.
- **Icons sind `LucideIcon`, nie Emoji.**
- **`text-white`/`text-black` niemals auf `folk-ink*`/`folk-card`/`folk-bg`** — `themeGuard` bricht sonst den Testlauf. Gegenfarbe ist `text-folk-bg`.
- **Nebenaktionen sichtbar**, Gesten nur Abkürzung.
- **Kein „PRO"-Abzeichen** — das Projekt kennt keine Abo-Stufen.

---

## Zwei Befunde, die den Zuschnitt bestimmen

**1. Die Kopfleiste wird angepasst, nicht neu gebaut.**
Die Vorlage beschreibt eine `MobileTopBar` aus Markenavatar, Firmenname, Datumszeile,
Suche und Benachrichtigungen. Die heutige Kopfleiste
([`FirmaLayout.tsx:567`](../../../src/components/firma/FirmaLayout.tsx#L567)) trägt aber
zusätzlich `LanguageSwitcher` und `WikiHelpButton`. Eine wörtlich gebaute Mobilleiste
**entfernte beide vom Telefon** — den Sprachumschalter, der für die dreisprachige
Bedienung gebraucht wird, und den Hilfe-Knopf, der ins Wiki führt. Das wäre ein
Funktionsverlust, den die Vorlage nicht beabsichtigt, sondern übersieht.

Stattdessen: der Hamburger-Knopf entfällt (die Tab-Leiste übernimmt die Navigation), ein
Such-Knopf kommt hinzu, der Rest bleibt.

**2. `DrawerContent` erfüllt zwei Anforderungen bereits.**
[`drawer.tsx:34`](../../../src/components/ui/drawer.tsx#L34) bringt `mt-24` mit — das
Sheet lässt oben 6rem frei und bedeckt nie den ganzen Bildschirm, genau wie gefordert.
Der Ziehgriff ist ebenfalls da (`mx-auto mt-4 h-2 w-[100px]`). Beides wird benutzt, nicht
nachgebaut.

---

## File Structure

| Datei | Zuständigkeit |
|---|---|
| `src/components/firma/mobile/MoreSheet.tsx` | **Neu.** Vollständige Navigation als Bottom-Sheet. |
| `src/components/firma/CommandPalette.tsx` | **Neu.** ⌘K-Palette und mobiles Such-Sheet in einem. |
| `src/lib/searchTargets.ts` | **Neu.** Reines Ziel- und Filtermodell. |
| `src/lib/__tests__/searchTargets.test.ts` | **Neu.** Tests dazu. |
| `src/components/firma/mobile/Fab.tsx` | **Neu.** Hauptaktion. |
| `src/components/firma/FirmaLayout.tsx` | **Ändern.** Schublade raus, Shell rein, `md:` → `shell-tablet:`. |
| `src/i18n/catalog/{de,fr,en}/nav.ts` | **Ändern.** Neue Schlüssel. |

---

## Task 1: Mehr-Sheet

**Files:**
- Create: `src/components/firma/mobile/MoreSheet.tsx`
- Modify: `src/i18n/catalog/{de,fr,en}/nav.ts`

**Interfaces:**
- Consumes: `FIRMA_NAV_GROUPS`, `FIRMA_QUICK_LINKS`, `MODULES`, `ThemeMenuItems` (Durchgang 1), `Drawer*` aus `@/components/ui/drawer`, `useT`.
- Produces: `MoreSheet: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => JSX.Element`

**Vollständigkeit ist der Zweck dieser Komponente.** Sie zeigt alle Gruppen aus
`FIRMA_NAV_GROUPS` **und** die Schnellzugriffe, die keinen Tab haben (`email-import`).
Ohne letzteres wäre der E-Mail-Eingang auf dem Telefon unerreichbar.

- [ ] **Step 1: i18n-Schlüssel**

`de/nav.ts` neben `nav.mobile.more`:
```ts
  "nav.mobile.quickAccess": "Schnellzugriff",
  "nav.mobile.close": "Schliessen",
```
`fr/nav.ts`:
```ts
  "nav.mobile.quickAccess": "Accès rapide",
  "nav.mobile.close": "Fermer",
```
`en/nav.ts`:
```ts
  "nav.mobile.quickAccess": "Quick access",
  "nav.mobile.close": "Close",
```

- [ ] **Step 2: Komponente schreiben**

Create `src/components/firma/mobile/MoreSheet.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ThemeMenuItems } from "@/components/firma/ThemeMenuItems";
import { FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, type FirmaNavItem } from "@/config/firmaNav";
import { MODULES } from "@/config/modules";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

const isVisible = (item: FirmaNavItem) =>
  item.moduleKey === null || MODULES[item.moduleKey];

/** Schnellzugriffe ohne eigenen Tab — sonst waere der E-Mail-Eingang mobil unerreichbar. */
const untabbedQuickLinks = FIRMA_QUICK_LINKS.filter(
  (item) => item.mobileTab !== true && isVisible(item),
);

const Row = ({ item, onNavigate }: { item: FirmaNavItem; onNavigate: () => void }) => {
  const t = useT();
  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      className="flex min-h-[48px] items-center gap-3 border-b border-folk-line-soft px-3.5 text-[13.5px] text-folk-ink2 last:border-b-0 active:bg-folk-bg-warm"
    >
      <item.icon className="h-4 w-4 shrink-0 text-folk-ink3" strokeWidth={1.8} aria-hidden="true" />
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
      <div className="rounded-xl border border-folk-line bg-folk-card">
        {items.map((item) => (
          <Row key={item.url} item={item} onNavigate={onNavigate} />
        ))}
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
 * `DrawerContent` bringt `mt-24` mit — das Sheet bedeckt nie den ganzen
 * Bildschirm, der abgedunkelte Streifen oben bleibt sichtbar. Deshalb wird
 * hier nichts an der Höhe geschraubt, nur der Innenbereich scrollt.
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
        <div className="overflow-y-auto overscroll-contain px-3 pb-8 pt-4">
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
          <div className="rounded-xl border border-folk-line bg-folk-card py-1">
            <ThemeMenuItems />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
```

> **Prüfen beim Bauen:** `ThemeMenuItems` rendert `DropdownMenuItem`. Ausserhalb eines
> Aufklappmenüs kann das Radix-Kontext verlangen. Schlägt es fehl, bekommt
> `ThemeMenuItems` eine `as`-freie Variante mit einfachen Knöpfen — **nicht** eine
> Kopie des Blocks. Der unbenutzte Import `DropdownMenuSeparator` fliegt dann raus.

- [ ] **Step 3: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/components/firma/mobile/MoreSheet.tsx
npx eslint . 2>&1 | grep problems
git add src/components/firma/mobile/MoreSheet.tsx src/i18n/catalog
git commit -m "feat(mobile): Mehr-Sheet mit vollstaendiger Navigation"
```

---

## Task 2: Suche — ein Modell, zwei Darstellungen

⌘K ist heute eine Attrappe: die Seitenleiste zeigt ein `<span>` mit `<kbd>`, ohne
Handler. `cmdk` und `command.tsx` liegen bereit.

**Files:**
- Create: `src/lib/searchTargets.ts`, `src/lib/__tests__/searchTargets.test.ts`
- Create: `src/components/firma/CommandPalette.tsx`
- Modify: `src/i18n/catalog/{de,fr,en}/nav.ts`

**Interfaces:**
- Produces:
  - `type SearchTarget = { url: string; titleKey: MessageKey; icon: LucideIcon; group: "nav" | "command" }`
  - `buildNavTargets(groups, quickLinks, modules): SearchTarget[]`
  - `filterTargets(targets, query, translate): SearchTarget[]`
  - `CommandPalette: ({ open, onOpenChange }) => JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/searchTargets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildNavTargets, filterTargets } from "@/lib/searchTargets";
import { FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS } from "@/config/firmaNav";

const ALL_ON: Record<string, boolean> = new Proxy(
  {},
  { get: () => true },
) as Record<string, boolean>;

/** Uebersetzt einen Schluessel auf sein letztes Segment — reicht zum Filtern im Test. */
const translate = (key: string) => key.split(".").pop() ?? key;

describe("buildNavTargets", () => {
  it("contains every visible destination exactly once", () => {
    const targets = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, ALL_ON);
    const urls = targets.map((t) => t.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("/firma/hilfe");
    expect(urls).toContain("/firma/email-import");
  });

  it("drops destinations whose module is off", () => {
    const off: Record<string, boolean> = new Proxy(
      {},
      { get: (_t, key) => key !== "offers" },
    ) as Record<string, boolean>;
    const urls = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, off).map((t) => t.url);
    expect(urls).not.toContain("/firma/offerten");
  });
});

describe("filterTargets", () => {
  const targets = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, ALL_ON);

  it("returns everything for an empty query", () => {
    expect(filterTargets(targets, "", translate)).toHaveLength(targets.length);
  });

  it("ignores case and surrounding whitespace", () => {
    const a = filterTargets(targets, "  KUNDEN ", translate);
    const b = filterTargets(targets, "kunden", translate);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("returns nothing for a query that matches no label", () => {
    expect(filterTargets(targets, "zzzznichts", translate)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/searchTargets.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/searchTargets"`.

- [ ] **Step 3: Reine Logik schreiben**

Create `src/lib/searchTargets.ts`:

```ts
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
 * Schnellzugriffe und Gruppen überschneiden sich (Übersicht steht in beiden),
 * deshalb wird über die URL entdoppelt.
 */
export const buildNavTargets = (
  groups: readonly FirmaNavGroup[],
  quickLinks: readonly FirmaNavItem[],
  modules: Record<string, boolean>,
): SearchTarget[] => {
  const seen = new Set<string>();
  const all = [...quickLinks, ...groups.flatMap((group) => group.items)];

  return all
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
 * und dieselbe Suche liefert in jeder Dashboard-Sprache passende Treffer.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/searchTargets.test.ts`
Expected: PASS — 5 Tests.

- [ ] **Step 5: Palette bauen**

Create `src/components/firma/CommandPalette.tsx` auf Basis von
`CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`,
`CommandItem` aus `@/components/ui/command`. Der Zustand `query` filtert über
`filterTargets`; ein Treffer navigiert und schliesst.

Zusätzlich ein `useEffect` mit Tastaturhaken:

```ts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onOpenChange(!open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
```

- [ ] **Step 6: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/lib/searchTargets.ts src/lib/__tests__/searchTargets.test.ts src/components/firma/CommandPalette.tsx
git add src/lib/searchTargets.ts src/lib/__tests__/searchTargets.test.ts src/components/firma/CommandPalette.tsx src/i18n/catalog
git commit -m "feat(search): Kommandopalette verdrahten, cmdk statt Attrappe"
```

---

## Task 3: FAB

**Files:**
- Create: `src/components/firma/mobile/Fab.tsx`

**Interfaces:**
- Produces: `Fab: ({ onClick }: { onClick: () => void }) => JSX.Element`

- [ ] **Step 1: Komponente schreiben**

56px rund, `right-4`, `bottom: calc(env(safe-area-inset-bottom) + 82px)`,
`bg-folk-mint text-folk-bg`, Plus-Glyphe, `shell-tablet:hidden`.
Beschriftung über `aria-label={t("nav.mobile.newAnfrage")}`.

**Nicht `text-white`** — `folk-mint` ist zwar gesättigt, aber `text-folk-bg` hält in
beiden Themes und bleibt zur übrigen Palette konsistent.

- [ ] **Step 2: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/components/firma/mobile/Fab.tsx
git add src/components/firma/mobile/Fab.tsx
git commit -m "feat(mobile): FAB fuer die Hauptaktion"
```

---

## Task 4: Einhängen — die eigentliche Umstellung

Berührt alle 35 Routen auf einmal. Vorher müssen Task 1–3 fertig sein.

**Files:**
- Modify: `src/components/firma/FirmaLayout.tsx`

- [ ] **Step 1: Alte Schublade entfernen**

Der Block „Sidebar drawer (mobile)" (`mobileSidebarOpen`, Overlay, zweite
`FirmaSidebar`) entfällt vollständig, ebenso der Hamburger-Knopf in der Kopfleiste und
der Zustand `mobileSidebarOpen`. Die `onClose`-Prop von `FirmaSidebar` und ihr
Schliessen-Knopf entfallen mit.

- [ ] **Step 2: `md:` durch `shell-tablet:` ersetzen**

In `FirmaLayout.tsx` **jedes** `md:hidden` und `hidden md:block`, das die Shell
schaltet, auf `shell-tablet:` umstellen. Sonst bleibt der Widerspruch zwischen 768 und
820px bestehen, den 2a beseitigt hat.

Run zur Kontrolle: `grep -n "md:hidden\|hidden md:" src/components/firma/FirmaLayout.tsx`
Expected: keine Treffer mehr, die die Shell betreffen.

- [ ] **Step 3: Neue Shell einhängen**

Zustand `moreOpen`, `searchOpen` in `FirmaLayout`. Unter dem Inhalt:

```tsx
        <div className="flex-1 p-3 sm:p-4 md:p-6 pb-24 shell-tablet:pb-6 print:p-0">
          {children}
        </div>
        <BottomTabBar onOpenMore={() => setMoreOpen(true)} />
        <Fab onClick={() => navigate("/firma/anfragen")} />
        <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
```

`pb-24` sind 96px — ohne das verschwindet die letzte Karte unter FAB und Tab-Leiste.

- [ ] **Step 4: Such-Knopf in die Kopfleiste**

Anstelle des entfallenen Hamburgers ein Lupen-Knopf, der `setSearchOpen(true)` ruft.
`LanguageSwitcher`, `WikiHelpButton` und `NotificationDropdown` bleiben unangetastet —
sie sind auf dem Telefon die einzigen Zugänge zu Sprache und Hilfe.

- [ ] **Step 5: Prüfen bei 360, 390 und 430px**

`npm run dev`, Geräteemulation. Zu bestätigen:

- Keine waagrechte Seitenscrollleiste.
- Letzte Karte nicht unter FAB oder Tab-Leiste.
- Aktiver Tab stimmt auf Detailrouten (`/firma/offerten/<id>` → Offerten).
- Mehr-Sheet bedeckt nie den ganzen Bildschirm.
- Jedes Ziel der Seitenleiste über Tab-Leiste **oder** Mehr-Sheet erreichbar.
- Beide Themes.
- Bei ≥820px unverändert die Seitenleiste, keine Tab-Leiste, kein FAB.

- [ ] **Step 6: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/components/firma/FirmaLayout.tsx
npx eslint . 2>&1 | grep problems
git add src/components/firma/FirmaLayout.tsx
git commit -m "feat(mobile): Shell einhaengen, Seitenleisten-Schublade entfernen"
```

---

## Task 5: Wiki-Hinweis hinterlegen

Der Navigationsartikel beschreibt ab jetzt eine Bedienung, die es nicht mehr gibt.
Die Korrektur ist Durchgang 6 — hier wird nur sichergestellt, dass sie nicht vergessen
wird.

- [ ] **Step 1: Vermerk setzen**

In `docs/superpowers/specs/2026-07-28-uebersicht-redesign-dark-mode-design.md`,
Abschnitt 8, festhalten: „Ab Durchgang 2b ist der Abschnitt *Am Mobiltelefon* in
`navigation-und-benachrichtigungen.ts` (DE/FR/EN) sachlich falsch — er beschreibt
Hamburger und Seitenleiste, es gibt Tab-Leiste und Mehr-Sheet."

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-28-uebersicht-redesign-dark-mode-design.md
git commit -m "docs: Wiki-Nachzug nach der Shell-Umstellung vermerken"
```
