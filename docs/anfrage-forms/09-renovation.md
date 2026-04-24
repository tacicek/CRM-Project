# Renovation Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/renovation`  
> **Dateien:** `src/components/renovation/RenovationWizard.tsx` (alles in einer Datei)  
> **Gesamtschritte:** 6  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular ist übersichtlich aber könnte kompakter sein.

---

## Aktuelle Formular-Struktur (6 Schritte)

---

### Schritt 1 — Renovationsart

**Titel:** „Welche Renovation benötigen Sie?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Renovationsart | Card-Auswahl (9 Cards) | Ja |

**Optionen:**
| Icon | Typ |
|------|-----|
| 🏠 | Komplettrenoovation |
| 🛁 | Bad / Badezimmer |
| 🍳 | Küche |
| 🪵 | Boden (Parkett, Laminat, Fliesen) |
| ⚡ | Elektro |
| 💧 | Sanitär |
| 🚪 | Fenster & Türen |
| 🏢 | Fassade |
| 🏗️ | Dach |

---

### Schritt 2 — Objektdetails

**Titel:** „Das zu renovierende Objekt beschreiben"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Objekttyp | 3 Cards | Ja |
| Fläche m² | Zahl-Eingabe | Ja |
| Zimmeranzahl | Zahl-Eingabe | Nein |
| Beschreibung der Arbeiten | Textarea | Nein |

**Objekttypen:** Wohnung / Haus / Gewerbe

---

### Schritt 3 — Adresse

**Titel:** „Wo soll die Renovation stattfinden?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe (4-stellig) | Ja |
| Ort | Texteingabe | Ja |

---

### Schritt 4 — Zeitplanung

**Titel:** „Wann soll die Renovation beginnen?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Wunschdatum | Datepicker | Ja |
| Flexibilität | 3 Cards | Nein (Standard: Flexibel) |

**Flexibilitäts-Optionen:**
- Fester Termin
- Flexibel (±1 Woche)
- Sehr flexibel

---

### Schritt 5 — Kontaktdaten

**Titel:** „Wie können die Firmen Sie erreichen?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Anrede | Buttons | Herr / Frau / Firma |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |

---

### Schritt 6 — Zusammenfassung & AGB

**Titel:** „Bitte überprüfen Sie Ihre Angaben"

Zeigt alle Angaben als Übersicht:
- Renovationsart (mit Label)
- Objekt (Typ + m²)
- Adresse
- Termin
- Kontakt (Name + E-Mail)

| Element | Details |
|---------|---------|
| Bemerkungen | Textarea (optional) |
| Anzahl Offerten | 3 Cards: 1 / 3 / 5 |
| AGB + Datenschutz akzeptieren | Checkbox (Pflicht) |
| Angaben korrekt bestätigen | Checkbox (Pflicht) |

---

## Bewertung

### ✅ Was gut ist

- 6 Schritte — vernünftig
- Klare, visuelle Kategorienauswahl
- Gute Struktur ähnlich wie Malerarbeit

### ❌ Verbesserungspotenzial

1. **9 Renovationsarten** — „Dach" und „Fassade" sind sehr speziell und selten
2. **Schritt 3 (Adresse) und Schritt 4 (Termin)** könnten kombiniert werden
3. **Beschreibung der Arbeiten** in Schritt 2 — passt besser zur Zusammenfassung
4. **Zimmeranzahl** weniger relevant für Renovation
5. Identische Struktur wie Malerarbeit → könnte man zu einem gemeinsamen „Handwerk"-Formular zusammenfassen

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4 Schritte** (identische Vereinfachung wie Malerarbeit)
- Schritt 1: Renovationsart (vereinfacht auf Top 6)
- Schritt 2: Objekttyp + Fläche + Adresse
- Schritt 3: Termin + Beschreibung
- Schritt 4: Kontakt + AGB + Zusammenfassung

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `renovation_wizard_data`)
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "renovation"`
- Labels via `getRenovationsArtLabel(type)` Funktion aus `src/types/renovation.ts`
