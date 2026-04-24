# 📧 E-Mail CRM Lifecycle — Offerio.ch

## Uebersicht

Automatisierte E-Mail-Sequenzen via **n8n** Workflows fuer die komplette Customer Journey.

---

## 🔄 Workflow 1: Anfrage-Bestätigung

**Trigger:** Neue Anfrage erstellt (`leads` INSERT)  
**Delay:** Sofort  
**An:** Kunde (customer_email)

```
Betreff: ✅ Ihre Anfrage bei Offerio.ch wurde erhalten
```

**Inhalt:**
- Bestätigung der Anfrage mit Referenznummer
- Zusammenfassung (Service-Typ, PLZ, Datum)
- "Sie erhalten innerhalb von 24h bis zu 5 Offerten"
- Link zum Status der Anfrage

---

## 🔄 Workflow 2: Offerten-Benachrichtigung

**Trigger:** Lead-Distribution erstellt (`lead_distributions` INSERT, status = 'sent')  
**Delay:** Sofort  
**An:** Partner-Firma (company email)

```
Betreff: 🎯 Neue Anfrage in Ihrer Region — jetzt ansehen
```

**Inhalt:**
- Lead-Details (Service, PLZ, Zimmer/m²)
- Token-Kosten
- CTA: "Jetzt Lead ansehen"
- Ablauf-Hinweis

---

## 🔄 Workflow 3: Follow-up (Keine Offerten erhalten)

**Trigger:** Lead status still 'verified' nach 48h  
**Delay:** 48h nach Erstellung  
**An:** Kunde

```
Betreff: ℹ️ Update zu Ihrer Anfrage bei Offerio.ch
```

**Inhalt:**
- "Wir arbeiten daran, passende Partner zu finden"
- Alternative Services vorschlagen
- Kontakt-Support anbieten

---

## 🔄 Workflow 4: Bewertungs-Anfrage

**Trigger:** Lead status = 'completed' OR Auftrag abgeschlossen  
**Delay:** 7 Tage nach Abschluss  
**An:** Kunde

```
Betreff: ⭐ Wie war Ihr Umzug? Bewerten Sie Ihren Anbieter
```

**Inhalt:**
- "Wie zufrieden waren Sie mit [Firmenname]?"
- 1-5 Sterne Rating-Link
- "Ihre Bewertung hilft anderen Kunden"

---

## 🔄 Workflow 5: Re-Engagement

**Trigger:** Kunde hat Anfrage gestellt aber keine Offerte angenommen (30 Tage)  
**Delay:** 30 Tage nach Erstellung  
**An:** Kunde

```
Betreff: 🏠 Noch auf der Suche? Wir helfen Ihnen gerne
```

**Inhalt:**
- "Brauchen Sie noch Hilfe bei Ihrem Umzug/Reinigung?"
- Saisonale Tipps
- CTA: "Neue Anfrage stellen"

---

## 🔄 Workflow 6: Partner-Onboarding

**Trigger:** Neue Firma registriert (`companies` INSERT)  
**Delay:** Sofort + Day 3 + Day 7  
**An:** Partner-Firma

### E-Mail 1 (Sofort):
```
Betreff: 🤝 Willkommen bei Offerio — Ihr Konto ist bereit
```
- Dashboard-Zugang
- Erste Schritte
- Token-Erklärung

### E-Mail 2 (Tag 3):
```
Betreff: 💡 3 Tipps fuer mehr Leads auf Offerio
```
- Profil vollständig ausfuellen
- Servicegebiet erweitern
- Schnell auf Leads reagieren

### E-Mail 3 (Tag 7):
```
Betreff: 📊 Ihre erste Woche auf Offerio — So geht's weiter
```
- Statistiken der ersten Woche
- Token-Paket Empfehlung
- Support-Kontakt

---

## 🛠️ n8n Setup Anleitung

### Voraussetzungen
1. n8n Instance (self-hosted oder cloud)
2. Supabase Webhook oder Postgres Trigger
3. Resend API Key (bereits konfiguriert)

### Webhook-Endpunkte einrichten

```bash
# In n8n: Neuen Workflow erstellen
# Trigger: Webhook → POST /webhook/lead-created
# Oder: Supabase → Database → Webhook → INSERT on leads
```

### Supabase Webhooks konfigurieren

```sql
-- Webhook fuer neue Leads
-- Dashboard → Database → Webhooks → Create
-- Table: leads
-- Events: INSERT
-- URL: https://your-n8n.example.com/webhook/lead-created
```

### E-Mail via Resend senden

```javascript
// n8n HTTP Request Node
// Method: POST
// URL: https://api.resend.com/emails
// Headers: Authorization: Bearer {{$env.RESEND_API_KEY}}
// Body:
{
  "from": "Offerio <noreply@offerio.ch>",
  "to": "{{$json.customer_email}}",
  "subject": "✅ Ihre Anfrage wurde erhalten",
  "html": "<h1>Vielen Dank fuer Ihre Anfrage!</h1>..."
}
```

---

## 📊 Tracking

Alle E-Mails werden in der bestehenden `email_logs` Tabelle protokolliert:
- `email_type`: confirmation, follow_up, review_request, re_engagement, onboarding
- `status`: sent, delivered, opened, clicked, bounced
- `recipient_email`
- `sent_at`

---

## 📋 Implementierungs-Checkliste

- [ ] n8n Instance einrichten
- [ ] Supabase Webhooks konfigurieren
- [ ] Workflow 1: Anfrage-Bestätigung
- [ ] Workflow 2: Offerten-Benachrichtigung
- [ ] Workflow 3: Follow-up (48h)
- [ ] Workflow 4: Bewertungs-Anfrage (7d)
- [ ] Workflow 5: Re-Engagement (30d)
- [ ] Workflow 6: Partner-Onboarding (3 E-Mails)
- [ ] E-Mail Templates in Resend erstellen
- [ ] Tracking in email_logs verifizieren

---

*Erstellt: März 2025 | Offerio Team*
