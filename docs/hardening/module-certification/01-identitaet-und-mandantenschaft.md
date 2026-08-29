# Modulzertifizierung 01 — Identität und Mandantenschaft

**Stand:** 2026-08-28 · **Commit:** `2ba123bb` · **Rubrik:** Programm §6

Umfang: `Auth.tsx`, `CompanyProvider`, `useCompanyContext`, `company_members`,
`companies`, `user_roles`, die Rollenhelfer in SQL und die Mandantenauflösung im
gesamten `/firma`-Bereich.

Jede Zusage unten zeigt auf einen Test oder eine Messung. Wo keiner steht,
steht **LÜCKE** — und was fehlt, um sie zu schliessen.

---

## Der Befund, der oben stehen muss

**Vier Policies auf `companies` geben einem globalen „Admin" Vollzugriff auf
ALLE Firmen. Sie sind heute wirkungslos, weil `user_roles` leer ist — sie sind
eine Zeile davon entfernt, es nicht mehr zu sein.**

Gemessen am 2026-08-28:

```
Admins can view all companies   [SELECT] USING is_admin(auth.uid())
Admins can update all companies [UPDATE] USING is_admin(auth.uid())
Admins can insert companies     [INSERT] WITH CHECK is_admin(auth.uid())
Admins can delete companies     [DELETE] USING is_admin(auth.uid())

is_admin(_user_id) := EXISTS (SELECT 1 FROM user_roles
                               WHERE user_id = _user_id
                                 AND role IN ('super_admin','admin','moderator'))

user_roles_rows = 0     companies = 2     company_members = 2 (beide 'owner')
```

Drei Dinge daran:

1. **`is_admin` ist mandantenlos.** Es fragt nicht, zu welcher Firma jemand
   gehört. Wer drinsteht, sieht und ändert *jede* Firma — Adresse, IBAN,
   Absenderidentität.
2. **`moderator` zählt als Admin.** In `src/lib/adminPermissions.ts` ist
   `moderator` die *schwächste* Rolle (Stufe 10, „leads, verification, blog").
   In der Datenbank hat sie dieselbe Macht wie `super_admin`. Zwei Rollenmodelle
   mit demselben Namen und verschiedener Bedeutung.
3. **Der Weg hinein führt an der Anwendung vorbei.** `user_roles` lässt sich per
   Policy nur von einem bestehenden Super-Admin befüllen — bei leerer Tabelle
   also von niemandem. `service_role` umgeht RLS aber vollständig; jede Edge
   Function mit dem Dienstschlüssel kann die erste Zeile schreiben.

**Einstufung:** kein aktiver Mandantenübertritt (gemessen: 0 Zeilen), sondern
eine **ruhende Rechteausweitung**. Sie gehört korrigiert, bevor jemand die erste
Rolle vergibt — danach ist es ein Eingriff in laufenden Betrieb.
Ledger: **M01-01**, `PLANNED`.

---

## 6.1 Mandant und Autorisierung

| Frage der Rubrik | Antwort | Beleg |
|---|---|---|
| Was ist die mandantentragende Wurzelzeile? | `companies`; Zugehörigkeit über `company_members` | `docs/SISTEM_PRD.md`, Messung oben |
| Woher kommt `companyId` im Browser? | Ausschliesslich `useCompanyContext()` | `src/test/__tests__/mandanten-quelle.test.ts` — fünf Muster, gegen Einschleusung geprüft |
| Trägt jeder Lese-/Schreibschlüssel den Mandanten? | Ja für die umgestellten Seiten | P1A-1…P1A-5; **LÜCKE:** kein Tor über TanStack-Query-Schlüssel |
| Was erlaubt RLS wirklich? | `companies`: Mitgliedslesen + Rollenschreiben — **plus** die vier Admin-Policies oben | Messung, `ops/production-truth/2026-08-28/policies.json` |
| Welche RPCs sind `SECURITY DEFINER`, wer darf sie? | 220 Funktionen, 32 `anon`-ausführbar, davon 4 schreibend — alle vier einzeln gelesen | T-010, `function-authz.json` |
| Welche Edge Functions nutzen service-role, mit welchem Firmenfilter? | Alle 54 eingestuft, service-role ohne Mandantengrenze ist ein Testfehler | `src/test/__tests__/edge-auth-manifest.test.ts` |
| Verwirft ein Mandantenwechsel veraltete Antworten? | Ja, im Firmensatz und in den Einstellungen | `useCompanyRecord`; `src/lib/__tests__/tenantBoundWrite.test.ts`; `aktiverMandant.test.ts` |
| Zwei-Firmen-Test: sieht A nichts von B? | **Teilweise.** Als Vertragstests reiner Funktionen, nicht gegen eine laufende DB | **LÜCKE**, siehe unten |

**Was geprüft ist:** `company_members` erlaubt INSERT und DELETE **nur**
`service_role` (`members_insert_service_only`, `members_delete_service_only`);
SELECT ist auf die eigenen Zeilen beschränkt. Die Mitgliedschaft lässt sich also
nicht aus dem Browser erweitern. `companies_update_owner_admin` prüft
`is_company_role(id, ARRAY['owner','admin'])` — mandantengebunden und korrekt.

---

## 6.2 Datenvollständigkeit und Integrität

Gemessen (lesend, 2026-08-28): 2 Firmen · 2 Mitgliedschaften, beide `owner` ·
0 Rollenzeilen.

**LÜCKE:** kein wiederholbarer Integritätsbericht für dieses Modul — etwa
„Mitgliedschaften ohne Firma", „Firmen ohne Eigentümer", „Benutzer in
`user_roles` ohne `auth.users`-Zeile". Bei zwei Firmen ist das per Auge
machbar; als Zusage taugt es nicht. Gehört zu P2.4.

Ein Trigger seit `20260728170000` stellt sicher, dass jeder Eigentümer auch
Mitglied ist. **Nicht durch einen Test gedeckt** — nur durch die Migration.

---

## 6.3 Lebenszyklus

Zustände: kein Konto → Mitglied ohne Freischaltung → Mitglied mit
freigeschalteter Firma. Der Übergang wird an genau einer Stelle entschieden.

| Zusage | Beleg |
|---|---|
| Die Weiche fragt nach *berechtigten Mitgliedschaften*, nicht nach „der einen Firma" | `src/lib/__tests__/anmeldeZiel.test.ts` (5 Tests) |
| `is_verified === true`, nicht `!== false` — NULL ist keine Freischaltung | ebd. |
| Die Auto-Auswahl bevorzugt eine freigeschaltete Firma | `CompanyProvider`; **LÜCKE:** kein Test — die Auswahl liegt in einem Effekt, den diese Suite nicht ausführt |

---

## 6.4 Sprache

Die Dashboard-Sprache hängt an `companies.default_language` und ist die Achse
des **Bedieners**. Sie darf kundengerichtete Ausgabe nicht berühren.

| Zusage | Beleg |
|---|---|
| Kundengerichtete Renderer lesen den Bedienerkontext nicht | `src/test/__tests__/kundenrenderer-sprache.test.ts`, gegen ein eingeschleustes `useT()` geprüft |

---

## 6.5 Berechnung

Nicht anwendbar: dieses Modul führt keine Beträge.

---

## 6.6 Äussere Wirkungen

Anlegen von Benutzern und Mitgliedschaften lief früher über sechs
`admin-*`-Functions. Alle sechs sind **Grabsteine**: sie antworten mit 410,
öffnen keinen Client und lesen nichts ausser der Methode.

| Zusage | Beleg |
|---|---|
| Grabstein antwortet fail-closed, ohne service-role | `edge-auth-manifest.test.ts` — Grabstein mit Dienstschlüssel ist ein Testfehler |
| Alle sechs sind ausgerollt und inhaltsgleich zum Repo | `edge-hash-drift.json` — nicht in `known_drift` |

**Folge, die benannt gehört:** eine Firma anzulegen ist damit **kein
Anwendungsvorgang mehr**. Es geht nur direkt über GoTrue und einen
`companies`-INSERT. Das ist der gemessene Zustand, keine Empfehlung.

---

## 6.7 Repo / Konfiguration / Produktion

| Zusage | Beleg |
|---|---|
| Migrationen sind anfügend | `src/test/__tests__/migration-ledger.test.ts`, 391 Dateien signiert |
| Abweichung zwischen Produktion und Repo ist benannt oder ein Fehler | `edge-auth-manifest.test.ts`, Abschnitt Drift |
| Erzeugte Supabase-Typen passen zum Schema | `src/test/__tests__/schema-contract.test.ts` (Bestand) |

**Bekannte Abweichung in diesem Modul:** die Produktion trägt auf
`update_offer_by_token` ein `PUBLIC`-EXECUTE, das **kein Migrationsfile
erzeugt** (T10-02). Kein Beleg, wann oder warum. R-6 räumt es mit ab.

---

## 6.8 Reste und irreführende Oberflächen

| Befund | Zustand |
|---|---|
| `CLAUDE.md` §2 behauptete Einmandantigkeit | korrigiert durch D-001; die Datei sagt es noch — **LÜCKE**, gehört in P6 |
| `is_admin` behandelt `moderator` wie `super_admin`, entgegen `adminPermissions.ts` | **M01-01**, `PLANNED` |
| `crm_enabled`, `manual_import_monthly_fee` — Berechtigungsbegriffe ohne heutige Regel | `PLANNED`, P5 (Programm F-010) |

---

## 6.9 Wiederanlauf und Sichtbarkeit

| Zusage | Beleg |
|---|---|
| Ein fehlgeschlagener Firmensatz-Ladevorgang ist sichtbar | `useCompanyRecord` meldet über `sonner` |
| Nutzlast und Ziel einer Mutation tragen denselben Mandanten | `assertSameTenant`, `tenantBoundWrite.test.ts` |
| **LÜCKE:** kein Alarm bei fehlgeschlagenen Mandantenprüfungen | Es gibt keine Auswertung von 403/409 aus den Edge Functions. P2/P4-Rest. |

---

## Zertifizierungsurteil

**NICHT ZERTIFIZIERT.** Drei Gründe, in dieser Reihenfolge:

1. **M01-01** — die vier mandantenlosen Admin-Policies auf `companies`. Heute
   wirkungslos, morgen eine Zeile entfernt davon.
2. Die Zwei-Firmen-Zusagen sind Vertragstests **reiner Funktionen**. Programm
   §16: das ist kein Beweis für RLS- oder Komponentenverhalten. Ein echter
   Zwei-Mandanten-Durchlauf gegen den Wegwerf-Stapel fehlt (Freigabetor 1).
3. Nichts davon ist **live**. P1A steht als `INDEPENDENT_REVIEW_PASS`, nicht
   ausgerollt — die laufende Fassung rät die Firma weiter.

**Was zur Zertifizierung fehlt, in aufsteigendem Aufwand:**

- `is_admin` mandantengebunden machen oder die vier Policies entfernen (Migration).
- Zwei-Mandanten-Test gegen `scripts/supabase-stack.sh up test`: A sieht B nicht,
  weder Zeile noch Anzahl noch Speicherobjekt.
- Integritätsabfragen für dieses Modul als wiederholbarer Bericht.
- R-5 ausrollen, danach am laufenden System nachprüfen.
