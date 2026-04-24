# Umzug Anfrage-Formular — Bestandsaufnahme

> **Route:** `/anfrage/umzug`  
> **Dateien:** `src/components/umzug/UmzugWizard.tsx` + `src/components/umzug/steps/Step1–17.tsx`  
> **Gesamtschritte:** 17  
> **Status:** Zu überarbeiten

---

## Problem (Kundenfeedback)

Das Formular ist zu kompliziert und zu aufwändig für den Nutzer. Ziel ist eine drastische Vereinfachung.

---

## Aktuelle Formular-Struktur (17 Schritte)

---

### Schritt 1 — Art des Umzugs & Unterkunft

**Titel:** „Erhalten Sie mit wenigen Klicks Angebote — in weniger als 24 Stunden"

| Feld | Typ | Optionen |
|------|-----|---------|
| Art des Umzugs | 2 Cards (Pflicht) | Privatumzug / Firmenumzug |
| Art der aktuellen Unterkunft | Card-Auswahl (Pflicht) | Wohnung / Haus / WG-Zimmer / Lager / Büro |

**Logik:** Je nach Unterkunftstyp werden spätere Schritte angepasst.

---

### Schritt 2 — Grösse der aktuellen Unterkunft

**Titel:** „Grösse der aktuellen Unterkunft"

| Feld | Typ | Details |
|------|-----|---------|
| Anzahl Zimmer | Slider mit Dots | 1 bis 6 (halbe Zimmer: 1, 1.5, 2, 2.5 ... 6) |
| Wohnfläche m² | Counter + Quick-Buttons | Min: 10, Max: 500, Schritt: 5. Quick: 30/50/70/100/150/200 m² |
| Anzahl Etagen | Counter | Nur bei **Haus**: Min 1, Max 5 |
| Zusätzliche Bereiche | Checkboxen | Nur bei **Haus**: Garage / Garten / Keller / Estrich |
| Lagergrösse m³ | Counter | Nur bei **Lager**: Min 1, Max 100 |
| Regale vorhanden | Checkbox | Nur bei **Lager** |
| Anzahl Arbeitsplätze | Counter | Nur bei **Büro**: Min 1, Max 100 |
| Server/IT-Equipment | Checkbox | Nur bei **Büro** |
| Wochenend-Umzug | Checkbox | Nur bei **Büro** |

---

### Schritt 3 — Adresse der aktuellen Unterkunft

**Titel:** „Von wo wird der Umzug stattfinden?"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |

---

### Schritt 4 — Stockwerk (Aktuelle Unterkunft)

**Titel:** „Stockwerk, wo sich die Wohnung befindet"

> Wird **übersprungen** bei: Haus, Lager

| Feld | Typ | Optionen |
|------|-----|---------|
| Stockwerk | Card-Auswahl | Untergeschoss / Erdgeschoss / Hochparterre / 1. OG / 2. OG / 3. OG / 4. OG / 5.+ OG |

Kontextueller Hinweis je nach gewähltem Stockwerk (z.B. Möbellift-Empfehlung ab 5. OG).

---

### Schritt 5 — Liftinformationen (Aktuelle Unterkunft)

**Titel:** „Liftinformationen"

> Wird **übersprungen** bei: Haus

| Feld | Typ | Pflicht |
|------|-----|---------|
| Lift vorhanden? | Ja / Nein Button | Nein |
| Lifttyp | Card-Auswahl (nur wenn Ja) | Kleiner Lift / Grosser Lift / Lastenaufzug |

---

### Schritt 6 — Parkplatz & Zugang (Aktuelle Unterkunft)

**Titel:** „Distanz zwischen Parkplatz und Gebäudeeingang"

| Feld | Typ | Details |
|------|-----|---------|
| Distanz in Meter | Slider | 0–200 m |
| Stufen bis zum Eingang | 4 Cards | 0–10 / 11–30 / 31–50 / 51+ Stufen |
| Weg beeinträchtigt? | Checkbox | z.B. enger Weg, keine Geländer, steile Auffahrt |
| Beschreibung Beeinträchtigung | Textarea | Nur wenn Checkbox aktiv |

---

### Schritt 7 — Übergang zur neuen Unterkunft

**Titel:** „Weiter geht's! — Kommen wir nun zu Ihrem neuen Zuhause"

| Feld | Typ | Optionen |
|------|-----|---------|
| Art der neuen Unterkunft | Card-Auswahl | Wohnung / Haus / WG-Zimmer / Lager / Büro |

Zeigt Bestätigungsmeldung dass Auszugsinfos erfasst wurden.

---

### Schritt 8 — Grösse der neuen Unterkunft

**Titel:** „Grösse der neuen Unterkunft"

Identisch mit **Schritt 2**, aber für die neue Adresse.

| Feld | Typ | Details |
|------|-----|---------|
| Anzahl Zimmer | Slider mit Dots | 1 bis 6 |
| Wohnfläche m² | Counter + Quick-Buttons | Quick: 30/50/70/100/150/200 m² |
| Anzahl Etagen | Counter | Nur bei **Haus** |
| Zusätzliche Bereiche | Checkboxen | Nur bei **Haus**: Garage / Garten / Keller / Estrich |

---

### Schritt 9 — Adresse der neuen Unterkunft

**Titel:** „Wohin sollen wir Ihre Sachen bringen?"

Identisch mit **Schritt 3**, aber für die neue Adresse.

| Feld | Typ | Pflicht |
|------|-----|---------|
| Strasse | Texteingabe | Ja |
| Hausnummer | Texteingabe | Nein |
| PLZ | Texteingabe | Ja |
| Ort | Texteingabe | Ja |

---

### Schritt 10 — Stockwerk (Neue Unterkunft)

**Titel:** „Stockwerk, wo sich die neue Wohnung befindet"

> Wird **übersprungen** bei: Haus, Lager

Identisch mit **Schritt 4**, aber für die neue Adresse.

---

### Schritt 11 — Liftinformationen (Neue Unterkunft)

**Titel:** „Liftinformationen — Neue Adresse"

> Wird **übersprungen** bei: Haus

Identisch mit **Schritt 5**, aber für die neue Adresse.

---

### Schritt 12 — Parkplatz & Zugang (Neue Unterkunft)

**Titel:** „Distanz zwischen Parkplatz und Gebäudeeingang — Neue Adresse"

Identisch mit **Schritt 6**, aber für die neue Adresse.

---

### Schritt 13 — Umzugsdatum & Details

**Titel:** „Wann soll der Umzug stattfinden?"

| Feld | Typ | Details |
|------|-----|---------|
| Umzugsdatum | Kalender (Datepicker) | Frühestes Datum: heute +2 Tage, spätestes: +365 Tage |
| Flexibilität | 4 Cards | Festes Datum / ±3 Tage / ±1 Woche / ±2 Wochen |
| Gewünschte Startzeit | Button-Gruppe | 07:00 / 08:00 / 09:00 / 10:00 / 11:00 / 12:00 / Flexibel |

---

### Schritt 14 — Inventar

**Titel:** „Was wird transportiert? (Optional)"

| Feld | Typ | Details |
|------|-----|---------|
| Möbel nach Kategorie | Counter pro Item | Kategorien: Wohnzimmer, Schlafzimmer, Küche, etc. |
| Kartons | Auto-berechnet | aus Inventar |
| Schwere/Spezielle Gegenstände | Aufklappbar, Counter | Klavier, Tresor, Aquarium, etc. (mit CHF-Aufpreis) |

**Zusammenfassung oben:** Live-Zähler für Möbelstücke / Kartons / Spezial-Gegenstände

---

### Schritt 15 — Zusätzliche Dienstleistungen

**Titel:** „Optionale Services für einen sorgenfreien Umzug"

| Service | Typ | Details |
|---------|-----|---------|
| Verpackungsservice | Toggle + Unteroptionen | Alles verpacken / Nur Fragiles |
| Auspackservice | Toggle | — |
| Möbelmontage/-demontage | Toggle | — |
| Entsorgung | Toggle + Counter | Volumen in m³ |
| Endreinigung | Toggle | Hinweis: separates Reinigungsformular |
| Zwischenlagerung | Toggle + Counter | Dauer in Wochen (1–52) |
| Möbellift | Toggle + Optionen | Auszug / Einzug / Beide |

---

### Schritt 16 — Kontaktdaten

**Titel:** „Damit die Umzugsfirmen Sie erreichen können"

| Feld | Typ | Pflicht |
|------|-----|---------|
| Anrede | 3 Buttons | Herr / Frau / Divers | Ja |
| Vorname | Texteingabe | Ja |
| Nachname | Texteingabe | Ja |
| E-Mail | E-Mail-Eingabe | Ja |
| Telefon | Tel-Eingabe | Ja |
| Bevorzugte Kontaktzeit | Dropdown | Jederzeit / Vormittags (08–12) / Nachmittags (12–17) / Abends (17–20) |

---

### Schritt 17 — Zusammenfassung & Absenden

**Titel:** „Prüfen Sie Ihre Angaben und senden Sie die Anfrage ab"

Zeigt alle Angaben als Karten mit Bearbeiten-Button:
- Auszugsadresse (Bearbeiten → Schritt 1)
- Einzugsadresse (Bearbeiten → Schritt 7)
- Umzugstermin (Bearbeiten → Schritt 13)
- Inventar (Bearbeiten → Schritt 14)
- Zusatzleistungen (Bearbeiten → Schritt 15)
- Kontaktdaten (Bearbeiten → Schritt 16)

| Feld | Typ | Details |
|------|-----|---------|
| Anzahl Offerten | Selector | 1 / 3 / 5 Angebote |
| Zusätzliche Bemerkungen | Textarea | Optional |
| AGB akzeptieren | Checkbox | Pflicht vor Absenden |

---

## Probleme & Verbesserungspotenzial

### ❌ Hauptprobleme

1. **17 Schritte ist viel zu lang** — Nutzer brechen ab
2. **Schritt 4–6 und 10–12 sind fast identisch** — Parkplatz/Stockwerk/Lift wird 2x gefragt (einmal für Auszug, einmal für Einzug)
3. **Schritt 7 ist ein leerer Übergangsschritt** — unnötig
4. **Inventar (Schritt 14) ist überkomplex** — viele Nutzer kennen ihre Möbelanzahl nicht genau
5. **Parkplatz-Details (Stufen, Meter)** — zu detailliert für Erstanfrage
6. **Lifttyp-Auswahl** — „Kleiner Lift / Grosser Lift / Lastenaufzug" kennt der Durchschnittsnutzer nicht

### 💡 Vorschläge für Neugestaltung

- **Ziel: 5–7 Schritte** statt 17
- Auszug + Einzug auf einer Seite (2 Adressfelder)
- Stockwerk + Lift zusammen in einem Schritt
- Parkplatz-Info weglassen oder als optionales Feld
- Inventar vereinfachen: nur grobe Auswahl (Klein / Mittel / Gross / Sehr gross)
- Spezielle Gegenstände als einfache Ja/Nein-Frage

---

## Neue Struktur (Vorschlag)

| # | Schritt | Felder |
|---|---------|--------|
| 1 | Art des Umzugs | Privat/Firma + Unterkunftstyp |
| 2 | Adressen | Von-Adresse + Nach-Adresse |
| 3 | Details Auszug | Zimmer, m², Stockwerk, Lift |
| 4 | Details Einzug | Zimmer, m², Stockwerk, Lift |
| 5 | Termin & Umfang | Datum, Inventargrösse grob, Zusatzleistungen |
| 6 | Kontakt | Name, E-Mail, Telefon |
| 7 | Zusammenfassung | Übersicht + AGB |

---

## Technische Hinweise

- Daten gespeichert in `localStorage` (Key: `umzug_wizard_data`)
- Submit via Supabase RPC: `submit_lead_json`
- Lead-Matching via Edge Function: `match-lead`
- reCAPTCHA Verifikation via Edge Function: `verify-recaptcha`
- Felder gespeichert als `detailed_form_data` (JSONB) in `leads`-Tabelle
- `form_version: 2` für Umzug-Wizard-Daten
