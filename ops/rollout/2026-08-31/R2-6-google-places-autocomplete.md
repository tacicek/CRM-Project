# R2-6 — google-places-autocomplete ausgeliefert

Datum: 2026-08-31
Vorbefund: ops/rollout/2026-08-31/R2-6-BEFUND-drift-autocomplete.md
Gesicherter Vorzustand: ops/rollout/2026-08-31/prod-drift/google-places-autocomplete.PROD.ts

sha256 in Produktion, vom Server gelesen:
  50ff488bf810897ec246b44f9b3dafe136c63548c4755156d6a35c1e617ea7a9
Erwartet, aus dem Arbeitsbaum:
  50ff488bf810897ec246b44f9b3dafe136c63548c4755156d6a35c1e617ea7a9
Uebereinstimmung: exakt.

## Gemessene negative Pfade — VERIFIED

| Probe                  | Erwartet | Gemessen | Rumpf |
|------------------------|----------|----------|-------|
| OPTIONS                | 200      | 200      | (leer) |
| POST ohne Token        | 401      | 401      | code=no_token |
| POST falscher Token    | 401      | 401      | code=invalid_token |
| POST nur "Bearer"      | 401      | 401      | code=no_token |
| GET                    | 405      | 405      | Allow: POST, OPTIONS |
| PUT                    | 405      | 405      | Allow: POST, OPTIONS |

Der tokenlose POST trug die Nutzlast {"input":"zuerich", ...}. Vor dieser
Auslieferung war genau dieser Aufruf ein bezahlter Google-Request ohne jede
Pruefung. Jetzt endet er bei 401.

## PII im Log — direkter Vorher-Nachher-Beleg

Die alte Fassung schrieb in Zeile 50:
    console.log("[google-places-autocomplete] Fetching predictions for:", input)

Nach der Auslieferung, mit genau dieser Suchanfrage in der Probe:
    grep -ciE 'zuerich|Fetching predictions|"input"'   --> 0
    grep -ciE 'Bearer ey|ungueltig\.token'             --> 0

Im Log stehen nur strukturierte Ereignisse:
    {"ereignis":"kein_token","fn":"google-places-autocomplete","status":401}
    {"ereignis":"token_ungueltig",...,"status":401}
    {"ereignis":"methode_abgelehnt",...,"status":405}

## Budget

    select count(*) from public.api_rate_budget;  -->  0

Keine der Proben hat einen Eimer angelegt: die Abweisung erfolgt vor dem
Budgetpfad. Und kein bezahlter Aufruf wurde gezaehlt.

## Keine Regression bei den Nachbarn

    google-places-details  OPTIONS -> 200,  tokenlos POST -> 401 (R2-5 haelt)
    calculate-distance     OPTIONS -> 200   (alte Fassung, noch nicht ausgeliefert)

Der Containerneustart hat R2-5 nicht zurueckgenommen.

## NICHT gemessen — dieselbe ehrliche Grenze wie R2-5

400 (company_id fehlt / ungueltige Nutzlast), 403 (keine Mitgliedschaft) und
429 (Budget erschoepft) liegen hinter der Tokenpruefung und brauchen ein
gueltiges JWT. In der Produktion wurde kein Token ausgestellt. Diese Zweige
sind durch Einheits- und Datenbanktests gedeckt, in der Produktion UNGEMESSEN.

Kein positiver Aufruf: das waere ein bezahlter Google-Request.

## Urteil

R2-6: GO. Offen bleibt R2-7 (calculate-distance).
