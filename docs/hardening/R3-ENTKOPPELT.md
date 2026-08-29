# R-3 von R-4 entkoppelt

**Frage:** R-3 verlangt „das kompatible Frontend zuerst". Aktiviert dieses
Frontend-Deployment zugleich die strenge Sendebereitschaft aus R-4?

**Antwort:** Auf dem Härtungszweig **ja**. Deshalb gibt es jetzt eine getrennte,
minimale R-3-Fassung, die es **nicht** tut.

---

## Was genau die strenge Sendebereitschaft aktiviert

Genau **eine** Stelle: `src/lib/sendOffer.ts`

```ts
const bereitschaft = await ladeOfferSendReadiness(offerId);
if (!bereitschaft.ok) {
  return { success: false, error: "offer_not_ready", blockers: bereitschaft.blockers };
}
```

Alles andere ist Begleitwerk:

| Datei | Wirkung |
|---|---|
| `src/lib/offerSendReadinessInput.ts` | lädt die Zeilen — ohne den Aufruf oben untätig |
| `src/lib/offerSendBlockerText.ts` | übersetzt Blocker in Sätze — reine Anzeige |
| `OfferteErstellen/Bearbeiten/Detail` | zeigen die Blockerliste — reine Anzeige |
| `buildOfferEmailAttachments.ts` → `attachmentLocale` | ein zusätzliches Feld im Rumpf; **alte** Handler ignorieren es |

Die drei Anzeige-Stellen und `attachmentLocale` sind für sich **unschädlich**:
ohne den Aufruf in `sendOffer.ts` gibt es keine Blocker anzuzeigen, und ein
unbekanntes Feld im Rumpf ändert am alten Handler nichts.

---

## Die minimale R-3-Fassung

Zweig **`release/r3-spellcheck-locale`**, abgeleitet vom ausgerollten Stand
`origin/main` (`68c07c7b`) — nicht vom Härtungszweig.

Drei Änderungen, 19 Zeilen:

```
src/lib/spellCheckService.ts          locale wird PFLICHTargument, geht im Rumpf mit
src/pages/firma/OfferteErstellen.tsx  runSpellCheck(spellFields, offerLocale)
src/pages/firma/OfferteBearbeiten.tsx runSpellCheck(spellFields, offerLanguage)
```

Beide Seiten führen die Dokumentsprache auf `main` **bereits** als Zustand
(`offerLocale`, `offerLanguage`) — es wird nichts Neues eingeführt.

Kein Standardwert für `locale`. Ein Standardwert wäre derselbe stille Rückfall
auf Deutsch, nur eine Ebene höher.

### Nachweis, dass nichts aus R-4 mitkommt

```
$ git diff origin/main...release/r3-spellcheck-locale | grep -E \
    "ladeOfferSendReadiness|offerSendReadiness|blockerListe|attachmentLocale|evaluateOfferSendReadiness"
(kein Treffer)

$ … | grep -E "fetchCompanyById|useCompanyRecord|SprachwechselDialog|tenantBound|buildOfferLanguageRebasePlan"
(kein Treffer)
```

Auf dem Härtungszweig bleibt T-008 **unverändert und unabgeschwächt**.

### Tore

| | |
|---|---|
| `npm run type-check` | PASS |
| `npx vitest run` | PASS — 83 Dateien, 1746 Tests (der Stand von `main`) |
| `npm run build:vite` | PASS |
| Lint auf den drei Dateien | 0 Fehler |

### Artefakt-Fingerabdruck

```
Commit           ccd5ce79   (Basis 68c07c7b)
dist gesamt      sha256 9000bb390f6a1f267c1a258d8d4bd46f7e2e552f2e5dca92493eec04b25f24e0
dist/index.html  sha256 436752f87dfdbc4d…
Dateien in dist  341
```

Der Gesamtwert ist `find dist -type f | sort | xargs sha256sum | sha256sum` —
dieselbe Bildung wie bei den Edge-Digests, damit er nach dem Ausrollen
nachrechenbar ist.

---

## Rollout (nicht freigegeben)

Bindende Reihenfolge — sie ist einseitig:

| # | Einheit | Verhalten davor/danach |
|---|---|---|
| 1 | Frontend aus `release/r3-spellcheck-locale` | Neues Frontend + **alter** Handler: der Handler ignoriert `locale` und nimmt weiter den deutschen Prompt. Genau das heutige Verhalten — unschädlich. |
| 2 | `_shared/spellCheckPrompt.ts`, dann `spell-check-ai/index.ts` | Ab jetzt sprachabhängig. Ein noch offener alter Tab schickt kein `locale` und bekommt **400**; `runSpellCheck` fängt das und liefert `null` → das Korrekturfenster entfällt, gespeichert wird trotzdem. |

Umgekehrt verlieren offene Tabs ohne Not die Prüfung.

### Nachkontrolle — die WIRKUNG, nicht der Digest

Die Lehre aus R-2: ein Digest-Abgleich sagt, dass der richtige Code **liegt**,
nicht dass er **wirkt**.

| Probe | Erwartung |
|---|---|
| `POST` mit gültigem JWT und `locale:"de"` | 200, deutsche Regeln |
| `POST` mit gültigem JWT und `locale:"fr"` | 200, **kein** `ss` und keine Substantivgrossschreibung im Prompt |
| `POST` mit gültigem JWT und `locale:"en"` | 200 |
| `POST` **ohne** `locale` | **400** mit `{"supported":["de","fr","en"]}` — nicht 200 mit deutschem Ergebnis |
| `POST` mit `locale:"it"` | **400** |
| ohne JWT | 401 |

Die vierte Zeile ist die eigentliche Zusage: eine fehlende Sprache **scheitert
ausdrücklich** und fällt nicht auf deutsche Korrekturregeln zurück.

### Rücknahme

Umgekehrt: `spell-check-ai` zurück auf die vorige Fassung (die `locale`
ignoriert), dann das Frontend zurück auf `68c07c7b`. Das Frontend zuerst
zurückzunehmen wäre ebenfalls sicher — der neue Handler bekäme dann kein
`locale` und antwortete mit 400, was `runSpellCheck` als „keine Korrektur"
behandelt.

---

## Was das für R-4 bedeutet

R-4 bleibt **nicht freigegeben** — aber die Messung
([FREI-READINESS](FREI-READINESS-2026-08-28.md)) zeigt, dass es weniger
folgenreich ist als befürchtet: **eine einzige, nie gesendete Entwurfsofferte**
würde blockiert (12 Blocker: 6 aktive `umzug`-AGB × title + content, ohne
englische Fassung). Die 92 deutschen Offerten sind unberührt.

Die Arbeit vor R-4 ist damit **Inhalt, nicht Technik**: 37 AGB-Abschnitte
brauchen eine französische und eine englische Fassung.
