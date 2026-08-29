# Zustände, Stand 2026-08-28

Die vom Freigebenden vorgegebenen Zustände, mit dem Beleg daneben. Wo eine
Messung den vorgegebenen Zustand berührt, steht das Ergebnis dabei — nicht
stillschweigend übernommen.

| Gegenstand | Zustand | Beleg |
|---|---|---|
| **AC-0001** | `ACCEPTED` · `CORRECTED_BEFORE_FIRST_PRODUCTION_EXECUTION` · `NEVER_APPLIED_TO_PRODUCTION` · `EXECUTED_ONLY_IN_DISPOSABLE_TEST_ENVIRONMENTS` | `ops/artifact-corrections.jsonl` |
| **20260828140000** | `CANDIDATE_MIGRATION_REVIEWED` · `NOT_LIVE` · `ARTIFACT_IDENTITY_RECONCILIATION_REQUIRED` → **abgeschlossen als AC-0004** | Digest geprüft `8dbbb94d…` → jetzt `651317c4…`; nie ledger-signiert (Beweis unten) |
| **20260828150000** | `CANDIDATE_MIGRATION_REVIEWED` · `NOT_LIVE` · `ARTIFACT_IDENTITY_RECONCILIATION_REQUIRED` → **abgeschlossen als AC-0005** | Digest geprüft `36384466…` → jetzt `052e19ae…` |
| **20260828160000** | `PARTIAL_HARDENING_PREPARED` · `NOT_LIVE` | M01-05A/B vollständig, M01-05C `BLOCKED_BY_EXECUTION_IDENTITY` |
| **20260828170000** *(neu)* | `MIGRATION_PREPARED` · `NOT_LIVE` | Belegtabellen-Minimalrechte, 105 → 0 Rechte-Paare |
| **M01-05** | `VERIFIED_PRIVILEGE_DRIFT` · `NO_MEASURED_EXTERNAL_PATH` · `ROOT_CONTRACT_NOT_COMPLETE` | Vertrag unvollständig, solange die `supabase_admin`-Standardrechte stehen |
| **zwei Rücknahme-Ausnahmen** | `OPEN_SECURITY_FINDING` · `EXPLOITABILITY_NOT_SETTLED` → **jetzt entschieden: `REFUTED_BY_PARSER_AND_QUOTING`** | Ende-zu-Ende-Test, `ops/artifact-corrections/EVIDENZ-ausnahmen-service-role-pfad.txt` |
| **M01-02** `user_roles`-Selbstbeförderung | `VERIFIED_DORMANT_PRIVILEGE_ESCALATION` | `user_roles` hat 0 Zeilen; `Admins can manage roles` ist `FOR ALL USING is_admin(...)` |
| **DEC-003** direkte Firmenanlage | `OPEN_PRODUCT_AND_SECURITY_DECISION` | Policy `Users can insert their own company` |
| **M01-06** `get_public_company_info` | `INTENTIONAL_PUBLIC_READ` · `PUBLIC_ALLOWLIST_AND_CAPABILITY_REVIEW_REQUIRED` | `SECURITY DEFINER`, anon+authenticated `EXECUTE` |
| **R-2** | `ACTIVE_PRODUCTION_EXPOSURE` · `ROOT_CAUSE_UNRESOLVED` | R2-01: Modul-`Map` über Worker hinweg wirkungslos |
| **R-3** | `BLOCKED_BY_R2` · `BLOCKED_BY_RELEASE_COUPLING` | entkoppelte Fassung auf `release/r3-spellcheck-locale` |
| **R-4 … R-6** | `NOT_AUTHORIZED_FOR_PRODUCTION` | — |

## Zur Sprache bei M01-05

Der frühere Text sagte „nicht erreichbar". Das war zu stark und ist ersetzt durch
**`NO_MEASURED_EXTERNAL_PATH`**.

Der Einwand trifft zu: `rolcanlogin=false` beweist keine Unerreichbarkeit, weil
PostgREST als `authenticator` verbindet und `SET ROLE` ausführt. Was gemessen
wurde, ist enger — und nur das wird behauptet:

* keine Portfreigabe des DB-Containers,
* keine Funktion in einem exponierten Schema enthält `TRUNCATE`,
* kein `ON TRUNCATE`-Trigger ausser `cron.job`,
* 0 von 12 `pg_cron`-Jobs mit `TRUNCATE`,
* PostgREST bietet kein `TRUNCATE`-Verb.

Eine wörtliche Suche nach `TRUNCATE` ist **kein vollständiger
Erreichbarkeitsbeweis**. Die erweiterte RPC- und Dynamic-SQL-Prüfung steht in
[RPC-ERREICHBARKEIT-2026-08-28.md](RPC-ERREICHBARKEIT-2026-08-28.md).

## Beweis, dass 140000/150000 nie ledger-signiert waren

`ops/artifact-identity/2026-08-28-identitaet.json`:

* `je_im_ledger_gefuehrt: false` für beide,
* `ledger_digest_historie: []` für beide,
* der einzige Eintrag mit mehr als einem Digest in der gesamten Ledger-Historie
  ist `ROLLBACK_20260828100000_landing_analytics_anon_insert_entzogen.sql`.

**Die Aussage „genau ein Ledger-Eintrag hat sich je geändert" hat die
Nachmessung überstanden** — sie wurde gegen den aktuellen Branch neu erhoben,
nicht aus dem letzten Checkpoint übernommen.

Ledger-signiert waren sie also nicht. Ihre Digests sind trotzdem als AC-0004 und
AC-0005 festgehalten: die unabhängige Durchsicht hat die **vorherige** Fassung
geprüft, und ohne den Eintrag zeigte dieser Prüfbeleg auf eine Datei, die es so
nicht mehr gibt.

## AC-0002 / AC-0003

Reserviert für die Korrektur der beiden Rücknahme-Ausnahmen, **falls** sie sich
als verwundbar erwiesen. Der vorgeschriebene Ende-zu-Ende-Test ergab für beide
`REFUTED_BY_PARSER_AND_QUOTING`. Die bedingte Korrekturfreigabe galt nur für ein
als verwundbar **bewiesenes** Artefakt — die Bedingung ist nicht eingetreten,
also wurde nichts korrigiert und keine Nummer vergeben. Der Vermerk steht in
`ops/artifact-corrections.jsonl`.
