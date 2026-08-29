# P0 — Produktionswahrheit 2026-08-28

Aufnahme: `ops/production-truth/2026-08-28/` (Generation `b92a3bf64015b2eb`,
PostgreSQL 15.8, System-Identifier `7639710127421538342`).
Vergleichscommit: `f4064560` (`chore/produktionswahrheit-festschreiben`).
Alle Zugriffe lesend: `PGOPTIONS=-c default_transaction_read_only=on`,
`docker inspect` / `docker exec … cat|sha256sum|find`. Kein Schreibpfad.

## Basislinie dieses Auscheckstands

| Tor | Ergebnis |
|---|---|
| `npm run type-check` | **PASS** (exit 0) |
| `npm test` | **PASS** — 83 Dateien, 1746 Tests |
| `npx eslint .` | **FAIL** — 88 Fehler, 2 Warnungen (Altschuld, unverändert) |

## Was sich seit der Aufnahme vom 2026-08-10 geändert hat

`table-authz.json`, `policies.json`, `function-authz.json`, `remnants.json`,
`portal-usage.json` und `execute-sql.json` sind **byteweise identisch**.
Die Datenbank steht seit dem 10. August still. Geändert hat sich nur, was
seither ins Repo geschrieben wurde — und genau das ist der Befund.

## P0-S1 — `landing_page_analytics` steht in der Produktion jedem offen · VERIFIED

`ops/production-truth/2026-08-28/policies.json` führt auf
`public.landing_page_analytics` weiterhin die INSERT-Policy
`Service role can insert analytics` mit `roles={public}` und unbeschränktem
`WITH CHECK`. `table-authz.json` bestätigt `anon_insert=true`.
`to_regclass('public.undo_20260828100000')` ist `false` — die Korrektur
`20260828100000_landing_analytics_anon_insert_entzogen.sql` liegt im Repo, ist
aber **nicht eingespielt**.

Angreifer: unauthentifiziert, aus dem Internet. Zugang, den er schon hat: den
öffentlichen `anon`-Key. Gewinn: beliebig viele Zeilen in einer Tabelle des
CRM. Erreichbarkeit: PostgREST ist über Kong veröffentlicht.
Kleinster Eingriff: die vorhandene Migration einspielen.

**Status: `AWAITING_PRODUCTION_AUTH`.** Kein Produktionsschreibzugriff in
diesem Lauf.

Vollständige Liste der Tabellen mit unbeschränkter PUBLIC-Schreibpolicy
(gemessen, nicht geschätzt):

| Tabelle | Policy | Bewertung |
|---|---|---|
| `landing_page_analytics` | `Service role can insert analytics` | Kein Schreiber im Repo → Entzug liegt bereit, nicht eingespielt |
| `cookie_consent_log` | `cookie_consent_public_insert` | Erreichbarkeit offen — CookieBanner ist laut CLAUDE.md §2 aus dem Fork entfernt |
| `umzug_anfragen` | `Anyone can submit umzug anfragen` | Öffentliches Anfrageformular — beabsichtigt |
| `klaviertransport_anfragen` | `Anyone can insert klaviertransport anfragen` | Öffentliches Anfrageformular — beabsichtigt |
| `moebellift_anfragen` | `Allow public insert on moebellift_anfragen` | Öffentliches Anfrageformular — beabsichtigt |

101 Tabellen, alle mit RLS aktiv, keine mit `FORCE ROW LEVEL SECURITY`.
97 von 101 tragen `anon`-Schreibrechte auf Tabellenebene (Supabase-Vorgabe);
RLS ist damit die einzige Schranke, und eine Policy `TO PUBLIC` hebt sie auf.

## P0-S2 — das Edge-Gateway ist offen, der Router prüft nichts · VERIFIED

Bisher stützte sich diese Aussage auf `docker inspect`. Jetzt ist auch der
Quelltext gelesen:

- `edge-runtime.json`: `verify_jwt = "false"`, Kommando
  `start --main-service /home/deno/functions/main`.
- `gateway.functions_route_plugins = ["cors"]` — sonst nichts auf
  `/functions/v1`.
- Der ausgerollte Router `main/index.ts` (nur deployed, nicht im Repo) prüft in
  `Deno.serve`: `if (req.method !== 'OPTIONS' && VERIFY_JWT) { … 401 … }`.
  Bei `VERIFY_JWT=false` fällt der gesamte Block aus.

Damit ist **jede ausgerollte Function unauthentifiziert erreichbar**.
`supabase/config.toml` mit seinen `verify_jwt`-Angaben ist an dieser
Installation Dekoration. Die einzige Schranke ist die Prüfung im Handler.

## P0-S3 — die Produktion ist ÄLTER als das Repo, nicht anders · VERIFIED

`node scripts/edge-drift.mjs ops/production-truth/2026-08-28` (neu, siehe
`edge-hash-drift.json`) bildet den Digest genauso wie das Aufnahmeskript:

- 29 Functions **inhaltsgleich**
- 10 mit **Drift**
- 3 nur deployed: `accept-lead`, `hello`, `main`
- 12 nur im Repo, nicht ausgerollt

Alle 10 Driftfälle wurden gegen den ausgerollten Quelltext diffed. In **jedem**
Fall ist die Produktion die ältere Fassung. Es steht nichts Unbekanntes auf dem
Server; es fehlt Bekanntes.

| Function | Was in der Produktion fehlt |
|---|---|
| `calculate-distance` | Rate-Limit (`_shared/rateLimit.ts`) |
| `google-places-autocomplete` | Rate-Limit |
| `google-places-details` | Rate-Limit |
| `handle-proposal-response` | i18n — Kundenmail folgt nicht `offers.language` |
| `validate-besichtigung-token` | Dokumentsprache der Besichtigungsseite |
| `notify-appointment-reminder` | `_shared/appointmentDay.ts` (Zeitzonen-Rückrichtung) |
| `notify-offer-response`, `send-offer`, `calendar-feed` | Baumdrift bei gleichem `index.ts` |
| `_shared` | 44 Dateien ausgerollt gegen 64 im Repo |

**P0-S3a — die drei Google-Proxys sind ohne Drossel im Netz · VERIFIED.**
`calculate-distance`, `google-places-autocomplete` und `google-places-details`
sind unauthentifizierte Proxys auf **kostenpflichtige** Google-APIs. Das Repo
drosselt seit einiger Zeit auf 60 Anfragen/Minute je Client-IP; die
ausgerollte Fassung kennt die Drossel nicht. Zusammen mit P0-S2 heisst das:
jeder im Internet kann die Google-Rechnung des Betreibers beliebig hochtreiben.
Angreifer: unauthentifiziert. Gewinn: fremde Kosten, kein Datenzugriff.
Kleinster Eingriff: die vorhandene Fassung ausrollen.

**Status: `AWAITING_PRODUCTION_AUTH`.**

## P0-S4 — deploy-only Functions, gelesen statt vermutet · VERIFIED

Die Aufnahme schwärzt den Quelltext dieser drei (externe URLs, Bearer-Werte).
Für die Einstufung wurden sie lesend geholt und **ausserhalb des Repos**
ausgewertet; hier steht nur das Ergebnis.

| Function | Eingestuft als | Befund |
|---|---|---|
| `main` | `infrastructure` | Router der Edge-Laufzeit, von `--main-service` benötigt. Nicht entfernbar. |
| `hello` | `public-safe` | Beispiel aus der Supabase-Vorlage. Gibt eine Konstante zurück, kein Datenzugriff. Rückbau-Kandidat. |
| `accept-lead` | `jwt-member` | Prüft `Authorization` über `auth.getUser(token)` **und** `verifyCompanyMembership`. Also **kein** offenes Loch — aber Marktplatz-Verteilung aus der Offerio-Zeit, deren Quelle im Repo gelöscht ist. Rückbau nach Nachweis fehlender Aufrufer (P5). |

Damit ist die frühere Sorge „unauthentifizierter deploy-only Handler"
**REFUTED** für `accept-lead`.

## P0-S5 — `generate-sitemap` ist ausgerollte Marktplatz-Vergangenheit · VERIFIED

`supabase/functions/generate-sitemap/index.ts` läuft mit `service_role`, ohne
jede Authentifizierung, und erzeugt eine Sitemap für `/partner-werden`,
`/preise`, `/fuer-firmen`, `/so-funktioniert-es` sowie tausende
SEO-Landingpages Kanton×Stadt. Das ist der Offerio-Marktplatz, nicht dieses
CRM. Gelesen wird nur `blog_posts` mit `status='published'` — kein
Datenabfluss. Einstufung: `public-safe`, aber P5-Rückbau.

## P0-S6 — Mengenunterschiede Repo / config.toml / Deploy · VERIFIED

- **8 Einträge in `config.toml` ohne Quelle im Repo**: `admin-assign-lead`,
  `calculate-lead-price`, `generate-blog-ai`, `generate-landing-page-content`,
  `match-lead`, `notify-admin-new-lead`, `notify-companies`,
  `send-token-notification`. Keiner davon ist ausgerollt — sie stehen nur noch
  in einer Datei, die diese Installation ohnehin nicht liest.
- **16 Quellen ohne Eintrag in `config.toml`**, darunter ausgerollte:
  `send-quittung`, `send-rechnung-email`, `spell-check-ai`,
  `confirm-lead-by-token`, `admin-add-company-member`,
  `admin-remove-company-member`, `test-resend-email`.
- **12 Quellen ohne Deployment**: `cleanup-box-rentals`, `estimate-job-price`,
  `handle-reschedule-response`, `import-swiss-plz`,
  `notify-appointment-reschedule`, `notify-box-pickup`, `resend-email`,
  `send-lead-confirmation`, `transcribe-voice`, `translate-content`,
  `validate-lead-quality`, `verify-recaptcha`.

## P0-S7 — der Mandanten-Split-Brain besteht unverändert · VERIFIED

`src/lib/fetchSingleCompanyForUser.ts` liest nach wie vor **nicht** die
ausgewählte Firma. Bei mehr als einer Mitgliedschaft rät sie: erst
`companies.email`/`notification_email` gegen die Anmeldeadresse, sonst die
zuletzt angelegte Firma. Produktion hat **2 Firmen** und **2
Mitgliedschaften**.

17 Dateien importieren sie — 16 davon unter `/firma`:

`Rechnungen`, `RechnungDetail`, `Quittungen`, `QuittungDetail`,
`OfferteErstellen`, `OfferteBearbeiten`, `OfferteDetail`, `Auftraege`,
`Einstellungen`, `Datenarchiv`, `ManualImport`, `EmailImport`,
`Preisgestaltung`, `Leistungskatalog`, `Checkliste`, `Team` — plus `Auth.tsx`.

## P0-S8 — die Rechtschreibprüfung kennt nur Deutsch · VERIFIED

`supabase/functions/spell-check-ai/index.ts` (ausgerollt **inhaltsgleich** zum
Repo) trägt einen fest verdrahteten deutschen Prompt: „German spell checker",
`ß → ss`, „German nouns must be capitalized". `src/lib/spellCheckService.ts`
sendet `{ fields }` ohne Sprache. Aufgerufen wird sie aus `OfferteErstellen`
und `OfferteBearbeiten` — für **jede** Dokumentsprache.

## Offene Produktionsschreibvorgänge (nicht autorisiert in diesem Lauf)

1. `20260828100000_landing_analytics_anon_insert_entzogen.sql` einspielen.
2. Die 10 driftenden Edge Functions ausrollen — vorrangig die drei
   Google-Proxys (Kostenabfluss) und `_shared`.
