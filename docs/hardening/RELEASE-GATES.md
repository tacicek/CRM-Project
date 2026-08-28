# Dauerhafte Freigabetore — Stand 2026-08-28

Das Programm zählt in P6 fünfzehn Tore auf, die verhindern sollen, dass die
gefundenen Fehlerklassen still zurückkehren. Diese Datei sagt, welche es
**gibt**, welche **wirken**, und welche noch **fehlen** — getrennt, weil ein
geschriebenes Tor und ein geprüftes Tor nicht dasselbe sind.

## Was „geprüft" hier heisst

Ein Tor gilt erst als geprüft, wenn eine **eingeschleuste Verletzung** es rot
gemacht hat und das Repository danach mit passender Prüfsumme wiederhergestellt
wurde. Drei der vier Tore in dieser Tranche waren in ihrer ersten Fassung
**blind für genau die Verletzung, gegen die sie geschrieben waren** — das steht
unten je Tor.

Alle Tore laufen in `npm test` und damit im `Unit-Tests`-Schritt von
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). CI führt
ausserdem `Type-Check (App)`, `Type-Check (Test-Infrastruktur)`, `Lint` und
`Build` aus — ohne `continue-on-error`.

---

## Vorhanden und gegen Einschleusung geprüft

| # (P6) | Tor | Datei | Eingeschleuste Verletzung | Ergebnis |
|---|---|---|---|---|
| 14 | Kein Raten der Firma | `src/test/__tests__/mandanten-quelle.test.ts` | Ratehelfer wieder eingeführt · Suche über `companies.email` · Sortierung nach `created_at` · `getCachedCompany()` · `company_members.eq("user_id")` | 5/5 rot |
| 9 | Edge-Auth-Manifest vollständig **und passend** | `src/test/__tests__/edge-auth-manifest.test.ts` | unklassifizierte Function · Mitgliedschaftsprüfung entfernt · Cron-Wächter umbenannt · Ausnahme ohne Grund | 3/4 rot; der Cron-Fall kam durch (`includes()` statt Aufrufform) → nachgeschärft, dann 4/4 |
| 5 | Sendebereitschaft im **Sendeweg**, nicht am Knopf | `supabase/functions/_shared/__tests__/sendOfferReadinessGate.test.ts` | Prüfung entfernt · Wächter `if (false && …)` · Ergebnis kurzgeschlossen | 1/3 rot; nachgeschärft, dann 3/3 |
| 2 | Mandantenwechsel bei laufendem Timer | `src/lib/__tests__/tenantBoundWrite.test.ts` + Regel `verzoegerter-schreibvorgang-am-kontext` | Verbraucher nimmt den Mandanten wieder aus dem Kontext | rot (nach der zweiten Durchsicht ergänzt — vorher ging genau das durch) |
| 15 | Kundengerichtete Renderer lesen die Bedienersprache nicht | `src/test/__tests__/kundenrenderer-sprache.test.ts` | `useT()` in `OfferPDF.tsx` | rot |
| 5 | Sendebereitschaft als reine Funktion, nicht als Textsuche | `supabase/functions/_shared/__tests__/offerSendReadinessAssembly.test.ts` | (13 Vertragstests mit Eingabe/Ausgabe) | ersetzt den Beweis, den die Textsuche nicht tragen konnte |

## Vorhanden als Vertragstest

| # (P6) | Tor | Datei |
|---|---|---|
| 3 | Firmenidentität in Rechnung/Quittung/Offerte | `src/lib/__tests__/aktiverMandant.test.ts`, `fetchCompanyById.test.ts` |
| 4 | DE-Operator → FR/EN-Kunde | `supabase/functions/_shared/__tests__/offerSendReadiness.test.ts`, `spellCheckPrompt.test.ts` |
| 5 | Strenge Übersetzungsbereitschaft | `offerSendReadiness.test.ts` |
| 13 | Erzeugte Supabase-Typen | `src/test/__tests__/schema-contract.test.ts` (bestand bereits) |
| — | Ehrlicher Sprachwechsel | `src/lib/__tests__/offerLanguageRebase.test.ts`, `offerRebaseFelder.test.ts` |
| — | Anmeldeweiche über Mitgliedschaften | `src/lib/__tests__/anmeldeZiel.test.ts` |

## Fehlt noch

| # (P6) | Tor | Warum noch nicht |
|---|---|---|
| 1 | Zwei-Mandanten-Isolation je service-role-Function **gegen eine echte DB** | Braucht den Wegwerf-Stapel (`npm run test:db`), der bewusst nicht in CI läuft |
| 6 | PDF/E-Mail/öffentliche Ansicht byte-/inhaltsgleich | Setzt das Schnappschussmodell aus P2 voraus |
| 7 | Preismodell und Positions-Metadaten von der Eingabe bis zur PDF-Summe | P2 |
| 8 | Zustandsübergänge und Idempotenz bei Wiederholung | P2 |
| 10 | RPC-Rechte und RLS als Katalogzusicherung auf einer Wegwerf-DB | P3 |
| 11 | Migrations-Prüfsummen, Append-only-Wächter | P3 |
| 12 | Repo/config/deploy-Parität als **Tor** (heute nur Messwerkzeug: `scripts/edge-drift.mjs`) | P3 |

Tor 15 ist seit `e4e40a94` vorhanden und wurde gegen ein eingeschleustes
`useT()` in `OfferPDF.tsx` geprüft. Es wurde eingeführt, **solange es grün war** —
ein Tor, das nichts aufräumen muss, kostet nichts.

---

## Was diese Tore NICHT können

Sie lesen Quelltext und rufen reine Funktionen auf. Sie beweisen **nichts** über
RLS, über eine laufende Datenbank, über die tatsächlich ausgerollte Edge-Fassung
oder über das, was ein Kunde im Browser sieht. Programm §16 gilt unverändert:
eine grüne Suite reiner Funktionen ist kein Beweis für DB-, RLS-, Edge- oder
Komponentenverhalten.

Insbesondere: **kein Tor in dieser Liste bemerkt, dass die Produktion eine
ältere Fassung ausführt.** Dafür gibt es die Aufnahme
(`ops/production-truth/<datum>/`) und `scripts/edge-drift.mjs` — beide sind
Messwerkzeuge, kein Tor. Tor 12 zu schliessen hiesse, die Drift zum
Freigabefehler zu machen; heute ist sie eine Zahl in einem Bericht.
