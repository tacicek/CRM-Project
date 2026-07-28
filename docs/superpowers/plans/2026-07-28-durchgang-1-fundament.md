# Durchgang 1 — Fundament: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die CRM-Oberfläche unter `/firma` wird umschaltbar hell und dunkel, ohne dass eine einzige der 1478 bestehenden `folk-*`-Klassenverwendungen geändert wird.

**Architecture:** Die `folk`-Farben stehen heute als Hex-Literale in `tailwind.config.ts`. Sie werden zu CSS-Custom-Properties im **Kanalformat** (`251 250 247`), die Tailwind über `rgb(var(--folk-x) / <alpha-value>)` einbindet — dadurch bleiben Deckkraft-Modifikatoren wie `bg-folk-coral/30` funktionsfähig. Ein zweiter Variablenblock unter `:root[data-theme="dark"]` liefert die dunklen Werte. Ein `ThemeProvider` innerhalb von `FirmaRouteWrapper` setzt `data-theme` auf `<html>`, sodass kundenseitige Seiten ausserhalb von `/firma` unberührt bleiben.

**Tech Stack:** Vite 7, React 18, TypeScript (strict), Tailwind CSS 3.4.17, Vitest. Keine neuen Abhängigkeiten.

## Global Constraints

- **Keine neue npm-Abhängigkeit.** Kein `next-themes` (wurde bewusst entfernt).
- **Kein `any`.** Typen aus Zod oder handgeschriebenen Unions ableiten.
- **Kein `console.log`** im Produktionspfad.
- **Kein Barrel-Export** (`index.ts`-Re-Export). Direkt importieren.
- **Arrow Functions** für Komponenten und Handler; `function` nur in Utilities.
- **Pfad-Alias:** `@/` = `src/`. Keine `../../`-Ketten.
- **Neue UI-Texte niemals hartkodiert** — Schlüssel in `src/i18n/catalog/de/`, plus `fr` und `en`. Ein fehlender Schlüssel ist ein Compilerfehler.
- **Tests nur für reine Funktionen.** React-Komponenten und Supabase-Aufrufe werden nicht getestet (Projektregel CLAUDE.md §9).
- **Gate vor jedem Commit:**
  1. `npm run type-check` (läuft `tsc -b`) — **muss vollständig sauber sein.**
  2. `npm test` — **alle Tests grün.** Stand bei Beginn: 795 Tests in 55 Dateien.
  3. `npx eslint <die angefassten Dateien>` — **null Fehler in dem, was diese Arbeit
     berührt.**

  > **Berichtigung, gemessen am 2026-07-28:** Eine frühere Fassung verlangte
  > „`npm run lint` grün". Das ist in diesem Repo **nicht erreichbar**: `npx eslint .`
  > meldet bereits auf `main` **88 Fehler und 2 Warnungen in 30 Dateien** —
  > 35 × `no-unused-vars`, 35 × `no-explicit-any`, 8 × `no-require-imports`, dazu
  > je eines aus `react-hooks` und `react-refresh`. Nichts davon stammt aus dieser
  > Arbeit.
  >
  > Wörtlich genommen liesse CLAUDE.md §14 („ohne sauberes lint kein Commit")
  > deshalb heute **überhaupt keinen Commit** zu. Die Regel wird nicht umgangen,
  > sondern auf das angewendet, was sie schützen soll: **diese Arbeit darf die Zahl
  > nicht erhöhen.** Nach jedem Task gegenprüfen:
  > `npx eslint . 2>&1 | tail -3` → weiterhin 88 Fehler, nicht mehr.
  >
  > Die 88 Altfehler sind ein eigener Auftrag und gehören dem Auftraggeber vorgelegt,
  > nicht nebenbei mitrepariert.
- **Das Hell-Erscheinungsbild darf sich nicht ändern.** Jeder Hell-Wert in Task 3 ist exakt der heutige Hex-Wert, nur in anderer Schreibweise.

---

## File Structure

| Datei | Zuständigkeit |
|---|---|
| `src/lib/theme.ts` | **Neu.** Reine Theme-Logik: Typen, Lesen der gespeicherten Wahl, Auflösung zu hell/dunkel. Kein React, kein DOM. |
| `src/lib/__tests__/theme.test.ts` | **Neu.** Tests dazu. |
| `src/lib/breakpoints.ts` | **Neu.** Reine Breakpoint-Logik: Breite → Bereich. Kein React. |
| `src/lib/__tests__/breakpoints.test.ts` | **Neu.** Tests dazu. |
| `src/index.css` | **Ändern.** `--folk-*` Variablen hell und dunkel; shadcn-Dunkelblock; 44px-Regel eingrenzen. |
| `tailwind.config.ts` | **Ändern.** `folk`-Farben auf Variablen umstellen; `darkMode` setzen. |
| `index.html` | **Ändern.** Vorab-Script, dunkles kritisches CSS, `theme-color`. |
| `src/hooks/useTheme.tsx` | **Neu.** `ThemeProvider` + `useTheme`. Hält React-Zustand, schreibt `localStorage`, setzt `data-theme`. |
| `src/hooks/useBreakpoint.ts` | **Neu.** React-Hook um `resolveBreakpoint`. |
| `src/App.tsx` | **Ändern.** `ThemeProvider` in `FirmaRouteWrapper` einhängen. |
| `src/components/firma/FirmaLayout.tsx` | **Ändern.** Theme-Umschalter in das bestehende Aufklappmenü. |
| `src/i18n/catalog/{de,fr,en}/…` | **Ändern.** Schlüssel für den Umschalter. |

**Trennung reine Logik ↔ React:** `theme.ts` und `breakpoints.ts` enthalten keine React- und keine DOM-Zugriffe. Nur so sind sie nach Projektregel testbar. Die Hooks daneben sind dünne Hüllen ohne eigene Entscheidungslogik.

---

## Task 1: Reine Theme-Logik

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `type ThemePreference = "light" | "dark" | "system"`
  - `type ResolvedTheme = "light" | "dark"`
  - `const THEME_STORAGE_KEY = "crm:theme"`
  - `parseThemePreference(raw: string | null): ThemePreference`
  - `resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

describe("parseThemePreference", () => {
  it("accepts the three known values", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to system when nothing is stored", () => {
    expect(parseThemePreference(null)).toBe("system");
  });

  it("falls back to system on unknown or corrupt input", () => {
    expect(parseThemePreference("")).toBe("system");
    expect(parseThemePreference("Dark")).toBe("system");
    expect(parseThemePreference("{}")).toBe("system");
  });

  it("uses a namespaced storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("crm:theme");
  });
});

describe("resolveTheme", () => {
  it("returns the explicit choice regardless of the system setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system setting when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/theme"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/theme.ts`:

```ts
/**
 * Reine Theme-Logik — ohne React und ohne DOM, damit sie nach Projektregel
 * (CLAUDE.md §9) testbar bleibt. Der Provider in `@/hooks/useTheme` ist nur
 * die Hülle, die diese Funktionen an React und `localStorage` anbindet.
 */

/** Was der Benutzer gewählt hat. */
export type ThemePreference = "light" | "dark" | "system";

/** Was tatsächlich gilt — nur das darf eine Komponente zum Vergleich benutzen. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "crm:theme";

const PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

/**
 * Liest einen gespeicherten Wert. Alles Unbekannte wird zu "system" — ein
 * beschädigter localStorage-Eintrag darf die Oberfläche nicht blockieren.
 */
export const parseThemePreference = (raw: string | null): ThemePreference =>
  PREFERENCES.find((candidate) => candidate === raw) ?? "system";

/**
 * `systemPrefersDark` kommt vom Aufrufer (Media Query), nicht von hier —
 * sonst wäre die Funktion nicht mehr rein.
 */
export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme => {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: PASS — 6 Tests.

- [ ] **Step 5: Run the gate**

Run: `npm run type-check && npm run lint && npm test`
Expected: alle drei ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/__tests__/theme.test.ts
git commit -m "feat(theme): reine Theme-Aufloesung mit Tests"
```

---

## Task 2: Reine Breakpoint-Logik

**Files:**
- Create: `src/lib/breakpoints.ts`
- Test: `src/lib/__tests__/breakpoints.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `type Breakpoint = "mobile" | "tablet" | "desktop"`
  - `const BREAKPOINT_TABLET_MIN = 820`
  - `const BREAKPOINT_DESKTOP_MIN = 1100`
  - `resolveBreakpoint(width: number): Breakpoint`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/breakpoints.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BREAKPOINT_DESKTOP_MIN,
  BREAKPOINT_TABLET_MIN,
  resolveBreakpoint,
} from "@/lib/breakpoints";

describe("resolveBreakpoint", () => {
  it("treats the reference phone widths as mobile", () => {
    expect(resolveBreakpoint(360)).toBe("mobile");
    expect(resolveBreakpoint(390)).toBe("mobile");
    expect(resolveBreakpoint(430)).toBe("mobile");
  });

  it("switches to tablet exactly at 820", () => {
    expect(resolveBreakpoint(819)).toBe("mobile");
    expect(resolveBreakpoint(BREAKPOINT_TABLET_MIN)).toBe("tablet");
  });

  it("switches to desktop exactly at 1100", () => {
    expect(resolveBreakpoint(1099)).toBe("tablet");
    expect(resolveBreakpoint(BREAKPOINT_DESKTOP_MIN)).toBe("desktop");
    expect(resolveBreakpoint(1920)).toBe("desktop");
  });

  it("does not crash on a zero width during first render", () => {
    expect(resolveBreakpoint(0)).toBe("mobile");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/breakpoints.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/breakpoints"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/breakpoints.ts`:

```ts
/**
 * Die drei Bereiche der Shell. Die Grenzen stammen aus der Mobil-Vorlage und
 * gelten für Verhalten (Sheets, Gesten). Das Layout selbst läuft über
 * CSS-Media-Queries — dieselben Zahlen, andere Stelle.
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

/** Ab hier weicht die Seitenleiste einer Icon-Leiste. */
export const BREAKPOINT_TABLET_MIN = 820;

/** Ab hier steht die volle Seitenleiste. */
export const BREAKPOINT_DESKTOP_MIN = 1100;

export const resolveBreakpoint = (width: number): Breakpoint => {
  if (width >= BREAKPOINT_DESKTOP_MIN) return "desktop";
  if (width >= BREAKPOINT_TABLET_MIN) return "tablet";
  return "mobile";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/breakpoints.test.ts`
Expected: PASS — 4 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/breakpoints.ts src/lib/__tests__/breakpoints.test.ts
git commit -m "feat(layout): reine Breakpoint-Aufloesung mit Tests"
```

---

## Task 3: `folk`-Farben auf Variablen umstellen

Dies ist die riskanteste Änderung des Durchgangs: 1478 Verwendungen hängen daran. Sie ändert **kein einziges** `.tsx`.

**Files:**
- Modify: `src/index.css` (neuer Variablenblock im `:root` von `@layer base`, plus neuer Dunkelblock)
- Modify: `tailwind.config.ts:85-112` (die `folk`-Farbdefinition) und der `theme`-Wurzelbereich (`darkMode`)

**Interfaces:**
- Consumes: nichts.
- Produces: CSS-Variablen `--folk-bg`, `--folk-bg-warm`, `--folk-sidebar`, `--folk-sidebar-hi`, `--folk-card`, `--folk-ink`, `--folk-ink2`…`--folk-ink5`, `--folk-line`, `--folk-line-soft`, `--folk-line-hard`, `--folk-coral`, `--folk-coral-lite`, `--folk-coral-bg`, `--folk-violet`, `--folk-violet-bg`, `--folk-mint`, `--folk-mint-bg`, `--folk-lemon`, `--folk-lemon-bg`, `--folk-sky`, `--folk-sky-bg`, `--folk-rose`, `--folk-rose-bg` — je als drei Kanalzahlen ohne `rgb()`.

- [ ] **Step 1: Hell-Variablen anlegen**

In `src/index.css`, innerhalb des bestehenden `:root`-Blocks in `@layer base`, direkt nach den `--sidebar-*`-Zeilen einfügen:

```css
    /* --------------------------------------------------------------------
     * folk — die Designsprache des CRM.
     *
     * KANALWERTE, nicht Hex: Tailwind ersetzt `<alpha-value>` nur innerhalb
     * einer Farbfunktion. Stünde hier ein Hex, würden die 31 Stellen mit
     * Deckkraft-Modifikator (`bg-folk-coral/30`, `text-folk-ink/40`) still
     * wirkungslos. Beim Ändern eines Wertes: Kanalform beibehalten.
     *
     * Diese Hellwerte sind exakt die vorherigen Hex-Literale aus
     * tailwind.config.ts — das Hell-Erscheinungsbild ändert sich nicht.
     * ------------------------------------------------------------------ */
    --folk-bg: 251 250 247;
    --folk-bg-warm: 247 245 239;
    --folk-sidebar: 243 241 234;
    --folk-sidebar-hi: 235 231 220;
    --folk-card: 255 255 255;
    --folk-ink: 24 24 26;
    --folk-ink2: 60 60 63;
    --folk-ink3: 115 112 115;
    --folk-ink4: 165 163 161;
    --folk-ink5: 199 197 192;
    --folk-line: 235 233 226;
    --folk-line-soft: 242 240 232;
    --folk-line-hard: 218 215 205;
    --folk-coral: 248 117 87;
    --folk-coral-lite: 252 229 222;
    --folk-coral-bg: 255 241 236;
    --folk-violet: 110 91 216;
    --folk-violet-bg: 242 238 253;
    --folk-mint: 66 166 120;
    --folk-mint-bg: 235 246 240;
    --folk-lemon: 212 165 10;
    --folk-lemon-bg: 251 244 217;
    --folk-sky: 58 130 186;
    --folk-sky-bg: 233 241 248;
    --folk-rose: 194 68 114;
    --folk-rose-bg: 249 233 240;

    /* Native Bedienelemente (Scrollbalken, Datumsauswahl) mitziehen. Steht
     * hier im CSS und nicht im Provider, damit es genau eine Quelle gibt. */
    color-scheme: light;
```

- [ ] **Step 2: Dunkel-Variablen anlegen**

In `src/index.css`, **nach** dem schliessenden `}` des `:root`-Blocks, noch innerhalb desselben `@layer base`:

```css
  /* --------------------------------------------------------------------
   * folk dunkel — warm-neutral, kein Blauschwarz. Ein kühles Grau würde der
   * Papier-Anmutung des Hell-Sets widersprechen.
   *
   * `--folk-ink4` ist bewusst heller als eine mechanische Spiegelung
   * (#8A857C statt ~#726E66): ink4 trägt Meta-Text wie Zeitstempel und
   * Routen; der gespiegelte Wert läge bei 3.7:1 gegen den Grund, dieser bei
   * ~5.1:1. Wer die Palette hier "begradigt", nimmt Kontrast weg.
   * ------------------------------------------------------------------ */
  :root[data-theme="dark"] {
    --folk-bg: 18 17 16;
    --folk-bg-warm: 23 22 20;
    --folk-sidebar: 20 19 17;
    --folk-sidebar-hi: 32 30 26;
    --folk-card: 26 25 23;
    --folk-ink: 237 235 230;
    --folk-ink2: 201 198 191;
    --folk-ink3: 150 146 137;
    --folk-ink4: 138 133 124;
    --folk-ink5: 96 91 83;
    --folk-line: 43 41 38;
    --folk-line-soft: 35 33 32;
    --folk-line-hard: 58 55 51;
    --folk-coral: 255 138 107;
    --folk-coral-lite: 74 42 34;
    --folk-coral-bg: 42 26 22;
    --folk-violet: 155 138 240;
    --folk-violet-bg: 36 31 58;
    --folk-mint: 79 195 164;
    --folk-mint-bg: 22 48 42;
    --folk-lemon: 232 192 74;
    --folk-lemon-bg: 50 41 19;
    --folk-sky: 107 168 220;
    --folk-sky-bg: 22 36 47;
    --folk-rose: 224 123 163;
    --folk-rose-bg: 46 26 36;

    color-scheme: dark;
  }
```

- [ ] **Step 3: Tailwind auf die Variablen umstellen**

In `tailwind.config.ts` den kompletten `folk`-Block (aktuell Zeilen 85–112) ersetzen durch:

```ts
        // Folk design tokens — die Werte stehen als Kanalzahlen in index.css,
        // je einmal für hell und einmal unter :root[data-theme="dark"].
        // `<alpha-value>` erhält die Deckkraft-Modifikatoren (bg-folk-coral/30).
        folk: {
          bg: "rgb(var(--folk-bg) / <alpha-value>)",
          "bg-warm": "rgb(var(--folk-bg-warm) / <alpha-value>)",
          sidebar: "rgb(var(--folk-sidebar) / <alpha-value>)",
          "sidebar-hi": "rgb(var(--folk-sidebar-hi) / <alpha-value>)",
          card: "rgb(var(--folk-card) / <alpha-value>)",
          ink: "rgb(var(--folk-ink) / <alpha-value>)",
          ink2: "rgb(var(--folk-ink2) / <alpha-value>)",
          ink3: "rgb(var(--folk-ink3) / <alpha-value>)",
          ink4: "rgb(var(--folk-ink4) / <alpha-value>)",
          ink5: "rgb(var(--folk-ink5) / <alpha-value>)",
          line: "rgb(var(--folk-line) / <alpha-value>)",
          "line-soft": "rgb(var(--folk-line-soft) / <alpha-value>)",
          "line-hard": "rgb(var(--folk-line-hard) / <alpha-value>)",
          coral: "rgb(var(--folk-coral) / <alpha-value>)",
          "coral-lite": "rgb(var(--folk-coral-lite) / <alpha-value>)",
          "coral-bg": "rgb(var(--folk-coral-bg) / <alpha-value>)",
          violet: "rgb(var(--folk-violet) / <alpha-value>)",
          "violet-bg": "rgb(var(--folk-violet-bg) / <alpha-value>)",
          mint: "rgb(var(--folk-mint) / <alpha-value>)",
          "mint-bg": "rgb(var(--folk-mint-bg) / <alpha-value>)",
          lemon: "rgb(var(--folk-lemon) / <alpha-value>)",
          "lemon-bg": "rgb(var(--folk-lemon-bg) / <alpha-value>)",
          sky: "rgb(var(--folk-sky) / <alpha-value>)",
          "sky-bg": "rgb(var(--folk-sky-bg) / <alpha-value>)",
          rose: "rgb(var(--folk-rose) / <alpha-value>)",
          "rose-bg": "rgb(var(--folk-rose-bg) / <alpha-value>)",
        },
```

- [ ] **Step 4: `darkMode` setzen**

In `tailwind.config.ts`, direkt nach `prefix: "",` einfügen:

```ts
  // `dark:`-Varianten hängen am Attribut, nicht an einer Klasse — der
  // ThemeProvider setzt data-theme auf <html>.
  darkMode: ["selector", '[data-theme="dark"]'],
```

- [ ] **Step 5: Beweisen, dass das Hell-Bild unverändert ist**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build ohne Fehler.

Dann `npm run dev` starten und `http://localhost:8080/firma` öffnen. Prüfen:
- Die Seitenleiste ist weiterhin warm-beige, nicht weiss oder grau.
- Anfragen und Offerten zeigen ihre Statusfarben (coral, mint, lemon).
- **Besonders prüfen:** eine Stelle mit Deckkraft, z. B. in `Auftraege.tsx` die
  Klasse `folk-coral/30`. Wäre die Kanalform falsch, wäre der Rand hier
  vollständig durchsichtig oder schwarz.

Wenn eine Farbe fehlt: Variablenname in `index.css` gegen den Schlüssel in
`tailwind.config.ts` prüfen — `bg-warm` ↔ `--folk-bg-warm`.

- [ ] **Step 6: Dunkelwerte einmal von Hand gegenprüfen**

In den Browser-Entwicklerwerkzeugen auf `<html>` das Attribut `data-theme="dark"`
von Hand setzen. Erwartung: die gesamte `/firma`-Oberfläche wird warm-dunkel.
Text bleibt lesbar; Karten heben sich vom Grund ab.

Noch **nicht** korrekt sind an dieser Stelle: shadcn-Dialoge (Task 4), sowie
alle Stellen mit hartkodierten Hellfarben — die gehören in Durchgang 5 und sind
hier kein Fehler.

Attribut wieder entfernen.

- [ ] **Step 6: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/index.css tailwind.config.ts
git commit -m "feat(theme): folk-Farben als CSS-Variablen mit Dunkel-Set"
```

---

## Task 4: shadcn-Tokens dunkelfähig machen

Ohne diesen Schritt bleiben alle Dialoge, Auswahlfelder, Eingaben und Popover hell — sie lesen `--background`, `--card`, `--border` und nicht die `folk`-Variablen.

**Files:**
- Modify: `src/index.css` (neuer Block innerhalb `:root[data-theme="dark"]`)

**Interfaces:**
- Consumes: den in Task 3 angelegten `:root[data-theme="dark"]`-Block.
- Produces: dunkle Werte für alle bestehenden shadcn-Variablen.

- [ ] **Step 1: Dunkle shadcn-Werte ergänzen**

In `src/index.css`, **innerhalb** des in Task 3 angelegten `:root[data-theme="dark"]`-Blocks, unterhalb der `--folk-*`-Zeilen und vor `color-scheme: dark;` einfügen:

```css
    /* shadcn — dieselben Variablennamen wie hell, nur andere Werte.
     * Die Neutraltöne sind an die warmen folk-Werte angeglichen: läge hier
     * ein blaustichiges Grau, stünde jeder Dialog kühl über einer warmen
     * Seite. Die Markentöne sind aufgehellt, weil die Hellwerte auf dunklem
     * Grund unter 4.5:1 fallen. */
    --background: 30 6% 7%;
    --foreground: 40 12% 92%;

    --card: 30 6% 10%;
    --card-foreground: 40 12% 92%;

    --popover: 30 6% 10%;
    --popover-foreground: 40 12% 92%;

    --primary: 210 70% 65%;
    --primary-foreground: 30 6% 7%;

    --secondary: 24 86% 60%;
    --secondary-foreground: 30 6% 7%;

    --muted: 30 5% 16%;
    --muted-foreground: 35 6% 60%;

    --accent: 270 60% 68%;
    --accent-foreground: 30 6% 7%;

    --destructive: 0 72% 58%;
    --destructive-foreground: 0 0% 100%;

    --border: 30 6% 16%;
    --input: 30 6% 16%;
    --ring: 210 70% 65%;

    --warning: 42 80% 58%;
    --warning-foreground: 30 6% 7%;

    --success: 158 50% 54%;
    --success-foreground: 30 6% 7%;

    --sidebar-background: 30 6% 8%;
    --sidebar-foreground: 40 12% 92%;
    --sidebar-primary: 210 70% 65%;
    --sidebar-primary-foreground: 30 6% 7%;
    --sidebar-accent: 30 5% 16%;
    --sidebar-accent-foreground: 40 12% 92%;
    --sidebar-border: 30 6% 16%;
    --sidebar-ring: 210 70% 65%;
```

- [ ] **Step 2: Von Hand prüfen**

`npm run dev`, `data-theme="dark"` von Hand auf `<html>` setzen, dann auf
`/firma/anfragen` einen beliebigen Dialog öffnen (z. B. über einen
Bearbeiten-Knopf). Erwartung: der Dialog hat dunklen Grund und hellen Text, der
Rand ist sichtbar, Eingabefelder sind lesbar.

- [ ] **Step 3: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/index.css
git commit -m "feat(theme): shadcn-Tokens fuer den Dunkelmodus"
```

---

## Task 5: Die 44px-Regel auf Touch-Geräte eingrenzen

**Ursache:** `src/index.css` erzwingt heute für **jeden** `button`, `a` und
`input[type=button|submit]` eine Mindestgrösse von 44×44px, unabhängig vom
Eingabegerät. Die Regel war für Mobilgeräte gedacht, greift aber auf dem Desktop
mit. Kompakte Bedienelemente (Segmentknöpfe mit 5px/12px Polsterung, 11px
Listenaktionen, 28px-Avatare) sind damit nicht baubar — sie werden stumm
aufgeblasen, ohne dass eine Klasse den Grund zeigt.

**Wirkung dieser Änderung:** Auf Touch-Geräten ändert sich nichts. Auf
Maus-Geräten verlieren alle Knöpfe und Verweise ihre erzwungene Mindestgrösse.
Das ist beabsichtigt; es betrifft alle Seiten und ist deshalb hier einzeln
geprüft, nicht nebenbei erledigt.

**Files:**
- Modify: `src/index.css:104-119`

- [ ] **Step 1: Regel umschliessen**

Den bestehenden Block ersetzen:

```css
  /* Ensure minimum touch target size for mobile */
  button, 
  [role="button"],
  input[type="button"],
  input[type="submit"],
  a {
    min-height: 44px;
    min-width: 44px;
  }

  /* But allow smaller inline elements */
  a:not(.btn):not([class*="button"]) {
    min-height: auto;
    min-width: auto;
  }
```

durch:

```css
  /* Mindestgrösse für Berührungsziele — nur dort, wo mit dem Finger bedient
   * wird. Vorher galt die Regel unabhängig vom Eingabegerät und blies auch
   * auf dem Desktop jedes Bedienelement auf 44px auf; kompakte Steuerelemente
   * waren dadurch nicht baubar, ohne dass eine Klasse den Grund zeigte.
   * Der Geltungsbereich wird eingegrenzt, die Regel nicht überschrieben. */
  @media (pointer: coarse) {
    button,
    [role="button"],
    input[type="button"],
    input[type="submit"],
    a {
      min-height: 44px;
      min-width: 44px;
    }

    /* But allow smaller inline elements */
    a:not(.btn):not([class*="button"]) {
      min-height: auto;
      min-width: auto;
    }
  }
```

- [ ] **Step 2: Beide Seiten prüfen**

`npm run dev`. Am Desktop (Maus) `/firma` öffnen: die Seitenleisteneinträge
werden kompakter, weil die erzwungenen 44px wegfallen. Das ist die erwartete
Änderung — kurz gegen den vorherigen Zustand halten und bestätigen, dass nichts
überlappt oder abgeschnitten ist.

Dann in den Entwicklerwerkzeugen die Geräteemulation einschalten (dadurch wird
`pointer: coarse` aktiv) und dieselbe Seite prüfen: die Einträge sind wieder
mindestens 44px hoch.

- [ ] **Step 3: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/index.css
git commit -m "fix(a11y): 44px-Beruehrungsziele auf pointer:coarse eingrenzen"
```

---

## Task 6: Erster Anstrich ohne Blitz

**Files:**
- Modify: `index.html` (Kopfbereich: `theme-color`, Vorab-Script; kritisches CSS ab Zeile 53)

**Interfaces:**
- Consumes: `THEME_STORAGE_KEY` als Literal `"crm:theme"` — das Script läuft vor
  jedem Modul und kann nichts importieren. Der Wert steht deshalb doppelt; der
  Kommentar hält fest, wo das Gegenstück liegt.
- Produces: `data-theme` auf `<html>`, bevor das erste Bild gezeichnet wird.

- [ ] **Step 1: `theme-color` ergänzen**

In `index.html` direkt nach der `viewport`-Zeile einfügen:

```html
    <meta name="theme-color" content="#FBFAF7" />
```

- [ ] **Step 2: Vorab-Script einfügen**

Ebenfalls im `<head>`, **vor** dem `<style>`-Block mit dem kritischen CSS:

```html
    <!--
      Setzt data-theme vor dem ersten Anstrich. Ohne das blitzt die helle
      Oberfläche auf, bevor React montiert ist.

      Nur unterhalb von /firma: ausserhalb liegen kundenseitige Seiten
      (/offerte/:token, /portal, /termin/*) und der Anmeldefluss. Deren
      Aussehen darf nicht von einer Einstellung des Operators abhängen.

      Der Schlüssel "crm:theme" steht auch in src/lib/theme.ts. Hier kann
      nicht importiert werden — beim Ändern beide Stellen anfassen.
    -->
    <script>
      (function () {
        try {
          if (location.pathname.indexOf("/firma") !== 0) return;
          var stored = null;
          try { stored = localStorage.getItem("crm:theme"); } catch (e) { /* gesperrt */ }
          var dark =
            stored === "dark" ||
            ((stored === null || stored === "system") &&
              window.matchMedia("(prefers-color-scheme: dark)").matches);
          if (dark) {
            document.documentElement.setAttribute("data-theme", "dark");
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", "#121110");
          }
        } catch (e) {
          /* Im Zweifel hell — ein Fehler hier darf die Seite nicht blockieren. */
        }
      })();
    </script>
```

- [ ] **Step 3: Kritisches CSS dunkelfähig machen**

Im `<style>`-Block ab Zeile 53 steht heute:

```css
      body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc;color:#1e293b}
```

und

```css
      .init-loader{width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:auto;margin-top:45vh}
```

Direkt **nach** der `.init-loader`-Zeile ergänzen:

```css
      /* Diese Regeln malen, bevor React montiert ist — ohne sie sieht ein
         Benutzer mit dunklem Theme trotz Vorab-Script einen hellen Blitz.
         Die Werte sind Literale, weil hier noch keine Variablen geladen sind;
         sie entsprechen --folk-bg / --folk-ink / --folk-line aus index.css. */
      html[data-theme="dark"] body{background:#121110;color:#EDEBE6}
      html[data-theme="dark"] .init-loader{border-color:#2B2926;border-top-color:#4FC3A4}
```

- [ ] **Step 4: Den Blitz tatsächlich prüfen**

`npm run dev`. In den Entwicklerwerkzeugen unter „Rendering" die Einstellung
`prefers-color-scheme: dark` erzwingen, dann `/firma` **neu laden** und die
Netzwerkdrosselung auf „Slow 3G" stellen, damit der Ladezustand sichtbar bleibt.

Erwartung: der Ladekreis erscheint auf dunklem Grund. Kein weisses Aufblitzen.

Zweite Prüfung: `/auth` neu laden — dort muss es **hell** bleiben, weil der Pfad
nicht mit `/firma` beginnt.

Dritte Prüfung: `localStorage` in den Entwicklerwerkzeugen sperren (Anwendung →
Speicher blockieren) und `/firma` laden. Erwartung: Seite lädt normal, kein
Fehler in der Konsole.

- [ ] **Step 5: Commit**

```bash
npm run type-check && npm run lint && npm test
git add index.html
git commit -m "feat(theme): Vorab-Script und dunkles Ladebild ohne Blitz"
```

---

## Task 7: `ThemeProvider` und Einhängen in `/firma`

**Files:**
- Create: `src/hooks/useTheme.tsx`
- Modify: `src/App.tsx:117-124` (`FirmaRouteWrapper`)

**Interfaces:**
- Consumes: `ThemePreference`, `ResolvedTheme`, `THEME_STORAGE_KEY`, `parseThemePreference`, `resolveTheme` aus Task 1.
- Produces:
  - `ThemeProvider: ({ children }: { children: ReactNode }) => JSX.Element`
  - `useTheme(): { theme: ThemePreference; resolvedTheme: ResolvedTheme; setTheme: (next: ThemePreference) => void }`

  **`resolvedTheme` ist der Wert, den Komponenten vergleichen.** Ein Vergleich
  `theme === "dark"` ist bei der Wahl `"system"` immer falsch.

- [ ] **Step 1: Provider schreiben**

Create `src/hooks/useTheme.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  /** Was der Benutzer gewählt hat — inklusive "system". */
  theme: ThemePreference;
  /** Was tatsächlich gilt. Nur dieser Wert darf verglichen werden. */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Grundfarben für die Statusleiste — dieselben Werte wie --folk-bg. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#FBFAF7",
  dark: "#121110",
};

const readStoredPreference = (): ThemePreference => {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // localStorage kann gesperrt sein (privater Modus, Richtlinie).
    return "system";
  }
};

const readSystemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;

/**
 * Hält das Erscheinungsbild der Operator-Oberfläche.
 *
 * Sitzt bewusst INNERHALB von FirmaRouteWrapper — genau wie I18nProvider und
 * aus demselben Grund: kundenseitige Seiten (/offerte/:token, /portal,
 * /termin/*) liegen ausserhalb und dürfen sich nicht nach einer Einstellung
 * des Operators richten. Beim Verlassen von /firma wird das Attribut entfernt.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(readSystemPrefersDark);

  // Nur horchen, solange die Wahl "system" ist — sonst ist die Media Query egal.
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    query.addEventListener("change", onChange);
    setSystemPrefersDark(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const resolvedTheme = resolveTheme(theme, systemPrefersDark);

  // `color-scheme` wird NICHT hier gesetzt, sondern in index.css am
  // :root-Block je Theme — sonst gäbe es zwei Quellen für denselben Wert,
  // und die Inline-Variante würde das Stylesheet stumm überstimmen.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);

    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", THEME_COLOR[resolvedTheme]);

    return () => {
      root.removeAttribute("data-theme");
      meta?.setAttribute("content", THEME_COLOR.light);
    };
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Gesperrter Speicher darf das Umschalten nicht verhindern —
      // die Wahl gilt dann nur für diese Sitzung.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme muss innerhalb von ThemeProvider stehen");
  return context;
};
```

- [ ] **Step 2: In `FirmaRouteWrapper` einhängen**

In `src/App.tsx` den Import ergänzen (bei den übrigen Hook-Importen):

```tsx
import { ThemeProvider } from "@/hooks/useTheme";
```

Dann `FirmaRouteWrapper` (Zeilen 117–124) ersetzen durch:

```tsx
// I18nProvider sitzt INNERHALB des CompanyProvider: die Dashboard-Sprache kommt aus
// companies.default_language. Öffentliche Seiten liegen bewusst ausserhalb — sie
// richten sich nach der Sprache des Dokuments, nicht nach der der Firma.
// ThemeProvider steht aus demselben Grund hier: das Erscheinungsbild ist eine
// Einstellung des Operators und darf nicht auf Kundenseiten durchschlagen.
const FirmaRouteWrapper = () => (
  <CompanyProvider>
    <I18nProvider>
      <ThemeProvider>
        <FirmaLayout>
          <Outlet />
        </FirmaLayout>
      </ThemeProvider>
    </I18nProvider>
  </CompanyProvider>
);
```

- [ ] **Step 3: Prüfen**

`npm run dev`. Auf `/firma` in der Konsole ausführen:

```js
localStorage.setItem("crm:theme", "dark"); location.reload();
```

Erwartung: die Oberfläche ist dunkel, `<html>` trägt `data-theme="dark"`.

Dann in der Anwendung zu `/auth` navigieren (abmelden oder Adresse direkt
eingeben). Erwartung: `data-theme` ist **verschwunden**, die Seite ist hell.

Zurück auf `/firma`: wieder dunkel.

Aufräumen: `localStorage.removeItem("crm:theme")`.

- [ ] **Step 4: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/hooks/useTheme.tsx src/App.tsx
git commit -m "feat(theme): ThemeProvider auf /firma begrenzt einhaengen"
```

---

## Task 8: `useBreakpoint`

**Files:**
- Create: `src/hooks/useBreakpoint.ts`

**Interfaces:**
- Consumes: `resolveBreakpoint`, `Breakpoint` aus Task 2.
- Produces: `useBreakpoint(): Breakpoint` — für **Verhalten** (Sheets, Gesten),
  nicht für Layout. Layout läuft über CSS-Media-Queries.

- [ ] **Step 1: Hook schreiben**

Create `src/hooks/useBreakpoint.ts`:

```ts
import { useEffect, useState } from "react";
import { resolveBreakpoint, type Breakpoint } from "@/lib/breakpoints";

const readWidth = (): number =>
  typeof window === "undefined" ? 0 : window.innerWidth;

/**
 * Liefert den aktuellen Shell-Bereich für VERHALTEN — welches Sheet sich
 * öffnet, ob eine Wischgeste aktiv ist.
 *
 * Nicht für Layout benutzen: Breiten und Spalten laufen über
 * CSS-Media-Queries. Würde das Layout an diesem Hook hängen, flackerte die
 * Shell beim ersten Render und bräche beim Vorab-Rendern (scripts/prerender.mjs),
 * wo es kein `window` gibt.
 */
export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    resolveBreakpoint(readWidth()),
  );

  useEffect(() => {
    const onResize = () => setBreakpoint(resolveBreakpoint(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return breakpoint;
};
```

- [ ] **Step 2: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/hooks/useBreakpoint.ts
git commit -m "feat(layout): useBreakpoint fuer verhaltensabhaengige Bereiche"
```

---

## Task 9: Umschalter im Menü, dreisprachig

Der Umschalter kommt in das bestehende Aufklappmenü von `FirmaLayout`, in dem
bereits Ton und Hinweise geschaltet werden — dort liegen die Voreinstellungen
des Benutzers. (Der Fuss der Seitenleiste enthält nur Avatar, Name, E-Mail und
den Abmelden-Knopf; dort gehört er nicht hin.)

**Files:**
- Modify: `src/components/firma/FirmaLayout.tsx` (Aufklappmenü, um Zeile 648–658)
- Modify: `src/i18n/catalog/de/…`, `src/i18n/catalog/fr/…`, `src/i18n/catalog/en/…`

**Interfaces:**
- Consumes: `useTheme` aus Task 7, `useT` aus `@/i18n/useI18n`.
- Produces: keine für spätere Tasks.

- [ ] **Step 1: Deutsche Schlüssel anlegen**

In `src/i18n/catalog/de/nav.ts` neben `nav.push.*` (um Zeile 55) ergänzen:

```ts
  "nav.theme.label": "Erscheinungsbild",
  "nav.theme.light": "Hell",
  "nav.theme.dark": "Dunkel",
  "nav.theme.system": "Wie das System",
```

- [ ] **Step 2: Französisch und Englisch anlegen**

In `src/i18n/catalog/fr/nav.ts`:

```ts
  "nav.theme.label": "Apparence",
  "nav.theme.light": "Clair",
  "nav.theme.dark": "Sombre",
  "nav.theme.system": "Comme le système",
```

In `src/i18n/catalog/en/nav.ts`:

```ts
  "nav.theme.label": "Appearance",
  "nav.theme.light": "Light",
  "nav.theme.dark": "Dark",
  "nav.theme.system": "Match system",
```

- [ ] **Step 3: Beweisen, dass fehlende Schlüssel auffallen**

Eine der drei `nav.theme.light`-Zeilen vorübergehend auskommentieren, dann:

Run: `npm run type-check`
Expected: FAIL — die `fr`/`en`-Kataloge sind `Record<keyof typeof de, string>`,
ein fehlender Schlüssel ist ein Compilerfehler.

Zeile wieder einkommentieren, `npm run type-check` erneut: grün.

- [ ] **Step 4: Menüeintrag ergänzen**

In `src/components/firma/FirmaLayout.tsx` die Importe ergänzen:

```tsx
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
```

(`Monitor`, `Moon` und `Sun` zu den bestehenden `lucide-react`-Importen
hinzufügen, keinen zweiten Import-Block anlegen.)

In der Komponente, die das Aufklappmenü rendert, neben `togglePushNotifications`:

```tsx
  const { theme, setTheme } = useTheme();
```

Dann im Menü, **nach** dem Push-Eintrag und **vor** dem `DropdownMenuSeparator`
über dem Abmelden-Eintrag, einfügen:

```tsx
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">
                  {t("nav.theme.label")}
                </DropdownMenuLabel>
                {(
                  [
                    { value: "light", icon: Sun, labelKey: "nav.theme.light" },
                    { value: "dark", icon: Moon, labelKey: "nav.theme.dark" },
                    { value: "system", icon: Monitor, labelKey: "nav.theme.system" },
                  ] as const
                ).map((option) => (
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
```

`t("nav.state.on")` existiert bereits — es wird für Ton und Hinweise verwendet.

- [ ] **Step 5: Prüfen**

`npm run dev`, `/firma` öffnen, das Menü aufklappen. Erwartung:

- Drei Einträge unter „Erscheinungsbild", der aktive ist markiert.
- „Dunkel" schaltet die Oberfläche sofort um, ohne Neuladen.
- Nach `location.reload()` bleibt die Wahl bestehen.
- „Wie das System" folgt der Systemeinstellung; Umstellen des Systemthemes
  ändert die Oberfläche ohne Neuladen.
- Dashboard-Sprache auf Französisch stellen: die drei Einträge heissen
  „Clair", „Sombre", „Comme le système".

- [ ] **Step 6: Gate und Commit**

```bash
npm run type-check && npm run lint && npm test
git add src/components/firma/FirmaLayout.tsx src/i18n/catalog
git commit -m "feat(theme): Umschalter im Menue, dreisprachig"
```

---

## Abschluss des Durchgangs

- [ ] **Gesamtprüfung von Hand**

Mit `npm run dev` und aktivem Dunkelmodus jede der 35 `/firma`-Routen einmal
öffnen. Notieren — **nicht beheben** —, welche Stellen hell bleiben: das ist die
Arbeitsliste für Durchgang 5. Erwartet sind Treffer bei `react-big-calendar`
(Kalender), `recharts` (Kennzahlen), der PDF-Vorschau, `ui/calendar.tsx` und
`ui/tiptap-editor.tsx`.

Die Liste in `docs/superpowers/specs/2026-07-28-uebersicht-redesign-dark-mode-design.md`
unter Abschnitt 7 ergänzen, damit Durchgang 5 nicht neu suchen muss.

- [ ] **Prüfen, dass Kundenseiten unberührt sind**

`/offerte/:token` mit einem gültigen Token, `/portal` und `/auth` bei aktivem
Dunkelmodus öffnen. Alle drei müssen hell bleiben.

- [ ] **CLAUDE.md §12 berichtigen**

Dort steht noch, `npm run type-check` prüfe nichts und man müsse
`npx tsc --noEmit -p tsconfig.app.json` benutzen. Das Skript ist inzwischen
`tsc -b` und baut beide Projekte. Die veraltete Warnung streichen — sie wurde
bereits einmal abgeschrieben und führte zu einer falschen Angabe in der
Spezifikation.

```bash
git add CLAUDE.md
git commit -m "docs: veraltete type-check-Warnung in CLAUDE.md streichen"
```

---

## Was dieser Durchgang NICHT liefert

Damit niemand es sucht:

- **Keine Mobile Shell** — Tab-Leiste, Mehr-Sheet und FAB kommen in Durchgang 2.
- **Keine neue Übersicht** — die Seite behält ihr heutiges Layout und wird nur
  dunkel einfärbbar. Durchgang 3.
- **Keine PWA** — kein Manifest, kein Standalone-Modus. Durchgang 4.
- **Keine Bereinigung der 302 hartkodierten Hellfarben** — Durchgang 5.
- **Keine Wiki-Anpassung** — Durchgang 6.
