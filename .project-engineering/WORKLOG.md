# Worklog

Anfügend. Neueste zuerst.

---

## 2026-08-28 · T-001 · P0 Produktionswahrheit · `MERGED`

**Was gemacht wurde**

1. Basislinie dieses Auscheckstands gemessen: `type-check` PASS,
   `npm test` PASS (83 Dateien / 1746 Tests), `eslint` 88 Fehler + 2 Warnungen.
2. `scripts/capture-production-truth.sh` gegen die Produktion gefahren, lesend.
   Vorher gelesen und geprüft: jede Datenbankverbindung läuft mit
   `PGOPTIONS=-c default_transaction_read_only=on`, die Docker-Aufrufe sind
   `inspect` und `exec … cat|sha256sum|find|grep`. Kein Schreibpfad.
   Ergebnis: `ops/production-truth/2026-08-28/`.
3. `scripts/edge-drift.mjs` geschrieben — die Aufnahme sagt, **was** ausgerollt
   ist, konnte aber nicht sagen, **ob es dem Repo entspricht**. Das Skript bildet
   den Digest genauso wie das Aufnahmeskript und stellt beide Seiten gegenüber.
4. Migrationsstand für die vier Migrationen seit 2026-08-05 lesend gesondet.
5. `docs/hardening/edge-auth-manifest.json` — genau ein Auth-Modell je
   ausgerollter Function — plus ein Tor, das eine unklassifizierte ausgerollte
   Function zum Testfehler macht.
6. Ledger und Steuerungsebene angelegt.

**Belege**

- `ops/production-truth/2026-08-28/` (Generation `b92a3bf64015b2eb`)
- `.project-engineering/evidence/P0-2026-08-28/edge-hash-drift.json`
- `.project-engineering/evidence/P0-2026-08-28/migration-applied-state.json`
- `.project-engineering/evidence/P0-2026-08-28/P0-BEFUND.md`

**Was das ändert**

Die Datenbank steht seit dem 10. August still — `table-authz`, `policies`,
`function-authz`, `remnants`, `portal-usage` und `execute-sql` sind byteweise
identisch zur Aufnahme vom 2026-08-10. Verändert hat sich nur das Repo. Damit
verschiebt sich das grösste offene Risiko: es ist **kein Quelltextfehler,
sondern eine Rollout-Lücke**.

- `landing_page_analytics` ist in der Produktion weiterhin von aussen
  beschreibbar; die Korrektur liegt seit heute im Repo, ist nicht eingespielt.
- Die drei Google-Proxys laufen produktiv **ohne** die Drossel, die im Repo
  steht — unauthentifiziert, auf kostenpflichtige APIs.

**Widerlegt**

- Die Sorge, ein deploy-only Handler stünde unauthentifiziert offen:
  `accept-lead` prüft JWT **und** Mitgliedschaft, `hello` gibt eine Konstante
  zurück, `main` ist der Laufzeit-Router. `REFUTED`.
- Die Annahme, Migration `20260807100000` (Kundenkarte) sei nicht in der
  Produktion: `customer_addresses` und alle vier RPCs sind vorhanden. `APPLIED`.

**Nicht getan / offen**

- Kein Produktionsschreibvorgang. Zwei Rollouts stehen aus (siehe Ledger).
- Für die 380+ Migrationen vor 2026-08-05 gibt es weiterhin keinen Ledger.

**Nächstes:** T-002 — Rechnungen und Quittungen weg von der geratenen
Firmenidentität.
