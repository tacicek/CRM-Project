# Lagerung Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/lagerung`  
> **Dateien:** `src/components/lagerung/LagerungWizard.tsx` (alles in einer Datei)  
> **Gesamtschritte:** 6  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Formular fragt nach Volumen in m³ — das können die meisten Nutzer nicht einschätzen.

---

## Aktuelle Formular-Struktur (6 Schritte)

---

### Schritt 1 — Lagerungsart

**Titel:** „Welche Lagerung benötigen Sie?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Lagerungsart | Card-Auswahl (6 Cards) | Ja |

**Optionen:**
| Icon | Typ | Beschreibung |
|------|-----|---------|
| 🛋️ | Möbeleinlagerung | — |
| 📦 | Umzugslager | — |
| 💼 | Geschäftslager | — |
| 🗃️ | Archivlager | — |
| 🏭 | Self-Storage | — |
| 🌡️ | Klimatisiert | — |

---

### Schritt 2 — Lagerdetails

**Titel:** „Wie viel Platz und wie lange?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Geschätztes Volumen m³ | Zahl-Eingabe | Ja |
| Lagerdauer | 6 Cards | Ja |
| Startdatum | Datepicker | Ja |
| Versicherung gewünscht | Checkbox | Nein |
| Abhol- und Lieferdienst | Checkbox | Nein |

**Dauer-Optionen:**
- Kurzfristig (< 1 Monat)
- 1–3 Monate
- 3–6 Monate
- 6–12 Monate
- 1+ Jahr
- Unbegrenzt

**Hilfstext:** „1 m³ ≈ 1 grosser Umzugskarton"

---

### Schritt 3 — Abholadresse

**Titel:** „Von wo sollen die Gegenstände abgeholt werden?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe (4-stellig) | Ja |
| Ort | Texteingabe | Ja |
| Was einlagern? | Textarea | Nein |

---

### Schritt 4 — Kontaktdaten

**Titel:** „Kontaktdaten"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Anrede | Buttons | Herr / Frau / Firma |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |

---

### Schritt 5 — Zusätzliche Informationen

**Titel:** „Zusätzliche Informationen"

| Feld | Typ | Details |
|------|-----|---------|
| Bemerkungen | Textarea | Optional |
| Anzahl Offerten | 3 Cards | 1 (Exklusiv) / 3 (Empfohlen) / 5 (Maximum) |

---

### Schritt 6 — Zusammenfassung & AGB

**Titel:** „Zusammenfassung"

Zeigt alle Angaben als Übersicht:
- Lagerungsart
- Volumen m³
- Dauer
- Startdatum
- Adresse
- Kontakt
- Versicherung / Abholdienst (falls gewählt)

| Element | Details |
|---------|---------|
| AGB akzeptieren | Checkbox (Pflicht) |
| Angaben korrekt | Checkbox (Pflicht) |

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **Volumen in m³** — sehr schwer einzuschätzen (auch wenn Hilfstext vorhanden)
2. **Lagerungsart hat 6 Optionen** — „Klimatisiert" ist ein Merkmal, kein Typ
3. **Abholadresse** — nicht immer relevant (manchmal bringen Nutzer selbst)
4. **Schritt 5 nur für Bemerkungen + Offerten** — ineffizient, könnte in Schritt 6 integriert werden

### 💡 Vorschlag für Neugestaltung

- **Ziel: 4 Schritte**
- Schritt 1: Was soll gelagert werden + Typ (vereinfacht)
- Schritt 2: Ungefähre Grösse (nicht m³, sondern visuelle Vergleiche: 1 Zimmer / 2 Zimmer / etc.) + Dauer + Start
- Schritt 3: Adresse + Kontakt
- Schritt 4: Zusammenfassung + AGB

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `lagerung_wizard_data`)
- Submit via Supabase RPC: `submit_lead_json`
- `form_version: 2`, Status: `pending_verification`
- `service_type: "lagerung"`
- Adresse wird als `pickup_street` (nicht `from_street`) gespeichert
