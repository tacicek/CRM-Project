# Durchgang 2a — Navigationsfundament: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Grundlage der Mobilnavigation: CSS und JS benutzen dieselben Breakpoints, die Tab-Auswahl wird aus `firmaNav.ts` abgeleitet statt von Hand gelistet, und die Tab-Leiste ist gebaut. Die sichtbare Umstellung folgt in 2b.

**Architecture:** Navigation wird **aus `firmaNav.ts` erzeugt**, nicht von Hand gelistet: der Wiki-Validator liest dieselbe Datei, und `MODULES`-Feature-Flags müssen greifen. Die Auswahl der Tab-Einträge und die Zuordnung Route → aktiver Tab sind reine Funktionen mit Tests; die Komponenten sind Hüllen. Sheets bauen auf dem vorhandenen `vaul`-`Drawer` auf, nichts wird neu geschrieben.

**Tech Stack:** React 18, TypeScript strict, Tailwind 3.4.17, `vaul` (vorhanden), `cmdk` (vorhanden), `lucide-react`. Keine neuen Abhängigkeiten.

## Global Constraints

Alle Regeln aus Durchgang 1 gelten unverändert, insbesondere:

- **Gate:** `npm run type-check` sauber · `npm test` grün · `npx eslint <angefasste Dateien>` null Fehler · `npx eslint .` bleibt bei **88 Fehlern / 2 Warnungen** (vorbestehende Altlast, siehe CLAUDE.md §12).
- **Kein `any`, kein `console.log`, kein Barrel-Export, keine `../../`-Ketten.**
- **Keine hartkodierten UI-Texte** — Schlüssel in `src/i18n/catalog/{de,fr,en}/`.
- **Icons sind `LucideIcon`, nie Emoji** — `firmaNav.ts` hält das im Kopfkommentar fest, der Wiki-Validator hängt daran.
- **Kein „PRO"-Abzeichen** — das Projekt kennt keine Abo-Stufen (CLAUDE.md §2). Wo die Vorlage eine Stufe zeigt, steht die **Rolle** aus `user_roles`.
- **Nebenaktionen sichtbar**, Gesten nur Abkürzung (Spec §5.3, vom Auftraggeber entschieden).
- **Neue Komponenten unter 820px prüfen bei 360, 390 und 430px.**

---

## Kritischer Vorbefund: 768 ≠ 820

Die heutige Shell schaltet auf Tailwinds `md:` um — das sind **768px**.
Spec und `useBreakpoint` (Durchgang 1) nennen dagegen **820px**.

Bliebe das so, entstünde zwischen 768 und 820px ein Band, in dem das **Layout**
(CSS, 768) und das **Verhalten** (JS, 820) einander widersprechen: die Tab-Leiste wäre
schon weg, aber `useBreakpoint` meldete weiterhin `mobile` und öffnete Sheets statt
Aufklappmenüs. Solche Fehler zeigen sich nur auf Tablets und werden selten gemeldet.

Task 1 legt deshalb benannte Tailwind-Breakpoints an, die **dieselben Zahlen** wie
`src/lib/breakpoints.ts` benutzen.

---

## File Structure

| Datei | Zuständigkeit |
|---|---|
| `tailwind.config.ts` | **Ändern.** Benannte Screens `shell-tablet: 820px`, `shell-desktop: 1100px`. |
| `src/config/firmaNav.ts` | **Ändern.** Feld `mobileTab?: boolean` an vier Einträgen. |
| `src/lib/mobileNav.ts` | **Neu.** Reine Auswahl- und Zuordnungslogik. Kein React. |
| `src/lib/__tests__/mobileNav.test.ts` | **Neu.** Tests dazu. |
| `src/components/firma/mobile/BottomTabBar.tsx` | **Neu.** Fünf Spalten, aus der Konfiguration. |
| `src/components/firma/mobile/MobileTopBar.tsx` | **Neu.** Klebende Kopfleiste. |
| `src/components/firma/mobile/MoreSheet.tsx` | **Neu.** Vollständige Navigation als Sheet. |
| `src/components/firma/mobile/SearchSheet.tsx` | **Neu.** Suche mobil; teilt das Ergebnismodell mit der Palette. |
| `src/components/firma/mobile/Fab.tsx` | **Neu.** Hauptaktion. |
| `src/components/firma/CommandPalette.tsx` | **Neu.** ⌘K auf dem Desktop; heute ist die Anzeige eine Attrappe. |
| `src/lib/searchTargets.ts` | **Neu.** Reines Ergebnismodell + Filter für beide Darstellungen. |
| `src/lib/__tests__/searchTargets.test.ts` | **Neu.** Tests dazu. |
| `src/components/firma/FirmaLayout.tsx` | **Ändern.** Mobile Schublade entfernen, neue Shell einhängen. |
| `src/i18n/catalog/{de,fr,en}/nav.ts` | **Ändern.** Neue Schlüssel. |

---

## Task 1: Breakpoints in CSS und JS auf dieselben Zahlen bringen

**Files:**
- Modify: `tailwind.config.ts` (`theme.extend.screens`)

**Interfaces:**
- Consumes: `BREAKPOINT_TABLET_MIN` (820), `BREAKPOINT_DESKTOP_MIN` (1100) aus `src/lib/breakpoints.ts`.
- Produces: Tailwind-Varianten `shell-tablet:` und `shell-desktop:`.

- [ ] **Step 1: Screens ergänzen**

In `tailwind.config.ts` innerhalb von `theme.extend`, neben `fontFamily`:

```ts
      // Dieselben Zahlen wie src/lib/breakpoints.ts. Getrennt benannt, damit
      // niemand versehentlich `md:` (768px) benutzt und Layout und Verhalten
      // zwischen 768 und 820px auseinanderlaufen.
      screens: {
        "shell-tablet": "820px",
        "shell-desktop": "1100px",
      },
```

- [ ] **Step 2: Beweisen, dass die Varianten erzeugt werden**

Eine Probeklasse an einer beliebigen Stelle benutzen ist unnötig — Tailwind erzeugt
Varianten nur bei Verwendung. Statt dessen prüfen, dass die Konfiguration lädt:

Run: `npx tailwindcss --help >/dev/null && node -e "const c=require('./tailwind.config.ts');" 2>/dev/null || npx vite build --mode development 2>&1 | tail -3`
Expected: Build ohne Fehler.

Der eigentliche Nachweis erfolgt in Task 8, wenn die Klassen tatsächlich benutzt werden.

- [ ] **Step 3: Commit**

```bash
npm run type-check && npm test
git add tailwind.config.ts
git commit -m "feat(layout): benannte Shell-Breakpoints 820/1100"
```

---

## Task 2: Navigation aus der Konfiguration ableiten

Kern des Durchgangs. Die Vorlage listet Tab-Leiste und Mehr-Sheet von Hand — und ihre
Liste ist bereits unvollständig (Spec §4.1: HAUPTBEREICH 6 statt 9, VERWALTUNG 3 statt 5).
Eine zweite handgepflegte Liste liefe still auseinander und umginge sowohl den
Wiki-Validator als auch die `MODULES`-Flags.

**Files:**
- Modify: `src/config/firmaNav.ts`
- Create: `src/lib/mobileNav.ts`
- Test: `src/lib/__tests__/mobileNav.test.ts`

**Interfaces:**
- Consumes: `FirmaNavItem`, `FIRMA_QUICK_LINKS`, `FIRMA_NAV_GROUPS`, `MODULES`.
- Produces:
  - `FirmaNavItem` erhält `mobileTab?: boolean`
  - `selectTabItems(quickLinks: readonly FirmaNavItem[], modules: Record<string, boolean>): FirmaNavItem[]`
  - `findActiveTabUrl(pathname: string, tabUrls: readonly string[]): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/mobileNav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findActiveTabUrl, selectTabItems } from "@/lib/mobileNav";
import { FIRMA_QUICK_LINKS } from "@/config/firmaNav";
import type { FirmaNavItem } from "@/config/firmaNav";

const ALL_ON: Record<string, boolean> = new Proxy({}, { get: () => true });

describe("selectTabItems", () => {
  it("picks exactly the entries marked as mobileTab", () => {
    const urls = selectTabItems(FIRMA_QUICK_LINKS, ALL_ON).map((i) => i.url);
    expect(urls).toEqual([
      "/firma",
      "/firma/anfragen",
      "/firma/offerten",
      "/firma/kalender",
    ]);
  });

  it("never returns more than four — the fifth slot belongs to 'Mehr'", () => {
    expect(selectTabItems(FIRMA_QUICK_LINKS, ALL_ON).length).toBeLessThanOrEqual(4);
  });

  it("drops an entry whose module is switched off", () => {
    const off: Record<string, boolean> = { ...ALL_ON, offers: false };
    const urls = selectTabItems(FIRMA_QUICK_LINKS, off).map((i) => i.url);
    expect(urls).not.toContain("/firma/offerten");
    // Die uebrigen bleiben — ein abgeschaltetes Modul darf die Leiste nicht leeren.
    expect(urls).toContain("/firma");
  });

  it("keeps an entry without a moduleKey", () => {
    const item: FirmaNavItem = {
      titleKey: "nav.hilfe",
      url: "/firma/hilfe",
      icon: FIRMA_QUICK_LINKS[0].icon,
      moduleKey: null,
      mobileTab: true,
    };
    expect(selectTabItems([item], { }).map((i) => i.url)).toEqual(["/firma/hilfe"]);
  });
});

describe("findActiveTabUrl", () => {
  const tabs = ["/firma", "/firma/anfragen", "/firma/offerten", "/firma/kalender"];

  it("matches the overview only exactly", () => {
    expect(findActiveTabUrl("/firma", tabs)).toBe("/firma");
  });

  it("does not let /firma swallow every other route", () => {
    expect(findActiveTabUrl("/firma/kunden", tabs)).toBeNull();
    expect(findActiveTabUrl("/firma/einstellungen", tabs)).toBeNull();
  });

  it("marks the tab of a detail route", () => {
    expect(findActiveTabUrl("/firma/offerten/abc-123", tabs)).toBe("/firma/offerten");
    expect(findActiveTabUrl("/firma/anfragen/42", tabs)).toBe("/firma/anfragen");
  });

  it("prefers the longest matching prefix", () => {
    const withNested = [...tabs, "/firma/offerten/entwurf"];
    expect(findActiveTabUrl("/firma/offerten/entwurf/7", withNested)).toBe(
      "/firma/offerten/entwurf",
    );
  });

  it("does not match a partial path segment", () => {
    expect(findActiveTabUrl("/firma/offerten-archiv", tabs)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/mobileNav.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/mobileNav"`.

- [ ] **Step 3: `mobileTab` an die Konfiguration**

In `src/config/firmaNav.ts` den Typ ergänzen:

```ts
  /**
   * Sichtbar in der Tab-Leiste der Mobilansicht. Genau vier Eintraege tragen
   * das Feld; der fuenfte Platz gehoert "Mehr". Ausdrueckliches Feld statt
   * "die ersten vier Schnellzugriffe", damit ein Umsortieren der Seitenleiste
   * nicht still die Tab-Leiste veraendert.
   */
  mobileTab?: boolean;
```

Dann an den vier Einträgen in `FIRMA_QUICK_LINKS` setzen — Übersicht, Anfragen,
Offerten, Kalender bekommen `mobileTab: true`. **`emailImport` bekommt es nicht**; der
Eintrag bleibt über das Mehr-Sheet erreichbar.

- [ ] **Step 4: Reine Logik schreiben**

Create `src/lib/mobileNav.ts`:

```ts
import type { FirmaNavItem } from "@/config/firmaNav";

/**
 * Die Eintraege der Tab-Leiste — abgeleitet, nie von Hand gelistet.
 *
 * `modules` wird hereingereicht statt importiert, damit die Funktion rein
 * bleibt und ein abgeschaltetes Modul testbar ist.
 */
export const selectTabItems = (
  quickLinks: readonly FirmaNavItem[],
  modules: Record<string, boolean>,
): FirmaNavItem[] =>
  quickLinks.filter(
    (item) =>
      item.mobileTab === true &&
      (item.moduleKey === null || modules[item.moduleKey] === true),
  );

/**
 * Welcher Tab ist zur aktuellen Route aktiv?
 *
 * Zwei Fallen, die hier bewusst abgefangen werden:
 *  1. "/firma" ist Praefix jeder anderen Route — es zaehlt nur bei exakter
 *     Gleichheit, sonst waere immer die Uebersicht markiert.
 *  2. Ein Praefixvergleich auf Zeichenebene wuerde "/firma/offerten-archiv"
 *     dem Tab "/firma/offerten" zuschlagen. Es muss an einer Segmentgrenze
 *     enden.
 *
 * Bei mehreren Treffern gewinnt der laengste — der spezifischere Tab.
 */
export const findActiveTabUrl = (
  pathname: string,
  tabUrls: readonly string[],
): string | null => {
  const matches = tabUrls.filter((url) =>
    url === "/firma"
      ? pathname === "/firma"
      : pathname === url || pathname.startsWith(`${url}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, url) => (url.length > longest.length ? url : longest));
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/mobileNav.test.ts`
Expected: PASS — 9 Tests.

- [ ] **Step 6: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/lib/mobileNav.ts src/lib/__tests__/mobileNav.test.ts
npx eslint . 2>&1 | grep problems   # weiterhin 88 Fehler
git add src/config/firmaNav.ts src/lib/mobileNav.ts src/lib/__tests__/mobileNav.test.ts
git commit -m "feat(nav): Tab-Auswahl und aktiven Tab aus der Konfiguration ableiten"
```

---

## Task 3: Bottom-Tab-Leiste

**Files:**
- Create: `src/components/firma/mobile/BottomTabBar.tsx`
- Modify: `src/i18n/catalog/{de,fr,en}/nav.ts`

**Interfaces:**
- Consumes: `selectTabItems`, `findActiveTabUrl`, `FIRMA_QUICK_LINKS`, `MODULES`, `useT`.
- Produces: `BottomTabBar: ({ onOpenMore }: { onOpenMore: () => void }) => JSX.Element`

- [ ] **Step 1: i18n-Schlüssel**

`de/nav.ts`:
```ts
  "nav.mobile.more": "Mehr",
  "nav.mobile.openMore": "Weitere Bereiche öffnen",
  "nav.mobile.search": "Suchen",
  "nav.mobile.notifications": "Hinweise",
  "nav.mobile.newAnfrage": "Anfrage erfassen",
```
`fr/nav.ts`:
```ts
  "nav.mobile.more": "Plus",
  "nav.mobile.openMore": "Ouvrir les autres sections",
  "nav.mobile.search": "Rechercher",
  "nav.mobile.notifications": "Notifications",
  "nav.mobile.newAnfrage": "Saisir une demande",
```
`en/nav.ts`:
```ts
  "nav.mobile.more": "More",
  "nav.mobile.openMore": "Open more sections",
  "nav.mobile.search": "Search",
  "nav.mobile.notifications": "Notifications",
  "nav.mobile.newAnfrage": "New request",
```

- [ ] **Step 2: Komponente schreiben**

Create `src/components/firma/mobile/BottomTabBar.tsx`:

```tsx
import { MoreHorizontal } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { FIRMA_QUICK_LINKS } from "@/config/firmaNav";
import { MODULES } from "@/config/modules";
import { useT } from "@/i18n/useI18n";
import { findActiveTabUrl, selectTabItems } from "@/lib/mobileNav";

/**
 * Die Tab-Leiste der Mobilansicht. Vier Ziele aus der Konfiguration, der
 * fuenfte Platz oeffnet das Mehr-Sheet.
 *
 * `pb` beruecksichtigt `env(safe-area-inset-bottom)`, sonst liegt die Leiste
 * auf iPhones unter dem Home-Indikator.
 */
export const BottomTabBar = ({ onOpenMore }: { onOpenMore: () => void }) => {
  const t = useT();
  const { pathname } = useLocation();

  const items = selectTabItems(FIRMA_QUICK_LINKS, MODULES);
  const activeUrl = findActiveTabUrl(pathname, items.map((i) => i.url));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-folk-line bg-folk-bg/95 backdrop-blur shell-tablet:hidden print:hidden"
      style={{
        gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))`,
        paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
      }}
      aria-label={t("nav.openMenu")}
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
            <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
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
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <span>{t("nav.mobile.more")}</span>
      </button>
    </nav>
  );
};
```

- [ ] **Step 3: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/components/firma/mobile/BottomTabBar.tsx
git add src/components/firma/mobile/BottomTabBar.tsx src/i18n/catalog
git commit -m "feat(mobile): Bottom-Tab-Leiste aus der Navigationskonfiguration"
```

---

## Nicht in diesem Plan — Durchgang 2b

Dieser Plan liefert das **Fundament** der Mobilnavigation: übereinstimmende
Breakpoints, die aus der Konfiguration abgeleitete Auswahl samt Tests, und die
Tab-Leiste. Danach ist die Ableitung bewiesen und die Konventionen einer
Mobilkomponente stehen fest.

Die sichtbare Shell folgt in einem eigenen Plan, weil sie erst mit dem Einhängen
in `FirmaLayout` ein Ergebnis ergibt und dieses Einhängen alle 35 Routen berührt:

- `MobileTopBar` — klebende Kopfleiste mit Suche und Hinweisen
- `MoreSheet` — vollständige Navigation, auf dem vorhandenen `vaul`-`Drawer`
- `SearchSheet` + `CommandPalette` — ⌘K ist heute eine Attrappe ohne Handler
- `Fab` — Hauptaktion samt Langdruck-Sheet
- Einhängen in `FirmaLayout`, Entfernen der alten Schublade
- Schlussprüfung bei 360, 390 und 430px

> **Zwischenzustand nach diesem Plan:** die Tab-Leiste ist gebaut und getestet, aber
> noch **nicht gerendert** — `FirmaLayout` zeigt weiterhin die heutige Schublade. Das
> ist beabsichtigt: eine halb umgestellte Navigation auf 35 Routen wäre schlechter als
> die alte. Umgestellt wird in einem Zug, in 2b.

**Für 2b vorgemerkt — diese Punkte sind bereits ermittelt und dürfen nicht neu geraten
werden:**

- `FirmaLayout` rendert die Seitenleiste heute mit `hidden md:block` und die Schublade
  mit `md:hidden` — **beide müssen auf `shell-tablet:` umgestellt werden**, sonst bleibt
  der Widerspruch zwischen 768 und 820px bestehen, den Task 1 gerade beseitigt hat.
- Der Scroll-Inhalt braucht **~96px Bodenabstand**, sonst verschwindet die letzte Karte
  unter FAB und Tab-Leiste.
- FAB und Tab-Leiste **ausblenden, solange ein Eingabefeld den Fokus hat**.
- Das Mehr-Sheet darf **nie den ganzen Bildschirm bedecken**; der abgedunkelte Streifen
  oben bleibt sichtbar.
- Jede Detailansicht braucht im Standalone-Modus eine **sichtbare Zurück-Schaltfläche**.
- `ThemeMenuItems` aus Durchgang 1 wird im Mehr-Sheet wiederverwendet — nicht neu bauen.
