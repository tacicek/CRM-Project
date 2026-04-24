# Lead-Verifizierungssystem

## Uebersicht

Das Lead-Verifizierungssystem ist ein zentrales Qualitätssicherungs-Tool, das eingehende Anfragen auf Spam und Betrug ueberprueft, bevor sie an Partnerfirmen weitergeleitet werden.

---

## Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Formular  │ ──► │  Spam-Berechnung │ ──► │  Verifizierung  │ ──► │  Lead-Matching   │
│   Eingabe   │     │  (automatisch)   │     │  (manuell/auto) │     │  (automatisch)   │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

### 1. Formular-Eingabe
- Kunde fuellt das Anfrageformular aus
- IP-Addressse wird automatisch erfasst
- Alle Daten werden in der `leads`-Tabelle gespeichert
- **Status wird auf `pending_verification` gesetzt** (Default-Wert)

### 2. Automatische Spam-Berechnung
Beim Erstellen eines Leads wird automatisch ein **Spam-Score** berechnet:

| Faktor | Punkte |
|--------|--------|
| Gleiche IP in 24h | +2 pro Lead |
| Gleiche E-Mail in 24h | +3 pro Lead |
| Gleiche Telefonnummer in 24h | +2 pro Lead |
| Beschreibung < 10 Zeichen | +1 |
| Kein Wunschdatum | +1 |
| **IP auf Blacklist** | **Automatische Ablehnung** |

#### Spam-Risiko-Einstufung
- **Niedrig (0-2):** Gruenes Badge ✓
- **Mittel (3-5):** Gelbes Badge ⚠
- **Hoch (6+):** Rotes Badge ⚠

#### Auto-Verifizierung
Leads mit **spam_score = 0** werden automatisch verifiziert:
- Status wird direkt auf `verified` gesetzt
- `verified_at` wird automatisch gesetzt
- `verified_by` bleibt NULL (kennzeichnet Auto-Verifizierung)
- Lead-Matching wird sofort getriggert

**Kriterien fuer spam_score = 0:**
- Keine vorherigen Leads von gleicher IP/E-Mail/Telefon in 24h
- Beschreibung ≥ 10 Zeichen
- Wunschdatum angegeben
- IP nicht auf Blacklist

#### Admin-Benachrichtigung bei hohem Spam-Score
Leads mit **spam_score ≥ 6** loesen automatisch eine E-Mail-Benachrichtigung an alle Admins aus:
- E-Mail enthält Spam-Score-Badge und Lead-Details
- IP-Addressse wird zur Ueberpruefung angezeigt
- Direktlink zur Verification-Seite
- Betreff zeigt "⚠️ SPAM-VERDACHT" fuer schnelle Erkennung

### 3. Verifizierungsstatus

| Status | Beschreibung |
|--------|--------------|
| `pending_verification` | Wartet auf manuelle Ueberpruefung (spam_score > 0) |
| `verified` | Genehmigt - wird an Firmen weitergeleitet |
| `rejected` | Abgelehnt - keine Weiterleitung |

---

## IP-Blacklist

### Funktionsweise
Die IP-Blacklist blockiert automatisch alle Anfragen von bekannten Spam-IP-Addresssen.

### Automatische Ablehnung
Wenn eine IP auf der Blacklist steht:
1. Lead-Status wird auf `rejected` gesetzt
2. Spam-Score wird auf `100` gesetzt
3. Ablehnungsgrund: "IP-Addressse auf Blacklist: [Grund]"
4. Blockierungszähler wird erhoeht

### Blacklist verwalten
1. **Hinzufuegen:** Button "IP-Blacklist" → IP und Grund eingeben
2. **Aus Lead hinzufuegen:** Im Lead-Detail → "IP zur Blacklist"
3. **Entfernen:** In der Blacklist-Uebersicht → Papierkorb-Icon

---

## Admin-Aktionen

### Einzelne Leads
- **Verifizieren:** Lead wird freigegeben und an passende Firmen verteilt
- **Ablehnen:** Lead wird abgelehnt, optional mit Grund
- **IP blockieren:** IP-Addressse zur Blacklist hinzufuegen

### Massenaktionen
- Mehrere Leads auswählen (Checkboxen)
- "Alle verifizieren" oder "Alle ablehnen"
- "Alle auswählen" / "Auswahl aufheben"

---

## Lead-Matching (nach Verifizierung)

Nach der Verifizierung wird automatisch die `match-lead` Edge-Function aufgerufen:

1. **PLZ-Matching:** Firmen mit passender PLZ-Abdeckung finden
2. **Service-Matching:** Nur Firmen mit aktiviertem Dienstleistungstyp
3. **Radius-Berechnung:** Entfernung zwischen Lead-PLZ und Firmen-PLZ
4. **Token-Abzug:** Bei Lead-Annahme werden Tokens abgezogen
5. **Benachrichtigung:** E-Mail an qualifizierte Firmen

---

## Datenbank-Struktur

### leads-Tabelle (relevante Felder)
```sql
status          -- 'pending', 'verified', 'rejected'
spam_score      -- Berechneter Spam-Score (0-100)
ip_address      -- IP-Addressse des Kunden
admin_notes     -- Interne Notizen
verified_at     -- Zeitstempel der Verifizierung
verified_by     -- Admin-ID
rejection_reason -- Ablehnungsgrund
```

### ip_blacklist-Tabelle
```sql
ip_address      -- Blockierte IP (UNIQUE)
reason          -- Grund fuer Blockierung
added_by        -- Admin-ID
blocked_count   -- Anzahl blockierter Versuche
created_at      -- Erstellungsdatum
```

---

## Trigger & Funktionen

### calculate_lead_spam_score()
- **Trigger:** BEFORE INSERT auf `leads`
- **Funktion:** Berechnet Spam-Score und prueft Blacklist

### trigger_match_verified_lead()
- **Trigger:** AFTER UPDATE auf `leads`
- **Funktion:** Startet Lead-Matching wenn Status = 'verified'

---

## Best Practices

### Spam-Erkennung
1. Leads mit hohem Spam-Score (6+) genau pruefen
2. Bei Doppelanfragen: Original-Lead verifizieren, Duplikate ablehnen
3. Verdächtige IPs zur Blacklist hinzufuegen

### Verifizierung
1. Kontaktdaten auf Plausibilität pruefen
2. Beschreibung auf sinnvollen Inhalt pruefen
3. Addresssdaten validieren

### Blacklist-Management
1. Regelmäßig Blacklist ueberpruefen
2. Alte/irrelevante Einträge entfernen
3. Blockierungszähler beobachten

---

## Fehlerbehebung

### Lead wird nicht an Firmen verteilt
- Pruefen: Ist der Status auf `verified`?
- Pruefen: Gibt es Firmen mit passender PLZ-Abdeckung?
- Pruefen: Haben die Firmen den Dienstleistungstyp aktiviert?

### Spam-Score ist 0 aber Lead ist Spam
- IP-Addressse manuell zur Blacklist hinzufuegen
- Lead ablehnen mit Grund

### Legitimer Lead wird automatisch abgelehnt
- IP-Addressse von der Blacklist entfernen
- Lead manuell neu erstellen oder Status ändern
