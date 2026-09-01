# R2-6 Vorbefund — google-places-autocomplete weicht von der Quelle ab

Datum: 2026-08-31
Gefunden beim Digest-Abgleich vor der Auslieferung.
Gesicherte Kopie: ops/rollout/2026-08-31/prod-drift/google-places-autocomplete.PROD.ts

## Der Befund

| Stand                      | md5                              |
|----------------------------|----------------------------------|
| Produktion (jetzt)         | 82df1f6a718ea3c51b0527032acc0a21 |
| altes main (68c07c7b)      | b0b8eeff638cd8cef14ae559fa535989 |
| origin/main (b239d51b, neu)| 2fd85df2146f8b7d1a592578a62eac7a |

Der Produktionsstand entspricht KEINEM Stand der gesamten Git-Geschichte dieser
Datei — auch nicht leerraum-unempfindlich. Er wurde aus einer Quelle
ausgeliefert, die nie im Repository gelandet ist, oder auf dem Server bearbeitet.

Der Beleg fuer den Drift ist nicht der Hash, sondern der Zeilenvergleich: dem
Produktionsstand fehlen gegenueber 68c07c7b der Import von `createRateLimiter`
und der gesamte IP-Drosselblock. Er ist also AELTER als das alte main.

## Was dort jetzt laeuft — gemessen, nicht vermutet

    grep -E "getUser|Authorization|authHeader|Bearer|company_id|jwt|verifyCompany" 
    --> 0 Treffer

    grep -cE "rateLimit|createRateLimiter|isLimited|429|budget"
    --> 0 Treffer

Der Ablauf ist: OPTIONS --> req.json() --> Zod --> Google, mit dem API-Schluessel.
Keine Authentifizierung. Keine Begrenzung. Wer die URL kennt, kann die
Google-Rechnung unbegrenzt treiben.

Zusaetzlich, Zeile 50:

    console.log("[google-places-autocomplete] Fetching predictions for:", input)

`input` ist die Adresse, die der Benutzer tippt. Sie steht im Containerlog.
Die neue Fassung enthaelt keinen console.log. Sie enthaelt genau einen
console.error, und zwar den strukturierten Ereignislogger:

    log: (ereignis, felder) => console.error(JSON.stringify({ ereignis, ...(felder ?? {}) }))

Er schreibt Ereignisname und Statuszahl, keine Nutzlast. Genau das war in der
Kanarya zu sehen: {"ereignis":"kein_token","fn":...,"status":401}. Das Quelltor
src/test/paid-endpoint-guard.ts verbietet console.log( und prueft zusaetzlich,
dass in den Argumenten eines Log-Aufrufs kein Kundeninhalt steht.

## Bewertung

Das blockiert R2-6 NICHT, es macht es dringend. Die Ablaufreihenfolge bleibt
gleich; der zu ueberschreibende Stand ist vorher gesichert.

Kein positiver Aufruf zur Bestaetigung durchgefuehrt: das waere ein bezahlter
Google-Request. Der Befund steht auf dem Quelltext, nicht auf einer Messung
gegen Google.

## Nachbar calculate-distance

Produktion cf7a8ad939a1ace1f23b9f618ac108bc == 68c07c7b. Kein Drift, der Stand
ist nachvollziehbar. Aber ebenfalls 0 Auth-Treffer; sein Limiter ist der
speicherinterne aus R2-01, der pro Anfrage einen frischen Worker sieht und
deshalb nie ausloest. Also ebenfalls ein unauthentifizierter bezahlter Proxy,
nur mit dekorativer Bremse.
