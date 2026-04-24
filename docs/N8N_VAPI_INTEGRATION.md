# n8n + Vapi.ai → Offerio Integration Guide

## Mimari Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────────────┐
│   Vapi.ai   │ ───► │    n8n      │ ───► │  Offerio Supabase       │
│  (AI Voice) │      │ (Transform) │      │ (n8n-lead-webhook)      │
└─────────────┘      └─────────────┘      └─────────────────────────┘
                            │
                            ▼
                    JSON Transformation:
                    - Vapi format → Offerio format
                    - Data validation
                    - Enrichment (optional)
```

## n8n Workflow Kurulumu

### 1. Yeni Workflow Olustur

n8n'de yeni bir workflow olusturun: `Vapi.ai → Offerio Lead`

### 2. Webhook Trigger Node

**Node Type:** `Webhook`

**Settings:**
- HTTP Method: `POST`
- Path: `vapi-lead` (veya istediginiz bir path)
- Response Mode: `Respond to Webhook`

Bu size bir URL verecek, oern: `https://your-n8n.example.com/webhook/vapi-lead`

Bu URL'i Vapi.ai'da "End of Call Webhook" olarak ayarlayin.

### 3. Set Node (Data Transform)

**Node Type:** `Set`

Vapi.ai'dan gelen veriyi Offerio formatina doenuestueruer:

```javascript
// Set node - Values to Set
{
  // Metadata
  "source": "ai_voice",
  "vapi_call_id": "{{ $json.call?.id }}",
  "n8n_execution_id": "{{ $execution.id }}",
  
  // Service Type (Vapi'dan gelen degere goere)
  "service_type": "{{ $json.analysis?.service_type || 'umzug' }}",
  
  // From Address (Auszug)
  "from_plz": "{{ $json.analysis?.from_plz }}",
  "from_city": "{{ $json.analysis?.from_city }}",
  "from_street": "{{ $json.analysis?.from_street || null }}",
  "from_floor": "{{ $json.analysis?.from_floor || null }}",
  "from_has_lift": "{{ $json.analysis?.from_has_lift || false }}",
  
  // To Address (Einzug)
  "to_plz": "{{ $json.analysis?.to_plz || null }}",
  "to_city": "{{ $json.analysis?.to_city || null }}",
  "to_street": "{{ $json.analysis?.to_street || null }}",
  "to_floor": "{{ $json.analysis?.to_floor || null }}",
  "to_has_lift": "{{ $json.analysis?.to_has_lift || false }}",
  
  // Property Details
  "from_rooms": "{{ $json.analysis?.rooms || null }}",
  "from_living_space_m2": "{{ $json.analysis?.square_meters || null }}",
  
  // Date & Time
  "preferred_date": "{{ $json.analysis?.preferred_date || null }}",
  "preferred_time": "{{ $json.analysis?.preferred_time || null }}",
  
  // Customer Info
  "customer_first_name": "{{ $json.analysis?.customer_name?.split(' ')[0] || '' }}",
  "customer_last_name": "{{ $json.analysis?.customer_name?.split(' ').slice(1).join(' ') || '' }}",
  "customer_phone": "{{ $json.analysis?.phone || $json.customer?.number }}",
  "customer_email": "{{ $json.analysis?.email }}",
  
  // Additional Services
  "packing_service_needed": "{{ $json.analysis?.packing_service || false }}",
  "cleaning_service_needed": "{{ $json.analysis?.cleaning_service || false }}",
  "storage_needed": "{{ $json.analysis?.storage_needed || false }}",
  
  // AI Data
  "conversation_transcript": "{{ $json.transcript }}",
  "conversation_duration": "{{ $json.call?.duration || 0 }}",
  "ai_confidence_score": "{{ $json.analysis?.confidence || 80 }}",
  
  // Notes
  "special_requirements": "{{ $json.analysis?.notes || null }}"
}
```

### 4. HTTP Request Node (Offerio Webhook)

**Node Type:** `HTTP Request`

**Settings:**
- Method: `POST`
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/n8n-lead-webhook`
- Headers:
  ```
  Content-Type: application/json
  x-webhook-secret: {{$env.OFFERIO_WEBHOOK_SECRET}}
  ```
- Body: `{{ JSON.stringify($json) }}`

### 5. Respond to Webhook Node

**Node Type:** `Respond to Webhook`

Vapi.ai'ya basari yaniti goenderir:

```json
{
  "success": true,
  "message": "Lead created successfully"
}
```

---

## n8n Environment Variables

n8n'de su environment variable'lari ayarlayin:

```bash
OFFERIO_WEBHOOK_SECRET=your-secret-key-here
```

## Supabase Secret Ayari

Supabase Dashboard > Edge Functions > Secrets:

```
N8N_WEBHOOK_SECRET=your-secret-key-here
```

(Ayni deger olmali!)

---

## Vapi.ai Konfiguerasyonu

### Assistant Setup

1. Vapi.ai Dashboard'da yeni bir Assistant olusturun
2. Model: GPT-4 veya Claude-3
3. Voice: ElevenLabs (Swiss German destekli)

### System Prompt Oernegi

```
Du bist ein freundlicher Schweizer Umzugsberater bei Offerio.ch. 
Deine Aufgabe ist es, alle wichtigen Informationen fuer eine Umzugsanfrage zu sammeln.

Sammle folgende Informationen:
1. Service-Typ (Umzug, Reinigung, Räumung, etc.)
2. Auszugsadresse (PLZ, Stadt, Strasse, Stockwerk, Lift vorhanden?)
3. Einzugsadresse (falls Umzug)
4. Anzahl Zimmer und ungefähre Wohnfläche
5. Gewuenschtes Datum
6. Name, Telefonnummer und E-Mail
7. Zusatzleistungen (Verpackung, Reinigung, Lagerung)
8. Besondere Anforderungen

Sprich freundlich und hilfsbereit. Verwende "Grueezi" zur Begruessung.
Stelle Rueckfragen wenn etwas unklar ist.
```

### Analysis Schema (Vapi Function Calling)

```json
{
  "type": "object",
  "properties": {
    "service_type": {
      "type": "string",
      "enum": ["umzug", "reinigung", "raeumung", "entsorgung", "lagerung", "klaviertransport", "moebellift"]
    },
    "from_plz": { "type": "string", "pattern": "^[1-9][0-9]{3}$" },
    "from_city": { "type": "string" },
    "from_street": { "type": "string" },
    "from_floor": { "type": "integer", "minimum": 0 },
    "from_has_lift": { "type": "boolean" },
    "to_plz": { "type": "string", "pattern": "^[1-9][0-9]{3}$" },
    "to_city": { "type": "string" },
    "to_street": { "type": "string" },
    "to_floor": { "type": "integer", "minimum": 0 },
    "to_has_lift": { "type": "boolean" },
    "rooms": { "type": "number" },
    "square_meters": { "type": "integer" },
    "preferred_date": { "type": "string", "format": "date" },
    "preferred_time": { "type": "string" },
    "customer_name": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "packing_service": { "type": "boolean" },
    "cleaning_service": { "type": "boolean" },
    "storage_needed": { "type": "boolean" },
    "notes": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 100 }
  },
  "required": ["service_type", "from_plz", "from_city", "customer_name", "phone", "email"]
}
```

### End of Call Webhook

**URL:** Your n8n webhook URL  
**Events:** `call.ended`

---

## Example n8n Workflow JSON

Asagidaki JSON'u n8n'e import edebilirsiniz:

```json
{
  "name": "Vapi.ai → Offerio Lead",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "vapi-lead",
        "responseMode": "responseNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [
            { "name": "source", "value": "ai_voice" },
            { "name": "service_type", "value": "={{ $json.analysis?.service_type || 'umzug' }}" },
            { "name": "from_plz", "value": "={{ $json.analysis?.from_plz }}" },
            { "name": "from_city", "value": "={{ $json.analysis?.from_city }}" },
            { "name": "customer_first_name", "value": "={{ ($json.analysis?.customer_name || '').split(' ')[0] }}" },
            { "name": "customer_last_name", "value": "={{ ($json.analysis?.customer_name || '').split(' ').slice(1).join(' ') }}" },
            { "name": "customer_phone", "value": "={{ $json.analysis?.phone || $json.customer?.number }}" },
            { "name": "customer_email", "value": "={{ $json.analysis?.email }}" },
            { "name": "conversation_transcript", "value": "={{ $json.transcript }}" }
          ],
          "number": [
            { "name": "conversation_duration", "value": "={{ $json.call?.duration || 0 }}" },
            { "name": "ai_confidence_score", "value": "={{ $json.analysis?.confidence || 80 }}" }
          ]
        }
      },
      "name": "Transform Data",
      "type": "n8n-nodes-base.set",
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/n8n-lead-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" },
            { "name": "x-webhook-secret", "value": "={{$env.OFFERIO_WEBHOOK_SECRET}}" }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "json", "value": "={{ $json }}" }
          ]
        }
      },
      "name": "Send to Offerio",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { success: true, offerio_response: $json } }}"
      },
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Transform Data", "type": "main", "index": 0 }]] },
    "Transform Data": { "main": [[{ "node": "Send to Offerio", "type": "main", "index": 0 }]] },
    "Send to Offerio": { "main": [[{ "node": "Respond", "type": "main", "index": 0 }]] }
  }
}
```

---

## Test Etme

### 1. n8n Workflow Test

n8n'de webhook'u test etmek icin:

```bash
curl -X POST https://your-n8n.example.com/webhook-test/vapi-lead \
  -H "Content-Type: application/json" \
  -d '{
    "call": { "id": "test-123", "duration": 120 },
    "transcript": "Grueezi, ich moechte umziehen...",
    "analysis": {
      "service_type": "umzug",
      "from_plz": "8001",
      "from_city": "Zuerich",
      "to_plz": "3000",
      "to_city": "Bern",
      "rooms": 3,
      "customer_name": "Max Mustermann",
      "phone": "+41791234567",
      "email": "max@example.com",
      "confidence": 85
    }
  }'
```

### 2. Offerio Webhook Direkt Test

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/n8n-lead-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-key" \
  -d '{
    "source": "ai_voice",
    "service_type": "umzug",
    "from_plz": "8001",
    "from_city": "Zuerich",
    "to_plz": "3000",
    "to_city": "Bern",
    "from_rooms": 3,
    "customer_first_name": "Max",
    "customer_last_name": "Mustermann",
    "customer_phone": "+41791234567",
    "customer_email": "max@example.com",
    "conversation_duration": 120,
    "ai_confidence_score": 85
  }'
```

---

## Troubleshooting

### "Unauthorized" Hatasi
- `N8N_WEBHOOK_SECRET` ve `x-webhook-secret` header'inin eslestiginden emin olun

### "Validierungsfehler" Hatasi
- PLZ 4 haneli olmali (oern: "8001")
- Telefon +41 formatinda olmali (oern: "+41791234567")
- Email gecerli olmali

### Lead Olusturuldu Ama Companylere Gitmedi
- `ai_confidence_score` 70'den duesuekse, lead manuel verification bekler
- Admin panelden lead'i dogrulayin

---

## Monitoring

### Supabase Logs
```bash
npx supabase functions logs n8n-lead-webhook
```

### n8n Execution History
n8n Dashboard > Executions sayfasindan tuem workflow calismalarini goerebilirsiniz.

---

## Related Files

| Dosya | Description |
|-------|----------|
| `docs/VAPI_CONVERSATION_GUIDE.md` | Vapi.ai konusma rehberi ve tuem servisler icin soru listesi |
| `docs/vapi-schemas/` | Her servis icin JSON semalari |
| `docs/vapi-schemas/umzug.json` | Umzug (Moving) semasi |
| `docs/vapi-schemas/reinigung.json` | Reinigung (Temizlik) semasi |
| `docs/vapi-schemas/raeumung.json` | Räumung (Clearance) semasi |
| `docs/vapi-schemas/entsorgung.json` | Entsorgung (Bertaraf) semasi |
| `docs/vapi-schemas/klaviertransport.json` | Klaviertransport semasi |
| `docs/vapi-schemas/moebellift.json` | Moebellift semasi |
| `docs/vapi-schemas/lagerung.json` | Lagerung (Storage) semasi |
