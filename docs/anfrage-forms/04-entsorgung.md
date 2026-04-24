# Entsorgung Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/entsorgung`  
> **Dateien:** `src/components/entsorgung/EntsorgungWizard.tsx` + `src/components/entsorgung/steps/Step1–8.tsx`  
> **Gesamtschritte:** 8  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular hat zu viele Details die ein Nutzer bei der Erstanfrage nicht kennt (z.B. genaues Containervolumen).

---

## Aktuelle Formular-Struktur (8 Schritte)

---

### Schritt 1 — Abfallart / Entsorgungsart

**Titel:** „Was möchten Sie entsorgen?"

| Feld | Typ | Optionen |
|------|-----|---------|
| Entsorgungsart | Card-Auswahl (Pflicht) | Sperrmüll / Elektronik-Schrott / Bauschutt / Gartenabfälle / Altmöbel / Gefahrenstoffe / Gemischter Abfall / Sonstiges |

---

### Schritt 2 — Gegenstände & Menge

**Titel:** „Was genau und wie viel?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Containergrösse | Card-Auswahl | Ja (oder Volumen) |
| Volumen m³ | Zahl-Eingabe | Ja (wenn kein Container gewählt) |
| Spezifische Gegenstände | Checkboxen / Counter | Nein |

**Containergrö­ssen:** 3 m³ / 5 m³ / 7 m³ / 10 m³ / 15 m³ / 20 m³+

---

### Schritt 3 — Adresse

**Titel:** „Von wo soll der Abfall abgeholt werden?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |

---

### Schritt 4 — Zugang & Zugänglichkeit

**Titel:** „Wie gut ist der Zugang?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Stockwerk | Card-Auswahl | Ja |
| Lift vorhanden? | Ja/Nein | Nein |
| Parkplatz-Distanz m | Slider | Nein |

---

### Schritt 5 — Zusatzleistungen

**Titel:** „Optionale Zusatzleistungen"

| Service | Typ | Details |
|---------|-----|---------|
| Vor-Ort-Besichtigung | Toggle | — |
| Container-Aufstellung | Toggle | Dauer in Tagen |
| Sortierung vor Ort | Toggle | — |
| Recycling-Nachweis | Toggle | — |

---

### Schritt 6 — Zeitplanung

**Titel:** „Wann soll die Entsorgung stattfinden?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Wunschdatum | Datepicker | Ja |
| Flexibilität | Cards | Fest / Flexibel |

---

### Schritt 7 — Kontaktdaten

**Titel:** „Ihre Kontaktdaten"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Anrede | Buttons | Nein |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |
| Bevorzugte Kontaktzeit | Dropdown | Nein |

---

### Schritt 8 — Zusammenfassung & AGB

**Titel:** „Zusammenfassung"

| Element | Details |
|---------|---------|
| Übersicht aller Angaben | Mit Bearbeiten-Buttons |
| Anzahl Offerten | 1 / 3 / 5 |
| Bemerkungen | Textarea (optional) |
| AGB akzeptieren | Checkbox (Pflicht) |
| Korrekte Angaben bestätigen | Checkbox (Pflicht) |

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **8 Schritte für eine Entsorgungsanfrage** — zu lang
2. **Containergrösse vs. Volumen m³** — Nutzer kennen weder Container-Grössen noch m³
3. **Zugangsfrage (Schritt 4)** — bei Entsorgung meist nicht relevant (Strassenabholung)
4. **Schritt 5 Zusatzleistungen** — unklar für Laien
5. **Spezifische Gegenstände** — zu detailliert für Erstanfrage

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4 Schritte**
- Schritt 1: Was soll entsorgt werden? (einfache Kategorien)
- Schritt 2: Ungefähre Menge (Klein / Mittel / Gross / Sehr Gross als visuelle Auswahl)
- Schritt 3: Adresse + Wunschdatum
- Schritt 4: Kontakt + AGB

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `entsorgung_wizard_data`)
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "entsorgung"`
