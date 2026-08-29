# FR/EN-Sendebereitschaft — gemessener Bestand, 2026-08-28

Lesend gegen die Produktion erhoben (`PGOPTIONS=-c default_transaction_read_only=on`).
Rohdaten: [`ops/rollout/2026-08-28/FREI-readiness-1.txt`](../../ops/rollout/2026-08-28/FREI-readiness-1.txt) ·
[`FREI-readiness-2.txt`](../../ops/rollout/2026-08-28/FREI-readiness-2.txt).

**Keine Zeile verändert.** Keine Offerte, keine Position, keine Vorlage.

---

## Die kurze Antwort

**Es gibt heute keine einzige französische Kundenunterlage, und genau eine
englische — einen Entwurf, der nie gesendet wurde.**

| | de | fr | en |
|---|---:|---:|---:|
| offers | 92 | **0** | **1** |
| leads | 116 | 0 | 0 |
| auftraege | 26 | 0 | 0 |
| rechnungen | 31 | 0 | 0 |
| quittungen | 12 | 0 | 0 |
| appointments | 96 | 0 | 0 |
| customers | 117 | 0 | 0 |
| offer_amendments | 0 | 0 | 0 |

Die eine englische Offerte:

```
id      a83d8a84-b292-4133-99ed-ae839d1ec07b
nr      10089        status draft        sent_at (nie)      locked_at (null)
firma   Hirschenumzug GmbH                service umzug_privat
payment_terms gesetzt (eigener Wert auf der Offerte)
8 Positionen, alle mit Text
```

---

## Was die strenge Prüfung heute bewirken würde

Die Prüfung aus T-008 betrachtet, was der Sendeweg **selbst** aus einer Vorlage
holt: Zahlungskondition und AGB.

| Offerte | Sprache | Blocker | warum |
|---|---|---:|---|
| 92 Stück | `de` | **0** | Bei `de` ist die Basisspalte die richtige Quelle. |
| 10089 | `en` | **12** | 6 aktive `umzug`-AGB-Abschnitte × (title + content), **keiner** mit englischer Fassung. |

**R-4 betrifft also genau eine Offerte — einen Entwurf, der nie gesendet wurde.**
Kein laufender Vorgang wird unterbrochen; es entsteht kein Rückschritt für die
92 deutschen Offerten.

Die Zahlungskondition erzeugt **nirgends** einen Blocker: beide Firmen haben
`default_payment_terms` **leer**, und alle 93 Offerten tragen einen eigenen,
beim Anlegen eingefrorenen Wert. Der Slot feuert nur, wenn der Sendeweg die
Kondition aus der Firmenspalte holen müsste.

---

## Bestand je Kategorie

### REQUIRED_AND_PRESENT

| Inhalt | Beleg |
|---|---|
| PDF-, E-Mail- und Public-View-**Beschriftungen** in de/fr/en | 4467 Schlüssel je Sprache. `fr`/`en` sind `Record<keyof typeof de, string>` typisiert — ein fehlender Schlüssel ist ein **Compilerfehler**, keine stille deutsche Zeile. `npm run type-check` grün. |
| Zahlungskondition je Offerte | 93 von 93 Offerten tragen einen eigenen Wert. |
| Offertentitel | 93 von 93. |
| Positionstexte | 531 Positionen, keine leere Beschreibung auf der en-Offerte. |

### REQUIRED_AND_MISSING

| Inhalt | fehlt für | Menge | betroffene Kennungen |
|---|---|---:|---|
| **AGB-Abschnitte** (`title`, `content`) | `fr` **und** `en` | **37 von 37 aktiven**, beide Felder | alle Hirschenumzug; für `umzug` sind 6 aktiv → 12 Blocker an Offerte 10089 |
| Leistungsübersicht-Vorlage | `fr` und `en` | 1 von 1 | — |

### OPTIONAL_AND_PRESENT

| Inhalt | Firma | Bestand |
|---|---|---|
| Katalogpositionen `fr` | Hirschenumzug | **66 von 67** Namen, **67 von 67** Beschreibungen |
| Katalogpositionen `fr` | Bernova | 1 von 67 Namen, 0 Beschreibungen |

Optional, weil `offer_items` beim Anlegen einen **Schnappschuss** aus dem Katalog
nehmen. Ein fehlender Katalogeintrag verhindert keinen Versand einer bestehenden
Offerte — er verhindert, dass eine *neue* französische Offerte ohne Handarbeit
entsteht.

### OPTIONAL_AND_MISSING

| Inhalt | Menge |
|---|---|
| Katalogpositionen `en` | **134 von 134** — keine einzige englische Katalogfassung |
| Katalogpositionen `fr` bei Bernova | 66 von 67 Namen, 67 von 67 Beschreibungen |
| Checklisten-Vorlagen | **0 Zeilen in der Tabelle.** Es gibt nichts zu übersetzen und nichts anzuhängen. |
| `companies.default_terms_and_conditions` | bei beiden Firmen **leer**, auch auf Deutsch |

### GERMAN_FALLBACK_CURRENTLY_USED

Heute **keiner mit Wirkung** — weil es ausser Offerte 10089 keine
nicht-deutsche Unterlage gibt.

Was ohne die strenge Prüfung passieren *würde*, wenn 10089 gesendet würde:
6 AGB-Abschnitte × 2 Felder gehen als **deutscher Text an einen englischsprachigen
Kunden**, im angehängten AGB-PDF. Genau dieser Fall.

### USER_AUTHORED_WITHOUT_TRANSLATION_SOURCE

| Inhalt | Menge | Folge |
|---|---:|---|
| `offers.title` | 93 | Kein Katalogschlüssel hinterlegt; die Herkunft ist zur Sendezeit nicht mehr belegbar. |
| `offers.payment_terms` | 93 | dito — eingefroren beim Anlegen. |
| `offer_items.description` | 531 | `offer_items` trägt **keine Herkunftsspalte**. Ob ein Text aus dem Katalog stammt oder von Hand geschrieben wurde, ist nicht belegbar. |

Deshalb prüft T-008 diese Felder **nicht** — ein Blocker auf Verdacht hielte jede
richtige Offerte auf. Und deshalb behandelt der Sprachumstellungsplan (T-007) sie
als `USER_EDITED_CONFLICT`: ohne Beleg wird nicht überschrieben.

---

## Was daraus folgt

1. **R-4 ist risikoarm.** Es betrifft eine einzige, nie gesendete Entwurfsofferte.
   Die 92 deutschen Offerten sind unberührt.
2. **Die eigentliche Arbeit liegt vor R-4, nicht darin:** 37 AGB-Abschnitte
   brauchen eine französische und eine englische Fassung, sonst ist eine fr/en-
   Offerte in dieser Installation nicht versendbar. Das ist Inhalt, keine Technik.
3. **Für `en` fehlt der Katalog vollständig.** Eine englische Offerte lässt sich
   heute nur von Hand schreiben.
4. **`checklist_templates` ist leer.** Jede Aussage über „Checklisten-Anhänge in
   FR/EN" beträfe eine Funktion, die in dieser Installation keine Daten hat.
