# Malerarbeit Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/malerarbeiten`  
> **Dateien:** `src/components/malerarbeit/MalerarbeitWizard.tsx` (alles in einer Datei)  
> **Gesamtschritte:** 6  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular ist gut strukturiert aber könnte kürzer sein.

---

## Aktuelle Formular-Struktur (6 Schritte)

---

### Schritt 1 — Art der Malerarbeit

**Titel:** „Welche Malerarbeit benötigen Sie?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Malerarbeit-Art | Card-Auswahl (7 Cards) | Ja |

**Optionen:**
| Icon | Typ |
|------|-----|
| 🪣 | Innenanstrich |
| ☀️ | Aussenanstrich |
| ⬜ | Tapezieren |
| 🖌️ | Lackieren |
| 🏢 | Fassade |
| 💧 | Spachteln |
| 🎨 | Dekorativ |

---

### Schritt 2 — Objektdetails

**Titel:** „Objektdetails"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Objekttyp | 3 Cards | Ja |
| Fläche m² | Zahl-Eingabe | Ja |
| Zimmeranzahl | Zahl-Eingabe | Nein |
| Beschreibung | Textarea | Nein |
| Farbe vorhanden? | Checkbox | Nein |

**Objekttypen:** Wohnung / Haus / Gewerbe

---

### Schritt 3 — Adresse

**Titel:** „Adresse"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe (4-stellig) | Ja |
| Ort | Texteingabe | Ja |

---

### Schritt 4 — Zeitplanung

**Titel:** „Zeitplanung"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Wunschdatum | Datepicker | Ja |
| Flexibilität | 3 Cards | Nein (Standard: Flexibel) |

**Flexibilitäts-Optionen:**
- Fester Termin
- Flexibel
- Sehr flexibel

---

### Schritt 5 — Kontaktdaten

**Titel:** „Kontaktdaten"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Anrede | Buttons | Herr / Frau / Firma |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |

---

### Schritt 6 — Zusammenfassung & AGB

**Titel:** „Zusammenfassung"

Zeigt alle Angaben als Übersicht:
- Art der Malerarbeit
- Objekt (Typ + m²)
- Adresse
- Termin
- Kontakt

| Element | Details |
|---------|---------|
| Bemerkungen | Textarea (optional) |
| Anzahl Offerten | 3 Cards: 1 / 3 / 5 |
| AGB akzeptieren | Checkbox (Pflicht) |
| Angaben korrekt | Checkbox (Pflicht) |

---

## Bewertung

### ✅ Was gut ist

- 6 Schritte — überschaubar
- Klare Kategorien
- Flüssige Struktur

### ❌ Verbesserungspotenzial

1. **Malerarbeit-Art hat 7 Optionen** — „Spachteln" und „Dekorativ" sind sehr selten und verwirren
2. **Beschreibungsfeld in Schritt 2** — gehört eher zur Zusammenfassung
3. **Zimmeranzahl** bei Malerarbeit weniger relevant als bei Umzug
4. **Schritt 3 (Adresse) und Schritt 4 (Termin)** könnten kombiniert werden

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4 Schritte**
- Schritt 1: Art der Malerarbeit (vereinfacht, Top 5)
- Schritt 2: Objekttyp + Fläche + Adresse
- Schritt 3: Termin + Zusatzinfo
- Schritt 4: Kontakt + AGB + Zusammenfassung

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `malerarbeit_wizard_data`)
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "malerarbeit"`
