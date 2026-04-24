# Anfrage-Formulare — Übersicht

> **Ziel:** Vereinfachung aller Formulare. Kundenrückmeldung: zu komplex, zu lang, zu aufwändig.

---

## Alle Formulare im Überblick

| # | Formular | Route | Schritte Aktuell | Ziel |
|---|----------|-------|-----------------|------|
| 01 | [Umzug](./01-umzug.md) | `/anfrage/umzug` | 17 Schritte | 7 Schritte |
| 02 | [Reinigung](./02-reinigung.md) | `/anfrage/reinigung` | 8 Schritte | 4–5 Schritte |
| 03 | [Räumung](./03-raeumung.md) | `/anfrage/raeumung` | 9–10 Schritte | 5–6 Schritte |
| 04 | [Entsorgung](./04-entsorgung.md) | `/anfrage/entsorgung` | 8 Schritte | 4 Schritte |
| 05 | [Klaviertransport](./05-klaviertransport.md) | `/anfrage/klaviertransport` | 7–8 Schritte | 4–5 Schritte |
| 06 | [Möbellift](./06-moebellift.md) | `/anfrage/moebellift` | 7 Schritte | 4 Schritte |
| 07 | [Lagerung](./07-lagerung.md) | `/anfrage/lagerung` | 6 Schritte | 4 Schritte |
| 08 | [Malerarbeit](./08-malerarbeit.md) | `/anfrage/malerarbeiten` | 6 Schritte | 4 Schritte |
| 09 | [Renovation](./09-renovation.md) | `/anfrage/renovation` | 6 Schritte | 4 Schritte |

---

## Gemeinsame Probleme (alle Formulare)

1. **Zu viele Schritte** — durchschnittlich 9 Schritte pro Formular
2. **Technische Fragen** — Lifttyp, m³-Volumen, Treppenhaus-Breite etc.
3. **Doppelte Strukturen** — Malerarbeit und Renovation sind fast identisch
4. **Parkplatz/Zugang** — wird in mehreren Formularen gefragt, selten nötig
5. **Storen/Rollläden-Unterscheidung** — unklar für Nutzer
6. **Zu viele Bestätigungs-Checkboxen** — 2–3 Checkboxen am Ende

---

## Design-Prinzipien für neue Formulare

Gemäss Cursor Rules (CORE UX DESIGN PRINCIPLES):

1. **Mobile-First** — primär für Smartphone-Nutzer
2. **Max 5 Schritte** — Nutzer brechen bei mehr als 5 ab
3. **Keine technischen Begriffe** — einfache Sprache
4. **Visual Choices** — Karten statt Dropdowns
5. **Pflichtfelder minimal** — nur was wirklich nötig ist
6. **Kontaktdaten immer letzter Schritt** — Vertrauen aufbauen zuerst

---

## Empfohlene Reihenfolge der Überarbeitung

1. **Umzug** (am meisten genutzt, am meisten Schritte → grösster Impact)
2. **Reinigung** (zweithäufigster Service)
3. **Räumung** + **Entsorgung** (ähnliche Struktur → zusammen überarbeiten)
4. **Klaviertransport** + **Möbellift** (Spezialservices)
5. **Malerarbeit** + **Renovation** (fast identisch → gemeinsames Template)
6. **Lagerung** (eigenständig)
