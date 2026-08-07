# ADR — Offerte-Preismodell: eine Achse statt drei

**Datum:** 2026-08-07 · **Status:** angenommen · **Gilt für:** `offers`, `offer_items`, Erstellen/Bearbeiten, PDF, OfferView, Offerten-Liste

Dieses Dokument hält drei Entscheidungen fest, die getroffen werden mussten, bevor die
Preis-Fehlerbilder (F1–F11) einzeln repariert werden konnten. Ohne sie wäre jede Reparatur
ein Pflaster auf einer von zwei gleichzeitig gültigen Wahrheiten gewesen.

---

## 1. Befund

Der Preis einer Offerte ist heute auf **drei unabhängigen Achsen** modelliert, aber die
Summe entsteht nur aus zweien:

| # | Achse | Ort | Zählt zur Summe? |
|---|---|---|---|
| 1 | `offers.price_model` (`pauschal`/`stundenansatz`/`kostendach`) + `offers.hourly_rate` + `offers.kostendach_max` | Offerte | **Nein — nur ein PDF-Kästchen** |
| 2 | `offer_items.price_type` (`pauschale`/`per_unit`/`per_hour`/`inkl`/`optional`) | Position, Einheiten-Achse | Ja (`inkl`/`optional` ausgenommen) |
| 3 | `offer_items.amount_basis` (`fixed`/`rate`/`range`) | Position, Betrags-Achse | Ja (`rate` ausgenommen) |

Die Summe entsteht an genau einer Stelle — `computeItemsSubtotal`
([src/lib/offerPricing.ts](../src/lib/offerPricing.ts)) — und `price_model` kommt dort nicht vor.

Der Bediener hält das Preismodell für eine Einstellung. Das System behandelt es als Etikett.

Dazu wohnt der Stundensatz an fünf Orten, von denen keiner die Wahrheit der anderen ist:
`offers.hourly_rate` · `offer_item_effort_meta.hourly_rate` · `offer_items.time_estimate.hourlyRate` ·
`offer_items.unit_price` (bei `per_hour`) · `offer_item_volume_meta.rate`.

### Am Code geprüft — Korrekturen an der ursprünglichen Diagnose

Die folgenden fünf Punkte wichen von der Vorlage ab und sind hier festgehalten, damit sie
nicht ein zweites Mal falsch hergeleitet werden:

1. **`OfferteItemRow` hat bereits einen eigenen `amountBasis`-Wähler**
   ([OfferteItemRow.tsx:252-268](../src/components/offerte/OfferteItemRow.tsx#L252-L268)).
   Nicht synchronisiert wird er vom Preistyp-Dropdown — vorhanden ist er.
2. **`OfferteBearbeiten` hat denselben `amountBasis`-Wähler**
   ([:1458-1472](../src/pages/firma/OfferteBearbeiten.tsx#L1458-L1472)) samt Item-Kostendach bei `rate`.
   Was dort fehlt, ist **nur der Preistyp-Wähler**.
3. **Die angezeigte Zwischensumme in Bearbeiten nutzt bereits `isFreeItem(price_type)`**
   ([:541-544](../src/pages/firma/OfferteBearbeiten.tsx#L541-L544)). Lesson #8 ist auf der
   Anzeigeseite geschlossen. Die Abweichung sitzt **allein im Speicherpfad**: `quantity`
   ([:826](../src/pages/firma/OfferteBearbeiten.tsx#L826)) **und `unit_price`**
   ([:828](../src/pages/firma/OfferteBearbeiten.tsx#L828)) prüfen weiterhin den String
   `unit === "inkl."` und übersehen damit `optional`.
4. **`serviceTerminLabel` wird in der Produktion nirgends aufgerufen** — nur in seinem eigenen
   Test. [ServiceTable.tsx:679](../src/components/pdf/components/ServiceTable.tsx#L679) hält
   fest, dass die Katalog-Auflösung an seine Stelle getreten ist. Der dort vermutete
   i18n-Verstoss existiert nicht; es ist toter Code.
5. **`agb_ip_address` wird seit `20260416000002` ignoriert**, nicht erst seit `20260705100000`.
   Vier spätere Fassungen haben die Entscheidung mitgeschleppt.

Zusätzlich, weil der Name doppelt vorkommt: **`offers.kostendach_max` und
`offer_items.kostendach_max` sind zwei verschiedene Spalten.** Die erste gehört zum
Offerte-Kästchen, die zweite zur Position.

---

## 2. Entscheidung 1 — `price_model` wird abgeleitet, nicht gesetzt (Option A)

Das Preismodell-Kästchen verschwindet aus Erstellen und Bearbeiten. Das Etikett auf
Beleg und Vorschau wird **aus den Positionen abgeleitet**:

- mindestens eine Position mit `amount_basis = 'rate'` → nach Aufwand;
- dazu ein Item-Kostendach → nach Aufwand mit Obergrenze;
- sonst → Pauschale.

Damit ist `amount_basis` die einzige Wahrheit, und die Frage „ich habe das Modell geändert,
warum ändert sich der Preis nicht?" kann nicht mehr gestellt werden — es gibt kein Modell
mehr zu ändern.

**Warum das trägt und nicht nur verschiebt:** der massgebliche Stundensatz auf dem Beleg ist
schon heute `effortMeta.hourly_rate` (Service-Details je Gruppe) — ServiceTable und
OfferPDFModern lesen ihn zuerst. `offers.hourly_rate` speist ausschliesslich das Kästchen,
das hier ersetzt wird. Auch der Seed einer neuen Zeitschätzung fällt bereits auf
`groupMeta[…].hourlyRate` zurück ([OfferteErstellen.tsx:947-952](../src/pages/firma/OfferteErstellen.tsx#L947-L952)),
läuft also ohne das Kästchen weiter.

### Was das heisst

- `offers.price_model`, `offers.hourly_rate`, `offers.kostendach_max` werden **nicht mehr
  geschrieben**. Die Spalten bleiben stehen: Bestandsofferten tragen dort Werte, und ein
  DROP würde die Historie eines Belegs verändern.
- Alle lesenden Flächen (PDF `mapOfferData`/`ServiceTable`, `OfferteLivePreview`,
  Offerten-Liste) beziehen das Etikett aus der abgeleiteten Funktion.
- `offerPriceModel.ts` (`PriceModel`, `parsePriceModel`) bleibt — als Typ für das **Lesen**
  von Bestandszeilen. Kein Schreibpfad benutzt ihn mehr.
- **Nicht betroffen:** `auftraege.hourly_rate`. Das ist eine eigene Spalte, die das
  Auftragsformular setzt.

### Verworfen

- **(B) Assistent, der Positionen umschreibt.** Behält das gewohnte Bild, verlangt aber für
  jeden Randfall eine Entscheidung: halbe Umwandlung, Rücknahme, gemischte Serviceblöcke,
  ein Pauschalpreis ohne bekannten Stundensatz. Mehr Fläche für genau die Art Abweichung,
  die hier beseitigt wird.
- **(C) Warnschicht.** Lässt beide Wahrheiten stehen und schreibt einen Hinweis daneben.
  Das ist ein Pflaster im Sinne von CLAUDE.md §2 und wurde nur der Vollständigkeit halber
  angeboten.

---

## 3. Entscheidung 2 — die drei Rabattspalten werden entfernt

`offer_items.list_price`, `offer_items.discount_percent`, `offer_items.discount_amount`
(aus `20260701160000_offer_items_rabatt.sql`) werden **gedroppt**.

Geprüft: keine der drei steht in der INSERT-Liste von `replace_offer_items`
([20260708150000](../supabase/migrations/20260708150000_replace_offer_items_amount_basis.sql)).
Da der Speicherpfad `DELETE` + `INSERT` ist, wären sie selbst von Hand gefüllt **bei der
ersten Bearbeitung wieder weg**. `list_price` wird in
[mapOfferData.ts:286](../src/components/pdf/utils/mapOfferData.ts#L286) gelesen und danach
**nirgends gerendert**; die beiden anderen werden weder geschrieben noch gelesen.

Drei Spalten, die garantiert leer bleiben, sind für die nächste Person eine Falle: sie sehen
nach einem Feature aus, das es nicht gibt. Ein positionsbezogener Rabatt ist ein sinnvolles
Vorhaben — er gehört aber mit eigener Gestaltung entworfen, samt der Frage, wie er sich zum
bestehenden `offers.discount_percent` (Offerte-Ebene) und zum Kostendach verhält.

Mit `ROLLBACK_*.sql`. Die tote Lesestelle in `mapOfferData` fällt mit.

---

## 4. Entscheidung 3 — Annahmenachweis ohne IP-Adresse

`offers.agb_ip_address` bleibt leer, und das wird **festgeschrieben** statt weiter
stillschweigend hingenommen.

Der Nachweis einer Annahme besteht aus: dem Zugriffstoken, dem **serverseitigen** Zeitstempel
(`accepted_at`), der AGB-Version samt Hash und dem Versandbeleg in `email_logs`. Für eine
einfache elektronische Signatur nach schweizerischem Recht trägt das.

Eine vom Browser mitgeschickte IP trägt nichts dazu bei — sie ist fälschbar, und genau
deshalb hat `20260416000002` sie aus dem UPDATE genommen. Der Weg über eine eigene Edge
Function, die `x-forwarded-for` liest, wäre technisch möglich, brächte aber eine neue
Fehlerfläche im öffentlichen Annahmepfad und müsste erst beweisen, dass die Proxy-Kette
von Coolify die echte Adresse überhaupt durchreicht.

Umsetzung: `COMMENT ON COLUMN` schreibt die Entscheidung an die Spalte, der irreführende
`new_agb_ip_address`-Parameter verschwindet aus der RPC-Signatur nicht (Aufrufer würden
brechen), bekommt aber einen eindeutigen Kommentar.

---

## 5. Reihenfolge

F1 trägt die Umsetzung von Entscheidung 1 mit, weil beides derselbe Satz ist: *die Position
ist die einzige Wahrheit.* Das Kästchen zu entfernen, ohne den Positionen einen vollständigen
Preistyp-Wechsel zu geben, liesse den Bediener ohne Stellschraube zurück.

| Schritt | Inhalt |
|---|---|
| F1 | Kästchen weg + abgeleitetes Etikett + eine Übergangsfunktion für den Preistyp, in Erstellen **und** Bearbeiten |
| F2 | Speicherpfad-Normalisierung (`quantity`, `unit_price`) in eine Funktion — beide Seiten rufen sie |
| F3 | `kostendach_max` nur bei `amount_basis='rate'` persistieren (+ CHECK als zweite Linie) |
| F4 | Kostendach als echte Schranke vor dem Speichern |
| F5 | `offers.subtotal` — Bedeutung an die Spalte schreiben, Auftrag-Konsumenten korrigieren |
| F6 | Rundung in den GENERATED-Spalten |
| F7 | `rate`-Offerten in KPI und Auftrag nicht als CHF 0 führen |
| F8 | Rabattspalten droppen (Entscheidung 2) |
| F9 | `moebellift` in `metaKindForService`; toter `serviceTerminLabel` fällt mit F10 |
| F10 | Totes `src/components/offerte/PricingSummary.tsx` löschen (an F1 angehängt) |
| F11 | Entscheidung 3 dokumentieren |

Ausdrücklich **nicht** in diesem Paket: die schweizerische 5-Rappen-Rundung
(Barzahlung) und die Überschreitung eines Kostendachs während der Auftragsausführung
(`SahaExtrasModal`).
