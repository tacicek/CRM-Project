# Wiki / Hilfe & Anleitung — Wartung

Die in-App-Hilfe unter `/firma/hilfe`. Dieses Dokument erklärt, wie man Artikel pflegt,
Screenshots neu aufnimmt und prüft, dass beides noch zur laufenden Anwendung passt.

> **Sprache dieses Dokuments:** Deutsch, wie der Rest von `docs/`. Die Artikelinhalte
> selbst liegen dreisprachig vor (DE als Quelle, FR und EN vollwertig).

---

## 1. Wo was liegt

```
src/features/wiki/
  wikiTypes.ts          Blocktypen, Artikel-Metadaten, Suchindex-Typ
  wikiSlugs.ts          ⭐ Die Liste aller Artikel. Das Tor: nur was hier steht, existiert.
  wikiRegistry.ts       Sprachunabhängige Metadaten + ROUTES_DEFERRED
  wikiIcons.tsx         Erlaubte Lucide-Icons (explizit, kein dynamischer Import)
  wikiRouteMap.ts       CRM-Route → Artikel (für die Hilfe-Schaltfläche in der Kopfzeile)
  wikiSearch.ts         Normalisierung, Synonyme, Ranking
  wikiSearchKeyboard.ts Pfeiltasten-Logik (rein, testbar)
  wikiContent.ts        Lazy-Loader für Artikel und Suchindex
  wikiScreenshotMeta.generated.ts   ⚠️ generiert — nicht von Hand ändern
  content/
    searchIndex.{de,fr,en}.ts   leichter Index (Titel, Kurztext, Stichwörter)
    {de,fr,en}/<slug>.ts        die eigentlichen Texte
  components/           WikiHome, WikiArticleView, WikiSearch, WikiFigure,
                        WikiCallout, WikiHelpButton
src/pages/firma/Hilfe.tsx        Die Seite (Index + Artikel in einem)
src/config/firmaNav.ts           ⭐ Die Navigationsdaten — Quelle der Abdeckungsprüfung
public/wiki/screenshots/{de,fr,en}/
supabase-wiki/                   Der isolierte Screenshot-Stack
scripts/wiki-db.sh               Guard + Schema-Aufbau
scripts/wiki-seed.mjs            Testkonto + Fixtures + Live-Probe
scripts/capture-wiki-screenshots.mjs
scripts/wiki-shots.manifest.mjs  Was fotografiert wird
scripts/validate-wiki.mjs        Einstiegspunkt für die Prüfungen
```

**Kurze Wiki-Beschriftungen** (Schaltflächen, Überschriften der Hilfe selbst) liegen in
`src/i18n/catalog/{de,fr,en}/wiki.ts`. **Artikeltexte niemals dort ablegen** — die
Kataloge werden eager geladen und lägen damit im Start-Bundle.

---

## 2. Einen Artikel hinzufügen

Reihenfolge einhalten; die Typen erzwingen sie ohnehin.

1. **Slug eintragen** in `src/features/wiki/wikiSlugs.ts`.
   Ab hier ist das Projekt rot, bis alle drei Sprachen vorliegen. Das ist Absicht: ein
   halb übersetzter Artikel soll ein Compile-Fehler sein, keine Merkregel.

2. **Metadaten** in `wikiRegistry.ts` ergänzen: `category`, `kind`, `icon`, `routes`,
   `moduleKey`, `related`, `lastVerified`, `verifiedCommit`.
   - `routes` sind React-Router-Muster (`/firma/kunden/:id`). Sie speisen die
     Hilfe-Schaltfläche in der Kopfzeile **und** die Abdeckungsprüfung.
   - `moduleKey: null` nur für Artikel, die nie ausgeblendet werden dürfen.

3. **Route aus `ROUTES_DEFERRED` entfernen**, sobald der Artikel sie abdeckt.

4. **Drei Textdateien** anlegen: `content/de/<slug>.ts`, dann `fr/`, dann `en/`.
   Jede endet mit `satisfies WikiArticleBody`.

5. **Drei Indexeinträge** in `content/searchIndex.{de,fr,en}.ts`.
   Stichwörter kleingeschrieben, mindestens drei, **in der jeweiligen Sprache gedacht** —
   keine Übersetzung der deutschen Liste. Wer französisch sucht, tippt «connexion».

6. **Loader-Tabellen** in `wikiContent.ts` um den Slug ergänzen (drei Zeilen).

7. `npm run wiki:validate`

### Regeln für den Text

- Deutsch mit «Sie», Französisch mit «vous», Englisch direkt mit «you».
- Sprachniveau A2–B1. Kurze Sätze, gängige Wörter, aktive Formulierungen.
- **Höchstens drei kurze Sätze pro Absatz.**
- Beschriftungen **wörtlich aus der laufenden Anwendung** übernehmen — und zwar aus dem
  Katalog der jeweiligen Sprache (`catalog/fr/*.ts`), nicht aus einer Übersetzung des
  deutschen Textes.
- Keine Emojis als Überschrift, Aufzählungszeichen oder Statussymbol.
- Keine Entwicklerbegriffe. Der Validator lehnt RLS, RPC, JSON, UUID, Migration,
  Trigger und Ähnliches ab.
- Nichts versprechen, was die Anwendung nicht kann. Beispiel: aus dem Posteingang lässt
  sich **nicht** antworten; das gehört so in den Text.
- Vor einem unumkehrbaren Schritt ein `callout` mit `tone: "danger"`, vor einem
  rollenabhängigen eines mit `tone: "permission"`.

### Was der Validator über Sprachen hinweg erzwingt

Gleiche Anzahl und gleiche Reihenfolge der Blöcke, gleiche Anzahl Schritte, Zeilen und
Listenpunkte, gleiche Anker-`id`s, gleiche Hotspot-Nummern und -Koordinaten.
**Nicht** erzwungen: Bildmasse — Ausschnitte fallen je Sprache unterschiedlich hoch aus,
weil Text anders umbricht. Jede Zahl wird stattdessen gegen die echte Datei geprüft.

---

## 3. Screenshots

### Der Stack

Ein eigenes Supabase-Projekt `crm-wiki` (API 54421, DB 54422), getrennt von
`supabase-test` (dort sind API und Auth bewusst aus, ein Browser kann sich nicht
anmelden) und vom App-Stack.

```bash
npm run wiki:db:up                              # Stack starten
CRM_WIKI_ENV=1 npm run wiki:db:bootstrap        # Schema + Testdaten + Live-Probe
CRM_WIKI_ENV=1 CRM_WIKI_CAPTURE=1 npm run wiki:capture
npm run wiki:db:down                            # Stack stoppen
```

`WIKI_ANCHOR_DATE=2026-07-28` setzt das Bezugsdatum der Fixtures fest.

### Warum zwei Umgebungsvariablen

`CRM_WIKI_ENV=1` erlaubt den zerstörenden Schema-Neuaufbau, `CRM_WIKI_CAPTURE=1`
zusätzlich das Schreiben von Bildern. Beides wird nie erraten.

> ### ⚠️ Die eine Sache, die man hier verstehen muss
>
> `.env.local` zeigt auf **Produktion**. `vite.config.ts` schreibt im Dev-Modus die für
> den Browser sichtbare `VITE_SUPABASE_URL` auf `window.location.origin` um und leitet
> `/rest`, `/auth`, `/storage` an das aufgelöste Ziel weiter. Die Seite hält sich also
> **immer** für lokal — auch wenn jedes Byte aus der Produktionsdatenbank kommt.
>
> Eine Prüfung «ist die URL Loopback?» geht deshalb gegen Produktion durch.
>
> Der Schutz besteht aus zwei Teilen, und **keiner davon darf entfernt werden**:
> 1. Das Capture-Skript startet ein **eigenes** Vite und setzt **alle sechs** Variablen
>    der Auflösungskette explizit. Nur `VITE_SUPABASE_URL` zu setzen genügt nicht: ein
>    leerer Wert fällt auf `SUPABASE_URL` durch, und `VITE_SUPABASE_PROJECT_ID` ist ein
>    dritter Weg zu einem entfernten Host.
> 2. Es fragt die Datenbank **hinter dem Proxy**, wer sie ist
>    (`public.crm_wiki_identity()`). Produktion hat diese Funktion nicht und fällt genau
>    dort durch.
>
> Der zugehörige Test heisst `refuses production behind a loopback URL`
> (`src/test/__tests__/wiki-guard.test.ts`). Wenn er je gelöscht wird, kann ein Lauf
> echte Kundendaten fotografieren.

### Warum keine E-Mails hinausgehen

Vier voneinander unabhängige Schichten, drei davon strukturell:

1. `[edge_runtime] enabled = false` — jeder ausgehende Weg der App läuft über
   `supabase.functions.invoke`; ohne Edge-Runtime antwortet Kong mit einem Fehler.
2. `[inbucket] enabled = false` — GoTrue hat gar keinen SMTP-Endpunkt.
3. Keine Zeile in `company_secrets`, alle Resend-/Twilio-Felder leer.
4. `context.route("**/functions/v1/**", abort)` im Browser als letzte Sicherung.

### Eine neue Aufnahme hinzufügen

In `scripts/wiki-shots.manifest.mjs` einen Eintrag ergänzen:

```js
{
  id: "kunden-liste",             // Dateiname ohne Sprache und Version
  route: "/firma/kunden",
  viewports: ["desktop", "mobile"],
  readySelector: "h1",
  minCount: { selector: "tbody tr", min: 3 },   // Beweis, dass die Seite nicht leer ist
  mask: ["input[type='password']"],
}
```

- **Selektoren sprachneutral wählen.** `getByRole`, Struktur, Zeilenzahlen — kein Text,
  der je Sprache anders lautet.
- `prepare` darf **nur lesend** interagieren: ein Menü öffnen, einen Reiter wechseln.
  Niemals absenden, niemals löschen.
- Danach die Bildmasse aus der Ausgabe in die Artikel eintragen (oder `wiki:validate`
  laufen lassen — es nennt die richtigen Zahlen).

### Wann `-v<n>` erhöhen

Dateien in `public/` tragen keinen Inhalts-Hash, und `nginx.conf` liefert sie als
`immutable` aus. Ändert sich ein Bild inhaltlich, **muss** das Suffix hoch
(`kunden-liste-v1.webp` → `-v2.webp`), sonst sehen Nutzer monatelang das alte Bild.

### Bildregeln

- Nur `.webp` (oder `.avif`) im Repo. PNG bleibt in `/tmp`.
- Desktop 1440×1000, Mobil 390×844 bei doppelter Pixeldichte.
- Metadaten werden von `sharp` standardmässig entfernt — `.withMetadata()` würde sie
  wieder **hinzufügen**. Nicht aufrufen.
- Keine echten Personendaten, keine Schlüssel, keine Token, keine Entwicklerwerkzeuge im
  Bild. Nur `example.test`-Adressen. Das Capture-Skript bricht ab, wenn es etwas anderes
  findet.

---

## 4. Prüfen

```bash
npx tsc --noEmit -p tsconfig.app.json   # das echte Tor; `npm run type-check` ist es NICHT
npm run lint
npm test
npm run wiki:validate
```

Der Validator schlägt fehl bei: fehlender Abdeckung einer sichtbaren CRM-Route,
doppeltem oder ungültigem Slug, unbekanntem Icon, fehlender Sprache, abweichender
Blockstruktur, gebrochenem Verweis, fehlender Bilddatei, falsch angegebenem Bildmass,
zu kurzem oder mit «Screenshot …» beginnendem Alternativtext, Platzhaltern wie TODO und
Entwicklerbegriffen im Text.

### Die Abdeckungsprüfung

`ROUTES_REQUIRING_HELP \ abgedeckt === ROUTES_DEFERRED`, als **exakte Menge**.
Die Navigationsdaten werden dafür aus `src/config/firmaNav.ts` importiert, nicht
abgeschrieben. Damit gilt:

- neuer CRM-Bereich ohne Artikel → Build rot;
- Artikel gelöscht → Build rot;
- bewusst vertagt → **eine sichtbare, reviewte Zeile** in `ROUTES_DEFERRED`.

Vergessen ist nicht möglich, nur bewusstes Verschieben.

---

## 5. Tastatur und Barrierefreiheit — manuelle Liste

`CLAUDE.md` §9 hält dieses Repo bei reinen Funktionstests; es gibt kein jsdom und kein
Testing Library. Die Pfeiltasten-Logik ist als reine Funktion abgedeckt
(`wikiSearchKeyboard.test.ts`), die ARIA-Verdrahtung wird **von Hand** geprüft. Vor dem
Freigeben grösserer Änderungen an der Hilfe:

- [ ] Suchfeld mit `Tab` erreichbar, Fokusring sichtbar.
- [ ] `↓` und `↑` bewegen die Auswahl, springen an den Enden um.
- [ ] `Pos1` / `Ende` springen an Anfang und Ende der Trefferliste.
- [ ] `Enter` öffnet den markierten Treffer.
- [ ] `Esc` leert die Suche.
- [ ] Bild mit `Enter` vergrössern, mit `Esc` schliessen — **Fokus landet wieder auf dem
      Bild**, nicht am Seitenanfang.
- [ ] Inhaltsverzeichnis: jeder Eintrag per Tastatur erreichbar, Sprungziel korrekt.
- [ ] Überschriften springen keine Ebene (h1 → h2 → h3).
- [ ] Bei 320 px Breite kein waagerechtes Scrollen ausser in der Statustabelle.
- [ ] Druckvorschau: Menü, Kopfzeile und Schaltflächen fehlen, Schritte und Bildunter-
      schriften bleiben.
- [ ] In allen drei Sprachen: keine rohen Katalogschlüssel sichtbar.

---

## 6. Als Prüfer: passt der Screenshot noch?

1. `git log -1 --format=%h` mit `verifiedCommit` des Artikels vergleichen. Liegen viele
   Commits dazwischen, die den Bereich berühren: neu aufnehmen.
2. Bild öffnen und die im Text zitierten Beschriftungen darin suchen. Stimmt eine nicht
   mehr, ist der Artikel veraltet — nicht nur das Bild.
3. Auf Kacheln und Listen achten, die auf null stehen. Ein leerer Screenshot bedeutet
   fast immer, dass eine Fixture fehlt, nicht dass die Seite so aussieht.
4. Nach der Neuaufnahme `-v<n>` erhöhen und `lastVerified` / `verifiedCommit` anpassen.

---

## 7. Bekannte Grenzen

- **Nur die Kategorie `start` ist geschrieben** (7 Artikel × 3 Sprachen). Alle übrigen
  Routen stehen in `ROUTES_DEFERRED`.
- **Bildschirme, die eine Edge-Function brauchen** (KI-Extraktion, Google-Places-Vor-
  schläge, alle Sendevorgänge), zeigen im Screenshot die Schaltfläche, nicht deren
  Wirkung. Wird der Folgezustand gebraucht, gehört er in die Fixtures — die Funktion
  wird nicht aufgerufen.
- **`besichtigung` ist im Baseline-Dump nur ein Stub.** `supabase-wiki/baseline/
  besichtigung-grants.sql` gleicht die fehlenden Rechte aus; die saubere Lösung ist ein
  Baseline-Dump mit `--schema=public --schema=besichtigung`.
- **Bilder sind nicht bitgenau reproduzierbar** (Schriftrasterung). Der Browser ist
  gepinnt, das reicht für Lesbarkeit, nicht für Byte-Gleichheit.
