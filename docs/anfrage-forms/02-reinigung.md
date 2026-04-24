# Reinigung Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/reinigung`  
> **Dateien:** `src/components/reinigung/ReinigungWizard.tsx` + `src/components/reinigung/steps/Step1–8.tsx`  
> **Gesamtschritte:** 8  
> **Service-Typen (via URL-Parameter):** `uebergabereinigung`, `grundreinigung`, `unterhaltsreinigung`  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular ist zu komplex und zu lang für einfache Reinigungsanfragen.

---

## Aktuelle Formular-Struktur (8 Schritte)

---

### Schritt 1 — Unterkunft & Grösse

**Titel:** „Art und Grösse der Unterkunft"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Service-Typ | Vorab gewählt via URL | — |
| Art der Unterkunft | Card-Auswahl | Ja |
| Anzahl Zimmer | Slider / Eingabe | Nur bei Wohnung/Haus |
| Wohnfläche m² | Zahl-Eingabe | Ja (min 10, max 1000) |

**Unterkunftstypen:** Wohnung / Haus / WG-Zimmer / Büro / Gewerbe

**Validierung:**
- Unterkunftsart Pflicht
- Wohnfläche Pflicht (10–1000 m²)
- Zimmer-Anzahl Pflicht bei Wohnung/Haus

---

### Schritt 2 — Zusätzliche Räume

**Titel:** „Welche Zusatzräume gibt es?"

| Feld | Typ | Details |
|------|-----|---------|
| Keller | Checkbox | Ja/Nein |
| Dachboden | Checkbox | Ja/Nein |
| Garage | Checkbox | Ja/Nein |
| Wintergarten | Checkbox | Ja/Nein |
| Balkon | Toggle + Fläche m² | Wenn aktiv → Fläche in m² Pflicht |

---

### Schritt 3 — Besonderheiten

**Titel:** „Besondere Eigenschaften der Unterkunft"

| Feld | Typ | Details |
|------|-----|---------|
| Keine Besonderheiten | Checkbox | Wenn aktiv → Rest deaktiviert |
| Einbauschränke | Checkbox | — |
| Stark verschmutzte Küche | Checkbox | — |
| Waschturm | Checkbox | — |
| Haustierhaltung | Checkbox | — |
| Möbel vorhanden | Checkbox | — |

---

### Schritt 4 — Badezimmer

**Titel:** „Informationen zu den Badezimmern"

| Feld | Typ | Details |
|------|-----|---------|
| Duschen / Badewannen | Counter | Min 0 |
| Toiletten | Counter | Min 0 |
| Lavabos | Counter | Min 0 |

---

### Schritt 5 — Fenster

**Titel:** „Fensterreinigung"

| Feld | Typ | Details |
|------|-----|---------|
| Normale Fenster | Counter | Anzahl |
| Fensterwände (Glasfronten) | Counter | Anzahl |
| Fenstertüren | Counter | Anzahl |

---

### Schritt 6 — Storen & Rollläden

**Titel:** „Storen und Rollläden"

| Feld | Typ | Details |
|------|-----|---------|
| Lamellenstoren | Counter | Anzahl |
| Rollläden | Counter | Anzahl |
| Fensterläden | Counter | Anzahl |

---

### Schritt 7 — Zusatzleistungen

**Titel:** „Optionale Zusatzleistungen"

| Service | Typ | Details |
|---------|-----|---------|
| Hochdruckreinigung | Toggle | — |
| Kaminreinigung | Toggle | — |
| Teppichreinigung | Toggle + Counter | Anzahl Räume (Pflicht wenn aktiv) |
| Fugenreinigung | Toggle | — |

---

### Schritt 8 — Kontakt & Termin

**Titel:** „Kontaktdaten und Termin"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Ja |
| PLZ | Texteingabe (4-stellig) | Ja |
| Ort | Texteingabe | Ja |
| Wunschdatum | Datepicker | Nur wenn Termin „Fest" |
| Flexibilität | Radio | Fest / Flexibel |
| Bemerkungen | Textarea | Nein |
| Anzahl Offerten | Selector | 1 / 3 / 5 |

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **Fenster (Schritt 5) und Storen (Schritt 6) sind eigene Schritte** — diese könnte man zusammenfassen
2. **Storen** — die meisten Nutzer wissen nicht ob sie „Lamellenstoren" oder „Rollläden" haben
3. **Badezimmer** werden extra gezählt — könnte vereinfacht werden
4. **Besonderheiten als Checkboxen** — unklar für einfache Nutzer
5. **Kontakt + Adresse + Termin alles in Schritt 8** — zu viel auf einmal

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4–5 Schritte**
- Schritt 1: Unterkunftstyp + Fläche + Zimmer
- Schritt 2: Räume + Badezimmer zusammen
- Schritt 3: Fenster + Storen zusammen (vereinfacht)
- Schritt 4: Termin + Kontakt

---

## Technische Hinweise

- Service-Type wird via URL-Parameter vorgewählt: `?type=uebergabereinigung`
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type` gemappt: `uebergabereinigung` → `reinigung_end`, `grundreinigung` → `reinigung_grund`
