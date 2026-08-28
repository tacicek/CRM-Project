# Produktion → `main`: was fehlt, und wie es dorthin kommt

Stand 2026-08-28, alles frisch gemessen (`git fetch --prune` vorab).

| | |
|---|---|
| lokaler HEAD | `e48b4b99` |
| `origin/chore/produktionswahrheit-festschreiben` (PR-#26-Head) | `0d473025` |
| `origin/main` = lokal `main` | `68c07c7b` |
| **PR #26** | **OFFEN**, `MERGEABLE`, base `main` |
| ungepushte Commits | **9** |

Die frühere Notiz „PR `BLOCKED_EXTERNAL`" ist **überholt** — PR #26 existiert.

## Wo liegen die produktionsangewendeten Bytes?

| Commit | auf PR #26 | auf `main` |
|---|---|---|
| `ac26a2ed` (`20260828100000`) | **ja** | nein |
| `14a96a93` (`20260828120000`) | **ja** | nein |

Sie fehlen also nicht *irgendwo*, sondern nur auf `main` — weil PR #26 noch nicht
gemergt ist.

## Der Fallstrick, den ein naiver Hotfix-PR auslöst

Ein schmaler PR, der einfach `ac26a2ed` + `14a96a93` auf `main` cherry-pickt,
merged **sauber gegen `main`** (`git merge-tree --write-tree`, rc=0, Bäume
`3a1a3607` → `34017d23`), und die beiden Vorwärtsmigrationen sind darin
byte-identisch mit der Produktion:

```
20260828100000…  c0f6b7422e784568…   identisch
20260828120000…  6582650850fe6d18…   identisch
```

**Aber** `ac26a2ed` enthält nicht nur die Vorwärtsmigrationen. Es enthält auch
`ROLLBACK_20260828100000_…sql` in der **alten, verwundbaren Fassung**
(`c329d13b…`, die privilegierte SQL-Injektion aus AC-0001). PR #26 trägt
dieselbe Datei in der **korrigierten** Fassung (`58195780…`).

Gemessen, nicht vermutet:

```
git merge-tree --merge-base=… <hotfix-baum> HEAD
  CONFLICT (add/add): ROLLBACK_20260828100000_landing_analytics_anon_insert_entzogen.sql
```

Ein Hotfix-PR aus dem ganzen Commit würde die verwundbare Ruecknahme nach `main`
tragen und beim späteren Merge von PR #26 einen Konflikt erzeugen, dessen eine
Seite die Injektionsdatei ist. Das ist die schlechteste aller Auflösungen: sie
lädt dazu ein, „theirs" zu nehmen.

## Zwei saubere Wege

**Weg A — bevorzugt: PR #26 mergen.** Beide Commits sind bereits Vorfahren von
PR #26, und dessen Head trägt die *korrigierte* Rücknahme. Ein Merge liefert die
produktionsangewendeten Bytes unverändert nach `main` und die sichere Rücknahme
gleich mit. Kein zweiter Pfad, kein Konflikt, keine Dublette.

**Weg B — nur falls PR #26 nicht zeitnah mergt:** ein Hotfix-PR von
`origin/main`, der **ausschliesslich** enthält:

* `supabase/migrations/20260828100000_…sql` — `c0f6b7422e78…`, unverändert
* `supabase/migrations/20260828120000_…sql` — `6582650850fe…`, unverändert
* `supabase/migrations/ROLLBACK_20260828100000_…sql` — in der **korrigierten**
  Fassung `581957802753…`, **nicht** der aus `ac26a2ed`
* `supabase/migrations/ROLLBACK_20260828120000_…sql` — unverändert
* `ops/artifact-corrections.jsonl` (AC-0001) und den Digest-Warnhinweis aus
  `ROLLOUT-2026-08-28.md`
* den Anwendungsbeleg (`ops/rollout/2026-08-28/`, `R1-RUECKVERFOLGBARKEIT.md`)

Also **als Dateien, nicht als Commits** — weil `ac26a2ed` als Commit die
verwundbare Rücknahme mitschleppt. Kein Zeitstempel wird verändert oder
dupliziert; die angewendeten Vorwärtsdateien bleiben Byte für Byte gleich.

## PR-#26-Disziplin

Nach dieser Identitäts- und Sicherheitsabgleichung wird der Umfang von PR #26
**eingefroren**. Die 9 ungepushten Commits gehören noch hinein — sie *sind* die
Abgleichung. Danach: keine weitere P4-Modularbeit in diesem PR, sondern
gestapelte Folge-PRs.

**Nicht gepusht, nicht gemergt.** Das Pushen aktualisiert einen offenen PR und
ist damit nach aussen wirksam; es wartet auf eine ausdrückliche Freigabe.
