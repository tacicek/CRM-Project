# R2-7 — calculate-distance ausgeliefert

Datum: 2026-08-31

sha256 in Produktion, vom Server gelesen == erwartet:
  5ecac9a205d8eb36e32caaa4155fbedcb067f0e534a3071958892113029de246

Vorzustand: cf7a8ad939a1ace1f23b9f618ac108bc (md5) == 68c07c7b. Kein Drift,
nachvollziehbar — anders als bei autocomplete. Aber 0 Auth-Treffer, und sein
Limiter war der speicherinterne aus R2-01, der pro Anfrage einen frischen
Worker sieht und deshalb nie ausloest.

## Gemessene negative Pfade — VERIFIED

| Probe                  | Erwartet | Gemessen |
|------------------------|----------|----------|
| OPTIONS                | 200      | 200      |
| POST ohne Token        | 401      | 401  code=no_token |
| POST falscher Token    | 401      | 401  code=invalid_token |
| POST nur "Bearer"      | 401      | 401  code=no_token |
| GET / PUT / DELETE     | 405      | 405  Allow: POST, OPTIONS |

Die Probe trug echte Adressen:
  {"origin":"Bahnhofstrasse 1, Zuerich","destination":"Bundesplatz 1, Bern"}

    grep -ciE 'Bahnhofstrasse|Bundesplatz|Zuerich|"origin"|"destination"'  --> 0
    grep -ciE 'AIza|key=AIza'                                             --> 0

Weder Kundenadresse noch Google-Schluessel im Log. Nur:
    {"ereignis":"kein_token","fn":"calculate-distance","status":401}

## Budget

    select count(*) from public.api_rate_budget;  -->  0
