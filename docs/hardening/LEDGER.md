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
weil ihre Migration existiert. Deshalb sechs getrennte Stufen:

| Zustand | Bedeutet | Bedeutet NICHT |
|---|---|---|
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

**Nichts in diesem Repo kann `LIVE_VERIFIED` erreichen, solange kein
Produktionsschreibvorgang freigegeben ist.** Das ist kein Mangel des Ledgers,
sondern sein Zweck.

Programm: [CRM_SYSTEM_HARDENING_PROGRAM.md](../CRM_SYSTEM_HARDENING_PROGRAM.md) ·
Belege: `.project-engineering/evidence/` · Steuerung: `.project-engineering/`

---

## Was in der Produktion JETZT gilt (Stand 2026-08-28)

Nichts aus diesem Programm ausser der Messung selbst ist live. Zwei Befunde sind
**offen und ausnutzbar**, während ihre Korrektur im Repo liegt:

| | Zustand | Was das bedeutet |
|---|---|---|
| **P0-S1** `landing_page_analytics` | **`ACTIVE_PRODUCTION_EXPOSURE`** | Jeder unauthentifizierte Aufrufer kann Zeilen schreiben. Migration `20260828100000` existiert, ist **nicht eingespielt**. |
| **P0-S3a** drei Google-Proxys | **`ACTIVE_PRODUCTION_EXPOSURE`** | Ohne Drossel im Netz, auf kostenpflichtigen APIs. Die Drossel ist im Repo, **nicht ausgerollt**. |
| **P1A** Mandantentrennung | `INDEPENDENT_REVIEW_PASS`, **nicht live** | Die laufende Fassung rät die Firma weiter. |
| **P1B-1** Rechtschreibprüfung | `VERIFIED_IN_REPO`, **nicht live** | Die ausgerollte Fassung korrigiert Französisch weiter nach deutschen Regeln. |
| **P1B-2/3** Sprachwechsel + Sendebereitschaft | `VERIFIED_IN_REPO`, **nicht live** | Die laufende Fassung schickt eine französische Offerte weiterhin mit deutschen AGB hinaus. |
| **P1C-0** Auth-Manifest | `VERIFIED_IN_REPO` | Ein Tor im Repo. Es ändert nichts an dem, was heute in der Produktion erreichbar ist. |
| **R-1 / R-2 / R-3** | `READY_FOR_ROLLOUT` | Pakete vollständig ([ROLLOUT-2026-08-28.md](ROLLOUT-2026-08-28.md)), **keins ausgeführt**. |
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

### Belegte Befunde aus P0

| ID | Etikett | Befund | Zustand |
|---|---|---|---|
| **P0-S1** | `VERIFIED` | `landing_page_analytics` trägt in der Produktion eine INSERT-Policy `TO PUBLIC` mit `WITH CHECK (true)`; `anon` hat das Tabellenrecht. Die Korrektur `20260828100000` liegt im Repo, `undo_20260828100000` fehlt in der Produktion → **nicht eingespielt**. Unauthentifiziert aus dem Internet schreibbar. | **`ACTIVE_PRODUCTION_EXPOSURE`** — Korrektur liegt bereit (R-1), ist aber **nicht angewendet**. Die Lücke ist offen. |
| **P0-S2** | `VERIFIED` | `VERIFY_JWT=false`; der ausgerollte Router `main` überspringt seinen 401-Block genau dann; Kong-Route `/functions/v1` trägt nur `cors`. Jede ausgerollte Function ist unauthentifiziert erreichbar. `config.toml` ist an dieser Installation wirkungslos. | `LIVE_VERIFIED` (gemessener Zustand; als Vertrag im Manifest festgeschrieben) |
| **P0-S3** | `VERIFIED` | 10 Functions driften. Alle 10 gegen den ausgerollten Quelltext diffed: die Produktion ist **älter**, nicht anders. | `READY_FOR_ROLLOUT` (R-2) |
| **P0-S3a** | `VERIFIED` | `calculate-distance`, `google-places-autocomplete`, `google-places-details` sind unauthentifizierte Proxys auf kostenpflichtige Google-APIs. Die Drossel (60/min je IP) steht im Repo, ist aber **nicht ausgerollt**. Fremdkostenabfluss ohne jede Hürde. | **`ACTIVE_PRODUCTION_EXPOSURE`** — die Drossel ist im Repo, aber nicht ausgerollt (R-2). Der Abfluss ist offen. |
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
| **P1C-2** | Edge | 4 verbliebene `anon`+DEFINER+schreibende RPCs einzeln prüfen | P0-1 | `PLANNED` | — | — |

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

## P3 / P5 — später

| ID | Modul | Zustand |
|---|---|---|
| **P3-1** | Migrationsledger ab signierter Basislinie | `BACKLOG` |
| **P3-2** | Repo/config/deploy-Parität als Tor | `BACKLOG` |
| **P5-1** | `generate-sitemap`, `hello`, `accept-lead` zurückbauen | `BACKLOG` |
| **P5-2** | `cookie_consent_log` — Erreichbarkeit klären | `BACKLOG` |

---

## Nicht autorisierte Produktionsschreibvorgänge (Stand 2026-08-28)

Beide sind vollständig vorbereitet: **[ROLLOUT-2026-08-28.md](ROLLOUT-2026-08-28.md)**
— Reihenfolge, Rücknahme und lesende Nachkontrolle. Ausgeführt wurde keiner.

| ID | Was | Befund | Zustand |
|---|---|---|---|
| **R-1** | Migration `20260828100000_landing_analytics_anon_insert_entzogen.sql` einspielen | P0-S1 | `READY_FOR_ROLLOUT` — der Befund selbst bleibt `ACTIVE_PRODUCTION_EXPOSURE` |
| **R-2** | `_shared/appointmentDay.ts` **zuerst**, dann sechs Handler | P0-S3, P0-S3a | `READY_FOR_ROLLOUT` — P0-S3a bleibt `ACTIVE_PRODUCTION_EXPOSURE` |
| **R-3** | `_shared/spellCheckPrompt.ts` + `spell-check-ai`, **Frontend zuerst** | P0-S8 | `READY_FOR_ROLLOUT` |
| **R-4** | `_shared/offerSendReadiness.ts` + `_shared/localizedRow.ts` + `_shared/verifyCompanyMembership.ts` **zuerst**, dann `send-offer` | P1B-3 | `READY_FOR_ROLLOUT` — fachliche Auswirkung vorher klären: unvollständig übersetzte fr/en-Offerten gehen danach nicht mehr hinaus |
| **R-5** | Frontend neu bauen und ausrollen | P1A, P1B-2 | `READY_FOR_ROLLOUT` — ohne sie bleiben P1A und P1B-2 wirkungslos |

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
