# R-2 Produktionsauslieferung — Abschluss

Datum: 2026-08-31
Quelle: origin/main b239d51b (Zusammenfuehrung PR #30)
Arbeitsbaum == origin/main fuer supabase/functions/, byte-genau geprueft.

## Was ausgeliefert wurde

| Datei                               | sha256 in Produktion |
|-------------------------------------|----------------------|
| google-places-details/index.ts      | 41c4f401…1f7c3098    |
| google-places-autocomplete/index.ts | 50ff488b…617ea7a9    |
| calculate-distance/index.ts         | 5ecac9a2…029de246    |
| _shared/paidApiHttp.ts              | 2f246381…271dce6f    |
| _shared/paidApiGuard.ts             | 51e87510…91767e45    |

Alle fuenf stimmen exakt mit dem Arbeitsbaum ueberein.

Datenbank: die drei Migrationen 20260828130000, 20260829120000 und
20260830100000 sind angewandt. api_rate_budget hat RLS, null Policies, und
weder anon noch authenticated noch service_role haben eine einzige
Tabellenberechtigung. EXECUTE auf consume_api_budget nur fuer service_role.

## Der Zustand davor — gemessen, nicht erinnert

Alle drei Endpunkte waren unauthentifizierte Proxys auf bezahlte
Google-Schnittstellen. `grep -E "getUser|Authorization|Bearer|company_id"`
ergab bei allen dreien null Treffer. Zwei trugen einen speicherinternen
Limiter, der wegen R2-01 (frischer Worker je Anfrage) nie ausloesen konnte;
der dritte trug gar keinen.

autocomplete schrieb zusaetzlich die getippte Adresse ins Containerlog.

Und der ausgelieferte Stand von autocomplete entsprach KEINEM Stand der
Git-Geschichte — er kam aus einer Quelle, die nie im Repository lag. Gesichert
unter ops/rollout/2026-08-31/prod-drift/.

## Was jetzt gilt — VERIFIED gegen die Produktion

Fuer jeden der drei Endpunkte, gemessen ueber
http://supabasekong-aw0c0w440o8k0cccokow0csw.213.199.45.205.sslip.io:

    OPTIONS              -> 200
    POST ohne Token      -> 401  no_token
    POST falscher Token  -> 401  invalid_token
    POST nur "Bearer"    -> 401  no_token
    GET / PUT / DELETE   -> 405  Allow: POST, OPTIONS

Neunzehn Proben insgesamt, keine einzige hat Google erreicht:

    select count(*) from public.api_rate_budget;  -->  0

Keine Kundendaten, keine Tokens, keine API-Schluessel im Log. Nur
strukturierte Ereignisse der Form {"ereignis":…,"fn":…,"status":…}.

## Was NICHT gemessen wurde — die ehrliche Grenze

400 (company_id fehlt, ungueltige Nutzlast), 403 (keine Mitgliedschaft) und
429 (Budget erschoepft) liegen hinter der Tokenpruefung. Sie brauchen ein
gueltiges JWT; in der Produktion wurde keines ausgestellt. Diese Zweige sind
durch 848 Einheitstests und die Datenbanktests gedeckt, in der PRODUKTION
jedoch UNGEMESSEN.

Kein positiver Aufruf wurde durchgefuehrt — das waere ein bezahlter
Google-Request gewesen. Der Nachweis, dass ein berechtigter Benutzer weiterhin
Adressen suchen kann, steht damit AUS. Er faellt beim naechsten echten
Gebrauch durch einen angemeldeten Benutzer an.

## Offen

- Drift-Befund: mindestens eine Edge Function lief aus einer Quelle, die nie
  im Repository lag. Ob weitere betroffen sind, ist UNGEPRUEFT.
- R-3 (spell-check-ai) und R-4 sind unveraendert offen.
