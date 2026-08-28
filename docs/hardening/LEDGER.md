# Härtungs-Ledger

Eine Zeile je Aufgabe. Die Spalten sind der Vertrag: ohne *Beleg vorher* und
*Nachweis* rückt keine Zeile weiter.

**Etiketten:** `VERIFIED` (aus Quelltext, Testausgabe, Katalog oder ausgerolltem
Code bewiesen) · `HYPOTHESIS` (plausibel, unbewiesen) · `NEEDS-PROD-CHECK`
(braucht den Live-Zustand; die Abfrage steht dabei) · `REFUTED` (geprüft und
widerlegt).

## Zustände — es gibt kein „fertig"

Ein einziges `DONE` für „im Repo umgesetzt", „lokal geprüft", „durchgesehen",
„gemergt", „ausgerollt" und „live nachgewiesen" ist genau die Unschärfe, die
dieses Programm beseitigen soll. Eine Sicherheitslücke ist nicht geschlossen,
weil ihre Migration existiert. Deshalb getrennte Stufen — die Tabelle ist die
vollständige Liste; ein Zustand, der hier fehlt, darf unten nicht auftauchen:

| Zustand | Bedeutet | Bedeutet NICHT |
|---|---|---|
| `BACKLOG` | erfasst, bewusst zurückgestellt | dass es erledigt ist |
| `PLANNED` | benannt, nicht begonnen | — |
| `IN_PROGRESS` | in Arbeit | — |
| `VERIFIED_IN_REPO` | umgesetzt, lokale Tore grün (type-check, Tests, Build, Lint) | dass jemand anderes daraufgeschaut hat |
| `INDEPENDENT_REVIEW_PASS` | eine unabhängige Durchsicht hat die Zusagen angegriffen und sie halten | dass es gemergt oder ausgerollt ist |
| `READY_FOR_ROLLOUT` | Rollout-Paket vollständig: Reihenfolge, Vorprüfung, Nachweis, Rücknahme | dass es angewendet wurde |
| `MERGED_NOT_DEPLOYED` | auf `main`, aber die Produktion führt es nicht aus | dass die Wirkung eingetreten ist |
| `LIVE_UNVERIFIED` | ausgerollt, Wirkung noch nicht gemessen | dass es funktioniert |
| `LIVE_VERIFIED` | ausgerollt **und** am Endergebnis gemessen | — |
| `BLOCKED_EXTERNAL` | etwas ausserhalb dieses Repos hält auf (Berechtigung, Zugang, Dienst) | dass die Arbeit steht |
| `ACTIVE_PRODUCTION_EXPOSURE` | in der Produktion **jetzt** ausnutzbar, Korrektur liegt bereit | dass sie behoben ist |
| `AWAITING_PRODUCTION_AUTH` | der nächste Schritt ist ein Produktionsschreibvorgang ohne Freigabe | — |
| `DECIDED` | die Produktentscheidung ist gefallen | dass Code oder Migration existiert |
| `MIGRATION_PREPARED / NOT_LIVE` | Migration geschrieben und auf dem Wegwerf-Stapel bewiesen | dass sie in der Produktion liegt |
| `DEPLOYED / BEHAVIOUR_EQUIVALENT` | ausgerollt, aber das Verhalten ist identisch zur Vorfassung | dass der Rollout etwas bewirkt hat |
| `ROOT_CAUSE_UNRESOLVED` | die Ursache steht, die Behebung nicht | dass ein Rollout sie behebt |
| `BLOCKED_BY_R2` / `BLOCKED_BY_RELEASE_COUPLING` | hängt an einer anderen Einheit bzw. an einem gekoppelten Release | — |
| `NOT_AUTHORIZED_FOR_PRODUCTION` | ausdrücklich nicht freigegeben | dass es unfertig wäre |
| `REVIEW_PASS` | eine unabhängige Durchsicht hat die Zusagen angegriffen; die Befunde sind behoben | dass es ausgerollt ist |
| `NEVER_APPLIED_TO_PRODUCTION` | in der Produktion nie ausgeführt | dass es nirgends ausgeführt wurde |
| `EXECUTED_ONLY_IN_DISPOSABLE_TEST_ENVIRONMENTS` | ausgeführt, aber ausschliesslich auf Wegwerf-Stapeln | dass es ungeprüft wäre |
| `SAFE_ARTIFACT` | das Artefakt trägt den bekannten Defekt nicht mehr | dass es freigegeben ist |
| `CORRECTED_BEFORE_FIRST_PRODUCTION_EXECUTION` | korrigiert, bevor es je in der Produktion lief | dass die Unveränderlichkeitsregel allgemein gelockert wäre |
| `VERIFIED_PRIVILEGE_DRIFT` | ein Recht ist gemessen falsch vergeben | dass es erreichbar ist |
| `NO_MEASURED_EXTERNAL_REACHABILITY` | kein gemessener Weg von aussen | dass keiner existiert — nur, dass keiner gefunden wurde |
| `SEPARATE_HARDENING_DECISION_REQUIRED` | die Korrektur braucht eine eigene Freigabe | dass sie unklar wäre |

**Nichts in diesem Repo kann `LIVE_VERIFIED` erreichen, solange kein
Produktionsschreibvorgang freigegeben ist.** Das ist kein Mangel des Ledgers,
sondern sein Zweck.

Davon zu trennen sind die **Belegetiketten** `VERIFIED`, `HYPOTHESIS`,
`NEEDS-PRODUCTION-CHECK` und `REFUTED`. Sie sagen, wie gut etwas belegt ist,
nicht wie weit es ist. Ein Befund kann `VERIFIED` und trotzdem `PLANNED` sein —
gut belegt und unangetastet.

Am 2026-08-28 wurden **R-1, R-2 und R-3 gestuft freigegeben** — ausdrücklich, mit
bindender Reihenfolge und Abbruchbedingung. R-4 bis R-6 blieben ausgenommen.
Ausgeführt wurden davon R-1 vollständig und R-2 bis Einheit 2; danach griff die
Abbruchbedingung. Die `LIVE_VERIFIED`-Zeilen unten stützen sich auf **diese**
Freigabe. Seither ist nichts weiter freigegeben.

Programm: [CRM_SYSTEM_HARDENING_PROGRAM.md](../CRM_SYSTEM_HARDENING_PROGRAM.md) ·
Belege: `.project-engineering/evidence/` · Steuerung: `.project-engineering/`

---

## Was in der Produktion JETZT gilt (Stand 2026-08-28)

Aus diesem Programm ist **R-1** live (freigegeben und ausgeführt) sowie **eine**
gemeinsame Datei aus R-2; alles Übrige ist es nicht. Ein Befund ist **offen und
ausnutzbar**, und für ihn liegt die Korrektur ausdrücklich *nicht* im Repo, weil
Ausrollen ihn nicht behebt (R2-01):

| | Zustand | Was das bedeutet |
|---|---|---|
| **P0-S1** `landing_page_analytics` | **`LIVE_VERIFIED`** ✅ | Geschlossen am 2026-08-28, am selben Tag nachgemessen. Keine schreibende PUBLIC-Policy, `anon` hält kein Schreibrecht (ACL `rxt`), RLS aktiv, 0 Zeilen; die verbliebene SELECT-Policy ist `is_admin(auth.uid())`. `anon` behält das SELECT-**Recht** (`rxt`); gesperrt wird es vom Prädikat. In der Produktion nicht beobachtbar (0 Zeilen) — am Wegwerf-Stapel mit 3 Zeilen nachgestellt: `anon sieht 0`. Beleg: `ops/rollout/2026-08-28/`, Rückverfolgbarkeit: [R1-RUECKVERFOLGBARKEIT.md](R1-RUECKVERFOLGBARKEIT.md). |
| **R-1 auf `main`** | **`NICHT VORHANDEN`** ⚠️ | Die Produktion führt zwei Migrationen aus, die es auf `main` nicht gibt. Schmaler Hotfix-PR vorgeschlagen (genau `ac26a2ed` + `14a96a93`), nicht angelegt — `gh pr create` bleibt extern blockiert. |
| **M01-03** Undo-Tabelle ohne RLS | **`MIGRATION_PREPARED / NOT_LIVE`** | `public.undo_20260828100000` ist bis heute die einzige Tabelle im `public`-Schema ohne RLS — `anon` kann den R-1-Beleg lesen, fälschen und löschen. Keine Rechteausweitung, aber Beweismittelvernichtung. Korrektur `20260828150000` liegt bereit. |
| **P0-S3a** drei Google-Proxys | **`ACTIVE_PRODUCTION_EXPOSURE` · `ROOT_CAUSE_UNRESOLVED`** | Die Drossel ist ausgerollt (`calculate-distance`) und wirkt trotzdem nicht — siehe **R2-01**. **Diese Funktionen sind NICHT gedrosselt.** Der Modul-`Map`-Zähler kann über Worker hinweg nichts durchsetzen. |
| **P1A** Mandantentrennung | `INDEPENDENT_REVIEW_PASS`, **nicht live** | Die laufende Fassung rät die Firma weiter. |
| **P1B-1** Rechtschreibprüfung | `VERIFIED_IN_REPO`, **nicht live** | Die ausgerollte Fassung korrigiert Französisch weiter nach deutschen Regeln. |
| **P1B-2/3** Sprachwechsel + Sendebereitschaft | `VERIFIED_IN_REPO`, **nicht live** | Die laufende Fassung schickt eine französische Offerte weiterhin mit deutschen AGB hinaus. |
| **P1C-0** Auth-Manifest | `VERIFIED_IN_REPO` | Ein Tor im Repo. Es ändert nichts an dem, was heute in der Produktion erreichbar ist. |
| **R-1** | `LIVE_VERIFIED` ✅ | Freigegeben und ausgeführt. |
| **R-2** | teils ausgeführt | Einheit 1 (`_shared/appointmentDay.ts`) `LIVE_VERIFIED`; `calculate-distance` `DEPLOYED / BEHAVIOUR_EQUIVALENT`; danach Abbruchbedingung gegriffen. |
| **R-3** | `BLOCKED_BY_R2` · `BLOCKED_BY_RELEASE_COUPLING` | Freigegeben, aber nicht ausführbar: das Frontend-Deployment aktiviert zugleich die strenge Sendebereitschaft aus R-4. Entkoppelte Minimalfassung liegt auf `release/r3-spellcheck-locale`. |
| **R-4 … R-6** | `NOT_AUTHORIZED_FOR_PRODUCTION` | Pakete vollständig ([ROLLOUT-2026-08-28.md](ROLLOUT-2026-08-28.md)), **nicht freigegeben**. |
| **PR** | `BLOCKED_EXTERNAL` | `gh pr create` von der Berechtigungsprüfung abgewiesen. Hält die Arbeit im Repo nicht auf. |

---

## Basislinie (Commit `f4064560`, gemessen 2026-08-28)

| Tor | Ergebnis |
|---|---|
| `npm run type-check` | PASS |
| `npm test` | PASS — 83 Dateien, 1746 Tests |
| `npx eslint .` | FAIL — 88 Fehler … **aber keiner davon in diesem Repository** |

### B-01 · Die „88 Lint-Fehler" gibt es in diesem Repository nicht · `VERIFIED`

`CLAUDE.md` §12 hält fest: *„`npm run lint` ist derzeit NICHT sauber: auf `main`
88 Fehler … das Tor lautet praktisch: in berührten Dateien null Fehler."* Ich
habe diese Zahl übernommen und in jedem Commit als unveränderte Altschuld
gemeldet.

Gemessen:

```
$ npx eslint . -f json | (Fehler nach oberstem Verzeichnis)
[('vibecosystem', 88)]

$ git ls-files -s vibecosystem
160000 6172d4ac… 0   vibecosystem        ← Gitlink, kein .gitmodules

$ git ls-files '*.ts' '*.tsx' '*.js' '*.mjs' | grep -v '^vibecosystem/' | xargs npx eslint
✖ 129 problems (0 errors, 129 warnings)      ← NULL Fehler
```

**Alle 88 Fehler liegen in `vibecosystem/`** — einem Gitlink (Modus `160000`)
ohne `.gitmodules`-Eintrag. `actions/checkout@v4` holt ohne `submodules: true`
keine Untermodul-Inhalte, das Verzeichnis ist in CI also leer. Deshalb läuft der
`Lint`-Schritt in `.github/workflows/ci.yml` **ohne `continue-on-error` grün** —
nachweisbar an den erfolgreichen CI-Läufen dieses Branches.

**Warum das zählt:** die Anweisung „Gesamtzahl darf nicht steigen" klingt streng
und ist in Wahrheit blind. Wer 89 statt 88 sieht, zuckt mit den Schultern —
während CI in Wirklichkeit *jeden* Fehler in den eigenen Dateien ablehnt. Die
Regel lud dazu ein, eine echte Verschlechterung für Altschuld zu halten.

**Richtige Basislinie:** die eigenen Dateien dieses Repositories haben
**0 Lint-Fehler**, und CI erzwingt das. Der lokale Befund entsteht nur, wenn
jemand das Untermodul-Verzeichnis gefüllt hat.

Nebenbefund: ein Gitlink ohne `.gitmodules` lässt sich von niemandem klonen —
`git submodule update` kennt kein Ziel. Eigene Aufgabe, hier nur benannt.

Produktion: PostgreSQL 15.8 · 101 Tabellen, alle mit RLS, 232 Policies ·
220 Funktionen, davon 32 `anon`-ausführbar · 42 Edge Functions ausgerollt ·
2 Firmen, 2 Mitgliedschaften · 93 Offerten, 531 Positionen, 31 Rechnungen,
12 Quittungen, 115 Leads, 26 Aufträge, 96 Termine.

---

## P0 — Produktionswahrheit

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Umsetzung | Nachweis | Commit | Produktionsprüfung | Restrisiko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **P0-1** | Plattform | keine gemessene Wahrheit | — | `LIVE_VERIFIED` | Letzte Aufnahme 2026-08-10, Repo seither weitergezogen | Datierte, lesende Aufnahme; jeder Driftposten benannt | `scripts/capture-production-truth.sh` gegen `7639710127421538342` | `ops/production-truth/2026-08-28/` (Generation `b92a3bf64015b2eb`) | T-001 | lesend erfolgt | — |
| **P0-2** | Plattform | Repo↔Deploy nur Mengen-, kein Inhaltsvergleich | P0-1 | `LIVE_VERIFIED` | `deploy-repo-diff.json` vergleicht nur Namen | Inhaltsvergleich gegen den exakten Commit, reproduzierbar | `scripts/edge-drift.mjs` | `.project-engineering/evidence/P0-2026-08-28/edge-hash-drift.json` — 29 gleich, 10 Drift, 3 deploy-only, 12 nicht ausgerollt | T-001 | lesend erfolgt | — |
| **P0-3** | Plattform | Migrationsstand unbelegt | P0-1 | `LIVE_VERIFIED` | „Datei vorhanden" ≠ „eingespielt" | Für die Migrationen seit 2026-08-05 gemessener Stand | Lesende Katalogsonde | `migration-applied-state.json` — 3 `APPLIED`, 1 `NOT_APPLIED` | T-001 | lesend erfolgt | Für die 380+ älteren Dateien gibt es weiterhin keinen Ledger (→ P3-1) |
| **P0-4** | Plattform | Edge ohne Auth-Modell | P0-1, P0-2 | `LIVE_VERIFIED` | 42 ausgerollte Functions, keine Einstufung | Genau ein Modell je ausgerollter Function, als Tor erzwungen | `docs/hardening/edge-auth-manifest.json` + `src/test/__tests__/edge-auth-manifest.test.ts` | 8 Tests grün; 42/42 eingestuft | T-001 | lesend erfolgt | Bei den 10 Driftfällen gilt die Einstufung dem Repo-Stand; die ausgerollten Fassungen wurden einzeln gelesen und sind älter, nicht anders |

### R2-01 · Die Drossel kann in dieser Laufzeit nicht wirken · `VERIFIED`

Beim Ausrollen von `calculate-distance` gemessen — 61 Anfragen, **kein einziger
Google-Aufruf** (die Drossel sitzt vor der Eingabeprüfung, ein leerer Rumpf endet
mit 400):

| | 400 | 429 |
|---|---:|---:|
| vorher, ohne Drossel | 61 | 0 |
| **nachher, mit Drossel** | **61** | **0** |

**Ursache.** Der ausgerollte Router erzeugt **pro Anfrage** einen neuen
User-Worker (`EdgeRuntime.userWorkers.create(…)` → `worker.fetch(req)`).
`_shared/rateLimit.ts` hält seinen Zähler in einer `Map` im Modulkörper; bei
einem Worker je Anfrage wird der Modulkörper jedes Mal neu ausgewertet. Die
`Map` ist immer leer, `isLimited` gibt immer `false` zurück. Der Kopf von
`rateLimit.ts` sagt es selbst: *„resets on function cold starts"* — hier **ist**
jede Anfrage ein Cold Start.

**Das korrigiert meinen eigenen früheren Befund.** „Die Drossel steht im Repo,
sie ist nur nicht ausgerollt" war unvollständig. Sie auszurollen schliesst
P0-S3a **nicht**. Der Kostenabfluss bleibt offen, und kein Deployment behebt
ihn. Nötig ist ein Zähler, der die Anfrage überlebt — Postgres oder eine Drossel
im Gateway. **`PLANNED`**, neue Aufgabe.

**Was daraus für die Methode folgt:** der Digest-Abgleich sagt, dass der richtige
Code liegt. Er sagt nicht, dass er wirkt. Ohne den Smoke-Test hätte ich R-2
durchgezogen und P0-S3a als geschlossen gemeldet.

### Belegte Befunde aus P0

| ID | Etikett | Befund | Zustand |
|---|---|---|---|
| **P0-S1** | `VERIFIED` | Befund bei der Messung: `landing_page_analytics` trug eine INSERT-Policy `TO PUBLIC` mit `WITH CHECK (true)`; `anon` hielt das Tabellenrecht. Unauthentifiziert aus dem Internet schreibbar. **Am 2026-08-28 geschlossen** (R-1, freigegeben): keine schreibende PUBLIC-Policy, `anon`-ACL auf `rxt`, RLS aktiv, am selben Tag lesend nachgeprüft. | **`LIVE_VERIFIED`** ✅ — Nachtrag: die Undo-Tabelle dieser Migration lag ohne RLS, siehe **M01-03** und **M01-04**. |
| **P0-S2** | `VERIFIED` | `VERIFY_JWT=false`; der ausgerollte Router `main` überspringt seinen 401-Block genau dann; Kong-Route `/functions/v1` trägt nur `cors`. Jede ausgerollte Function ist unauthentifiziert erreichbar. `config.toml` ist an dieser Installation wirkungslos. | `LIVE_VERIFIED` (gemessener Zustand; als Vertrag im Manifest festgeschrieben) |
| **P0-S3** | `VERIFIED` | 10 Functions driften. Alle 10 gegen den ausgerollten Quelltext diffed: die Produktion ist **älter**, nicht anders. | `READY_FOR_ROLLOUT` (R-2) |
| **P0-S3a** | `VERIFIED` | `calculate-distance`, `google-places-autocomplete`, `google-places-details` sind unauthentifizierte Proxys auf kostenpflichtige Google-APIs. Fremdkostenabfluss ohne jede Hürde. **Ausrollen behebt es nicht** — siehe R2-01: der Modul-`Map`-Zähler kann über Worker hinweg nichts durchsetzen. `calculate-distance` ist ausgerollt und trotzdem ungedrosselt. | **`ACTIVE_PRODUCTION_EXPOSURE` · `ROOT_CAUSE_UNRESOLVED`** — der Ersatz (`20260828130000` + `_shared/paidApiGuard.ts`) liegt bereit, ist **nicht** freigegeben. |
| **P0-S4** | `REFUTED` | Sorge: unauthentifizierter deploy-only Handler. Gelesen: `accept-lead` prüft `auth.getUser` **und** `verifyCompanyMembership`; `hello` gibt eine Konstante zurück; `main` ist der Laufzeit-Router. Kein offenes Loch. | — |
| **P0-S5** | `VERIFIED` | `generate-sitemap` läuft mit `service_role` ohne Auth und erzeugt Marktplatz-Sitemaps (`/partner-werden`, `/preise`, SEO-Landingpages). Liest nur `blog_posts` mit `status='published'` — kein Datenabfluss. | `BACKLOG` → P5-1 |
| **P0-S6** | `VERIFIED` | 8 `config.toml`-Einträge ohne Quelle und ohne Deployment; 16 Quellen ohne Eintrag; 12 Quellen ohne Deployment. | `BACKLOG` → P3-2 |
| **P0-S7** | `VERIFIED` | `fetchSingleCompanyForUser()` rät die Firma; 17 Dateien rufen sie, 16 davon unter `/firma`. Produktion hat 2 Firmen. | `INDEPENDENT_REVIEW_PASS` · **NICHT LIVE** — siehe P1A |
| **P0-S8** | `VERIFIED` | `spell-check-ai` trägt einen fest deutschen Prompt (`ß→ss`, Substantivgrossschreibung); `runSpellCheck(fields)` sendet keine Sprache. Aufgerufen für jede Dokumentsprache. | `VERIFIED_IN_REPO` · **NICHT LIVE** — die ausgerollte Fassung korrigiert Französisch weiterhin nach deutschen Regeln (R-3) |
| **P0-S9** | `VERIFIED` | `cookie_consent_log` trägt eine unbeschränkte PUBLIC-INSERT-Policy. CookieBanner ist laut `CLAUDE.md` §2 aus dem Fork entfernt — Erreichbarkeit ungeprüft. | `BACKLOG` → P5-2 |
| **H-004** | `VERIFIED` | In `send-quittung` und `send-rechnung-email` steht die Berechtigungsprüfung in einem `if (zeile) { … }`, dessen Abfragefehler verworfen wird: fällt die zweite Abfrage aus, wird der 403 **übersprungen**. In `send-quittung` lädt `loadCompanySecrets` ausserdem **vor** der Prüfung. | `BACKLOG` → P1C-1 |

---

## P1A — Mandanten-Split-Brain · **geschlossen**

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Umsetzung | Nachweis | Commit | Produktionsprüfung | Restrisiko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **P1A-1** | Finanzen | geratene Firmenidentität in Rechnungen/Quittungen | P0-S7 | `INDEPENDENT_REVIEW_PASS` · NICHT LIVE | `Rechnungen.tsx` holte Liste über aktiven Mandanten, Kopfdaten über den Ratehelfer | Firmensatz kommt aus dem aktiven Mandanten; Zeile fremder Firma fällt fail closed durch | `fetchCompanyById`, `aktiverMandant`, `useCompanyRecord`; 4 Seiten umgestellt | 12 Vertragstests; type-check, 1766 Tests, build grün | `37f9d7bc` | — (nur Browsercode) | Zwei-Firmen-Test läuft gegen reine Funktionen, nicht gegen ein laufendes DOM (§16 des Programms) |
| **P1A-2** | Offerten | geratene Firmenidentität in Offerte anlegen/bearbeiten/Detail | P1A-1 | `INDEPENDENT_REVIEW_PASS` · NICHT LIVE | drei Seiten am Ratehelfer; `OfferteErstellen` lud den Lead ohne Mandantenfilter | aktiver Mandant als einzige Quelle; Lead fremder Firma fällt fail closed durch | 3 Seiten umgestellt; `select: "*"` in `OfferteDetail` durch Spaltenliste ersetzt | type-check, 1766 Tests, build grün | `109289b3` | — | — |
| **P1A-3** | Aufträge, Einstellungen, Archiv, Importe, Preise, Katalog, Checkliste, Team | restliche `/firma`-Aufrufer | P1A-2 | `INDEPENDENT_REVIEW_PASS` · NICHT LIVE | 9 Seiten am Ratehelfer; Einstellungs-Entwurf unter festem Schlüssel; `select: "*"` | keine eigene Firmenauflösung mehr; tenant-gebundener Entwurfsschlüssel | 5 Seiten ganz ohne Abfrage (ID kommt aus dem Kontext), 4 über `fetchCompanyById` | type-check, 1766 Tests, build grün | `5d2f2976` | — | — |
| **P1A-4** | Auth | `Auth.tsx`: „genau eine Firma" → „berechtigte Mitgliedschaften" | P1A-3 | `INDEPENDENT_REVIEW_PASS` · NICHT LIVE | Ratehelfer entschied den Anmeldebildschirm: verifizierte Firma A + unverifizierte B konnte „Verifizierung ausstehend" ergeben | `entscheideAnmeldeZiel()` über alle Mitgliedschaften; `is_verified === true` | reine Funktion + `fetchCompaniesForUser` | 5 Vertragstests; 1772 Tests grün | `45faf73d` | — | — |
| **P1A-5** | Plattform | Wiedereinführung des Ratehelfers | P1A-4 | `INDEPENDENT_REVIEW_PASS` · NICHT LIVE | Helfer gelöscht — aber in zwei Zeilen neu schreibbar | Tor prüft das MUSTER (E-Mail-Suche, `created_at`-Sortierung), nicht den Namen | `src/test/__tests__/mandanten-quelle.test.ts` | **gegen eine eingeschleuste Verletzung geprüft** — schlägt bei allen drei Mustern an | `45faf73d` | — | Das Tor deckt `src/` ab, nicht `supabase/functions/` |

**Exit-Gate P1A im Repo erfüllt:** null `/firma`-Importe des Ratehelfers · null
Vorkommen im Quelltext · Tor gegen die Rückkehr, negativ geprüft · unabhängige
Durchsicht bestanden (7 Punkte, 5 gehalten, alle behoben).

⚠️ **NICHT LIVE.** Der Browsercode läuft in der Produktion erst, wenn die
Anwendung neu gebaut und ausgerollt wird. Bis dahin rät die laufende Fassung die
Firma weiter — mit allem, was in P1A-1 bis P1A-5 steht. Der Zustand
`INDEPENDENT_REVIEW_PASS` sagt genau das und nicht mehr.

### Nebenbefunde, in P1A mit erledigt

| ID | Etikett | Befund | Commit |
|---|---|---|---|
| **N-001** | `VERIFIED` | `Rechnungen`/`Quittungen`-Detailseiten luden `.eq("id", id).single()` ohne Mandantenfilter — ein Mitglied beider Firmen sah die fremde Zeile unter eigenen Kopfdaten. | `37f9d7bc` |
| **N-002** | `VERIFIED` | Logo wurde nur bei Erfolg gesetzt (`if (b64)`) — beim Wechsel zu einer Firma ohne Logo blieb das fremde Logo im PDF. | `37f9d7bc` |
| **N-003** | `VERIFIED` | `OfferteErstellen` lud den Lead ohne Mandantenfilter — daraus liess sich mit einem Klick eine Offerte der eigenen Firma aus fremden Kundendaten bauen. | `109289b3` |
| **N-004** | `VERIFIED` | `Einstellungen` legte den unfertigen Formularentwurf unter einem FESTEN `sessionStorage`-Schlüssel ab — A-Entwurf landete im B-Formular und beim Speichern in der B-Zeile. | `5d2f2976` |
| **N-005** | `VERIFIED` | `OfferteDetail` und `Einstellungen` lasen `companies` mit `select: "*"`. Die Zugangsdaten wurden 2026-07-27 aus `companies` gezogen, WEIL sie im Browser lesbar waren; ein `*` holt die nächste solche Spalte automatisch zurück. | `109289b3`, `5d2f2976` |

### Unabhängige Durchsicht der P0/P1A-Tranche (2026-08-28)

Ein Prüfdurchgang, sieben Punkte, fünf halten stand. Alle behoben in `9de0541b`.

| ID | Schwere | Befund | Zustand |
|---|---|---|---|
| **R-01** | HOCH | Der Entwurfsschlüssel in `Einstellungen` hing an `activeCompanyId`, nicht an der Zeile, aus der die Werte stammen. Beim Wechsel schrieb der 600-ms-Timer A-Werte unter den Schlüssel von B; das Laden legte sie über die frischen B-Werte, und `handleSaveProfile` schrieb sie mit `.eq("id", company.id)` in die **B-Zeile**. **Meine eigene P1A-Korrektur hatte den falschen Tenant gewählt.** | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-02** | MITTEL | `Besichtigungen.tsx` holte die Firma aus `getCachedCompany()` — synchron, und beim Wechsel nicht nachziehend. Ich hatte nur nach `fetchSingleCompanyForUser` gesucht; die Aussage „null Aufrufer" war wahr, die Aussage „eine Quelle" trotzdem falsch. | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-03** | MITTEL | Das Tor kannte drei Muster, `getCachedCompany` war keines davon — es bestätigte einen Zustand, den es nicht prüfte. Zwei Regeln ergänzt (sessionStorage-Griffe, `company_members.eq("user_id")`), beide gegen eingeschleuste Verletzungen geprüft. Grenze des Tors jetzt im Kopf der Datei. | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-04** | MITTEL | `CompanyProvider` wählte `fetchedCompanies[0]` ohne `is_verified` zu prüfen. Die in P1A-4 behobene Sackgasse lag damit eine Ebene tiefer weiter vor. Auto-Auswahl bevorzugt jetzt eine freigeschaltete Firma. | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-05** | GERING | `useCompanyRecord` gab `error` zurück, niemand las es, der Kommentar behauptete das Gegenteil. Der Hook meldet jetzt selbst. | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-06** | GERING | Das Manifest stufte `accept-lead` als `jwt-member` ein, ohne dass das aus dem Repo belegbar wäre (Quelle nicht da, Aufnahme geschwärzt). Herkunft und Grenze des Tors jetzt vermerkt. | `VERIFIED_IN_REPO` · NICHT LIVE |
| **R-07** | KLEINIGKEIT | Vier Listenseiten drehten bei fehlendem Mandanten ewig — früher `return` ausserhalb des `finally`. Heute unerreichbar, behoben. | `VERIFIED_IN_REPO` · NICHT LIVE |

---

## P1B — FR/EN-Kette

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Nachweis | Commit |
|---|---|---|---|---|---|---|---|---|
| **P1B-1** | Offerten | Rechtschreibprüfung nur Deutsch, für jede Sprache aufgerufen | P0-S8 | `VERIFIED_IN_REPO` · NICHT LIVE | fester deutscher Prompt (`ß→ss`, Substantivgrossschreibung); `runSpellCheck(fields)` ohne Sprache | `runSpellCheck(fields, locale)`; Handler prüft `de\|fr\|en` und weist Fehlendes mit 400 ab; sprachabhängige Prompts; nie übersetzen | 9 Vertragstests, u. a.: `ß` und deutsche Substantivregel kommen in `fr`/`en` NICHT vor; alle Edge Functions booten | `e4583ee9` |
| **P1B-2** | Offerten | Sprachumschalter behauptet eine Umstellung, die nicht stattfindet | P1B-1 | `VERIFIED_IN_REPO` · NICHT LIVE | Wähler setzte `offers.language` und sonst nichts; Hinweistext warnte nur vor Positionen und schwieg über Titel, Zahlungskondition, AGB | Plan statt Wirkung: sechs Kategorien je Feld; nichts wird erfunden, nichts still überschrieben | `buildOfferLanguageRebasePlan` + `sammleOfferteRebaseFelder` + `SprachwechselDialog`; Titelerzeugung nach `@/lib/offerTitle` gezogen | 35 Vertragstests — u. a. „kein Betrag im Ergebnis, auch bei pauschaler Zustimmung", eingefrorene Offerte ändert nicht einmal den Sprachcode, halb übersetzte Quelle = TRANSLATION_MISSING | `094cea38` |
| **P1B-3** | Offerten | strenge Sendebereitschaft statt stiller deutscher Rückfall | P1B-2 | `VERIFIED_IN_REPO` · NICHT LIVE | `send-offer` las `agb_sections` OHNE `translations` — es konnte den deutschen Rückfall gar nicht bemerken | Ein Vertrag, zwei Laufzeiten: `_shared/offerSendReadiness.ts` von Browser UND Edge; fehlende/unbekannte Sprache wird abgewiesen statt gerundet | Blocker in `send-offer` (HTTP 422) vor jedem Versand; `sendOffer` prüft vorab und reicht die 422-Blocker durch | 29 Tests; Torprüfung gegen **drei** Einschleusungen (Prüfung entfernt · Wächter `if (false && …)` · Ergebnis kurzgeschlossen) — Fassung 1 fing nur die erste | `cf19bef2` |

⚠️ P1B-1 ist eine **Edge-Änderung** und wirkt erst nach dem Ausrollen. Reihenfolge
bindend: **Frontend zuerst, Handler danach** — siehe R-3 im
[Rollout-Paket](ROLLOUT-2026-08-28.md). Umgekehrt verlieren offene Tabs die
Prüfung.

## P1C — Edge/RPC-Grenzen

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg / Nachweis | Commit |
|---|---|---|---|---|---|---|
| **P1C-0** | Edge | Manifest prüfte Vollständigkeit, nicht ob das Modell zum Handler passt | P0-4 | `VERIFIED_IN_REPO` | 54 Einträge (alles Ausgerollte + alles im Repo); mechanische Tatsachen werden gemessen statt abgeschrieben; 11 Torbedingungen; gegen **vier** Einschleusungen geprüft | `c5f3ad8b` |
| **P1C-1** | Finanzen/Edge | Autorisierung im `if`, Fehler verworfen; Secret-Ladung vor Prüfung (H-004) | P1C-0 | `VERIFIED_IN_REPO` · NICHT LIVE — behoben in `send-offer`, `send-quittung`, `send-rechnung-email`; die Manifest-Ausnahmen sind entfallen | siehe D-09 | `e4e40a94` |
| **P1C-2** | Datenbank | 4 verbliebene `anon`+DEFINER+schreibende RPCs einzeln prüfen | P0-1 | `READY_FOR_ROLLOUT` — alle vier gelesen, Migration auf einem Wegwerf-Stapel bewiesen | siehe T10-* | `20260828110000` |

### T-010 · Die vier öffentlichen Schreib-RPCs, einzeln gelesen

Definitionen lesend aus der Produktion geholt und einzeln durchgegangen.
**Ergebnis: keine davon ist ein Rest.** Es sind die öffentlichen Eingänge des
Kundenbereichs und der Token-Seiten. Jede schliesst über ein Token genau eine
Zeile auf, leitet den Mandanten aus dieser Zeile ab, prüft Status und Fristen
und ist gegen Wiederholung gesichert. `anon` behält sein EXECUTE — ohne das gibt
es keinen Kundenzugang.

| ID | Etikett | Befund | Zustand |
|---|---|---|---|
| **T10-01** | `VERIFIED` | Drei der vier tragen ihr EXECUTE zusätzlich für **PUBLIC** (`=X/postgres`). `update_amendment_by_token` tut das nicht — dieselbe Aufgabe ohne PUBLIC, es geht also. Praktischer Unterschied heute klein (von aussen kommt man als `anon`/`authenticated`); der Unterschied entsteht beim nächsten Rollennamen, den jemand anlegt. Migration `20260828110000` **auf einem Wegwerf-Stapel bewiesen**: anwenden → PUBLIC weg, `anon` behält · zweiter Lauf idempotent · Rücknahme stellt her · erneut vorwärts. | `READY_FOR_ROLLOUT` |
| **T10-02** | `VERIFIED` | **Migrationsdrift.** Der aus den Migrationen gebaute Wegwerf-Stapel hat auf `update_offer_by_token` **kein** PUBLIC-Recht — die Produktion hat es. Kein Migrationsfile erzeugt diesen Grant. Er ist von Hand entstanden. Genau die Klasse, für die P3 den Ledger braucht. | `PLANNED` → P3-1 |
| **T10-03** | `VERIFIED` | **Zwei Token-Konventionen in einem System.** `portal_magic_links` und `calendar_feed_tokens` speichern `token_hash` (SHA-256). `offers.access_token` und `offer_amendments.access_token` stehen im **Klartext** und werden im Klartext verglichen. Wer die Zeile lesen darf — Mitglieder, Sicherungen, Protokolle — hält damit einen funktionierenden Kundenlink. D-004: eine Umsetzung je Vertrag. | `PLANNED` |
| **T10-04** | `VERIFIED` | `portal_request_change` legt den Änderungswunsch mit `ON CONFLICT … DO UPDATE` dedupliziert an, fügt aber **bei jedem Aufruf unbedingt** eine `crm_tasks`-Zeile hinzu. Eine gültige Kundensitzung kann damit die Wiedervorlage der Firma füllen. Kein Mandantenübertritt, aber unbegrenzte Schreibvermehrung. | `PLANNED` |
| **T10-05** | `REFUTED` | Verdacht: `p_feld` gelangt ungeprüft in `customer_change_requests` und von dort in ein dynamisches UPDATE. Falsch — `customer_change_requests_feld_check` beschränkt auf fünf Namen, und `decide_change_request` schreibt über eine **ausgeschriebene** `CASE`-Zuordnung, zusätzlich hinter `is_company_role(owner|admin)`. Kein dynamisches SQL. | — |

**Was `update_offer_by_token` gut macht** (weil es sonst untergeht):
Status-Positivliste, Endzustände unveränderlich, überholte Fassung darf nur noch
gelesen werden, Annahmefrist aus `valid_until` **und** `service_date`, und
`agb_ip_address` wird ausdrücklich **nicht** aus dem Aufruf übernommen. — | — |

### Was das Manifest-Tor gefunden hat (Befunde, die vorher niemand hatte)

| ID | Etikett | Befund | Zustand |
|---|---|---|---|
| **E-01** | `VERIFIED` | `translate-content` rief `assertCompanyMembership(supabase, authHeader, company_id)` — den **rohen Header** an der Stelle der `userId`, viertes Argument fehlend. Die Abfrage lief als `user_id = 'Bearer eyJ…'` und traf nie eine Zeile: **jeder** Aufruf wurde verweigert. Fail closed, aber kaputt. Nicht ausgerollt, deshalb nie bemerkt. Nichts type-checkt die Edge Functions — `check-edge-functions-parse.sh` prüft nur, dass sie booten. | `VERIFIED_IN_REPO` — an der Wurzel behoben (`assertCompanyMembershipFromAuthHeader`) |
| **E-02** | `VERIFIED` | `notify-appointment-reschedule` war als `capability-token` geführt. Sie **mintet** das Token und validiert keines: unauthentifiziert, service-role, sendet E-Mail an Adressen aus dem Body. | `VERIFIED_IN_REPO` — nicht ausgerollt; das Verbot steht jetzt als Bedingung im Manifest |
| **E-03** | `VERIFIED` | `send-lead-confirmation` ebenfalls falsch als `capability-token` geführt; prüft nichts ausser einer IP-Drossel. | `VERIFIED_IN_REPO` — jetzt `public-safe` mit Rollout-Sperre |
| **E-04** | `VERIFIED` | Zwei `normalizeServiceTypeForAgb` mit verschiedener Semantik: Frontend ein String (`.eq`), `send-offer` eine Liste (`.in`). Sie können unterschiedliche AGB-Abschnitte finden. | `PLANNED` — D-004-Befund, keine Sprachfrage |

### Zweite unabhängige Durchsicht (2026-08-28) — kumulierter Branch-Diff

Auflage: Gegenbeispiele einschleusen statt den Happy Path lesen. Zwölf Punkte,
**alle haltbar**. Behoben in `e4e40a94`.

| ID | Schwere | Befund | Zustand |
|---|---|---|---|
| **D-01** | HOCH | `buildOfferLanguageRebasePlan` prüfte „von Hand geändert?" mit `quelleInAktuellerSprache !== null`. Fehlt der Katalogzeile die Fassung der **Ausgangs**sprache, ist der Wert null — die Regel fiel durch bis `REBASE_AVAILABLE`. Eine französische Offerte mit handgeschriebener Position wurde beim Wechsel nach Deutsch **ohne Zustimmung** durch den Katalogtext ersetzt. | `VERIFIED_IN_REPO` |
| **D-02** | HOCH | `SprachwechselDialog` setzte `zustimmung` nur beim Anwenden zurück. `plan === null` gibt `null` zurück, hängt die Komponente aber nicht aus — ein Haken aus einer **abgebrochenen** Sitzung ersetzte in der nächsten den Handtext. | `VERIFIED_IN_REPO` |
| **D-03** | HOCH | Das Sendeweg-Tor suchte Literale und wurde mit einer Zuweisung **eine Zeile über dem `if`** ausgehebelt: 30/30 grün, Prüfung tot. Zusammenbau nach `_shared` gezogen und mit Eingabe/Ausgabe geprüft; das Quelltext-Tor auf „Stolperdraht" zurückgestuft. | `VERIFIED_IN_REPO` |
| **D-04** | HOCH | Die drei `localeClaims` verglichen `customerLocale` mit sich selbst (`x !== x`), während die PDF-Bytes aus dem Browser kommen. Ein veralteter Bundle mit deutschem PDF an einer französischen Offerte kam durch. Jetzt meldet der Renderer seine Sprache, und der Server vergleicht. | `VERIFIED_IN_REPO` |
| **D-05** | MITTEL | Das `capability-token`-Signal maß Vokabular: `if (false)` statt der Autorisierung blieb grün, weil `access_token` noch im `.select()` stand — und ein **Kommentar** die Prüfung beschrieb. Jetzt Wächterform, Kommentare gestrippt. | `VERIFIED_IN_REPO` |
| **D-06** | MITTEL | Der Geldschutz hing allein am Etikett des Sammlers; ein falsch etikettiertes `unit_price` lief durch. Jetzt entscheidet auch der Feldpfad, plus ein Riegel am Ausgang von `apply`. | `VERIFIED_IN_REPO` |
| **D-07** | MITTEL | `Einstellungen`: der verzögerte **Schreib**weg war abgesichert, der **Lese**weg nicht — eine überholte A-Antwort konnte den B-Bildschirm füllen. | `VERIFIED_IN_REPO` |
| **D-08** | MITTEL | Das Mandanten-Tor fing den Ratehelfer, aber nicht die Rückkehr des Fehlers im Verbraucher (`tenantBound(activeCompanyId, …)`). Regel ergänzt. | `VERIFIED_IN_REPO` |
| **D-09** | MITTEL | **`send-offer` (ausgerollt!)**, `send-quittung` und `send-rechnung-email` hatten die Mitgliedschaftsprüfung in `if (zeile) { … }` mit verworfenem Abfragefehler — löste die Abfrage zu null auf, wurde nicht geprüft. `send-quittung` lud zudem den Resend-Schlüssel **vor** der Autorisierung. | `VERIFIED_IN_REPO` |
| **D-10** | GERING | `resolveLocalizedRowField` erkennt eine **wörtlich kopierte** deutsche Übersetzung nicht — die häufigste reale Form einer nicht übersetzten AGB. Inhärent; jetzt im Modulkopf und in einem Test festgehalten statt verschwiegen. | `VERIFIED_IN_REPO` (Grenze dokumentiert) |
| **D-11** | GERING | Randleerzeichen machen eine Nur-Leerzeichen-Änderung für die Konflikterkennung unsichtbar. Dokumentiert, vertretbar. | akzeptiert |
| **D-12** | NITPICK | `BASIS_SPRACHE` und `DEFAULT_LOCALE` waren zwei unabhängige Antworten auf dieselbe Frage. Jetzt durch einen Test gebunden. | `VERIFIED_IN_REPO` |

**Von mir falsch beschuldigt:** meine Manifest-Ausnahme warf
`send-appointment-confirmation` dieselbe Fail-open-Prüfung vor. Falsch — es prüft
**dreiwertig** (ok / kein Mitglied / Störung) und antwortet auf die Störung mit
503 statt 403. Das ist strenger als der gemeinsame Helfer, der einen DB-Fehler
auf `false` abbildet. Die Ausnahme sagt das jetzt.

**Was daraus folgt:** drei der vier Tore aus der vorigen Tranche prüften die
REGEL und nicht ihre ANWENDUNG. Ein Quelltext-Tor kann Anwesenheit und
Reihenfolge belegen — mehr nicht. Wo Wirkung zählt, gehört die Logik in eine
reine Funktion mit Eingabe und Ausgabe.

---

## P1A — asynchrone Mandantenkette

| ID | Fehlerklasse | Zustand | Nachweis | Commit |
|---|---|---|---|---|
| **P1A-6** | Ein verzögerter Schreibvorgang nahm den Mandanten aus dem Kontext, die Werte aus der geladenen Zeile — zwei richtige Werte zu verschiedenen Zeitpunkten | `VERIFIED_IN_REPO` · NICHT LIVE | 8 Tests mit `vi.useFakeTimers()` fahren den Ablauf ab, der A in die B-Zeile schrieb; `assertSameTenant` macht Nutzlast/WHERE-Bruch zum Fehler | `642a71df` |

**Die Invariante:** *Jeder verzögerte Aufruf, jede Anfrage, jede Antwort, jeder
Cache-Eintrag, jeder Entwurfsschlüssel und jede Mutation trägt EINE
Mandantenidentität von Anfang bis Ende.* Ein statisches Verbot von
`fetchSingleCompanyForUser`/`getCachedCompany` ist dafür **notwendig, aber nicht
hinreichend** — dort rät niemand eine Firma.

## P4 — Modulzertifizierung

| Modul | Bericht | Urteil | Blockiert durch |
|---|---|---|---|
| 01 Identität und Mandantenschaft | [module-certification/01-…](module-certification/01-identitaet-und-mandantenschaft.md) | **NICHT ZERTIFIZIERT** | M01-01 · M01-02 (`is_admin` in 59 Policies/47 Tabellen) · M01-03 · M01-04 · M01-05 · Zwei-Mandanten-Durchlauf gegen eine echte DB fehlt · nichts davon ist live |

### M01-01 · Vier mandantenlose Admin-Policies auf `companies` · `VERIFIED`

`companies` trägt vier Policies, die einem globalen „Admin" SELECT, INSERT,
UPDATE und DELETE auf **alle** Firmen geben:

```
USING/WITH CHECK  is_admin(auth.uid())
is_admin(u) := EXISTS (SELECT 1 FROM user_roles
                        WHERE user_id = u AND role IN ('super_admin','admin','moderator'))
```

Gemessen 2026-08-28: **`user_roles` hat 0 Zeilen**. Die vier Policies sind damit
heute wirkungslos — und genau eine Zeile davon entfernt, es nicht mehr zu sein.

Drei Dinge daran:

1. `is_admin` ist **mandantenlos** — es fragt nicht, zu welcher Firma jemand
   gehört. Wer drinsteht, sieht und ändert jede Firma: Adresse, IBAN,
   Absenderidentität.
2. **`moderator` zählt als Admin.** In `src/lib/adminPermissions.ts` ist
   `moderator` die *schwächste* Rolle (Stufe 10). In der Datenbank hat sie
   dieselbe Macht wie `super_admin`. Zwei Rollenmodelle, ein Name.
3. Der Weg hinein führt an der Anwendung vorbei: `user_roles` ist per Policy nur
   von einem bestehenden Super-Admin befüllbar — bei leerer Tabelle also von
   niemandem. `service_role` umgeht RLS aber vollständig.

**Einstufung:** kein aktiver Übertritt (0 Zeilen, gemessen), sondern eine
**ruhende Rechteausweitung**. Sie gehört korrigiert, *bevor* jemand die erste
Rolle vergibt — danach ist es ein Eingriff in laufenden Betrieb.

**Zustand:** `MIGRATION_PREPARED / REVIEW_PASS / NOT_LIVE`. DEC-002 ist entschieden, die
Migration `20260828140000` geschrieben und auf dem Wegwerf-Stapel bewiesen —
nicht angewendet.

Beim Schreiben kam eine **fünfte** Stelle dazu, die im Befund oben fehlte:
`companies_select_member` trägt `USING (is_company_member(id) OR is_admin(auth.uid()))`.
Nur die vier benannten Policies zu entfernen hätte einen firmenübergreifenden
SELECT-Weg offen gelassen — die Entscheidung wäre nicht umgesetzt gewesen. Die
Migration legt die Policy ohne den `is_admin`-Zweig neu an.

Beweis auf dem Wegwerf-Stapel: vorher sah ein Benutzer mit Rolle `admin`
**4 Firmen** bei Mitgliedschaft in einer; nachher 1 eigene, 0 fremde. Benutzer
ohne Rolle blieben unberührt. Idempotent, Rücknahme stellt 5 Policies wieder her.

**Die tragende Annahme, nachgeprüft.** Alles hängt daran, dass die Helfer nicht
selbst `is_admin` aufrufen — täten sie es, bliebe der Ausnahmeweg trotz der
Migration offen. Lesend in der Produktion gemessen
(`ops/rollout/2026-08-28/DEC002-helfer-und-views.txt`):
`is_company_member`, `is_company_owner`, `is_company_role`, `has_role` → alle
`ruft_is_admin=false`. `is_company_member` ist ein reines `EXISTS` auf
`company_members`. Die beiden Views über `companies` (`offer_details`,
`pending_box_pickups`) tragen `security_invoker=on`, umgehen RLS also nicht.
Alle sieben Policies sind PERMISSIVE — sie verodern sich, das Entfernen entzieht
also wirklich.

**Eine Folge, die ich zuerst nicht benannt hatte.** `companies` trägt in der
Produktion **sieben** Policies, nicht fünf. Nach der Migration bleiben drei:
INSERT `auth.uid() = user_id`, SELECT `is_company_member(id)`, UPDATE
`is_company_role(id, {owner,admin})`. Für **DELETE bleibt keine einzige** — die
Tabelle ist danach über RLS nicht mehr löschbar.

**Was DEC-002 ausdrücklich NICHT schliesst.** `public.get_public_company_info(uuid)`
ist `SECURITY DEFINER`, für `anon` und `authenticated` ausführbar und liefert
Name, Adresse, Telefon, E-Mail, Website und Logo **jeder** Firma ohne
Mitgliedschaftsprüfung. Das ist Absicht — `src/pages/public/OfferView.tsx:279`
braucht es, damit ein Kunde sieht, wer ihm die Offerte geschickt hat. Es ist
keine `is_admin`-Ausnahme (auch `anon` kommt heran) und damit ausserhalb dieser
Entscheidung. Es steht hier, damit niemand DEC-002 für „keine
firmenübergreifenden Lesewege mehr" hält. Der Migrationskopf sagt deshalb
**policy-basierter** Zugriff, nicht Zugriff schlechthin.

Das nimmt keinem echten Benutzer etwas: der einzige DELETE-Weg war vorher
`Admins can delete companies` mit `is_admin`, und `user_roles` hat 0 Zeilen. Ein
Firmeninhaber konnte seine Firma also auch vorher nicht über die Anwendung
löschen. Löschen bleibt `service_role` vorbehalten — was der Entscheidung
entspricht, ist aber eine Aussage, die dastehen muss, statt sich zu ergeben.

---

### M01-02 · `is_admin` regiert 59 Policies auf 47 Tabellen · `VERIFIED`

DEC-002 wurde in der Annahme entschieden, es gehe um vier Policies. Beim
Aufzählen der Aufrufer ergab die Messung (2026-08-28, lesend, Beleg
`ops/rollout/2026-08-28/DEC002-is_admin-aufrufer.txt`):

```
is_admin in Policies:   59
betroffene Tabellen:    47
```

Zur Belegdatei selbst: sie enthält **zwei fehlgeschlagene Abfragen**
(`array_agg is an aggregate function`, `ORDER BY position 2 is not in select
list`). Die „47 Tabellen" stammen daher nicht aus einer Abfrage, sondern aus der
Auszählung der 59 Zeilen. Die unabhängige Durchsicht hat beide Zahlen
nachgerechnet und bestätigt, und die Stichprobe
(`offers | Public can view/update offer with valid token`) gegen
`20251223021009_…sql:20,35,40` geprüft — die Einträge tragen `is_admin` wirklich.

Darunter `leads`, `offers`, `offer_items`, `customers`, `email_logs`,
`appointments`, `team_members`, `profiles`, `agb_sections`, `pricing_rules`.
Eine einzige Zeile in `user_roles` öffnet also nicht die Firmenzeile, sondern
einen firmenübergreifenden Zugriff quer durch das System — Angebote, Kunden,
Preise, E-Mail-Protokolle.

Einziger Funktionsaufrufer: `guard_company_ownership()`, ein Trigger auf
`companies` (`20260727120000_company_role_guard.sql:83` — der einzige
Nicht-Policy-Aufruf im gesamten Migrationsbaum, unabhängig nachgeprüft). Der benutzt `is_admin`, um einen Eigentümerwechsel zu **erlauben** —
er sperrt, statt zu öffnen, und ist eine andere Frage.

**Einstufung:** dieselbe ruhende Rechteausweitung wie M01-01, nur mit rund
zwölfmal grösserer Reichweite. `user_roles` hat weiterhin 0 Zeilen, also kein
aktiver Übertritt.

**Zustand:** `PLANNED`. Migration `20260828140000` fasst die 55 übrigen Policies
**bewusst nicht** an — der Auftrag lautete `companies`. Das hier braucht eine
eigene Entscheidung, und sie ist grösser als DEC-002: sie berührt jede Tabelle,
auf der heute ein „Admin" arbeiten könnte.

---

### M01-03 · Meine eigene R-1-Undo-Tabelle lag ohne RLS · `VERIFIED`

`public.undo_20260828100000`, angelegt von der von mir geschriebenen und
angewendeten Migration `20260828100000`, war die **einzige** Tabelle im ganzen
`public`-Schema ohne Row Level Security. Die vier älteren Undo-Tabellen haben
sie, bei identischer ACL.

Die `anon`-Rechte stammen nicht aus der Migration, sondern aus dem schemaweiten
`ALTER DEFAULT PRIVILEGES` von Supabase — jede neue Tabelle bekommt sie. RLS ist
hier die Grenze, und genau die eine Zeile fehlte.

**Was das Objekt nicht kann:** es ist eine gewöhnliche Tabelle, keine Funktion —
kein `SECURITY DEFINER`, kein dynamisches SQL, kein Trigger, und **kein Aufrufer
in der Datenbank**. Diese Einschränkung zählt: die Abfrage sah den Katalog, nicht
das Dateisystem. Eine `.sql`-Datei im Repo, die die Tabelle liest, konnte sie
strukturell nicht finden — und genau eine solche gab es (M01-04). Sie
kann die entzogene Policy **nicht** wiederherstellen und `anon` keine Rechte
zurückgeben; dafür bräuchte es DDL.

**Was sie konnte,** am Nachbau gemessen: `anon` las die Zeile, fügte eine
gefälschte ein, änderte den Beleg auf `rollen=verfälscht` und löschte alles.
Nicht Rechteausweitung — Beweismittelvernichtung.

**Nach der zweiten Durchsicht überarbeitet.** Die erste Fassung behauptete „RLS
allein würde genügen; das Entziehen ist die zweite Linie". Das war **falsch
herum** — siehe M01-05. Ausserdem lief sie ohne Transaktion, brach bei fehlender
Tabelle hart ab, prüfte `TRUNCATE` nicht, und Nachweis 3 belegte mit
`rolbypassrls` von `service_role` etwas über einen Rücknahmeweg, der in
Wahrheit Eigentümerschaft verlangt (`must be owner of table`). Alles vier
behoben und neu bewiesen: fehlende Tabelle → `NOTICE`, kein Abbruch; `anon`
SELECT/TRUNCATE/DELETE alle blockiert; idempotent; Rücknahme gibt `TRUNCATE`
zurück.

**Zustand:** `MIGRATION_PREPARED / REVIEW_PASS / NOT_LIVE`. `20260828150000` schaltet RLS ein
und entzieht `anon`/`authenticated` das Tabellenrecht; 8 von 8 Operationen
danach `permission denied`, `service_role` kommt weiter heran, Belegzeile
unversehrt. Nicht angewendet.

**Korrektur der eigenen Einstufung:** oben stand „Nicht Rechteausweitung —
Beweismittelvernichtung". Das war zu milde. Siehe M01-04.

---

### M01-04 · SQL-Injektion in die Rücknahme von R-1 · `VERIFIED` · **behoben im Repo**

Die unabhängige Durchsicht fand, was mir entgangen war.
`ROLLBACK_20260828100000_…sql` baute die wiederherzustellende Policy so:

```sql
EXECUTE format(
  'CREATE POLICY %I ON public.landing_page_analytics FOR INSERT WITH CHECK (%s)',
  z.policyname, coalesce(z.withcheck, 'true')
);
```

`%s` setzt **roh** ein, und `z.withcheck` steht in genau der Tabelle, die laut
M01-03 ohne RLS liegt und von `anon` beschreibbar ist. PL/pgSQL `EXECUTE` nimmt
mehrere Anweisungen entgegen. Am Wegwerf-Stapel nachgestellt:

```
anon setzte:  true); INSERT INTO public.beute VALUES ('...'); --
Betreiber führt die Rücknahme aus (als postgres)
Ergebnis:     beute: anon hat als postgres geschrieben
```

Das ist keine Beweismittelvernichtung mehr, sondern **fremdes SQL mit
Eigentümerrechten**. Der Weg ist real, aber nicht selbstauslösend: er verlangt,
dass ein Betreiber die Rücknahme ausführt — und
[ROLLOUT-2026-08-28.md](ROLLOUT-2026-08-28.md) weist ihn genau dazu an.

**Warum es nur diese eine Datei trifft.** Das Muster `%s`-in-DDL steht auch in
`ROLLBACK_20260809120000_…sql`. Dessen Undo-Tabelle hat aber RLS — nur
`service_role` schreibt dort, und die dürfte das DDL ohnehin. Erreichbar für
`anon` ist allein `undo_20260828100000`, die Tabelle, die ich ohne RLS angelegt
habe. Die beiden Befunde sind dieselbe Wurzel, zweimal.

**Vollständiger Prüfsatz:** `ops/artifact-corrections.jsonl`, Eintrag `AC-0001` —
alter Digest `c329d13bba10f96c9105fd2a55003c2d02daa088f63195e7110b98951a5b2526`,
neuer `581957802753d27da4633be78f485390ac61e272e4f82e221316cccbd3270ace`,
Einführungscommit `ac26a2ed`, Korrekturcommit `8b8893a6`, Reproduktions- und
Negativtest-Belege, Prüferidentitäten und der Grund gegen eine Nachfolgedatei.
Der Eintrag ist anfügend und bleibt abfragbar; ein `git diff` allein ist
Stützbeleg, nicht das Ledger-Ereignis.

*(Die Freigabe nannte `8d015e82` als Korrekturcommit. Gemessen mit
`git log -- <pfad>` hat dieser Commit die Datei nicht angefasst — er korrigiert
die beiden Vorwärtsmigrationen. Der Prüfsatz führt den gemessenen Commit.)*

**Behoben:** der gespeicherte Wert erreicht das `EXECUTE` nicht mehr. Er wird
geprüft (`withcheck` muss `true` sein, der Name muss stimmen), und das DDL ist
konstant. Angriff danach: `ERROR … erwartet "true"`, Transaktion zurückgerollt,
`beute` leer. Der echte Fall stellt die Policy weiterhin her
(`cmd=a check=true`).

**Zustand des korrigierten Artefakts:** `SAFE_ARTIFACT` ·
`NEVER_APPLIED_TO_PRODUCTION`. Einstufung der Änderung:
`CORRECTED_BEFORE_FIRST_PRODUCTION_EXECUTION`.

Zur Sprache: die Datei ist **nicht** „nie gelaufen". Sie wurde bei der
Rücknahme-Prüfung auf Wegwerf-Stapeln ausgeführt —
`EXECUTED_ONLY_IN_DISPOSABLE_TEST_ENVIRONMENTS`. In der Produktion lief sie nie.

**Eingriff in eine bestehende Datei — freigegeben, eng.** Die Datei ist eine
`ROLLBACK_`-Schwester und wurde in der Produktion nie angewendet; die
Anfüge-Regel schützt den Nachweis dessen, was dort *lief*. Die Freigabe vom
2026-08-28 ist ausdrücklich eng und schafft **keine** allgemeine Ausnahme von
der Unveränderlichkeit von Migrationen.

Eine zweite, sichere Datei neben der verwundbaren wurde **abgelehnt**: das hätte
zwei scheinbar gültige Betreiberpfade geschaffen und die Möglichkeit erhalten,
dass später der unsichere ausgeführt wird. Das Tor hat den Eingriff korrekt gemeldet
(`keine bestehende Datei wurde geändert` → rot), und die Prüfsumme wurde
**einzeln** nachgezogen: eine Zeile in `ops/migration-ledger.json`. Wer das
prüfen will: `git log -p ops/migration-ledger.json`. Die Alternative wäre
gewesen, eine nachweislich ausnutzbare Datei in einem Handbuch stehen zu lassen,
das zu ihrer Ausführung auffordert.

---

### M01-05 · `anon` darf 97 von 102 Tabellen TRUNCATEn · `VERIFIED` · nicht erreichbar

Die zweite Durchsicht widerlegte eine Annahme, auf die ich M01-03 gestützt
hatte: dass die vier älteren Undo-Tabellen sicher seien, weil sie RLS tragen.

**`TRUNCATE` unterliegt keiner Row Level Security.** In der Produktion gemessen:

```
undo_20260802110000  rls=true   anon_truncate=true
undo_20260802120000  rls=true   anon_truncate=true
undo_20260802130000  rls=true   anon_truncate=true
undo_20260809120000  rls=true   anon_truncate=true
anon darf TRUNCATEn:  97 von 102 Tabellen im public-Schema
```

Das Recht stammt wie die übrigen aus Supabases schemaweitem
`ALTER DEFAULT PRIVILEGES`. RLS schützt Zeilen; `TRUNCATE` fragt nicht nach
Zeilen.

**Erreichbarkeit — und deshalb keine offene Lücke.** Gemessen:

```
docker port <db-container>     (keine Portfreigabe)
anon           rolcanlogin=false
authenticated  rolcanlogin=false
authenticator  rolcanlogin=true      (PostgREST, setzt SET ROLE je Anfrage)
Funktionen mit TRUNCATE im Rumpf:  keine
```

PostgREST bietet kein `TRUNCATE` an, `anon` kann sich nicht anmelden, der
Datenbank-Port ist nicht veröffentlicht. Es gibt heute **keinen gemessenen Weg**
von aussen. Einstufung deshalb: echtes Recht, falsch vergeben, **nicht
erreichbar** — Härtung, nicht Vorfall. Wer es anders einstuft, muss zuerst einen
Weg zeigen.

**Zustand:** `VERIFIED_PRIVILEGE_DRIFT` · `NO_MEASURED_EXTERNAL_REACHABILITY` ·
`SEPARATE_HARDENING_DECISION_REQUIRED`. Die Korrektur wäre
`REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated` plus
eine Änderung der Standardrechte für künftige Tabellen. Das berührt 97 Tabellen
und alle künftigen — eine eigene Entscheidung, keine Beifuhr zu DEC-002. Für
`undo_20260828100000` ist es in `20260828150000` bereits enthalten, weil dort
`REVOKE ALL` steht.

---

## P3 / P5 — später

| ID | Modul | Zustand |
|---|---|---|
| **P3-1** | Migrationsledger ab signierter Basislinie | `VERIFIED_IN_REPO` — 391 Dateien signiert; anfügend als Tor, 3 Einschleusungen |
| **P3-2** | Repo/deploy-Parität als Tor | `VERIFIED_IN_REPO` — 12 bekannte Abweichungen mit Rollout-Einheit; neue oder veraltete Einträge sind Testfehler |
| **P5-1** | `generate-sitemap`, `hello`, `accept-lead` zurückbauen | `BACKLOG` |
| **P5-2** | `cookie_consent_log` — Erreichbarkeit klären | `BACKLOG` |

---

## Produktionsschreibvorgänge — freigegeben, ausgeführt, offen (Stand 2026-08-28)

Alle sind vollständig vorbereitet: **[ROLLOUT-2026-08-28.md](ROLLOUT-2026-08-28.md)**
— Reihenfolge, Rücknahme und lesende Nachkontrolle.

**R-1, R-2 und R-3 wurden am 2026-08-28 gestuft freigegeben.** Ausgeführt wurden
R-1 vollständig und R-2 bis Einheit 2; dann griff die Abbruchbedingung. Alles
Übrige in dieser Tabelle ist **nicht** ausgeführt, und R-4 bis R-6 sind nicht
einmal freigegeben. Die Überschrift trifft also nur noch auf die nicht
ausgeführten Zeilen zu.

| ID | Was | Befund | Zustand |
|---|---|---|---|
| **R-1** | Migrationen `20260828100000` **und** `20260828120000` | P0-S1 | **`LIVE_VERIFIED`** ✅ 2026-08-28 · Digests, Commits und Anwendungszeit in [R1-RUECKVERFOLGBARKEIT.md](R1-RUECKVERFOLGBARKEIT.md); beim Anwenden wurde **kein Eingabe-Digest protokolliert** — bewiesen ist Wirkungsgleichheit, nicht Byte-Herkunft |
| **M01-03** | Migration `20260828150000` — RLS auf die R-1-Undo-Tabelle | M01-03 | **`MIGRATION_PREPARED / NOT_LIVE`** — 8/8 Operationen für `anon`/`authenticated` danach abgewiesen, `service_role` behält Zugriff |
| **R-2 / Einheit 1** | `_shared/appointmentDay.ts` | R-2 | **`LIVE_VERIFIED`** ✅ Digest geprüft, sieben Abhängige booten |
| **R-2 / `calculate-distance`** | Handler ausgerollt | R-2 | **`DEPLOYED / BEHAVIOUR_EQUIVALENT`** — der einzige Unterschied zur Vorfassung ist die wirkungslose Drossel; das Verhalten ist identisch |
| **R-2 / Drosselschutz** | Rate-Limit-Wirkung | R-2 | **`REFUTED`** — 61 Anfragen, null 429, vor und nach dem Rollout gleich |
| **R-2 gesamt** | die sechs Handler | P0-S3, P0-S3a | **`ACTIVE_PRODUCTION_EXPOSURE / ROOT_CAUSE_UNRESOLVED`** — Einheiten 3–7 nicht ausgerollt |
| **R-3** | Frontend, dann `spell-check-ai` | R-2 | **`BLOCKED_BY_R2`** · **`BLOCKED_BY_RELEASE_COUPLING`** — das Frontend-Deployment aktiviert zugleich die strenge Sendebereitschaft aus R-4 |
| **R-4 … R-6** | — | — | **`NOT_AUTHORIZED_FOR_PRODUCTION`** |
| **DEC-002** | vier mandantenlose `companies`-Policies entfernen | M01-01 | **`DECIDED / MIGRATION_PREPARED / NOT_LIVE`** — `20260828140000`, fünfte Stelle `companies_select_member` mitgefasst |
| **R-3 / Paketinhalt** | `_shared/spellCheckPrompt.ts` + `spell-check-ai`, **Frontend zuerst** | P0-S8 | Paket vollständig; der Zustand steht in der R-3-Zeile oben (`BLOCKED_BY_R2`), diese Zeile beschreibt nur den Inhalt |
| **R-4** | `_shared/offerSendReadiness.ts` + `_shared/localizedRow.ts` + `_shared/verifyCompanyMembership.ts` **zuerst**, dann `send-offer` | P1B-3 | `READY_FOR_ROLLOUT` — fachliche Auswirkung vorher klären: unvollständig übersetzte fr/en-Offerten gehen danach nicht mehr hinaus |
| **R-5** | Frontend neu bauen und ausrollen | P1A, P1B-2 | `READY_FOR_ROLLOUT` — ohne sie bleiben P1A und P1B-2 wirkungslos |
| **R-6** | Migration `20260828110000_oeffentliche_rpc_rechte_verengen.sql` einspielen | T10-01 | `READY_FOR_ROLLOUT` — auf einem Wegwerf-Stapel bewiesen (anwenden · idempotent · Rücknahme · erneut vorwärts); geringe Dringlichkeit, gehört in dieselbe Freigabe wie R-1 |

⚠️ **R-2 hat eine bindende Reihenfolge.** `_shared/appointmentDay.ts` ist im Repo,
aber nicht ausgerollt; der neue `notify-appointment-reminder/index.ts` importiert
sie. Handler vor der gemeinsamen Datei zu kopieren, bricht die Terminerinnerung
zur Laufzeit.

### Nachschärfung zu P0-S3 (gemessen nach der ersten Auswertung)

`edge-drift.mjs` zählte anfangs `__tests__` mit — die laufen unter Vitest, nicht
unter Deno, und werden nie ausgerollt. Dadurch erschienen `calendar-feed` und
`_shared` als Drift, obwohl jede ausgelieferte Datei stimmte. Korrigiert; der
Stand ist jetzt **30 identisch, 9 Drift**.

Von den 9 sind nur **6 echte Rückstände** (`index.ts` unterscheidet sich).
Bei `send-offer` und `notify-offer-response` stimmt `index.ts`; die Abweichung
sind **neun von Hand angelegte `.bak-*`-Kopien im Produktionsverzeichnis**.
Deno lädt nur `index.ts`, sie werden also nicht ausgeführt — es ist trotzdem
Geschäftslogik auf dem Server, die niemand prüft. Ihr Rückbau wartet auf ein
Deploy-Verfahren mit eigenem Rücknahmeverzeichnis (P3-2): derzeit sind sie die
einzige vorhandene Rücknahme für frühere Rollouts.
