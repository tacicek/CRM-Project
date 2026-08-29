# Erreichbarkeit über exponierte RPCs — 2026-08-28, lesend

Der Einwand traf zu: `rolcanlogin=false` beweist keine Unerreichbarkeit, weil
PostgREST als `authenticator` verbindet und `SET ROLE` ausführt. Eine wörtliche
Suche nach `TRUNCATE` ist ebenfalls kein Beweis. Also die Fläche selbst gemessen.

## Exponierte Schemata und ausführbare Funktionen

| Schema | `anon` | `authenticated` | davon `SECURITY DEFINER` für `anon` |
|---|---|---|---|
| `public` | 32 | 78 | **22** |
| `extensions` | 60 | 60 | 0 |
| `storage` | 15 | 15 | 0 |
| `realtime` | 12 | 12 | 0 |
| `net` | 10 | 10 | 0 |
| `graphql` | 6 | 6 | 2 |
| `cron` | 5 | 5 | 0 |
| `auth` | 4 | 4 | 0 |
| `besichtigung` | 2 | 2 | 2 |
| `graphql_public` | 1 | 1 | 0 |
| `supabase_functions` | 1 | 1 | 1 |

## Dynamisches SQL in erreichbaren Funktionen

13 Funktionen enthalten ein dynamisches `EXECUTE`. Entscheidend ist nicht das
`EXECUTE`, sondern ob ein **Aufruferparameter** hineinreicht.

**Unsere eigenen drei — geprüft, kein Weg hinein:**

| Funktion | Definer | Aufrufer | Parameter | Befund |
|---|---|---|---|---|
| `create_offer_revision` | ja | `authenticated` | `uuid`, `text` | `%s`/`%I` aus Katalogschleifen; `p_reason` als `$4` gebunden |
| `customer_merge_preview` | ja | `authenticated` | 3 × `uuid` | `%s`/`%I` aus `v_ref.tabelle/.spalte` — Katalogherkunft |
| `merge_customers` | ja | `authenticated` | 3 × `uuid`, `text` | dito |

Kein Parameter dieser drei ist ein Objektname oder SQL-Text. Der Aufrufer kann
die Platzhalter nicht füllen.

**Fremde (Supabase-eigene):** `realtime.*`, `storage.*`, `extensions.grant_pg_*`
tragen dynamisches SQL, sind aber durchgängig `SECURITY INVOKER` — sie laufen mit
den Rechten von `anon` und können daher nicht mehr als `anon`.
`graphql_public.graphql` nimmt einen `query text`, ist aber der GraphQL-Endpunkt
und kennt kein `TRUNCATE`-Verb.

## Parameter, die Objektnamen tragen könnten

Zehn Treffer. Neun davon in `realtime`, `graphql`, `extensions` — alle
`SECURITY INVOKER`. Der einzige in `public`
(`resolve_or_create_location(p_company_id, p_customer_id, p_address_raw, …)`)
ist für `anon` **nicht** ausführbar und nimmt keinen Objektnamen, sondern eine
Adresse als Text.

## Generische Verwaltungs-RPCs

`archive_and_purge_company_data`, `portal_revoke_access`, `run_*_backfill`:
sämtlich `anon=false`. Erreichbar für `anon` sind aus dieser Gruppe nur
`is_admin`, `is_super_admin`, `is_support_admin` — alle drei lesen `user_roles`
für `auth.uid()`, das für `anon` `NULL` ist.

**Nebenbefund, der ein eigenes Tor betraf:** `public.is_support_admin()` war mir
unbekannt. Meine Prüfung in `20260828140000` suchte mit Wortgrenzen nach
`is_admin|is_super_admin|is_staff|has_role` — `is_support_admin` enthält das
Wort `is_admin` **nicht** und wäre durchgerutscht. Muster jetzt
`is_[a-z_]*admin|is_staff|has_role`, gegen eine eingeschleuste
`is_support_admin`-Policy geprüft: `ERROR` + `ROLLBACK`. Festgehalten als
AC-0006.

## Ergebnis für M01-05

**`NO_MEASURED_EXTERNAL_PATH`** — und nur das. Gemessen:

* keine Portfreigabe des DB-Containers,
* keine Funktion in einem exponierten Schema enthält `TRUNCATE`,
* kein `ON TRUNCATE`-Trigger ausser `cron.job`,
* 0 von 12 `pg_cron`-Jobs mit `TRUNCATE`,
* kein erreichbares dynamisches SQL, in das ein Aufruferparameter reicht,
* PostgREST bietet kein `TRUNCATE`-Verb.

Das ist die Abwesenheit eines **gefundenen** Wegs, nicht der Beweis, dass keiner
existiert. Das Recht bleibt falsch vergeben und gehört entzogen.
