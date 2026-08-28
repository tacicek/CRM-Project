# Härtungs-Ledger

Eine Zeile je Aufgabe. Die Spalten sind der Vertrag: ohne *Beleg vorher* und
*Nachweis* wechselt keine Zeile auf `DONE`.

**Etiketten:** `VERIFIED` (aus Quelltext, Testausgabe, Katalog oder ausgerolltem
Code bewiesen) · `HYPOTHESIS` (plausibel, unbewiesen) · `NEEDS-PROD-CHECK`
(braucht den Live-Zustand; die Abfrage steht dabei) · `REFUTED` (geprüft und
widerlegt).

**Zustände:** `BACKLOG → READY → IN_PROGRESS → VERIFY → REVIEW → MERGED →
PRODUCTION_VERIFIED → DONE`, dazu `BLOCKED`, `AWAITING_PRODUCTION_AUTH`,
`DEFERRED_WITH_OWNER_DECISION`.

Programm: [CRM_SYSTEM_HARDENING_PROGRAM.md](../CRM_SYSTEM_HARDENING_PROGRAM.md) ·
Belege: `.project-engineering/evidence/` · Steuerung: `.project-engineering/`

---

## Basislinie (Commit `f4064560`, gemessen 2026-08-28)

| Tor | Ergebnis |
|---|---|
| `npm run type-check` | PASS |
| `npm test` | PASS — 83 Dateien, 1746 Tests |
| `npx eslint .` | FAIL — 88 Fehler, 2 Warnungen (Altschuld) |

Produktion: PostgreSQL 15.8 · 101 Tabellen, alle mit RLS, 232 Policies ·
220 Funktionen, davon 32 `anon`-ausführbar · 42 Edge Functions ausgerollt ·
2 Firmen, 2 Mitgliedschaften · 93 Offerten, 531 Positionen, 31 Rechnungen,
12 Quittungen, 115 Leads, 26 Aufträge, 96 Termine.

---

## P0 — Produktionswahrheit

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Umsetzung | Nachweis | Commit | Produktionsprüfung | Restrisiko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **P0-1** | Plattform | keine gemessene Wahrheit | — | `MERGED` | Letzte Aufnahme 2026-08-10, Repo seither weitergezogen | Datierte, lesende Aufnahme; jeder Driftposten benannt | `scripts/capture-production-truth.sh` gegen `7639710127421538342` | `ops/production-truth/2026-08-28/` (Generation `b92a3bf64015b2eb`) | T-001 | lesend erfolgt | — |
| **P0-2** | Plattform | Repo↔Deploy nur Mengen-, kein Inhaltsvergleich | P0-1 | `MERGED` | `deploy-repo-diff.json` vergleicht nur Namen | Inhaltsvergleich gegen den exakten Commit, reproduzierbar | `scripts/edge-drift.mjs` | `.project-engineering/evidence/P0-2026-08-28/edge-hash-drift.json` — 29 gleich, 10 Drift, 3 deploy-only, 12 nicht ausgerollt | T-001 | lesend erfolgt | — |
| **P0-3** | Plattform | Migrationsstand unbelegt | P0-1 | `MERGED` | „Datei vorhanden" ≠ „eingespielt" | Für die Migrationen seit 2026-08-05 gemessener Stand | Lesende Katalogsonde | `migration-applied-state.json` — 3 `APPLIED`, 1 `NOT_APPLIED` | T-001 | lesend erfolgt | Für die 380+ älteren Dateien gibt es weiterhin keinen Ledger (→ P3-1) |
| **P0-4** | Plattform | Edge ohne Auth-Modell | P0-1, P0-2 | `MERGED` | 42 ausgerollte Functions, keine Einstufung | Genau ein Modell je ausgerollter Function, als Tor erzwungen | `docs/hardening/edge-auth-manifest.json` + `src/test/__tests__/edge-auth-manifest.test.ts` | 8 Tests grün; 42/42 eingestuft | T-001 | lesend erfolgt | Bei den 10 Driftfällen gilt die Einstufung dem Repo-Stand; die ausgerollten Fassungen wurden einzeln gelesen und sind älter, nicht anders |

### Belegte Befunde aus P0

| ID | Etikett | Befund | Zustand |
|---|---|---|---|
| **P0-S1** | `VERIFIED` | `landing_page_analytics` trägt in der Produktion eine INSERT-Policy `TO PUBLIC` mit `WITH CHECK (true)`; `anon` hat das Tabellenrecht. Die Korrektur `20260828100000` liegt im Repo, `undo_20260828100000` fehlt in der Produktion → **nicht eingespielt**. Unauthentifiziert aus dem Internet schreibbar. | `AWAITING_PRODUCTION_AUTH` |
| **P0-S2** | `VERIFIED` | `VERIFY_JWT=false`; der ausgerollte Router `main` überspringt seinen 401-Block genau dann; Kong-Route `/functions/v1` trägt nur `cors`. Jede ausgerollte Function ist unauthentifiziert erreichbar. `config.toml` ist an dieser Installation wirkungslos. | `MERGED` (als Vertrag im Manifest festgeschrieben) |
| **P0-S3** | `VERIFIED` | 10 Functions driften. Alle 10 gegen den ausgerollten Quelltext diffed: die Produktion ist **älter**, nicht anders. | `AWAITING_PRODUCTION_AUTH` |
| **P0-S3a** | `VERIFIED` | `calculate-distance`, `google-places-autocomplete`, `google-places-details` sind unauthentifizierte Proxys auf kostenpflichtige Google-APIs. Die Drossel (60/min je IP) steht im Repo, ist aber **nicht ausgerollt**. Fremdkostenabfluss ohne jede Hürde. | `AWAITING_PRODUCTION_AUTH` |
| **P0-S4** | `REFUTED` | Sorge: unauthentifizierter deploy-only Handler. Gelesen: `accept-lead` prüft `auth.getUser` **und** `verifyCompanyMembership`; `hello` gibt eine Konstante zurück; `main` ist der Laufzeit-Router. Kein offenes Loch. | — |
| **P0-S5** | `VERIFIED` | `generate-sitemap` läuft mit `service_role` ohne Auth und erzeugt Marktplatz-Sitemaps (`/partner-werden`, `/preise`, SEO-Landingpages). Liest nur `blog_posts` mit `status='published'` — kein Datenabfluss. | `BACKLOG` → P5-1 |
| **P0-S6** | `VERIFIED` | 8 `config.toml`-Einträge ohne Quelle und ohne Deployment; 16 Quellen ohne Eintrag; 12 Quellen ohne Deployment. | `BACKLOG` → P3-2 |
| **P0-S7** | `VERIFIED` | `fetchSingleCompanyForUser()` rät die Firma; 17 Dateien rufen sie, 16 davon unter `/firma`. Produktion hat 2 Firmen. | **`MERGED`** — siehe P1A |
| **P0-S8** | `VERIFIED` | `spell-check-ai` trägt einen fest deutschen Prompt (`ß→ss`, Substantivgrossschreibung); `runSpellCheck(fields)` sendet keine Sprache. Aufgerufen für jede Dokumentsprache. | **`MERGED`** — siehe P1B-1; Rollout offen |
| **P0-S9** | `VERIFIED` | `cookie_consent_log` trägt eine unbeschränkte PUBLIC-INSERT-Policy. CookieBanner ist laut `CLAUDE.md` §2 aus dem Fork entfernt — Erreichbarkeit ungeprüft. | `BACKLOG` → P5-2 |
| **H-004** | `VERIFIED` | In `send-quittung` und `send-rechnung-email` steht die Berechtigungsprüfung in einem `if (zeile) { … }`, dessen Abfragefehler verworfen wird: fällt die zweite Abfrage aus, wird der 403 **übersprungen**. In `send-quittung` lädt `loadCompanySecrets` ausserdem **vor** der Prüfung. | `BACKLOG` → P1C-1 |

---

## P1A — Mandanten-Split-Brain · **geschlossen**

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Umsetzung | Nachweis | Commit | Produktionsprüfung | Restrisiko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **P1A-1** | Finanzen | geratene Firmenidentität in Rechnungen/Quittungen | P0-S7 | `MERGED` | `Rechnungen.tsx` holte Liste über aktiven Mandanten, Kopfdaten über den Ratehelfer | Firmensatz kommt aus dem aktiven Mandanten; Zeile fremder Firma fällt fail closed durch | `fetchCompanyById`, `aktiverMandant`, `useCompanyRecord`; 4 Seiten umgestellt | 12 Vertragstests; type-check, 1766 Tests, build grün | `37f9d7bc` | — (nur Browsercode) | Zwei-Firmen-Test läuft gegen reine Funktionen, nicht gegen ein laufendes DOM (§16 des Programms) |
| **P1A-2** | Offerten | geratene Firmenidentität in Offerte anlegen/bearbeiten/Detail | P1A-1 | `MERGED` | drei Seiten am Ratehelfer; `OfferteErstellen` lud den Lead ohne Mandantenfilter | aktiver Mandant als einzige Quelle; Lead fremder Firma fällt fail closed durch | 3 Seiten umgestellt; `select: "*"` in `OfferteDetail` durch Spaltenliste ersetzt | type-check, 1766 Tests, build grün | `109289b3` | — | — |
| **P1A-3** | Aufträge, Einstellungen, Archiv, Importe, Preise, Katalog, Checkliste, Team | restliche `/firma`-Aufrufer | P1A-2 | `MERGED` | 9 Seiten am Ratehelfer; Einstellungs-Entwurf unter festem Schlüssel; `select: "*"` | keine eigene Firmenauflösung mehr; tenant-gebundener Entwurfsschlüssel | 5 Seiten ganz ohne Abfrage (ID kommt aus dem Kontext), 4 über `fetchCompanyById` | type-check, 1766 Tests, build grün | `5d2f2976` | — | — |
| **P1A-4** | Auth | `Auth.tsx`: „genau eine Firma" → „berechtigte Mitgliedschaften" | P1A-3 | `MERGED` | Ratehelfer entschied den Anmeldebildschirm: verifizierte Firma A + unverifizierte B konnte „Verifizierung ausstehend" ergeben | `entscheideAnmeldeZiel()` über alle Mitgliedschaften; `is_verified === true` | reine Funktion + `fetchCompaniesForUser` | 5 Vertragstests; 1772 Tests grün | `45faf73d` | — | — |
| **P1A-5** | Plattform | Wiedereinführung des Ratehelfers | P1A-4 | `MERGED` | Helfer gelöscht — aber in zwei Zeilen neu schreibbar | Tor prüft das MUSTER (E-Mail-Suche, `created_at`-Sortierung), nicht den Namen | `src/test/__tests__/mandanten-quelle.test.ts` | **gegen eine eingeschleuste Verletzung geprüft** — schlägt bei allen drei Mustern an | `45faf73d` | — | Das Tor deckt `src/` ab, nicht `supabase/functions/` |

**Exit-Gate P1A:** null `/firma`-Importe des Ratehelfers · null Vorkommen im Quelltext · Tor gegen die Rückkehr, negativ geprüft. **Erfüllt.**

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
| **R-01** | HOCH | Der Entwurfsschlüssel in `Einstellungen` hing an `activeCompanyId`, nicht an der Zeile, aus der die Werte stammen. Beim Wechsel schrieb der 600-ms-Timer A-Werte unter den Schlüssel von B; das Laden legte sie über die frischen B-Werte, und `handleSaveProfile` schrieb sie mit `.eq("id", company.id)` in die **B-Zeile**. **Meine eigene P1A-Korrektur hatte den falschen Tenant gewählt.** | `MERGED` |
| **R-02** | MITTEL | `Besichtigungen.tsx` holte die Firma aus `getCachedCompany()` — synchron, und beim Wechsel nicht nachziehend. Ich hatte nur nach `fetchSingleCompanyForUser` gesucht; die Aussage „null Aufrufer" war wahr, die Aussage „eine Quelle" trotzdem falsch. | `MERGED` |
| **R-03** | MITTEL | Das Tor kannte drei Muster, `getCachedCompany` war keines davon — es bestätigte einen Zustand, den es nicht prüfte. Zwei Regeln ergänzt (sessionStorage-Griffe, `company_members.eq("user_id")`), beide gegen eingeschleuste Verletzungen geprüft. Grenze des Tors jetzt im Kopf der Datei. | `MERGED` |
| **R-04** | MITTEL | `CompanyProvider` wählte `fetchedCompanies[0]` ohne `is_verified` zu prüfen. Die in P1A-4 behobene Sackgasse lag damit eine Ebene tiefer weiter vor. Auto-Auswahl bevorzugt jetzt eine freigeschaltete Firma. | `MERGED` |
| **R-05** | GERING | `useCompanyRecord` gab `error` zurück, niemand las es, der Kommentar behauptete das Gegenteil. Der Hook meldet jetzt selbst. | `MERGED` |
| **R-06** | GERING | Das Manifest stufte `accept-lead` als `jwt-member` ein, ohne dass das aus dem Repo belegbar wäre (Quelle nicht da, Aufnahme geschwärzt). Herkunft und Grenze des Tors jetzt vermerkt. | `MERGED` |
| **R-07** | KLEINIGKEIT | Vier Listenseiten drehten bei fehlendem Mandanten ewig — früher `return` ausserhalb des `finally`. Heute unerreichbar, behoben. | `MERGED` |

---

## P1B — FR/EN-Kette

| ID | Modul | Fehlerklasse | Abhängig | Zustand | Beleg vorher | Sollvertrag | Nachweis | Commit |
|---|---|---|---|---|---|---|---|---|
| **P1B-1** | Offerten | Rechtschreibprüfung nur Deutsch, für jede Sprache aufgerufen | P0-S8 | `MERGED` | fester deutscher Prompt (`ß→ss`, Substantivgrossschreibung); `runSpellCheck(fields)` ohne Sprache | `runSpellCheck(fields, locale)`; Handler prüft `de\|fr\|en` und weist Fehlendes mit 400 ab; sprachabhängige Prompts; nie übersetzen | 9 Vertragstests, u. a.: `ß` und deutsche Substantivregel kommen in `fr`/`en` NICHT vor; alle Edge Functions booten | `e4583ee9` |
| **P1B-2** | Offerten | Sprachumschalter behauptet eine Umstellung, die nicht stattfindet | P1B-1 | `BACKLOG` |
| **P1B-3** | Offerten | strenge Sendebereitschaft statt stiller deutscher Rückfall | P1B-2 | `BACKLOG` |

⚠️ P1B-1 ist eine **Edge-Änderung** und wirkt erst nach dem Ausrollen. Reihenfolge
bindend: **Frontend zuerst, Handler danach** — siehe R-3 im
[Rollout-Paket](ROLLOUT-2026-08-28.md). Umgekehrt verlieren offene Tabs die
Prüfung.

## P1C — Edge/RPC-Grenzen

| ID | Modul | Fehlerklasse | Abhängig | Zustand |
|---|---|---|---|---|
| **P1C-1** | Finanzen/Edge | Autorisierung im `if`, Fehler verworfen; Secret-Ladung vor Prüfung (H-004) | P0-4 | `BACKLOG` |
| **P1C-2** | Edge | 4 verbliebene `anon`+DEFINER+schreibende RPCs einzeln prüfen | P0-1 | `BACKLOG` |

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
| **R-1** | Migration `20260828100000_landing_analytics_anon_insert_entzogen.sql` einspielen | P0-S1 | `AWAITING_PRODUCTION_AUTH` |
| **R-2** | `_shared/appointmentDay.ts` + sechs Handler ausrollen | P0-S3, P0-S3a | `AWAITING_PRODUCTION_AUTH` |

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
