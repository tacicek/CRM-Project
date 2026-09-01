# R2-5 — Kanarya: google-places-details

Datum: 2026-08-31
Gateway: http://supabasekong-aw0c0w440o8k0cccokow0csw.213.199.45.205.sslip.io
Digest (Produktion, verifiziert), sha256-Praefix: 41c4f4011928019cac258e4a6229fc5b
Digest md5, zur Gegenprobe: dcc43bdfebc90f713558d056e685d05f
HINWEIS: Alle Digests dieser Auslieferung sind sha256-Praefixe. Wer sie mit
md5 gegenpruefen will, bekommt sechs Fehlalarme.
Edge-Container-Neustart: StartedAt 2026-08-30T23:39:00.822635547Z

## Gemessene negative Pfade — VERIFIED

| Probe                    | Erwartet | Gemessen | Rumpf |
|--------------------------|----------|----------|-------|
| OPTIONS                  | 200      | 200      | (leer) |
| POST ohne Token          | 401      | 401      | code=no_token |
| POST ungueltiger Token   | 401      | 401      | code=invalid_token |
| POST nur "Bearer"        | 401      | 401      | code=no_token |
| GET                      | 405      | 405      | code=method_not_allowed, Allow: POST, OPTIONS |
| PUT                      | 405      | 405      | code=method_not_allowed, Allow: POST, OPTIONS |

Alle sechs Anfragen erreichten Google NICHT. Vor dieser Auslieferung waren
tokenlose Anfragen an diesen Endpunkt unmittelbar bezahlte Google-Aufrufe.

## Budgetzaehler

    select count(*) from public.api_rate_budget;  -->  0

Null Zeilen: kein einziger bezahlter Aufruf, und kein Eimer wurde durch eine
abgewiesene Anfrage angelegt (die hierarchische Kurzschliessung aus
20260830100000 wurde hier nicht ausgeloest, weil die Abweisung schon vor dem
Budgetpfad erfolgte).

## PII im Log

    docker logs --since 6m ... | grep -icE 'placeId|place_id|formatted_address|strasse|Bearer ey'
    --> 0

Nur strukturierte Ereignisse: {"ereignis":..., "fn":..., "status":...}

## NICHT gemessen — ehrliche Grenze

- 400 "company_id fehlt" und 400 "ungueltige Nutzlast" liegen HINTER der
  Tokenpruefung. Sie brauchen ein gueltiges JWT. In der Produktion wurde kein
  Token ausgestellt. Diese beiden Zweige sind durch 29 Einheitstests gedeckt,
  aber in der Produktion UNGEMESSEN.
- 403 (keine Mitgliedschaft) und 429 (Budget erschoepft) ebenso: UNGEMESSEN in
  Produktion, gedeckt durch Einheits- und Datenbanktests.
- Kein positiver Aufruf durchgefuehrt — das waere ein bezahlter Google-Request.

## Nachbarschaft

google-places-autocomplete  OPTIONS --> 200  (alte Fassung, unveraendert)
calculate-distance          OPTIONS --> 200  (alte Fassung, unveraendert)

Der Container-Neustart hat die beiden nicht ausgerollten Endpunkte nicht
beschaedigt.

## Urteil

R2-5: GO. Weiter mit R2-6 (google-places-autocomplete).
