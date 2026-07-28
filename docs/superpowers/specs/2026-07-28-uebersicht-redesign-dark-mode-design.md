# Übersicht-Redesign + Dark Mode (app-weit)

**Datum:** 2026-07-28
**Status:** Entwurf — vom Auftraggeber inhaltlich freigegeben, Umsetzung noch nicht begonnen
**Betrifft:** `/firma` (Shell aller 35 Routen) + `/firma` Übersicht + Wiki + PWA-Grundlage

---

## 1. Ausgangslage

Zwei Vorlagen liegen vor: ein Desktop-Redesign der Übersicht im flachen Vercel-Stil
mit Hell- und Dunkeltheme, und eine Mobil-/PWA-Vorlage, die unter 820px eine
native App-Anmutung fordert (Top-Bar, Bottom-Tab-Bar, FAB, Sheets).

Beide Vorlagen beschreiben ein grünes Token-Set, Emoji-Icons, hartkodiertes Deutsch
und Mock-Daten. Alle vier Punkte kollidieren mit dem Bestand. Die Messung des Ist-Zustands:

| Befund | Zahl | Konsequenz |
|---|---|---|
| `folk-*` Klassenverwendungen | 1478 in 45 Dateien | `folk` ist die Designsprache, nicht nur die Shell |
| Deckkraft-Modifikatoren (`folk-coral/30`) | 31 | Tokens müssen Kanalwerte tragen, nicht Hex |
| Hartkodierte Hellfarben (`bg-white`, `text-gray-*`) | 302 in 35 Dateien | brechen im Dunkeln → Durchgang 5 |
| Inline-Hex in `.tsx` | 127 | dito |
| Vorhandene `dark:`-Varianten | 0 | freies Feld, keine Kollisionen |
| Dark-Tokens in CSS | 0 | Dark Mode existiert nirgends |
| Tailwind | 3.4.17 | `darkMode: ['selector', …]` verfügbar |
| PWA-Infrastruktur | keine | kein Manifest, kein SW, kein `viewport-fit` |

### 1.1 Getroffene Entscheidungen

1. **Beide Themes, app-weit.** Dark Mode nur auf einer Seite wäre gebrochen, weil
   Shell und Dialoge geteilt sind.
2. **`folk` bleibt, ein Dark-Set kommt dazu.** Kein Wechsel auf die grüne Vorlagen-
   Palette: das hiesse 1478 Klassen umschreiben, ohne funktionalen Gewinn. Das Hell-
   Erscheinungsbild ändert sich dadurch **nicht**.
3. **Das Theme entscheidet über die Darstellung der Vorgänge** — hell Karten-Grid,
   dunkel Statusliste, wie in der Vorlage. Die `variant`-Prop bleibt trotzdem der
   Schaltpunkt, damit die Kopplung später lösbar ist.
4. **Lieferung in sechs Durchgängen** (Abschnitt 3–8), Fundament zuerst.

### 1.2 Punkte, die gegen die Vorlagen entschieden sind

Diese vier folgen aus Projektregeln, nicht aus Geschmack:

- **Icons bleiben lucide, nicht Emoji.** [`src/config/firmaNav.ts`](../../../src/config/firmaNav.ts)
  hält im Kopfkommentar ausdrücklich fest, dass Nav-Icons `LucideIcon` sind und nie
  Emoji — der Wiki-Validator importiert diese Liste, und eine Liste darf die beiden
  nicht mischen. Die Service-Kennzeichnung der Vorgänge (🏠 Privatumzug, ✨ Reinigung …)
  wird über farbige Icon-Chips mit `folk`-Feldern gelöst.
- **Keine hartkodierten deutschen Strings.** Alle neuen Texte laufen über `useT()`.
  Die `fr`/`en`-Kataloge sind `Record<keyof typeof de, string>` — ein fehlender
  Schlüssel ist ein Compilerfehler. Siehe CLAUDE.md §11b.
- **Keine Mock-Daten.** Die Übersicht liest heute echte Supabase-Daten; ein
  `mocks/uebersicht.ts` wäre ein Rückschritt. Die fehlenden Kennzahlen sind durch
  vorhandene Tabellen gedeckt (Abschnitt 9).
- **Kein `AppShell` / `Sidebar` / `NavItem` neu bauen.**
  [`FirmaLayout.tsx`](../../../src/components/firma/FirmaLayout.tsx) ist bereits diese
  Shell, inklusive Workspace-Umschalter, ⌘K-Feld, Badge-Zählern und Mobil-Schublade.

### 1.3 Aufgehobene Einschränkung

Die Desktop-Vorlage sagt „Don't touch the other pages". Die Mobil-Vorlage hebt das auf:
unter 820px ersetzt sie die Sidebar durch Bottom-Tab-Bar und Mehr-Sheet — das ist die
Navigation **aller** Seiten, nicht ein Bestandteil der Übersicht. Der Widerspruch wird
zugunsten der Mobil-Vorlage aufgelöst; die Shell-Arbeit bekommt deshalb einen eigenen
Durchgang (Abschnitt 4).

---

## 2. Nicht-Ziele

- Kein nativer Wrapper (Capacitor, React Native).
- Kein Offline-Sync, kein Cache-Worker mit Strategien.
- Keine Chart-Bibliothek: das Balkendiagramm sind `div`s, `recharts` bleibt unangetastet.
- Keine Verläufe, keine Schlagschatten auf ruhenden Karten.
- Keine Änderung an Auth-Fluss, Edge Functions oder RLS.
- Kein Service Worker (Begründung in Abschnitt 6).
- Keine neue npm-Abhängigkeit. `cmdk`, `lucide-react`, `vaul` und `date-fns` liegen
  bereits vor; das PWA-Manifest wird von Hand geschrieben.

---

## 3. Durchgang 1 — Fundament

Ziel: Die App wird dunkelfähig, ohne dass eine einzige bestehende Klasse umgeschrieben wird.

### 3.1 Token-Format: Kanalwerte, nicht Hex

`folk` steht heute als Hex-Literal in [`tailwind.config.ts:85`](../../../tailwind.config.ts).
Es wird zu CSS-Variablen — zwingend im Kanalformat:

```css
:root                    { --folk-card: 255 255 255; --folk-coral: 248 117  87; }
:root[data-theme="dark"] { --folk-card:  26  25  23; --folk-coral: 255 138 107; }
```

```ts
// tailwind.config.ts
folk: {
  card:  "rgb(var(--folk-card) / <alpha-value>)",
  coral: "rgb(var(--folk-coral) / <alpha-value>)",
  // …
}
```

**Warum nicht Hex in der Variable:** es gibt 31 Verwendungen mit Deckkraft-Modifikator
(`bg-folk-coral/30`, `text-folk-ink/40`). Tailwind ersetzt `<alpha-value>` nur in einer
Farbfunktion; mit `var(--x)` als Hex würde `/30` still wirkungslos oder ungültig. Das
Kanalformat erhält alle 31 Stellen unverändert.

### 3.2 folk — Hell (unverändert) und Dunkel (neu)

Das Dunkel-Set bleibt **warm-neutral**, kein Blauschwarz: sonst verliert die App ihre
Papier-Anmutung und stünde im Widerspruch zum Hell-Set.

| Token | Hell | Dunkel |
|---|---|---|
| `bg` | `251 250 247` · #FBFAF7 | `18 17 16` · #121110 |
| `bg-warm` | `247 245 239` · #F7F5EF | `23 22 20` · #171614 |
| `sidebar` | `243 241 234` · #F3F1EA | `20 19 17` · #141311 |
| `sidebar-hi` | `235 231 220` · #EBE7DC | `32 30 26` · #201E1A |
| `card` | `255 255 255` · #FFFFFF | `26 25 23` · #1A1917 |
| `ink` | `24 24 26` · #18181A | `237 235 230` · #EDEBE6 |
| `ink2` | `60 60 63` · #3C3C3F | `201 198 191` · #C9C6BF |
| `ink3` | `115 112 115` · #737073 | `150 146 137` · #969289 |
| `ink4` | `165 163 161` · #A5A3A1 | `138 133 124` · #8A857C |
| `ink5` | `199 197 192` · #C7C5C0 | `96 91 83` · #605B53 |
| `line` | `235 233 226` · #EBE9E2 | `43 41 38` · #2B2926 |
| `line-soft` | `242 240 232` · #F2F0E8 | `35 33 32` · #232120 |
| `line-hard` | `218 215 205` · #DAD7CD | `58 55 51` · #3A3733 |
| `coral` | `248 117 87` · #F87557 | `255 138 107` · #FF8A6B |
| `coral-lite` | `252 229 222` · #FCE5DE | `74 42 34` · #4A2A22 |
| `coral-bg` | `255 241 236` · #FFF1EC | `42 26 22` · #2A1A16 |
| `violet` | `110 91 216` · #6E5BD8 | `155 138 240` · #9B8AF0 |
| `violet-bg` | `242 238 253` · #F2EEFD | `36 31 58` · #241F3A |
| `mint` | `66 166 120` · #42A678 | `79 195 164` · #4FC3A4 |
| `mint-bg` | `235 246 240` · #EBF6F0 | `22 48 42` · #16302A |
| `lemon` | `212 165 10` · #D4A50A | `232 192 74` · #E8C04A |
| `lemon-bg` | `251 244 217` · #FBF4D9 | `50 41 19` · #322913 |
| `sky` | `58 130 186` · #3A82BA | `107 168 220` · #6BA8DC |
| `sky-bg` | `233 241 248` · #E9F1F8 | `22 36 47` · #16242F |
| `rose` | `194 68 114` · #C24472 | `224 123 163` · #E07BA3 |
| `rose-bg` | `249 233 240` · #F9E9F0 | `46 26 36` · #2E1A24 |

**Eine bewusste Abweichung:** `ink4` ist im Dunkeln auf #8A857C angehoben statt
mechanisch auf ~#726E66 gespiegelt. Der gespiegelte Wert läge bei 3.7:1 gegen `bg`;
`ink4` trägt aber Meta-Text (Zeitstempel, Routen), und die Vorlage verlangt ≥4.5:1 für
Fliesstext. #8A857C liegt bei ~5.1:1.

Kontrast der übrigen Schlüsselpaare gegen `bg` dunkel: `ink` 15.2:1, `ink3` 6.1:1,
`mint` 8.7:1, `coral` 8.2:1. Bei der Umsetzung werden alle Textpaare nachgemessen,
nicht nur diese.

### 3.3 shadcn-Tokens

Die shadcn-Variablen (`--background`, `--primary`, `--border`, `--sidebar-*` …) liegen
bereits als HSL-Tripel in Variablen vor — sie brauchen nur einen zweiten Block. Damit
werden **alle `ui/`-Primitiven** (Dialog, Select, Input, Popover, Sheet, Toast) in einem
Zug dunkelfähig, statt einzeln nachgezogen zu werden.

Die dunklen Neutraltöne werden auf die warmen folk-Werte ausgerichtet, damit ein Dialog
nicht blauschwarz über einer warmen Seite liegt. Die Markentöne (Blau, Orange, Violett)
werden aufgehellt, weil die Hellwerte auf dunklem Grund unter 4.5:1 fallen:

```css
:root[data-theme="dark"] {
  --background: 30 6% 7%;      --foreground: 40 12% 92%;
  --card: 30 6% 10%;           --card-foreground: 40 12% 92%;
  --popover: 30 6% 10%;        --popover-foreground: 40 12% 92%;
  --primary: 210 70% 65%;      --primary-foreground: 30 6% 7%;
  --secondary: 24 86% 60%;     --secondary-foreground: 30 6% 7%;
  --muted: 30 5% 16%;          --muted-foreground: 35 6% 60%;
  --accent: 270 60% 68%;       --accent-foreground: 30 6% 7%;
  --destructive: 0 72% 58%;    --destructive-foreground: 0 0% 100%;
  --border: 30 6% 16%;         --input: 30 6% 16%;  --ring: 210 70% 65%;
  --warning: 42 80% 58%;       --success: 158 50% 54%;
  --sidebar-background: 30 6% 8%;  /* … übrige sidebar-* analog */
}
```

`darkMode: ['selector', '[data-theme="dark"]']` in `tailwind.config.ts`, damit
`dark:`-Varianten am Attribut hängen statt an einer Klasse.

### 3.4 Theme-Laufzeit

- **`ThemeProvider`** in `src/hooks/useTheme.tsx` — eigener Provider, kein `next-themes`
  (das wurde aus dem Projekt entfernt und wird nicht zurückgeholt).
- **Zwei getrennte Werte, das ist verbindlich:**
  - `theme: 'light' | 'dark' | 'system'` — was der Benutzer gewählt hat.
  - `resolvedTheme: 'light' | 'dark'` — was tatsächlich gilt.

  Jeder Verbraucher liest `resolvedTheme`. Ein Vergleich `theme === 'dark'` ist bei der
  Wahl `'system'` **immer falsch** und würde auf einem dunkel eingestellten Gerät die
  helle Darstellung liefern.
- Persistenz in `localStorage` unter `crm:theme`. Ohne gespeicherten Wert gilt
  `'system'`; in diesem Fall wird auf Änderungen der Media Query gehört.
- Setzt `data-theme` **und** `color-scheme` auf `<html>`, damit native Bedienelemente
  (Scrollbalken, Auswahlfelder, Datumsauswahl) mitgehen.

#### Geltungsbereich: nur `/firma`

Das Attribut wird **nicht** dauerhaft global gesetzt. Ausserhalb von `/firma` liegen
kundenseitige Seiten — `/offerte/:token`, `/portal`, `/termin/*`, `/besichtigung/*` —
sowie der Auth-Fluss ([`App.tsx:159`](../../../src/App.tsx#L159)). Ein globales
`data-theme="dark"` würde die Sicht des Kunden von einer Einstellung des Operators
abhängig machen. Dieselbe Trennung, die §11b für die Sprache zieht, gilt hier für das
Erscheinungsbild.

- `FirmaRouteWrapper` setzt das Attribut beim Einhängen und entfernt es beim Aushängen.
- Das Vorab-Script prüft `location.pathname.startsWith('/firma')`, bevor es setzt.
- Druck- und PDF-Ansichten bleiben immer hell.

#### Kein Flash — und was dem heute entgegensteht

Ein Inline-Script im `<head>` von [`index.html`](../../../index.html) liest
`localStorage` und setzt `data-theme` vor dem ersten Paint. Es kommt ohne Build-Schritt
aus und darf nicht werfen, wenn `localStorage` gesperrt ist.

**Das allein genügt nicht.** Das kritische Inline-CSS in
[`index.html:53`](../../../index.html#L53) setzt heute feste helle Werte —
`body { background:#f8fafc; color:#1e293b }` und einen Ladekreis in `#e2e8f0`/`#3b82f6`.
Diese Regeln malen, bevor React montiert ist; ohne Anpassung sieht ein Benutzer mit
dunklem Theme trotz Vorab-Script einen hellen Blitz. Die Behauptung „kein Flash" ist
sonst unhaltbar. Das Inline-CSS bekommt deshalb eine `[data-theme="dark"]`-Variante für
Körperfarbe und Ladekreis — mit denselben Werten wie das folk-Dunkel-Set, als Literal,
weil an dieser Stelle noch keine Variablen geladen sind.

#### `theme-color`

`<meta name="theme-color">` existiert heute nicht und wird angelegt; der Provider
aktualisiert den Inhalt beim Themewechsel. Ohne das zeigt die Statusleiste im
Standalone-Modus die falsche Farbe.

#### Bedienpunkte

**Berichtigung:** Eine frühere Fassung verortete den Umschalter „neben der Push-Glocke
im Sidebar-Fuss". Den gibt es dort nicht. Der Fuss von
[`FirmaLayout.tsx:207`](../../../src/components/firma/FirmaLayout.tsx#L207) enthält
Avatar, Name, E-Mail und einen `MoreHorizontal`-Knopf. Die Glocke ist der
Push-Schalter **innerhalb des zugehörigen Aufklappmenüs**, zusammen mit dem Ton-Schalter.

Dorthin gehört auch der Theme-Schalter: in dieses Menü, neben Ton und Hinweise — dort
liegen die Voreinstellungen des Benutzers bereits. Zweiter Bedienpunkt ist die
Schalterzeile im Mehr-Sheet (Abschnitt 4.4). Ein Zustand, zwei Zugänge.

### 3.5 Die 44px-Regel — Ursachenkorrektur

[`src/index.css:105`](../../../src/index.css#L105) zwingt heute **jeden** `button`, `a`
und `input[type=button|submit]` auf `min-height: 44px; min-width: 44px`.

**Ursache:** eine Touch-Target-Regel, die global gilt, ohne das Eingabegerät zu
berücksichtigen. Sie war für Mobilgeräte gedacht, greift aber auch auf dem Desktop.

**Wirkung auf dieses Vorhaben:** die kompakten Bedienelemente beider Vorlagen (Segment-
Knöpfe 5px/12px, Listenaktionen 11px, 28px-Avatare, 34px-Icon-Chips) wären nicht baubar
— sie würden stumm auf 44px aufgeblasen. Der Fehler wäre schwer zu finden, weil keine
Klasse ihn zeigt.

**Korrektur:** die Regel wird in `@media (pointer: coarse)` gekapselt. Touch-Ziele
bleiben auf Touch-Geräten vollständig erhalten — was die Mobil-Vorlage ausdrücklich
verlangt (≥44px) —, das maus-bediente Dashboard wird frei. Zusätzlich werden alle
Hover-Stile der neuen Komponenten hinter `@media (hover: hover)` gelegt, damit auf
Touch kein klebender Hover-Zustand entsteht.

Das ist eine Behebung an der Wurzel, keine Ausnahme: die Regel wird nicht überschrieben,
sondern auf ihren tatsächlichen Geltungsbereich eingegrenzt.

### 3.6 Breakpoints

Verbindlich für beide Vorlagen:

| Bereich | Shell |
|---|---|
| ≥ 1100px | Sidebar 240px (Bestand), volles Desktop-Layout |
| 820–1099px | Sidebar als Icon-Leiste; KPI-Streifen 2×2; Karten-Grid 2 Spalten |
| < 820px | Mobile Shell: Top-Bar + Bottom-Tab-Bar + FAB; Karten 1 Spalte |

`useBreakpoint()` in `src/hooks/useBreakpoint.ts` liefert den Bereich für **Verhalten**
(Sheets, Swipe, Pull-to-Refresh). Das **Layout** selbst läuft über CSS-Media-Queries,
nicht über JS — sonst flackert die Shell beim ersten Render und bricht bei SSR/Prerender.

Referenzbreiten: Entwurf auf 390×844, Prüfung zusätzlich bei 360px und 430px.
`dvh` statt `vh`, `env(safe-area-inset-bottom)` für alles am unteren Rand.

---

## 4. Durchgang 2 — Mobile Shell

Ersetzt unter 820px die Mobil-Schublade von `FirmaLayout`. Betrifft alle 35 `/firma`-Routen
([`App.tsx`](../../../src/App.tsx)), deshalb ein eigener Durchgang vor der Übersicht.
Die Prüfliste wird aus `App.tsx` abgeleitet, nicht aus einer Schätzung.

### 4.1 Grundsatz: die Navigation wird aus der Konfiguration erzeugt

Die Vorlage listet die Einträge des Mehr-Sheets von Hand auf. Diese Liste ist bereits
beim Schreiben unvollständig — Abgleich mit `FIRMA_NAV_GROUPS`:

| Gruppe | Vorlage | Bestand | Fehlt in der Vorlage |
|---|---|---|---|
| HAUPTBEREICH | 6 | 9 | Fälle, Posteingang, Quittungen |
| BETRIEB | 4 | 4 | — |
| VERWALTUNG | 3 + Theme | 5 | Archiv, Hilfe |

Eine zweite, handgepflegte Liste würde still auseinanderlaufen, den Wiki-Validator
umgehen (er importiert `firmaNav.ts`, um zu beweisen, dass jeder Bereich einen
Hilfe-Artikel hat) und die `MODULES`-Feature-Flags ignorieren.

**Folge:** Mehr-Sheet und Tab-Bar lesen beide aus `firmaNav.ts`. Für die Tab-Bar
bekommt `FirmaNavItem` ein zusätzliches, ausdrückliches Feld `mobileTab?: boolean`;
genau vier Einträge tragen es (Übersicht, Anfragen, Offerten, Kalender), der fünfte
Platz ist „Mehr". Damit ist die Tab-Bar keine zweite Wahrheit, sondern eine Sicht auf
die erste.

### 4.2 Top-Bar

Klebend am oberen Rand, über dem Inhalt. `background: color-mix(in srgb, rgb(var(--folk-bg)) 92%, transparent)`
mit `backdrop-filter: blur(8px)`, `border-bottom: 1px solid` `folk-line`, Polsterung
`8px 16px 10px`. Scrollt nicht weg.

Links nach rechts: 32px runder Marken-Avatar (Firmenlogo oder Initialen, wie in der
bestehenden Sidebar) · zweizeiliger Block mit Firmenname 14px/700 (mit Ellipse
abgeschnitten) und 10.5px Meta „Dienstag, 28. Juli · 43 offen" · rechts zwei 36px runde
Icon-Knöpfe mit Hairline-Rand: Suche (öffnet das Such-Sheet) und Benachrichtigungen mit
rotem Zähler-Punkt.

### 4.3 Bottom-Tab-Bar

Fest am unteren Rand. `color-mix`-Hintergrund + Blur, `border-top` Hairline,
`padding: 8px 6px calc(14px + env(safe-area-inset-bottom))`, fünf gleich breite Spalten.

Je Tab: 18px lucide-Icon über 9.5px Label, Trefferfläche ≥44px. Aktiver Tab in
`folk-ink` 700, inaktiv `folk-ink4` 500. Tippen auf den bereits aktiven Tab scrollt
dessen Liste nach oben.

### 4.4 Mehr-Sheet

Bottom-Sheet über abgedunkeltem Hintergrund, Radius `22px 22px 0 0`, Ziehgriff 38×4px,
Ziehen zum Schliessen, Esc und Hintergrund-Tipp schliessen, Fokus gefangen.

**Es darf nie den ganzen Bildschirm bedecken** — der abgedunkelte Streifen oben bleibt
sichtbar, damit es als Sheet gelesen wird. Ist der Inhalt höher als der verfügbare
Platz, scrollt das Sheet intern, statt zu wachsen.

Inhalt: Kontozeile (Avatar, Benutzername, Firmenname, Chevron), darunter die
Gruppen aus `FIRMA_NAV_GROUPS` mit 10px/700 Grossbuchstaben-Gruppenlabels. Zeilen
`min-height: 48px`, 13.5px, Chevron rechts, Hairline zwischen den Zeilen. Als letzte
Zeile der Verwaltungsgruppe der Theme-Schalter (40×24px Spur).

**Kein „PRO".** Die Vorlage setzt neben den Firmennamen eine `PRO`-Pille. Das Projekt
kennt keine Abo-Stufen — CLAUDE.md §2 schliesst Stripe, Token-Guthaben und
Tarifstufen ausdrücklich aus, sie wurden beim Fork entfernt. Eine Stufenpille würde
etwas behaupten, das es nicht gibt. Wird Platz an dieser Stelle gebraucht, steht dort
die **Rolle** des angemeldeten Benutzers aus `user_roles`. Dasselbe gilt für die
`PRO`-Pille im Workspace-Umschalter der Desktop-Vorlage.

### 4.5 Such-Sheet und Kommandopalette

**Befund:** ⌘K ist heute eine Attrappe — die Sidebar zeigt ein `<span>` mit `<kbd>`,
ohne Handler. `cmdk` und [`src/components/ui/command.tsx`](../../../src/components/ui/command.tsx)
liegen aber bereits vor.

Ein Ergebnismodell, zwei Darstellungen: auf dem Desktop eine mittige Palette
(⌘K / Strg+K), auf dem Mobilgerät ein bildschirmfüllendes Sheet von oben mit
selbstfokussiertem Eingabefeld. Inhalt: letzte Suchen, dann gruppierte Live-Treffer
(Anfragen / Offerten / Kunden) und Schnellbefehle („Anfrage erfassen", „Zu Kalender").

### 4.6 FAB

56px rund, `right: 16px`, `bottom: calc(env(safe-area-inset-bottom) + 82px)`,
`folk-mint` als Grund, Plus-Glyphe, weicher Schatten in Markenfärbung. Öffnet
„Anfrage erfassen". Langes Drücken öffnet ein kleines Aktions-Sheet
(Anfrage erfassen · Offerte erstellen · Termin anlegen).

Der Scroll-Inhalt bekommt **~96px Bodenabstand**, damit die letzte Karte nie unter FAB
oder Tab-Bar verschwindet. FAB und Tab-Bar blenden aus, solange ein Eingabefeld den
Fokus hat — sonst springt das Layout beim Öffnen der Tastatur.

### 4.7 Sheets — vorhandenen `Drawer` benutzen, nichts Neues schreiben

**Berichtigung:** Eine frühere Fassung sah ein selbstgeschriebenes `BottomSheet` vor.
Das wäre eine Doppelung: [`src/components/ui/drawer.tsx`](../../../src/components/ui/drawer.tsx)
ist bereits ein Bottom-Sheet auf Basis von `vaul` — mit Ziehen, Hintergrund, Fokusfalle
und Schliessen per Esc. `vaul` steht in den Abhängigkeiten.

Mehr-Sheet, Such-Sheet und das Aktions-Sheet setzen darauf auf. Fehlt eine Eigenschaft
(Rastpunkte, `overscroll-behavior: contain`), wird sie **am vorhandenen Baustein**
ergänzt, nicht daneben neu gebaut.

---

## 5. Durchgang 3 — Die Übersicht

Neue Komponenten unter `src/components/firma/uebersicht/`. Jede Datei eine Aufgabe;
die Seite selbst komponiert nur.

`PageHeader` · `KpiStrip` · `KpiScroller` · `ActionBanner` · `SegmentedFilter` ·
`FilterChips` · `WorkItems` · `WorkItemCard` · `WorkItemRow` · `WorkItemMobileCard` ·
`WorkItemMobileRow` · `ActivityPanel` · `TodayPanel` · `RevenueBars`

### 5.0 Nichts Bestehendes darf verschwinden

Das `WorkItem`-Modell der Vorlage kennt nur Anfragen, Offerten und Aufträge. Die heutige
Übersicht zeigt aber mehr — [`Dashboard.tsx:127`](../../../src/pages/firma/Dashboard.tsx#L127)
lädt zusätzlich:

- **Besichtigungsanfragen** aus `notifications` (Typ `besichtigung_request`), samt
  Annahme-Dialog direkt auf der Übersicht.
- **Umzugsboxen-Lage** über `get_box_rental_stats` — überfällige und dringende Rückgaben.
- **Heutige Termine** aus `appointments`.

Diese drei sind Handlungsaufforderungen mit Frist. Fielen sie beim Redesign weg, wäre
das ein Funktionsverlust, den niemand bemerkt, bis eine Box nicht abgeholt wird. Sie
werden übernommen — als eigene, benannte Bereiche neben den Vorgängen, nicht in das
`WorkItem`-Modell hineingepresst, in das sie nicht passen.

**Vor der Umsetzung zu entscheiden:** ob die seit dem Redesign hinzugekommenen Bereiche
— `Aufgaben` (Wiedervorlage), `Fälle`, `Posteingang` und überfällige Posten aus dem
Finanzmodul — ebenfalls auf die Übersicht gehören. Sie sind heute nicht dort. Das ist
eine Erweiterung des Auftrags, keine Selbstverständlichkeit, und wird gefragt statt
angenommen.

### 5.1 Zwei Achsen, vier Renderpfade

```tsx
<WorkItems
  variant={resolvedTheme === "dark" ? "list" : "grid"}  // Theme entscheidet
  density={isMobile ? "mobile" : "desktop"}              // Breakpoint entscheidet
  items={items}
/>
```

Ein Datenmodell, vier Darstellungen. `variant` bleibt eine Prop und nicht ein direkter
Theme-Zugriff, damit die Kopplung später ohne Umbau lösbar ist.

**`resolvedTheme`, nicht `theme`.** Eine frühere Fassung schrieb hier `theme === "dark"`.
Bei der Einstellung `'system'` ist dieser Vergleich immer falsch — ein Gerät mit dunkler
Systemeinstellung bekäme das helle Layout auf dunklem Grund. Siehe Abschnitt 3.4.

### 5.2 Desktop

- **Kopfzeile:** `<h1>` „Übersicht" 24px/700, daneben 12px Meta „Wochentag, Datum ·
  N offen". Rechts im Hellen ein Filterfeld und ein Status-Aufklapper, im Dunkeln nur
  der Hauptknopf „+ Anfrage erfassen".
- **KPI-Streifen:** **ein** umrandeter Behälter, `grid-template-columns: repeat(4, 1fr)`,
  ohne Abstände — die geteilten Hairlines sind die Trenner. Je Zelle Label-Zeile
  (Icon + 11.5px), darunter Wert 26px/700 und Delta 11px/600. Delta grün wenn die
  Entwicklung gut ist, rot wenn ein wachsender Wert schlecht ist (unbeantwortete
  Anfragen), neutral bei Stillstand.
- **Abschnittskopf + Segmentfilter:** Alle · Neu · Offeriert · Gewonnen.
  Filtert clientseitig; **die KPI-Zahlen ändern sich dabei nicht.**
- **Vorgänge hell (Grid):** drei Spalten. Karte in drei Zonen — Kopf (34px Icon-Chip,
  Titel, Route, Überlaufmenü), Statuszeile (7px Punkt + Klartext), Fusszeile
  (relativer Zeitstempel links, **genau eine** Aktion rechts).
- **Vorgänge dunkel (Liste):** ein umrandeter Behälter, Zeilen durch Hairlines getrennt.
  Statuspunkt (bei `neu` mit Schein) · 200px-Block mit Titel und Route in kleiner
  Monospace · Statuspille · Detailtext · Zeitstempel · Aktionsknopf.
- **Unterer Bereich:** hell `1fr 1fr` mit Aktivität und Heute; dunkel `2fr 1fr` mit
  Umsatz-Balken und Heute.

Status, Punktfarbe und die eine Aktion:

| Status | Punkt | Aktion |
|---|---|---|
| `neu` — noch keine Offerte | `folk-coral` | „Offerte erstellen" (gefüllt) |
| `offeriert` — gesendet, ≤2 Tage | `folk-mint` | „Nachfassen" (sekundär) |
| `ueberfaellig` — >2 Tage offen | `folk-lemon` | „Nachfassen" (sekundär) |
| `gewonnen` — Auftrag steht | `folk-mint` kräftig | „Planen" (sekundär) |

Der Status wird **nie allein über Farbe** transportiert — jeder Punkt und jede Pille
trägt einen Textlabel.

### 5.3 Mobil

- **KPI-Streifen → waagrecht scrollende Kacheln.** `scroll-snap-type: x proximity`,
  Kachel 105px breit, `flex: none`, **`box-sizing: border-box`**. Ohne `border-box`
  addiert sich die Polsterung auf die Breite und die dritte Kachel wird abgeschnitten
  (105×3 + 2×10 Abstand + 32 Seitenrand = 367 ≤ 390). Währungskacheln setzen den Wert
  auf 15px/700, damit `CHF 48'200` einzeilig bleibt. Keine Seitenpunkte — weitere
  Kennzahlen scrollen einfach ins Bild.
- **Aktionsbanner** (nur hell, direkt unter den Kacheln): vollbreite Karte auf
  `folk-ink`, invertierte Schrift, „15 Anfragen warten" + Unterzeile. Öffnet Anfragen
  vorgefiltert auf `neu`. **Bei Zähler 0 ausgeblendet.**
- **Filter-Chips** statt Segmentleiste: waagrecht scrollend, `white-space: nowrap`
  (der Zähler darf nie vom Label abbrechen), `min-height: 34px`.
- **Vorgänge hell:** gestapelte Karten, Zeile 1 mit 38px Icon-Chip, Titel und Unterzeile
  (Route · Betrag), Statuspille rechts, dahinter ein **sichtbarer `⋯`-Knopf**. Zeile 2
  ist **eine vollbreite Hauptaktion** mit `min-height: 44px`.
- **Vorgänge dunkel:** ein umrandeter Listenbehälter, Zeilen mit Statuspunkt, Titel,
  Monospace-Unterzeile und kompaktem Aktionsknopf (Trefferfläche über Polsterung auf
  44px gebracht), ebenfalls mit sichtbarem `⋯`.
- **Reihenfolge unten:** Heute, dann Aktivität. Im Dunkeln steht die Umsatz-Balkenkarte
  über Heute.
- **10 Einträge und ein Link**, kein endloses Nachladen: darunter „Alle 43 →" als Sprung
  in die volle Liste. Die Übersicht ist eine Übersicht, keine zweite Anfragenliste.
- **Pull-to-Refresh** lädt KPIs, Vorgänge, Termine und Aktivität parallel neu.

#### Nebenaktionen sind sichtbar, Gesten nur Abkürzung

Die Mobil-Vorlage legt Öffnen, Löschen und Anrufen ausschliesslich hinter Wischen nach
links und einen Langdruck. Das wird **nicht** so gebaut.

Begründung: die Benutzer dieses CRM sind Disponenten eines Umzugsunternehmens, keine
geübten App-Benutzer. Eine Aktion, die nur über eine unsichtbare Geste erreichbar ist,
existiert für sie nicht — und für Tastatur- und Screenreader-Bedienung existiert sie
tatsächlich nicht.

- Jede Karte und jede Zeile trägt einen **sichtbaren `⋯`-Knopf**, der dasselbe
  Aktions-Sheet öffnet. Das ist der Hauptweg.
- **Wischen nach links und Langdruck bleiben** — aber als Abkürzung auf denselben
  Inhalt, nie als einziger Zugang.
- **Kein Löschen von der Übersicht.** Zerstörende Aktionen gehören in die Detailansicht,
  wo der Vorgang vollständig sichtbar ist. Eine Wischgeste, die neben einer Scrollgeste
  liegt und einen Datensatz entfernt, ist auf einem Telefon zu leicht auszulösen.
- Im installierten Standalone-Modus gibt es keine Browser-Zurück-Schaltfläche. Jede
  Detailansicht braucht deshalb eine **eigene, sichtbare Zurück-Schaltfläche**.

### 5.4 Zustände

- **Ladend:** Skelett, keine Spinner. KPI-Zellen zeigen einen 26px-Block, Vorgänge 3
  (Grid) bzw. 5 (Liste) Platzhalter mit denselben Rändern.
- **Leer:** ein umrandetes Feld mit Icon, 15px/600 „Keine offenen Vorgänge",
  12.5px Unterzeile und dem Hauptknopf.
- **Bewegung:** 120–200ms, `cubic-bezier(.2,.7,.2,1)`. Karten heben nicht ab, nur Rand
  und Schatten ändern sich. `prefers-reduced-motion: reduce` schaltet Übergänge ab.

---

## 6. Durchgang 4 — PWA

Nichts davon existiert heute.

- **`public/manifest.webmanifest`** von Hand: Name „Hirschenumzug CRM",
  `display: "standalone"`, `start_url: "/firma"`, maskierbare Icons 192 und 512,
  `theme_color` und `background_color` passend zum Hell-Set.
- **`viewport`** in [`index.html:5`](../../../index.html#L5) um `viewport-fit=cover`
  erweitern. Pinch-Zoom bleibt erlaubt; nur Doppeltipp-Zoom auf Bedienelementen wird
  unterbunden.
- **Kein Service Worker.** Frühere Fassungen dieses Dokuments hielten einen Worker mit
  `fetch`-Handler für zwingend. Die aktuellen Installierbarkeits-Kriterien von Chromium
  führen ihn nicht mehr auf — Manifest, HTTPS, Icons und die Interaktionsbedingung
  genügen. Da Offline-Betrieb ausdrücklich ausserhalb des Auftrags liegt, wäre ein leerer
  Durchreich-Worker reiner Ballast: er wird auf allen Geräten registriert, bleibt dort
  liegen und muss später wieder abgemeldet werden. **Er wird nicht gebaut.**
  Stellt sich beim Prüfen heraus, dass ein eigener Installations-Knopf über
  `beforeinstallprompt` gewünscht ist und ohne Worker ausbleibt, wird das als eigene
  Entscheidung vorgelegt — nicht stillschweigend nachgerüstet.
- **Manifest vollständig:** `id`, `name`, `short_name`, `scope`, `start_url`, `display`,
  `theme_color`, `background_color` und **echte** PNG-Icons in 192 und 512, davon
  mindestens eines `purpose: "maskable"`. Ein Manifest mit fehlendem `id` oder `scope`
  führt beim späteren Ändern der Startseite zu einer zweiten Installation.
- **`theme-color`** folgt dem Theme (Abschnitt 3.4).
- **Scrollverhalten:** `overscroll-behavior: contain` auf Scroll-Behältern; die Seite
  scrollt nie waagrecht — nur ausgewiesene Streifen tun das, mit versteckter Leiste.

---

## 7. Durchgang 5 — Dunkel-Nacharbeit

Nach Durchgang 1 erben alle Seiten die Tokens und sehen im Dunkeln weitgehend richtig
aus. Was bleibt, ist benannt und wird nicht stillschweigend liegengelassen:

- **302 hartkodierte Hellfarben** (`bg-white`, `text-gray-*`, `bg-slate-*`) in 35 Dateien.
- **127 Inline-Hex** in `.tsx`.
- **`react-big-calendar`** — eigenes Stylesheet, braucht Dunkel-Überschreibungen.
- **`recharts`** — Achsen, Gitter und Tooltips lesen keine folk-Tokens.
- **PDF-Vorschau** (`pdfjs-dist`) — heller Betrachter auf dunklem Grund.
- **`ui/calendar.tsx`** (DayPicker) — trägt feste Klassen wie `border-indigo-100` und
  `text-gray-900` ([Zeile 17](../../../src/components/ui/calendar.tsx#L17)). Betrifft
  jede Datumsauswahl der App.
- **`ui/tiptap-editor.tsx`** — `bg-white` am Rahmen
  ([Zeile 188](../../../src/components/ui/tiptap-editor.tsx#L188)); der Editor bliebe
  sonst ein weisser Block.

Diese beiden sind `ui/`-Primitive und damit breiter wirksam als eine einzelne Seite —
sie werden im Durchgang zuerst angefasst.

### 7.1 Gemessene Arbeitsliste (Stand nach Durchgang 1, 2026-07-28)

Erhoben über `src/pages/firma`, `src/components/firma`, `src/components/ui` und
`src/features/wiki`: **314 Treffer in 33 Dateien.** Nach Aufwand sortiert, damit
Durchgang 5 nicht neu suchen muss:

| Klassen | Hex | Datei |
|---:|---:|---|
| 43 | 14 | `src/pages/firma/Kalender.tsx` |
| 38 | 0 | `src/pages/firma/QuittungDetail.tsx` |
| 32 | 5 | `src/pages/firma/Besichtigungen.tsx` |
| 23 | 0 | `src/components/firma/AuftragModal.tsx` |
| 19 | 0 | `src/pages/firma/RechnungDetail.tsx` |
| 17 | 0 | `src/components/ui/calendar.tsx` ← Primitive, zuerst |
| 13 | 0 | `src/components/firma/AppointmentAnfrageSummary.tsx` |
| 11 | 2 | `src/components/ui/tiptap-editor.tsx` ← Primitive, zuerst |
| 10 | 0 | `src/components/firma/BesichtigungAnalysisView.tsx` |
| 9 | 0 | `src/components/firma/UmzugsboxModal.tsx` |
| 0 | 9 | `src/components/firma/CalendarExportMenu.tsx` |
| 7 | 1 | `src/pages/firma/Team.tsx` |
| 7 | 0 | `src/pages/firma/Preisgestaltung.tsx` |
| 7 | 0 | `src/pages/firma/OfferteDetail.tsx` |
| 7 | 0 | `src/components/firma/ReminderSettings.tsx` |
| 5 | 0 | `src/pages/firma/Umzugsboxen.tsx` |
| 5 | 0 | `src/pages/firma/OfferteErstellen.tsx` |
| 5 | 0 | `src/pages/firma/Leistungskatalog.tsx` |
| 4 | 0 | `src/components/firma/VoiceRecorder.tsx` |
| 0 | 3 | `src/pages/firma/Einstellungen.tsx` |
| 2 | 0 | `src/pages/firma/OfferteBearbeiten.tsx` |
| 2 | 0 | `src/components/firma/TeamWeekView.tsx` |

Dazu 11 weitere Dateien mit je einem Treffer.

**`Kalender.tsx` steht nicht zufällig oben:** dort kommen die eigenen Farben der Seite
und das Stylesheet von `react-big-calendar` zusammen. Diese Datei bekommt eine eigene
Aufgabe, keine Sammelbehandlung.

**Nicht pauschal ersetzen.** Ein Teil dieser Farben ist bewusst hell —
`QuittungDetail` und `RechnungDetail` zeigen die gedruckte Fassung eines Belegs; ein
weisses Blatt bleibt dort richtig, auch im Dunkelmodus. Vor jeder Änderung ist zu
entscheiden, ob die Farbe die *Oberfläche* oder das *Dokument* meint.

Jede Datei wird einzeln geprüft; eine pauschale Suchen-und-Ersetzen-Runde ist
ausgeschlossen, weil ein Teil dieser Farben bewusst hell ist (Dokumentvorschauen, die
das gedruckte Ergebnis zeigen).

---

## 8. Durchgang 6 — Wiki nachziehen

Dieser Durchgang fehlte in der ersten Fassung. Er ist nicht optional: das In-App-Wiki
unter `/firma/hilfe` beschreibt die Bedienung, die hier umgebaut wird, und wird im
selben Moment falsch, in dem das neue Layout live geht.

Konkret beschreibt
[`navigation-und-benachrichtigungen.ts`](../../../src/features/wiki/content/de/navigation-und-benachrichtigungen.ts)
unter „Am Mobiltelefon" die heutige Bedienung mit ausklappbarem Menü und Seitenleiste.
Nach Durchgang 2 gibt es dort eine Tab-Leiste und ein Mehr-Sheet. Ein Wiki, das die
Bedienung falsch erklärt, ist schlimmer als keines — es kostet den Benutzer Zeit und
Vertrauen.

Umfang:

- **Navigationsartikel in DE, FR und EN** auf die neue Mobilbedienung umschreiben.
- **Neuer Abschnitt zum Dunkelmodus:** wo der Schalter sitzt (Aufklappmenü und
  Mehr-Sheet), dass er nur die Ansicht des Operators betrifft und nichts an
  Kundendokumenten ändert.
- **Screenshots neu erzeugen** für Übersicht, Seitenleiste, Kopfzeile und die
  Mobilansichten: `npm run wiki:capture`.
- **Aufnahme-Skript festnageln:** die Aufnahme muss `crm:theme` auf `light` erzwingen.
  Sonst entscheidet das Systemtheme der aufnehmenden Maschine, ob die Bilder hell oder
  dunkel werden — und das Wiki bekäme bei jedem Lauf ein anderes Aussehen.
- **Bild-Versionskennung auf `v2` heben**, damit zwischengespeicherte alte Aufnahmen
  nicht weiterleben.
- **`npm run wiki:validate`** muss durchlaufen; der Validator prüft, dass jeder
  sichtbare Bereich einen Artikel hat, und liest dafür `firmaNav.ts` — nach der
  Ergänzung um `mobileTab` (Abschnitt 4.1) ist das erneut zu bestätigen.

---

## 9. Daten

Keine Mocks. Die bestehenden Abfragen der Übersicht bleiben; ergänzt wird:

| Bedarf | Quelle |
|---|---|
| KPI Umsatz · Monat | `finance_overview`-RPC → `kassiert_total` / `kassiert_30t` |
| Umsatz letzte 5 Wochen | `payments.payment_date`, Stornos abgezogen |
| Deltas (▲25%) | Vergleichszählung der Vorperiode je Kennzahl |
| Vorgänge + Status | `leads` ⋈ `offers` ⋈ `auftraege` |

### 9.1 Umsatz hat genau eine Quelle

Eine frühere Fassung dieses Dokuments schlug vor, `rechnungen.gesamttotal` über `datum`
zu summieren. **Das ist falsch und wird nicht gebaut.**

[`src/hooks/useFinanzen.ts:11`](../../../src/hooks/useFinanzen.ts) hält im Kommentar
ausdrücklich fest, dass `kassiert_total` — die Summe der Zahlungseingänge — die
**einzige** Umsatzzahl des Systems ist, und nennt den Grund: vor dem Zahlungsbuch
rechnete jede Liste ihre eigene Summe, und Rechnung plus Quittung zusammen ergaben mehr,
als tatsächlich hereingekommen war.

Eine rohe Rechnungssumme würde Entwürfe, Gutschriften, Stornos und unbezahlte Beträge
als Umsatz ausweisen — also genau den Fehler wieder einführen, den Migration
`20260729150000` behoben hat. Die Übersicht ruft deshalb dieselbe RPC auf wie das
Finanzmodul. **Es wird keine zweite Umsatzrechnung geschrieben.**

Der Wochenverlauf braucht eine Zerlegung, die `finance_overview` nicht liefert. Er wird
aus `payments` abgeleitet — nicht als neue Geschäftslogik, sondern als Gruppierung
derselben Zahlungseingänge, aus denen `kassiert_total` besteht. Vor der Umsetzung ist zu
prüfen, ob sich die Wochenreihe sauber als Erweiterung der bestehenden RPC unterbringen
lässt; das ist der Zerlegung im Frontend vorzuziehen.

### 9.2 Statusableitung — Versionierung beachten

`offers` ist **versioniert**: die Tabelle trägt `superseded_at`, `supersedes_offer_id`,
`version_number`, `offer_series_id` und `revision_reason`. Eine naive Verknüpfung
`leads ⋈ offers` erzeugt deshalb **einen Vorgang je Revision** statt je Anfrage.

Verbindliche Regeln:

- Es zählt **nur die aktuelle Offerte** je Serie: `superseded_at IS NULL`.
- Die 2-Tage-Grenze rechnet ab **`sent_at`**, nicht ab `created_at` — ein Entwurf, der
  drei Tage liegt, ist nicht überfällig, weil er nie beim Kunden war.
- `status = 'draft'` erscheint **nicht** als `offeriert`; ein Lead mit ausschliesslich
  Entwürfen bleibt `neu`.
- `rejected_at` und abgelaufene Offerten (`valid_until` in der Vergangenheit) bekommen
  einen **eigenen Zustand** — sie sind weder offen noch gewonnen und dürfen nicht still
  in `offeriert` fallen.
- `accepted_at` gesetzt → `gewonnen`, **auch wenn noch kein Auftrag existiert**. Das
  Anlegen des Auftrags ist der nächste Arbeitsschritt, nicht die Bedingung für den Sieg.

Daraus:

| Zustand | Bedingung |
|---|---|
| `neu` | keine Offerte, oder nur Entwürfe |
| `offeriert` | aktuelle Offerte `sent`/`viewed`, `sent_at` ≤ 2 Tage |
| `ueberfaellig` | aktuelle Offerte `sent`/`viewed`, `sent_at` > 2 Tage |
| `abgelehnt` | `rejected_at` gesetzt oder `valid_until` verstrichen |
| `gewonnen` | `accepted_at` gesetzt (Auftrag optional) |

**Die tatsächlichen Werte der `status`-Spalte werden vor der Umsetzung gegen die
Datenbank geprüft**, nicht aus den Namen geschlossen.

### 9.3 Die Aktionen der Vorgänge

Jede Schaltfläche braucht ein benanntes Ziel, sonst wird sie beim Bauen erfunden:

| Aktion | Ziel |
|---|---|
| „Offerte erstellen" | `/firma/offerte-erstellen` mit vorbelegter `lead_id` |
| „Nachfassen" | Detailansicht der Offerte, Nachfass-Dialog geöffnet |
| „Planen" | Terminanlage mit vorbelegtem Auftrag |
| „Öffnen" | Detailansicht des Vorgangs |

Die genauen Routen werden vor der Umsetzung gegen `App.tsx` abgeglichen.

Ansichtsmodell (`src/types/uebersicht.ts`), damit die Darstellung nicht an der
Tabellenform hängt:

```ts
type WorkItemStatus = "neu" | "offeriert" | "ueberfaellig" | "gewonnen";

interface WorkItem {
  id: string;
  service: ServiceKey;      // vorhandener Typ aus @/i18n/domain
  title: string;
  from?: string;
  to?: string;
  status: WorkItemStatus;
  amountChf?: number;
  daysOpen?: number;
  jobDate?: string;         // ISO
  createdAt: string;        // ISO
}
```

`Kpi`, `ActivityEvent`, `Appointment` und `RevenueWeek` analog.

**Zahlen und Daten** laufen über die vorhandenen Helfer aus
[`src/i18n/format.ts`](../../../src/i18n/format.ts) — `formatNumber` liefert unter
`de-CH` bereits `48'200` mit Apostroph. Ein eigenes `Intl.NumberFormat('de-CH')` wird
nicht angelegt, sonst gäbe es zwei Wahrheiten für dieselbe Formatierung.

---

## 10. Sprache

Alle neuen Zeichenketten als Schlüssel in `src/i18n/catalog/de/`, mit `fr`- und
`en`-Entsprechungen. Ein fehlender Schlüssel bricht den Build — das ist beabsichtigt.

Die Vorlage verlangt Schweizer Deutsch: `ss` statt `ß`, förmliche Anrede, Datum
`28.07.2026`, Uhrzeit `13:28`. Das gilt für den **deutschen** Katalog; die
Dashboard-Sprache bleibt umschaltbar.

**Die Dokumentachse ist hiervon nicht berührt.** Kein Renderer dieser Arbeit erzeugt
Kundendokumente, also liest keine dieser Komponenten eine Dokumentsprache. Siehe
CLAUDE.md §11b.

---

## 11. Barrierefreiheit

- Anklickbare Karten und Zeilen sind echte `<button>` oder `<a>` — kein `onClick` auf
  `<div>`.
- Sichtbarer Fokusring: 3px, Markenfarbe bei 40% Deckkraft, 2px Versatz — in beiden
  Themes geprüft.
- Status nie allein über Farbe: jeder Punkt und jede Pille trägt Text.
- Fliesstext ≥4.5:1 in beiden Themes.
- Balken des Umsatzdiagramms tragen `aria-label` mit Woche und Betrag.
- Sheets fangen den Fokus, schliessen mit Esc, geben den Fokus an den auslösenden
  Knopf zurück.
- Aktionsknöpfe in Karten und Zeilen rufen `stopPropagation`, damit sie nicht zusätzlich
  die Navigation der Karte auslösen.

---

## 12. Verifikation

Getestet wird, was testbar ist — nach der Projektregel nur reine Funktionen:

- Statusableitung `leads`+`offers`+`auftraege` → `WorkItemStatus` inklusive der
  2-Tage-Grenze.
- Delta-Rechnung, besonders Division durch null bei leerer Vorperiode.
- Wochengruppierung des Umsatzes über Jahresgrenzen.
- Ableitung der Tab-Bar aus `firmaNav.ts`. **Nicht** „immer genau fünf": ein
  abgeschaltetes Modul entfernt seinen Tab, und der Test wäre falsch. Geprüft wird:
  höchstens fünf Einträge, „Mehr" immer zuletzt, kein Eintrag mit abgeschaltetem
  `moduleKey`, und jedes Ziel der Seitenleiste über Tab-Bar **oder** Mehr-Sheet
  erreichbar.
- Zuordnung Route → aktiver Tab über Präfixvergleich: `/firma/offerten/:id` markiert
  „Offerten", nicht „Mehr". Geprüft mit den Detailrouten aus `App.tsx`, inklusive der
  Falle, dass `/firma` als Präfix auf alles passt und deshalb exakt verglichen werden
  muss.

Von Hand geprüft, weil UI-Komponenten hier nicht getestet werden:

- Beide Themes auf allen drei Breakpoints; 360, 390 und 430px Breite.
- Kein waagrechtes Scrollen der Seite auf 360px.
- Nichts verdeckt unter FAB oder Tab-Bar.
- Jedes Navigationsziel der Sidebar über Tab-Bar oder Mehr-Sheet erreichbar.
- Kein Themewechsel-Flash beim Neuladen, auch bei gesperrtem `localStorage`.
- Installierter Standalone-Modus: Statusleistenfarbe, sicherer Bereich, Startseite.

Vor jedem Commit: `npm run type-check`, `npm run lint`, `npm test`.

> **Berichtigung:** Eine frühere Fassung dieses Dokuments behauptete, `npm run type-check`
> prüfe wegen der Solution-Style-`tsconfig.json` nichts. Das stimmt nicht mehr: das
> Skript ist heute `tsc -b`, und ein Trockenlauf zeigt, dass es `tsconfig.app.json` und
> `tsconfig.node.json` baut. **CLAUDE.md §12 trägt die veraltete Warnung noch** und
> gehört korrigiert — getrennt von dieser Arbeit, damit die Behauptung nicht weiter
> abgeschrieben wird.

---

## 13. Risiken

- **`color-mix` und `backdrop-filter`** brauchen aktuelle Browser. Beide werden nur für
  Verzierung eingesetzt; ohne sie bleibt ein deckender Hintergrund — die Leiste ist
  weiterhin lesbar. Wird als `@supports`-Rückfall gebaut.
- **Wisch- und Langdruck-Gesten** kollidieren leicht mit dem Seitenscroll. Sie werden
  auf einen waagrechten Schwellwert festgelegt und beim ersten senkrechten Ausschlag
  abgebrochen. Das Risiko ist begrenzt, weil jede Geste nur eine Abkürzung auf den
  sichtbaren `⋯`-Weg ist (Abschnitt 5.3) — schlägt sie fehl, geht nichts verloren.
- **Der Service Worker ist ein Dauerobjekt.** Ein einmal registrierter Worker bleibt
  auf den Geräten. Deshalb strikt durchreichend, mit Versionskennung und einem
  dokumentierten Weg zur Abmeldung.
- **`ink4` im Dunkeln** ist bewusst heller als eine mechanische Spiegelung. Wer die
  Palette später „begradigt", nimmt Kontrast weg — der Grund steht in Abschnitt 3.2 und
  gehört als Kommentar in die CSS-Datei.
