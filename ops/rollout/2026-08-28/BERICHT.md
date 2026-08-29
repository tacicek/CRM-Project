# Rollout 2026-08-28 — Bericht

Freigegeben wurden R-1, R-2 und R-3 gestuft, mit bindender Reihenfolge und
Stop-Bedingungen. **R-1 ist erfolgreich. R-2 wurde nach der zweiten Einheit
gestoppt — regelkonform, wegen einer Abweichung.** R-3 wurde nicht begonnen.

Ziel: `7639710127421538342`, PostgreSQL 15.8. Vor jedem Schreibvorgang neu
gemessen.

---

## R-1 · `landing_page_analytics` — **LIVE_VERIFIED**

### Preflight (`R1-preflight.txt`)

```
policy "Service role can insert analytics"  roles=PUBLIC  withcheck=true
anon_insert=true  anon_update=true  anon_delete=true  anon_select=true
undo_20260828100000_present=false        row_count=0
```

### Zwei Migrationen statt einer

Die Freigabebedingung lautete: anon soll **weder** Tabellenrecht **noch** eine
schreibende PUBLIC-Policy besitzen. `20260828100000` entzieht nur die Policy —
das schliesst den Zugriff (ohne erlaubende Policy weist RLS ab), lässt das
Tabellenrecht aber stehen. Deshalb eine zweite, anfügende Datei
`20260828120000`, vorher auf dem Wegwerf-Stapel bewiesen.

### Postcheck (`R1-postcheck.txt`)

```
schreibende_PUBLIC_policies=0
anon_insert=false  anon_update=false  anon_delete=false  anon_truncate=false
anon_select=true        (RLS aktiv; einzige Lesepolicy ist is_admin-gebunden)
rls_enabled=true
verbleibende_policies: "Admins can view analytics" [SELECT]
row_count=0             (in der Zwischenzeit hat niemand geschrieben)
undo_zeile: public.landing_page_analytics | Service role can insert analytics | PUBLIC | true
```

**Zustand: `LIVE_VERIFIED`.** Rücknahme möglich — der Vorzustand steht in
`public.undo_20260828100000`.

---

## R-2 · Edge Functions — **NACH EINHEIT 2 GESTOPPT**

### Einheit 1/7 — `_shared/appointmentDay.ts` · erfolgreich

Digest übereinstimmend (`833ed5aa…`). Boot-/Import-Probe: alle sieben
abhängigen Handler antworten weiter mit `OPTIONS=200`.

### Einheit 2/7 — `calculate-distance` · **ABWEICHUNG**

Digest übereinstimmend (`666d2d83…`), Boot-Probe `OPTIONS=200`.

Rate-Limit-Smoke, 61 Anfragen `POST {}` — **ohne einen einzigen
Google-Aufruf**, weil die Drossel vor der Eingabeprüfung sitzt und ein leerer
Rumpf mit 400 endet, bevor Google erreicht würde:

| | 400 | 429 | andere |
|---|---:|---:|---:|
| vorher (ohne Drossel) | 61 | 0 | 0 |
| **nachher (mit Drossel)** | **61** | **0** | 0 |

**Die Drossel wirkt nicht.** Gemäss Stop-Bedingung wurde R-2 hier beendet; die
Einheiten 3–7 wurden **nicht** ausgerollt.

### R2-01 · Warum sie nicht wirken kann · `VERIFIED`

Der ausgerollte Router `main/index.ts` erzeugt **pro Anfrage** einen neuen
User-Worker:

```ts
const worker = await EdgeRuntime.userWorkers.create({ servicePath, … })
return await worker.fetch(req)
```

`_shared/rateLimit.ts` hält seinen Zähler in einer `Map` im Modulkörper. Bei
einem Worker je Anfrage wird dieser Modulkörper **jedes Mal neu ausgewertet** —
die `Map` ist immer leer, `isLimited` nimmt immer den Zweig „erste Anfrage" und
gibt immer `false` zurück.

Der Kopf von `rateLimit.ts` sagt es selbst: *„In-memory rate limiting that resets
on function cold starts."* In dieser Topologie ist **jede Anfrage ein Cold
Start**.

**Folge für P0-S3a:** meine frühere Aussage — „die Drossel steht im Repo, sie
ist nur nicht ausgerollt" — war unvollständig. Sie auszurollen schliesst den
Befund **nicht**. Die drei Google-Proxys bleiben ungedrosselt, und das lässt sich
durch ein Deployment nicht beheben. Eine wirksame Drossel braucht einen Zähler,
der die Anfrage überlebt: Postgres, oder eine Drossel im Gateway.

`calculate-distance` bleibt ausgerollt. Die neue Fassung unterscheidet sich von
der alten **ausschliesslich** durch die Drossel; da diese wirkungslos ist, ist
das Verhalten identisch, und die Abweichung zwischen Repo und Produktion ist für
diese Function beseitigt. Ein Rückbau brächte Risiko ohne Nutzen.

---

## R-3 · nicht begonnen

R-3 setzt einen erfolgreichen R-2-Postcheck voraus. Der liegt nicht vor.

Unabhängig davon ist beim Vorbereiten ein Konflikt sichtbar geworden, der vor
R-3 entschieden gehört: **R-3 verlangt „das kompatible Frontend zuerst" — und
dasselbe Frontend-Deployment aktiviert auch die strenge Sendebereitschaft aus
R-4**, die ausdrücklich noch nicht freigegeben ist. Ein Frontend-Rollout für
R-3 bringt R-4 also mit. Siehe den offenen Punkt im Ledger.

---

## Was sich in der Produktion geändert hat — vollständig

Neue Aufnahme `336c529295e00a42` gegen die vorherige `b92a3bf64015b2eb`
(bewahrt unter `aufnahme-vorher/`):

```
table-authz  landing_page_analytics: anon_insert/update/delete/truncate true → false
                                     policy_count 2 → 1
             + Tabelle undo_20260828100000
policies     − landing_page_analytics "Service role can insert analytics"
edge         _shared            44 → 45 Dateien  (appointmentDay.ts)
             calculate-distance index.ts a792b62e… → 666d2d83…
function-authz  unverändert
```

Kein Kollateralschaden. Nichts anderes wurde berührt.
