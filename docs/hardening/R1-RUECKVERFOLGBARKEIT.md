# R-1: was in der Produktion liegt, und wo es im Repository steht

Stand 2026-08-28. Lesend gegen die Produktion erhoben, Repository-Seite aus git.

## Die Lage in einem Satz

Die Produktion fuehrt zwei Migrationen aus, die auf `main` **nicht existieren**.
Sie liegen auf `chore/produktionswahrheit-festschreiben` (auch auf `origin`),
und dieser Branch hat keinen Pull Request — das Anlegen scheiterte an einer
externen Blockade, nicht an einer Entscheidung.

## Die beiden angewendeten Einheiten

### Einheit 1 — Policy entzogen

| | |
|---|---|
| Datei | `supabase/migrations/20260828100000_landing_analytics_anon_insert_entzogen.sql` |
| sha256 | `c0f6b7422e78456820ce279e9a85e057c11708752d38836019c940150f775305` |
| Groesse | 4482 Bytes |
| Commit | `ac26a2ed189e15b4bb876711d09e0c98a1ffdbb6` |
| Commit-Zeit | 2026-08-28T01:00:19+02:00 |
| Angewendet | 2026-08-28 08:12:55.376083+00 |
| Beleg fuer die Zeit | `public.undo_20260828100000.erfasst_am` — die Zeile, die die Migration selbst schrieb |
| Auf `main`? | nein |

### Einheit 2 — Tabellenrecht entzogen

| | |
|---|---|
| Datei | `supabase/migrations/20260828120000_landing_analytics_anon_schreibrechte_entzogen.sql` |
| sha256 | `6582650850fe6d1817126500bad2776a36a2cf8a93e9ad64cc53bb2696dcae69` |
| Groesse | 3040 Bytes |
| Commit | `14a96a9317643c9f3de8a40d3e05aac61a217b71` |
| Commit-Zeit | 2026-08-28T10:12:26+02:00 |
| Angewendet | 2026-08-28, unmittelbar nach Einheit 1 (Protokoll `ops/rollout/2026-08-28/R1-apply-120000.txt`) |
| Auf `main`? | nein |

Beide Dateien sind seit ihrem Commit unveraendert (`git status` sauber).

## Was hier ehrlicherweise NICHT bewiesen ist

**Beim Anwenden wurde kein Digest des tatsaechlich uebergebenen SQL protokolliert.**
Die Apply-Protokolle halten die Ausgabe fest (`BEGIN / NOTICE / DO / COMMIT`),
nicht die Eingabe. Das ist eine Luecke im Verfahren, und sie faellt mir zur Last.

Was daraus folgt, und was nicht:

- **Nicht bewiesen:** dass genau diese Bytes durch die Leitung gingen. Dafuer
  haette der Digest vor dem Pipe erfasst werden muessen.
- **Bewiesen:** dass der heutige Produktionszustand exakt der ist, den diese
  Bytes erzeugen. Am 2026-08-28 lesend nachgemessen
  (`ops/rollout/2026-08-28/R1-nachverifikation.txt`):

  ```
  rls                          true
  schreibende PUBLIC-Policies  0
  anon insert/update/delete    false
  anon ACL                     rxt   (Schreibrechte weg)
  verbliebene Policy           "Admins can view analytics" USING is_admin(auth.uid())
  anon liest tatsaechlich      0 Zeilen
  Tabellenzeilen               0
  ```

- **Bewiesen:** beide Migrationen sind idempotent und pruefen sich selbst. Ein
  erneuter Lauf waere ein No-op und wuerde bei Abweichung abbrechen.

Das ist Wirkungsgleichheit, nicht Byte-Herkunft. Der Unterschied ist klein, aber
er ist keiner, den man wegrunden darf: fuer kuenftige Rollouts gehoert der
Digest der Eingabe ins Protokoll, vor dem Anwenden.

Zuordnung der Datenbank: `system_identifier 7639710127421538342`, PostgreSQL 15.8.

## Vorschlag: ein schmaler Hotfix-PR

`main` steht auf `68c07c7b` (Merge von PR #25). Der Arbeitsbranch ist ein
strenger Fast-Forward: 41 Commits voraus, **0** zurueck. Es gibt also nichts
zu versoehnen — nur etwas nachzuziehen.

Beide angewendeten Commits beruehren **ausschliesslich** neue Migrationsdateien
(Vorwaerts- und Ruecknahmerichtung), die auf `main` nicht existieren. Ein
Cherry-Pick ist damit konfliktfrei; der Probemerge bestaetigt es.

Vorgeschlagener Inhalt — genau zwei Commits, nichts sonst:

```
ac26a2ed  fix(rls): landing_page_analytics — Policy hiess service_role …
14a96a93  fix(rls): landing_page_analytics — anon verliert auch das Tabellenrecht …
```

Titel: `hotfix(rls): die zwei bereits angewendeten landing_page_analytics-Migrationen nachziehen`

Der PR aendert an der Produktion **nichts** — sie laeuft bereits so. Er schliesst
die Luecke, dass jemand von `main` abzweigt und ohne diese Migrationen
deployt, und dass die angewendeten Bytes ausserhalb eines Feature-Branches
keinen Ort haben.

Die uebrigen 39 Commits des Arbeitsbranches gehoeren **nicht** in diesen PR.
Sie enthalten nicht freigegebene Migrationen (`20260828130000`,
`20260828140000`, `20260828150000`) und vorbereitete, nicht ausgerollte
Aenderungen. Ein Hotfix-PR, der sie mitnaehme, waere kein Hotfix.

**Keine der angewendeten Migrationen wird bearbeitet oder dupliziert.** Wo an
Einheit 1 etwas nachzubessern war — die fehlende RLS auf der Undo-Tabelle —
geschieht das in einer eigenen, additiven Migration (`20260828150000`), nicht
durch Anfassen von `20260828100000`.

## Status

| | |
|---|---|
| R-1 in der Produktion | LIVE_VERIFIED, am 2026-08-28 nachgemessen |
| R-1 auf `main` | NICHT VORHANDEN |
| Hotfix-PR | VORGESCHLAGEN, nicht angelegt — Anlegen extern blockiert |
| Digest-Protokollierung beim Anwenden | LUECKE, fuer kuenftige Rollouts nachzuruesten |
