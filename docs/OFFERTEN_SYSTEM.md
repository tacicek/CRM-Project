# Offerten-System

## Uebersicht

Das Offerten-System ermoeglicht es Partnerfirmen, professionelle Angebote zu erstellen, zu versenden und deren Status zu verfolgen. Kunden koennen Offerten online einsehen, annehmen oder ablehnen.

---

## Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Lead      │ ──► │  Offerte         │ ──► │  E-Mail an      │ ──► │  Kunden-         │
│   annehmen  │     │  erstellen       │     │  Kunden         │     │  Entscheidung    │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

---

## Offerte erstellen

### 1. Ausgangspunkt
- Navigieren zu "Anfragen" im Firma-Dashboard
- Lead auswählen und annehmen
- Button "Offerte erstellen" klicken

### 2. Grunddaten

| Feld | Beschreibung |
|------|--------------|
| Titel | Bezeichnung der Offerte (z.B. "Umzug Zuerich-Bern") |
| Beschreibung | Detaillierte Leistungsbeschreibung |
| Servicedatum | Geplantes Ausfuehrungsdatum |
| Gueltig bis | Ablaufdatum der Offerte |

### 3. Positionen hinzufuegen

Jede Position enthält:
- **Beschreibung:** Was wird geliefert/geleistet
- **Menge:** Anzahl der Einheiten
- **Einheit:** Stueck, Stunden, Pauschale, etc.
- **Einzelpreis:** Preis pro Einheit
- **Total:** Automatisch berechnet

#### Beispiel-Positionen
```
| Beschreibung              | Menge | Einheit | Einzelpreis | Total    |
|---------------------------|-------|---------|-------------|----------|
| Umzugsteam (2 Personen)   | 8     | Std     | CHF 120.00  | CHF 960  |
| LKW 3.5t inkl. Diesel     | 1     | Pausch. | CHF 250.00  | CHF 250  |
| Verpackungsmaterial       | 1     | Set     | CHF 80.00   | CHF 80   |
```

### 4. Leistungsuebersicht

Die Leistungsuebersicht definiert, was **inklusive** und was **nicht inklusive** ist:

#### Inklusiv-Leistungen
- Aus dem Leistungskatalog auswählen
- Benutzerdefinierte Leistungen hinzufuegen
- Reihenfolge per Drag & Drop anpassen

#### Exklusiv-Leistungen
- Klar kommunizieren, was NICHT enthalten ist
- Verhindert Missverständnisse

#### Besondere Hinweise
- Freitext fuer spezielle Bedingungen
- Erscheint prominent in der Offerte

### 5. MwSt. und Totale

```
Zwischensumme:    CHF 1'290.00
+ MwSt. (8.1%):   CHF   104.49
─────────────────────────────
Gesamttotal:      CHF 1'394.49
```

---

## Offerte versenden

### Versand-Optionen

1. **Per E-Mail:** 
   - Automatische E-Mail mit Link zur Online-Ansicht
   - Kunde kann direkt annehmen/ablehnen

2. **Als PDF:**
   - PDF-Download fuer manuellen Versand
   - Professionelles Layout mit Firmenlogo

### E-Mail-Inhalt
- Persoenliche Anrede
- Link zur Online-Offerte
- Gueltigkeitsdatum
- Kontaktdaten der Firma

---

## Offerten-Status

| Status | Beschreibung | Farbe |
|--------|--------------|-------|
| `draft` | Entwurf - noch nicht versendet | Grau |
| `sent` | Versendet - wartet auf Antwort | Blau |
| `viewed` | Kunde hat Offerte geoeffnet | Gelb |
| `accepted` | Kunde hat angenommen | Gruen |
| `rejected` | Kunde hat abgelehnt | Rot |

### Status-Uebergänge
```
draft ──► sent ──► viewed ──► accepted
                         └──► rejected
```

---

## Kundenansicht

### Online-Offerte
- Oeffentlich zugänglich via einzigartigem Token
- Responsive Design fuer alle Geräte
- Keine Anmeldung erforderlich

### Kunden-Aktionen
1. **Offerte ansehen:** Alle Details und Positionen
2. **PDF herunterladen:** Fuer eigene Unterlagen
3. **Annehmen:** Mit optionalem Kommentar
4. **Ablehnen:** Mit optionalem Ablehnungsgrund

### AGB-Akzeptanz
- Bei Annahme muessen AGB akzeptiert werden
- Zeitstempel und IP werden gespeichert
- Rechtlich verbindlich

---

## Benachrichtigungen

### Fuer Firmen
- **Offerte angesehen:** Kunde hat Link geoeffnet
- **Offerte angenommen:** Auftrag bestätigt!
- **Offerte abgelehnt:** Mit Ablehnungsgrund

### Fuer Kunden
- **Offerte erhalten:** E-Mail mit Link
- **Erinnerung:** Bei baldiger Ablauf (optional)

---

## PDF-Generierung

### Inhalt
1. **Kopfbereich:** Firmenlogo, Addressse, Kontakt
2. **Kundenadresse:** Name und Anschrift
3. **Offerten-Details:** Nummer, Datum, Gueltigkeit
4. **Positionen:** Tabellarische Auflistung
5. **Leistungsuebersicht:** Inklusiv/Exklusiv
6. **Totale:** Zwischensumme, MwSt., Gesamt
7. **Fussbereich:** Zahlungsbedingungen, Unterschrift

### Anpassungen
- Firmenlogo wird automatisch eingefuegt
- Primärfarbe der Firma wird verwendet
- AGB koennen angehängt werden

---

## Datenbank-Struktur

### offers-Tabelle
```sql
id                    -- UUID der Offerte
company_id            -- Zugehoerige Firma
lead_id               -- Urspruenglicher Lead
access_token          -- Einzigartiger Zugangs-Token
status                -- draft, sent, viewed, accepted, rejected
title                 -- Offerten-Titel
description           -- Beschreibung
customer_*            -- Kundendaten
subtotal              -- Zwischensumme
vat_rate              -- MwSt.-Satz
vat_amount            -- MwSt.-Betrag
total                 -- Gesamtbetrag
valid_until           -- Gueltigkeitsdatum
sent_at               -- Versandzeitpunkt
viewed_at             -- Erste Ansicht
accepted_at           -- Annahmezeitpunkt
rejected_at           -- Ablehnungszeitpunkt
agb_accepted_at       -- AGB-Akzeptanz
```

### offer_items-Tabelle
```sql
id                    -- UUID der Position
offer_id              -- Zugehoerige Offerte
position              -- Reihenfolge
description           -- Positionsbeschreibung
quantity              -- Menge
unit                  -- Einheit
unit_price            -- Einzelpreis
total                 -- Positionstotal
```

### offer_leistungsuebersicht-Tabelle
```sql
id                    -- UUID
offer_id              -- Zugehoerige Offerte
included_services     -- Array inklusiver Leistungen
excluded_services     -- Array exklusiver Leistungen
special_notes         -- Besondere Hinweise
```

---

## Leistungskatalog

### Vorlagen nutzen
Firmen koennen Leistungsvorlagen erstellen fuer wiederkehrende Angebote:
1. Zu "Leistungskatalog" navigieren
2. Vorlage erstellen mit Standardleistungen
3. Bei Offerte-Erstellung Vorlage laden

### Kategorien
- Transport & Logistik
- Verpackung & Material
- Montage & Demontage
- Reinigung
- Entsorgung
- Zusatzleistungen

---

## Checkliste

### Optionale Checkliste
- Kann der Offerte angehängt werden
- Hilft Kunden bei der Vorbereitung
- Firmenspezifische Templates

### Beispiel-Punkte
- [ ] Parkplatz fuer LKW reservieren
- [ ] Wertgegenstände separat verpacken
- [ ] Schluessel bereithalten
- [ ] Zählerstände ablesen

---

## Best Practices

### Offerte erstellen
1. **Klare Positionen:** Jede Leistung einzeln auffuehren
2. **Transparente Preise:** Keine versteckten Kosten
3. **Realistische Gueltigkeit:** 14-30 Tage empfohlen
4. **Vollständige Leistungsuebersicht:** Missverständnisse vermeiden

### Nachverfolgung
1. **Status beobachten:** "Viewed" zeigt Interesse
2. **Nachfassen:** Bei längerer Inaktivität kontaktieren
3. **Feedback nutzen:** Ablehnungsgruende analysieren

### Konversionsoptimierung
1. **Schnelle Reaktion:** Offerten zeitnah erstellen
2. **Professionelles Design:** Logo und Farben nutzen
3. **Persoenliche Note:** Beschreibung individualisieren

---

## Fehlerbehebung

### E-Mail kommt nicht an
- Spam-Ordner des Kunden pruefen
- E-Mail-Addressse verifizieren
- Resend-Konfiguration pruefen

### PDF wird nicht generiert
- Browser-Popup-Blocker deaktivieren
- Firmenlogo-Upload pruefen (max. 2MB)

### Kunde kann Offerte nicht oeffnen
- Link korrekt kopiert?
- Offerte bereits abgelaufen?
- Token in URL vorhanden?

### Status aktualisiert nicht
- Seite neu laden
- Browser-Cache leeren
- Echtzeit-Verbindung pruefen
