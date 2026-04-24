# Klaviertransport Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/klaviertransport`  
> **Dateien:** `src/components/klaviertransport/KlaviertransportWizard.tsx` + `src/components/klaviertransport/steps/Step1–8.tsx`  
> **Gesamtschritte:** 7 (ohne Lieferort) oder 8 (mit Lieferort, nur bei Transport)  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular fragt zu viele technische Details die der Nutzer nicht kennt.

---

## Aktuelle Formular-Struktur (7–8 Schritte)

---

### Schritt 1 — Dienstleistung & Instrument

**Titel:** „Klaviertransport Anfrage"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Dienstleistungsart | Card-Auswahl | Ja |
| Instrumententyp | Card-Auswahl | Ja |

**Dienstleistungsarten:**
- Transport (von A nach B)
- Lagerung (einlagern)
- Entsorgung (entsorgen)
- Interne Verschiebung (im selben Gebäude)

**Instrumententypen:**
- Klavier (aufrecht)
- Flügel (klein)
- Flügel (gross/Konzert)
- Keyboard / Digitalpiano
- Orgel
- Sonstiges Tasteninstrument

**Logik:** Bei Dienstleistung ≠ „Transport" → Schritt 4 (Lieferort) wird übersprungen

---

### Schritt 2 — Instrument Details

**Titel:** „Details zum Instrument"

| Feld | Typ | Details |
|------|-----|---------|
| Marke / Hersteller | Texteingabe | Optional |
| Ungefähres Gewicht kg | Zahl-Eingabe | Optional |
| Masse (H × B × T) | Texteingaben | Optional |
| Besondere Merkmale | Textarea | Optional |

> Alle Felder in diesem Schritt sind **optional**

---

### Schritt 3 — Abholadresse

**Titel:** „Abholadresse"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Ja |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |
| Stockwerk | Card-Auswahl | Nein |
| Lift vorhanden? | Ja/Nein | Nein |
| Lifttyp | Auswahl (wenn Ja) | Nein |

---

### Schritt 4 — Lieferadresse *(nur bei Transport)*

**Titel:** „Lieferadresse"

> Wird **übersprungen** bei: Lagerung, Entsorgung, Interne Verschiebung

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Ja |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |
| Stockwerk | Card-Auswahl | Nein |
| Lift vorhanden? | Ja/Nein | Nein |

---

### Schritt 5 — Besondere Anforderungen

**Titel:** „Besondere Anforderungen"

| Feld | Typ | Details |
|------|-----|---------|
| Treppenhaus-Typ | Card-Auswahl | Gerade / Gewendelt / Wendeltreppe |
| Treppenhaus-Breite cm | Zahl-Eingabe | Optional |
| Fensterzugang möglich? | Ja/Nein | Nein |
| Sonstige Besonderheiten | Textarea | Optional |

> Alle Felder **optional**

---

### Schritt 6 — Zusatzleistungen

**Titel:** „Zusätzliche Dienstleistungen"

| Service | Typ | Details |
|---------|-----|---------|
| Stimmung nach Transport | Toggle | — |
| Temporäre Lagerung | Toggle + Dauer | Wochen |
| Versicherung | Toggle | — |
| Montage/Demontage (Beine) | Toggle | — |

---

### Schritt 7 — Termin & Kontakt

**Titel:** „Termin und Kontaktdaten"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Wunschdatum | Datepicker | Ja |
| Flexibilität | Cards | Fest / ±3 Tage / ±1 Woche / Flexibel |
| Anrede | Buttons | Nein |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |
| Bevorzugte Kontaktzeit | Dropdown | Nein |
| Bemerkungen | Textarea | Nein |

---

### Schritt 8 — Zusammenfassung & AGB

**Titel:** „Zusammenfassung und Bestätigung"

| Element | Details |
|---------|---------|
| Übersicht aller Angaben | — |
| Anzahl Offerten | 1 / 3 / 5 |
| AGB akzeptieren | Checkbox (Pflicht) |
| Transportfähigkeit bestätigen | Checkbox (Pflicht) — Instrument ist transportfähig |
| Berechtigung bestätigen | Checkbox (Pflicht) — Ich bin berechtigt |

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **Instrument Details (Schritt 2)** — Nutzer kennen Gewicht und Masse selten
2. **Treppenhaustyp (Schritt 5)** — technisch, für Laien unbekannt
3. **Breite des Treppenhauses in cm** — niemand misst das vorher
4. **Lifttyp** — unklar für Durchschnittsnutzer
5. **3 separate Bestätigungs-Checkboxen in Schritt 8** — zu viel

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4–5 Schritte**
- Schritt 1: Dienstleistung + Instrument-Typ
- Schritt 2: Von-Adresse + Stockwerk + Lift (Ja/Nein) — vereinfacht
- Schritt 3: Nach-Adresse (nur bei Transport)
- Schritt 4: Termin + Besonderheiten (als freies Textfeld)
- Schritt 5: Kontakt + AGB

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `klaviertransport_form_data`)
- Bei Dienstleistung ≠ `transport`: Schritt 4 wird übersprungen → `totalSteps = 7`
- Bei `transport`: `totalSteps = 8`
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "klaviertransport"`
