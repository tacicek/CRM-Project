# Worklog

Anfügend. Neueste zuerst.

---

## 2026-08-28 · S-02 (P1A) · T-002 … T-005 · `MERGED`

Eine Frage — „welche Firma ist meine?" — hatte im Browser zwei Antworten. Der
`CompanyProvider` kannte die ausgewählte, `fetchSingleCompanyForUser` riet eine
(erst `companies.email`/`notification_email` gegen die Anmeldeadresse, sonst die
zuletzt angelegte). 17 Dateien fragten den Rater. Produktion hat 2 Firmen.

**T-002 · Rechnungen und Quittungen** (`37f9d7bc`)
`Rechnungen.tsx` holte die Liste über den aktiven Mandanten und die Kopfdaten
über den Rater — Positionsliste der einen Firma, QR-Gläubiger der anderen.
Neu: `fetchCompanyById` (fragt nach einer id, rät nicht, kein Rückfall),
`aktiverMandant` (zwei reine Entscheidungen: gehört die Zeile zum Mandanten,
gehört die Antwort noch zum Mandanten) und `useCompanyRecord` (die eine Stelle,
die den vollständigen Firmensatz des aktiven Mandanten lädt und beim Wechsel
zuerst leert). 12 Vertragstests.

**T-003 · Offerten** (`109289b3`)
`OfferteDetail`/`OfferteBearbeiten` filterten mit der geratenen ID und meldeten
„nicht gefunden" für existierende Offerten. `OfferteErstellen` lud den Lead ganz
ohne Mandantenfilter — daraus liess sich mit einem Klick eine Offerte der einen
Firma aus den Kundendaten der anderen bauen. Jetzt fail closed.

**T-004 · die restlichen neun** (`5d2f2976`)
Fünf brauchten nur die ID und stellten dafür eine eigene ratende Abfrage — die
sind ersatzlos weg, samt drei lokaler `companyId`-Spiegel und einem
AbortController, der nichts mehr abzubrechen hat. Vier holen den vollen Satz
über `fetchCompanyById`.

**T-005 · Anmeldung und Tor** (`45faf73d`)
`Auth.tsx` stellte dieselbe falsche Frage. Wer in einer verifizierten Firma A
und einer unverifizierten B Mitglied ist, bekam „Verifizierung ausstehend",
sobald B die neuere war — ein Benutzer, der nicht hereinkommt, obwohl er darf.
`entscheideAnmeldeZiel()` fragt jetzt: lässt mich überhaupt eine herein?
Der Helfer ist gelöscht. Das Tor `mandanten-quelle.test.ts` prüft das MUSTER,
nicht den Namen, und wurde gegen eine eingeschleuste Verletzung geprüft — es
schlägt bei allen drei Mustern an.

**Fünf Nebenbefunde mit erledigt** (N-001 … N-005 im Ledger): fremde Detailzeile
unter eigenen Kopfdaten, stehengebliebenes fremdes Logo im PDF, fremder Lead als
Offertenquelle, geteilter Entwurfsschlüssel in den Einstellungen, `select: "*"`
auf `companies` an zwei Stellen.

**Belege:** type-check grün · 1772 Tests grün (23 neu) · build grün · berührte
Dateien 0 Lint-Fehler · Repo-Fehlerzahl unverändert 88, Warnungen 2 → 1.

**Grenze:** Die Zwei-Firmen-Zusagen sind als reine Vertragstests festgehalten,
nicht als DOM-Durchlauf — das Repo testet bewusst keine Komponenten. Programm
§16 gilt: eine grüne Suite reiner Funktionen ist kein Beweis für DB-, RLS-,
Edge- oder Komponentenverhalten.

**Nächstes:** T-006 — die Rechtschreibprüfung kennt nur Deutsch.

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
