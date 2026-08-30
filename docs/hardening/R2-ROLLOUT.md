# R-2 · Rollout- und Rücknahmepaket

**Nichts davon ist ausgeführt.** Jede Einheit braucht eine eigene Freigabe.
Coolify Auto-Deploy ist für App 36 **aus**; ein Push liefert nichts aus.

## Reihenfolge — sie ist der Sicherheitsvertrag

Die Datenbank zuerst, die Handler zuletzt. Ein Handler, der
`consume_api_budget` aufruft, bevor die Funktion existiert, fällt geschlossen
aus — 503 auf allen Adressfunktionen.

### R2-0 · Nur lesen

Systemkennung, angewandte Migrationen, Frontend-Asset-Fingerabdrücke, Digests
der drei Handler und der gemeinsamen Dateien, Gateway-Verhalten,
unauthentifiziertes Verhalten. **Und: Coolify Auto-Deploy ist noch `false`.**

### R2-1 · `20260828130000_api_budget_dauerhaft.sql`

Legt Tabelle und erste Funktionsfassung an.

### R2-2 · `20260829120000_api_budget_ohne_topfvergiftung.sql`

Entfernt die Topfvergiftung und nimmt `service_role` alle Tabellenrechte.

### R2-3 · `20260830100000_api_budget_hierarchisch_kurzschliessen.sql`

Kurzschluss `global → firma → benutzer`, plus `R2403` / `r2_membership_denied`.

**Zwischen R2-1 und R2-3 existiert kurz die alte, vergiftbare Fassung. Kein
Handler darf in diesem Fenster ausgerollt werden.**

Danach lesend prüfen: Funktionsdefinition, ACL (alle sieben Rechte × vier
Rollen), RLS an, 0 Policies, `EXECUTE` nur für `service_role`, Eigentümer,
`search_path`, und dass keine weitere Funktion oder View `api_rate_budget`
anfasst.

### R2-4 · `_shared/paidApiHttp.ts` kopieren

Die Datei allein ändert kein Handlerverhalten. `_shared/boundedBody.ts` und
`_shared/paidApiGuard.ts` liegen bereits in der Produktion; `boundedBody.ts`
wird von den Termin-Wächtern mitbenutzt und ist **unverändert**.

### R2-5 · `google-places-details` als Kanarienvogel

Die niedrigste Frequenz der drei. Nach dem Import/Neustart prüfen:
bootet · ohne Token 401 · ohne Firma 400 · fremde Firma 403 · unförmige
Nutzlast 400 **ohne Budgetverbrauch** · kein bezahlter Google-Aufruf in den
Negativproben · kein Kundeninhalt im Protokoll · Quell-Digest.

**Bei der ersten Abweichung anhalten.**

### R2-6 · `google-places-autocomplete` · R2-7 · `calculate-distance`

Einzeln, mit derselben Nachkontrolle nach jedem.

## Rücknahme — in umgekehrter Richtung

1. **Handler zuerst** zurück, in umgekehrter Ausrollreihenfolge
   (`calculate-distance`, `google-places-autocomplete`, `google-places-details`).
2. Import-/Bootprobe nach jedem.
3. `_shared/paidApiHttp.ts` zuletzt entfernen — oder liegen lassen, sie ist ohne
   Aufrufer wirkungslos.
4. **Die Datenbankfunktion bleibt stehen**, solange irgendein ausgerollter
   Handler sie aufruft. Sie zu entfernen, während ein Handler sie braucht,
   erzeugt 503 auf allen Adressfunktionen.
5. Erst wenn kein Handler mehr `consume_api_budget` aufruft, darf
   `ROLLBACK_20260829120000` laufen — und der stellt ausdrücklich die
   **Topfvergiftung** wieder her. Deshalb ist er die letzte Wahl, nicht die
   erste.

`ROLLBACK_20260830100000` führt selbst nichts aus: die Rücknahme geschieht durch
erneutes Einspielen von `20260829120000`. Zwei Quellen für denselben
Funktionskörper laufen sonst auseinander.

## Frontend

**Keine Auslieferung nötig.** Das laufende Bundle sendet `company_id` an alle
drei Endpunkte — gemessen im Container, siehe `INCIDENT-2026-08-29`.

## Bezahlte Rauchtests

In diesem Paket sind **null** echte Google-Aufrufe vorgesehen. Falls nach dem
Ausrollen ein echter Positivtest gewünscht ist, wäre der Vorschlag
**höchstens drei** Aufrufe (einer je Endpunkt, mit einer Testadresse) — das
braucht eine eigene, ausdrückliche Freigabe und ist hier nicht enthalten.
