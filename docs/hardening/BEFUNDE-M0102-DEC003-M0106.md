# M01-02, DEC-003, M01-06 — gemessen 2026-08-28

## M01-02 · `user_roles`: ein Moderator kann sich zum `super_admin` machen

`VERIFIED_DORMANT_PRIVILEGE_ESCALATION`. Korrektur `20260828180000` vorbereitet,
**nicht angewendet**.

Sechs Policies auf `user_roles`. Fünf sind sauber gestuft und prüfen
`is_super_admin` plus `can_modify_role`. Die sechste hebt die Stufung auf:

```
Admins can manage roles | FOR ALL | TO authenticated
  USING is_admin(auth.uid())  WITH CHECK is_admin(auth.uid())
```

`is_admin` schliesst `moderator` ein, und Policies verodern sich. Also genügt
diese eine. **Am Wegwerf-Stapel bewiesen:** vorher gab sich ein `moderator`
selbst `super_admin` — `super_admin-Zeilen: 1`. Nachher: `permission denied`.

Ruhend, weil `user_roles` 0 Zeilen hat. Genau deshalb ist jetzt der Zeitpunkt.

Die Korrektur nimmt die Policy heraus **und** entzieht `anon`/`authenticated`
INSERT/UPDATE/DELETE auf der Tabelle — bisher war die Policy die einzige
Schranke, das Tabellenrecht lag vor. Danach kann kein Browserclient mehr
schreiben, gleich welche Policy jemand später anlegt. `SELECT` bleibt, sonst
sähe niemand mehr die eigene Rolle. Rollenvergabe läuft über `service_role`
(Betreiberweg) und wird protokolliert.

**Was das Testen an meinem eigenen Entwurf gefunden hat**, bevor irgendetwas
lief:

* Der Protokoll-Trigger schrieb auf `admin_activity_log(admin_user_id,
  target_type, target_id)` — diese Spalten gibt es nicht. Sie heissen `user_id`,
  `entity_type`, `entity_id`. Die Migration wäre in der Produktion gescheitert.
* Meine „serverseitige Rollenprüfung" zählte drei Rollen auf. `app_role` hat
  **vier** (`super_admin, admin, moderator, user`). Die legitime Vergabe von
  `user` wäre abgewiesen worden. Ersetzt durch eine Prüfung, **dass** Enum und
  Fremdschlüssel stehen — statt sie schlechter nachzubauen.
* Das Protokollfeld `current_user` nennt in einer `SECURITY DEFINER`-Funktion
  immer den Eigentümer. Es hätte konstant `postgres` gemeldet, egal wer handelte.
  Jetzt `session_user`; die fachliche Zuordnung steht ohnehin in `user_id`.

Neun festgenagelte Fälle in `ops/rollout/2026-08-28/M0102-nachweis.txt`.

## DEC-003 · direkte Firmenanlage — Empfehlung: `REMOVE_DIRECT_SELF_SERVICE_POLICY`

Die Policy `Users can insert their own company` (`WITH CHECK auth.uid() = user_id`)
erlaubt jedem angemeldeten Benutzer, sich eine Firma anzulegen; der Trigger
`trigger_companies_ensure_owner_membership` macht ihn anschliessend zum
Eigentümer-Mitglied.

Aufrufer-Inventar:

| Weg | Befund |
|---|---|
| direktes `INSERT`/`upsert` auf `companies` in `src/` oder `supabase/functions/` | **keiner** — nur Testfixtures |
| `public.create_company_after_signup` | existiert, `SECURITY DEFINER`, **umgeht RLS** |
| dessen Ausführungsrechte | `anon=false`, `authenticated=false`, **nur `service_role`** |
| dessen Aufrufer im Repo | **keiner** |
| Onboarding-Seite im Frontend | keine |
| `companies`-Zeilen in der Produktion | 2 |

Die Definer-Funktion trägt ihren Ursprung im Kopf: *„Partner Registrierung
sonrası firma oluşturma … session null → RLS INSERT engellendi → SECURITY
DEFINER … RLS bypass"*. Sie ist ein Rest der öffentlichen Partner-Registrierung,
die im CRM-Fork entfernt wurde — und sie umgeht die Policy ohnehin.

**Damit hat die Policy keinen identifizierten legitimen Aufrufer.** Der
Betreiberweg (Firmenanlage über `service_role`) läuft an RLS vorbei und bleibt
unberührt. Empfehlung daher `REMOVE_DIRECT_SELF_SERVICE_POLICY` — **aber nicht in
diesem Durchgang**: die Freigabe verlangt, die Policy erst zu entfernen, wenn der
legitime Onboarding-Aufrufer benannt oder ersetzt ist. Benannt ist er jetzt
(`service_role`, ausserhalb von RLS); die Entfernung selbst braucht eine eigene
Freigabe.

## M01-06 · `get_public_company_info` — `TOKEN_BOUND_REPLACEMENT_RECOMMENDED`

Gemessene Rückgabe, 14 Spalten:

```
id, company_name, street, house_number, city, plz, phone, email,
website, logo_url, primary_color, slogan, pdf_template, default_language
```

Aufrufer: genau einer — `src/pages/public/OfferView.tsx:279`.

Dass OfferView sie aufruft, beweist die Benutzung, nicht die Notwendigkeit des
UUID-Zugriffs. Drei Dinge sprechen dagegen, es so zu lassen:

1. **Der Zugriff ist nicht token-gebunden.** Jede beliebige Firmen-UUID liefert
   den vollen Satz — für `anon`. Die öffentliche Offerte hat bereits ein Token;
   der Firmenbezug ergibt sich daraus.
2. **`pdf_template` und `default_language` sind Konfiguration**, keine
   Kundeninformation. Sie gehören in keinen öffentlichen Datensatz.
3. **Adresse, Telefon und E-Mail** sind für den Absender einer Offerte richtig —
   aber als Antwort auf eine geratene UUID sind sie eine Firmenliste zum
   Abgrasen.

Zielbild, schrittweise:

1. Die token-gebundene Offerten-RPC liefert die ausdrücklich erlaubten
   Marken- und Kontaktfelder, die OfferView braucht.
2. OfferView ruft `get_public_company_info` nicht mehr auf.
3. Erst danach wird die generische UUID-Funktion `anon`/`authenticated` entzogen
   oder auf eine ausdrücklich freigegebene Firmenliste verengt.

**Die Funktion wird nicht entzogen, bevor der Ersatz in OfferView umgesetzt,
gebaut und geprüft ist.**
