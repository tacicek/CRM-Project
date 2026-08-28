# Worklog

Anfügend. Neueste zuerst.

---

## 2026-08-28 · T-010 · Die vier öffentlichen Schreib-RPCs · `READY_FOR_ROLLOUT` (`339ef191`)

Der einfache Weg wäre gewesen, vier `anon`-ausführbare schreibende
SECURITY-DEFINER-Funktionen pauschal zu entziehen. Gelesen habe ich sie
trotzdem einzeln — und der pauschale Entzug wäre der Fehler gewesen: es sind die
öffentlichen Eingänge des Kundenbereichs und der Token-Seiten. Ohne `anon` gibt
es keinen Kundenzugang.

Jede schliesst über ein Token genau eine Zeile auf, leitet den Mandanten aus
dieser Zeile ab, prüft Status und Fristen, ist gegen Wiederholung gesichert.
`update_offer_by_token` prüft zusätzlich die Annahmefrist aus `valid_until` UND
`service_date` und übernimmt `agb_ip_address` ausdrücklich nicht aus dem Aufruf.

Verengt wird nur das PUBLIC-Recht (Migration `20260828110000`), auf einem
Wegwerf-Stapel bewiesen: anwenden · idempotent · zurück · wieder vor. Den Stapel
habe ich vorgefunden und danach exakt in den vorgefundenen Zustand zurückgesetzt.

**Der schärfste Nebenbefund ist nicht die Berechtigung, sondern ihre Herkunft:**
der aus den Migrationen gebaute Stapel hat auf `update_offer_by_token` kein
PUBLIC-Recht — die Produktion hat es. Kein Migrationsfile erzeugt es. Es ist von
Hand entstanden, und es gibt keinen Beleg wann oder warum. Das ist die Klasse,
für die P3 den Ledger braucht, und es ist jetzt gemessen statt vermutet.

Ein Verdacht hat sich **nicht** bestätigt: `p_feld` gelangt nicht in ein
dynamisches UPDATE. Ein CHECK beschränkt auf fünf Namen, `decide_change_request`
schreibt über eine ausgeschriebene CASE-Zuordnung hinter einer Rollenprüfung.

**Nächstes:** T-011 — Migrationsledger ab signierter Basislinie, und die
Repo/Config/Deploy-Parität als TOR statt als Messwerkzeug.

---

## 2026-08-28 · T-009 · Fail-open-Autorisierung geschlossen · `VERIFIED_IN_REPO` (`e4e40a94`)

H-004, gefunden in der ersten Durchsicht, benannt im Manifest, jetzt behoben —
und beim Beheben stellte sich heraus, dass dieselbe Form auch in **`send-offer`**
steht, einer AUSGEROLLTEN Function.

Alle drei hatten die Mitgliedschaftsprüfung in `if (zeile) { … }`, deren
Abfragefehler verworfen wurde: löste die Abfrage zu `null` auf, wurde die
Berechtigung nicht geprüft und der Versand lief weiter. Ein fehlender Wert ist
keine Erlaubnis — jetzt 409.

`send-quittung` lud ausserdem `loadCompanySecrets` (den Resend-Schlüssel der
Firma), **bevor** feststand, ob der Aufrufer zu ihr gehört. Erst autorisieren,
dann Geheimnisse laden.

Die Manifest-Ausnahmen sind damit entfallen statt verlängert worden.

---

## 2026-08-28 · T-017 · Zweite unabhängige Durchsicht · `INDEPENDENT_REVIEW_PASS` (`e4e40a94`)

Kumulierter Branch-Diff, geprüft von jemandem, der nichts davon geschrieben hat,
mit der Auflage Gegenbeispiele **einzuschleusen** statt den Happy Path zu lesen.
Zwölf Punkte, alle haltbar.

**Was ich falsch gemacht habe, in der Reihenfolge des Gewichts:**

1. Zwei Wege, auf denen der von Hand geschriebene Text des Bedieners **ohne
   Zustimmung** überschrieben wurde — beide in der Datei, deren Kopf sagt, dass
   sie genau das verhindert.
2. Drei Tore, die die REGEL prüften und nicht ihre ANWENDUNG. Das Sendeweg-Tor
   fiel gegen eine Zuweisung eine Zeile über dem `if`; das Token-Signal gegen ein
   `.select()` und einen Kommentar; das Mandanten-Tor gegen die Rückkehr des
   Fehlers im Verbraucher.
3. Eine Zusage, die nicht stimmen konnte: drei `localeClaims` verglichen einen
   Wert mit sich selbst, während die PDF-Bytes aus dem Browser kommen.
4. Zwei Fail-open-Autorisierungen, eine davon in einer **ausgerollten** Function.
5. Eine Ausnahme im Manifest, die `send-appointment-confirmation` zu Unrecht
   beschuldigte — es ist strenger als der gemeinsame Helfer, nicht laxer.

**Die Lehre:** ein Quelltext-Tor belegt Anwesenheit und Reihenfolge. Mehr nicht.
Wo Wirkung zählt, gehört die Logik in eine reine Funktion mit Eingabe und
Ausgabe — deshalb ist `buildOfferSendReadiness` aus dem Handler herausgewandert.

Jede Einschleusung wurde nach dem Nachschärfen wiederholt; das Repository steht
danach mit passender Prüfsumme.

---

## 2026-08-28 · T-016 · Auth-Manifest, das misst statt zu glauben · `VERIFIED_IN_REPO` (`c5f3ad8b`)

Die erste Fassung listete 42 ausgerollte Functions und prüfte Vollständigkeit.
Sie prüfte nicht, ob ein Modell zum Handler passt — und genau dort lagen die
Fehler.

Jetzt stehen im Manifest nur noch Beurteilungen (54 Einträge: alles Ausgerollte
und alles im Repo). Die messbaren Tatsachen — Repo-Pfad, config-Eintrag,
Deployment, Gateway-Verhalten, Auth-Signale im Quelltext — holt das Tor sich aus
Aufnahme, Repo und `config.toml`. Abgeschriebene Tatsachen veralten, und dann
bestätigt ein Tor einen Zustand, den es nicht geprüft hat.

**Drei echte Fehler gefunden** (E-01…E-03 im Ledger): `translate-content` reichte
den rohen `Authorization`-Header dort durch, wo eine `userId` hingehört — jeder
Aufruf wurde verweigert, und weil die Function nicht ausgerollt ist, ist es nie
jemandem aufgefallen. Zwei weitere Functions hatte **ich** als
`capability-token` geführt, obwohl sie kein Token validieren.

**Vier Einschleusungen geprüft.** Die dritte — Cron-Wächter in
`isCronRequestDISABLED` umbenannt — kam durch: ich hatte mit `includes()` gesucht.
Die Signale prüfen jetzt die Aufrufform, nicht den Namen.

---

## 2026-08-28 · T-015 · Asynchrone Mandantenkette · `VERIFIED_IN_REPO` (`642a71df`)

Der Befund R-01 war behoben, der Mechanismus nicht: der Schlüssel kam aus
`company.id` statt aus dem Kontext, aber nur weil ich es an dieser einen Stelle
richtig hingeschrieben hatte.

`createTenantScopedDebounce` nimmt ein Paket, das seinen Mandanten trägt, und
gibt dem Schreibvorgang genau diesen — nicht den, der beim Auslösen aktuell ist.
`assertSameTenant` macht die zweite Hälfte zum Fehler: Nutzlast und `WHERE`
müssen denselben Mandanten tragen.

8 Tests mit `vi.useFakeTimers()` fahren den Ablauf ab, der A in die B-Zeile
schrieb.

**Warum das nötig war:** ein statisches Verbot von `fetchSingleCompanyForUser`
und `getCachedCompany` fängt diese Klasse NICHT. Hier rät niemand eine Firma —
zwei richtige Werte laufen auseinander, weil sie zu verschiedenen Zeitpunkten
entstanden sind.

---

## 2026-08-28 · T-008 · Strenge Sendebereitschaft · `VERIFIED_IN_REPO` (`cf19bef2`)

`send-offer` las `agb_sections` ohne die Spalte `translations` — es konnte den
deutschen Rückfall gar nicht bemerken. Eine französische Offerte ging mit
deutschen AGB im Anhang hinaus.

`_shared/offerSendReadiness.ts` ist EIN Vertrag für ZWEI Laufzeiten: die Edge
Function importiert ihn relativ, das Frontend über einen Pfad, den
`allowImportingTsExtensions` erlaubt. Fünf Codes, strukturierte Blocker statt
Wahrheitswert. Eine fehlende Sprache wird abgewiesen, nicht auf Deutsch gerundet.

Geprüft wird nur, was der Sendeweg SELBST aus einer Vorlage holt. Titel und
Positionstexte sind beim Anlegen eingefroren; ein Blocker auf Verdacht hielte
jede richtige Offerte auf.

**Torprüfung gegen drei Einschleusungen.** Fassung 1 fing nur die erste.

---

## 2026-08-28 · T-007 · Ehrlicher Sprachwechsel · `VERIFIED_IN_REPO` (`094cea38`)

Der Wähler setzte `offers.language` und sonst nichts. Der Hinweistext warnte vor
den Positionen und schwieg über Titel, Zahlungskondition und AGB.

Beim Wechsel alles neu zu erzeugen wäre schlimmer gewesen — es überschriebe den
von Hand geschriebenen Satz wortlos. Deshalb ein PLAN statt einer Wirkung: sechs
Kategorien, und `applyOfferLanguageRebase` verbraucht den Plan, nicht die
Offerte. Übersetzt wird nichts; gelesen wird nur, was jemand hinterlegt hat.

Halb übersetzt gilt als nicht übersetzt. Ohne belegte Herkunft wird nicht
angefasst — beim Bearbeiten einer bestehenden Offerte heisst das oft „es gibt
nichts zu übernehmen", und genau das ist der Fortschritt.

35 Vertragstests, darunter: kein Betrag im Ergebnis, auch bei pauschaler
Zustimmung zu allen Feldnamen.

---

## 2026-08-28 · T-014 · Durchsicht der P0/P1A-Tranche · `VERIFIED_IN_REPO` (`9de0541b`)

Ein unabhängiger Prüfdurchgang über die sechs Commits. Sieben Punkte, fünf
halten stand. Zwei davon waren echte mandantenübergreifende Wege — einer davon
**von meiner eigenen P1A-Korrektur eingeführt**:

- **HOCH:** Der Entwurfsschlüssel in `Einstellungen` hing an `activeCompanyId`
  statt an der Zeile, aus der die Werte stammen. Im Wechselfenster schrieb der
  600-ms-Timer A-Werte unter den Schlüssel von B; das Laden legte sie über die
  frischen B-Werte, und Speichern schrieb sie in die B-Zeile. Ich hatte den
  festen Schlüssel tenant-gebunden gemacht und dabei den falschen Tenant genommen.
- **MITTEL:** `Besichtigungen.tsx` holte die Firma aus `getCachedCompany()`.
  Ich hatte nur nach `fetchSingleCompanyForUser` gesucht — „null Aufrufer" war
  wahr, „eine Quelle" trotzdem falsch.
- **MITTEL:** Das Tor kannte dieses Muster nicht und bestätigte damit einen
  Zustand, den es nicht prüfte. Zwei Regeln ergänzt, beide gegen eingeschleuste
  Verletzungen geprüft. Die Grenze des Tors steht jetzt im Kopf der Datei.
- **MITTEL:** `CompanyProvider` wählte `fetchedCompanies[0]`; die in P1A-4
  behobene Sackgasse lag eine Ebene tiefer weiter vor.
- **GERING:** `useCompanyRecord.error` las niemand, der Kommentar behauptete das
  Gegenteil. Manifest-Notiz zu `accept-lead` überschritt ihren Beleg.
- **KLEINIGKEIT:** vier Listenseiten drehten bei fehlendem Mandanten ewig.

Nebenbei bekamen die sessionStorage-Schlüssel einen Besitzer
(`src/lib/tenantSession.ts`); sie standen an drei Orten.

**Lehre für die nächsten Tranchen:** nach einem Symbol zu suchen beweist, dass
das Symbol weg ist — nicht, dass die Klasse weg ist. Vor dem Schliessen eines
Exit-Gates wird nach dem MUSTER gesucht, nicht nach dem Namen.

---

## 2026-08-28 · T-006 · Rechtschreibprüfung nach Sprache · `MERGED` (`e4583ee9`)

`spell-check-ai` trug einen fest deutschen Prompt und bekam nie eine Sprache
mitgeteilt. Eine französische Offerte lief durch `ß → ss` und deutsche
Substantivgrossschreibung.

Der Prompt liegt jetzt als reine Funktion in
`_shared/spellCheckPrompt.ts`, die für alle Sprachen geltenden Zusagen (nie
übersetzen, nicht umschreiben, Eigennamen nicht anfassen, festes Ausgabeformat)
getrennt von den sprachabhängigen Regeln. `locale` ist an beiden Enden Pflicht;
der Handler weist Fehlendes mit 400 ab statt es als Deutsch zu lesen.

9 Vertragstests, darunter der Kern: `ß` und die deutsche Substantivregel dürfen
in `fr` und `en` nicht vorkommen.

**Rollout-Grenze:** wirkt erst nach dem Ausrollen, und die Reihenfolge ist
bindend — Frontend zuerst. Umgekehrt verlieren offene Tabs die Prüfung
(400 → `runSpellCheck` liefert `null` → Modal entfällt).

---

## 2026-08-28 · Rollout-Paket · `AWAITING_PRODUCTION_AUTH` (`5362df97`)

Drei Produktionsschreibvorgänge vorbereitet, keiner ausgeführt. Beim Schreiben
kam eine bindende Reihenfolge zum Vorschein: `_shared/appointmentDay.ts` ist im
Repo, aber nicht ausgerollt, und der neue `notify-appointment-reminder`
importiert sie — Handler zuerst zu kopieren bricht die Terminerinnerung.

Ausserdem stellte sich heraus, dass `edge-drift.mjs` `__tests__` mitzählte und
deshalb ohne Grund anschlug. Korrigiert: 30 identisch, 9 Drift, davon nur
**sechs** echte Rückstände. Die übrigen sind neun von Hand angelegte
`.bak-*`-Kopien im Produktionsverzeichnis.

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
