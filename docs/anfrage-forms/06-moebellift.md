# Möbellift Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/moebellift`  
> **Dateien:** `src/components/moebellift/MoebelliftWizard.tsx` + `src/components/moebellift/steps/Step1–7.tsx`  
> **Gesamtschritte:** 7  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Zu viele Schritte und zu viele technische Details die der Nutzer nicht kennt.

---

## Aktuelle Formular-Struktur (7 Schritte)

---

### Schritt 1 — Zweck & Dienstleistung

**Titel:** „Möbellift mieten"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Zweck | Card-Auswahl | Ja |
| Dienstleistungsart | Card-Auswahl | Ja |
| Richtung | Card-Auswahl | Ja |

**Zweck-Optionen:**
- Umzug (Wohnungsumzug)
- Einzelstück (grosses Möbelstück)
- Baumaterial (Lieferung auf Stockwerk)
- Handwerker (Werkzeug/Maschinen)
- Entsorgung (Sperrmüll/Möbel)
- Sonstiges

**Dienstleistungsarten:**
- Nur Möbellift mieten
- Mit Bedienungsperson
- Mit Trageservice

**Richtung:**
- Hochheben (rauf)
- Absenken (runter)
- Beides

---

### Schritt 2 — Standort & Adresse

**Titel:** „Einsatzort des Möbellifts"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Ja |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |
| Stockwerk | Card-Auswahl | Ja |
| Zugangsmöglichkeit | Card-Auswahl | Ja |

**Stockwerke:** EG / 1. OG / 2. OG / 3. OG / 4. OG / 5. OG / 6.+ OG / Dach

**Zugang-Optionen:**
- Strasse direkt
- Hof/Innenhof
- Tiefgarage
- Sonstiges

---

### Schritt 3 — Gegebenheiten vor Ort

**Titel:** „Platzverhältnisse und Parken"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Aufstellfläche für Lift | Card-Auswahl | Ja |
| Parkplatzsituation | Card-Auswahl | Ja |
| Besondere Hindernisse | Textarea | Nein |

**Aufstellfläche-Optionen:**
- Bürgersteig frei
- Strasse (Halteverbot beantragen)
- Hof vorhanden
- Sehr eingeschränkt

**Parkplatz-Optionen:**
- Ausreichend direkt vor Ort
- Begrenzt (ca. 20–50 m)
- Weit entfernt (50+ m)

---

### Schritt 4 — Transportgüter

**Titel:** „Was soll transportiert werden?"

Inhalte je nach Zweck (Schritt 1):

**Bei Umzug:**
| Feld | Typ | Pflicht |
|------|-----|---------|
| Wohnungsgrösse | Card-Auswahl | Ja |

**Bei Einzelstück:**
| Feld | Typ | Pflicht |
|------|-----|---------|
| Typ des Einzelstücks | Card-Auswahl | Ja |

**Einzelstück-Typen:** Sofa / Schrank / Klavier / Tresor / Kühlschrank / Waschmaschine / Bett / Sonstiges

**Bei Baumaterial:**
| Feld | Typ | Pflicht |
|------|-----|---------|
| Art des Baumaterials | Card-Auswahl | Ja |

**Bei anderen Zwecken:** Freitext-Beschreibung (optional)

---

### Schritt 5 — Terminplanung

**Titel:** „Wann wird der Möbellift benötigt?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Wunschdatum | Datepicker | Ja |
| Geschätzte Dauer | Card-Auswahl | Ja |

**Dauer-Optionen:**
- Bis 2 Stunden
- 2–4 Stunden
- 4–8 Stunden (ganzer Tag)
- Mehrere Tage

---

### Schritt 6 — Zusatzleistungen & Kontakt

**Titel:** „Zusatzleistungen und Kontaktdaten"

| Feld / Service | Typ | Details |
|----------------|-----|---------|
| Halteverbotsschild beantragen | Toggle | — |
| Treppenhaus-Schutz | Toggle | — |
| Anrede | Buttons | Herr / Frau / Firma |
| Vorname | Texteingabe | Pflicht |
| Nachname | Texteingabe | Pflicht |
| E-Mail | E-Mail-Eingabe | Pflicht |
| Telefon | Tel-Eingabe | Pflicht |
| Bemerkungen | Textarea | Optional |

---

### Schritt 7 — Zusammenfassung & AGB

**Titel:** „Zusammenfassung"

| Element | Details |
|---------|---------|
| Übersicht aller Angaben | — |
| Anzahl Offerten | 1 / 3 / 5 |
| AGB akzeptieren | Checkbox (Pflicht) |
| Aufstellfläche bestätigen | Checkbox (Pflicht) |
| Berechtigung bestätigen | Checkbox (Pflicht) |

**Preis-Schätzung:** Wird automatisch berechnet und angezeigt (via `estimatePrice()`)

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **Gegebenheiten vor Ort (Schritt 3)** — zu detailliert
2. **Aufstellfläche und Parkplatzsituation** — Nutzer wissen das selten im Voraus
3. **3 Bestätigungs-Checkboxen** — zu viele
4. **Zweck + Dienstleistungsart + Richtung** alles in Schritt 1 — zu viel auf einmal

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4 Schritte**
- Schritt 1: Zweck + Was soll transportiert werden
- Schritt 2: Adresse + Stockwerk + Zugang (vereinfacht)
- Schritt 3: Termin + optionale Zusatzleistungen
- Schritt 4: Kontakt + AGB

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `moebellift_form_data`)
- Preis-Schätzung via `estimatePrice(formData)` Funktion
- Lift-Empfehlung via `recommendLiftType(formData)` Funktion
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "moebellift"`
