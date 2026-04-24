# Vapi.ai JSON Schemas for Offerio.ch

This folder contains the JSON schemas used by Vapi.ai for Offerio.ch.

## File Structure

```
vapi-schemas/
├── README.md                    # This file
├── service-detection.json       # Service-type detection schema
├── umzug.json                   # Moving (Umzug) schema
├── reinigung.json               # Cleaning (Reinigung) schema
├── raeumung.json                # Clearance (Raeumung) schema
├── entsorgung.json              # Disposal (Entsorgung) schema
├── klaviertransport.json        # Piano transport schema
├── moebellift.json              # Furniture lift rental schema
└── lagerung.json                # Storage schema
```

## Usage Flow

### 1. Service Type Detection

First, use `service-detection.json` to determine what the customer needs:

```json
{
  "name": "detect_service_type",
  "description": "Detect which service the customer needs",
  ...
}
```

### 2. Service-Specific Data Collection

After determining the service type, use the matching schema:

| Service | Schema File |
|--------|--------------|
| Umzug | `umzug.json` |
| Reinigung | `reinigung.json` |
| Räumung | `raeumung.json` |
| Entsorgung | `entsorgung.json` |
| Klaviertransport | `klaviertransport.json` |
| Moebellift | `moebellift.json` |
| Lagerung | `lagerung.json` |

## Vapi.ai Konfiguerasyonu

### System Prompt

```
Du bist ein freundlicher Schweizer Kundenberater bei Offerio.ch.
Deine Aufgabe ist es, alle wichtigen Informationen fuer eine Anfrage zu sammeln.

ABLAUF:
1. Begruessung: "Grueezi! Willkommen bei Offerio. Wie kann ich Ihnen helfen?"
2. Service-Typ ermitteln
3. Alle notwendigen Informationen fuer den Service sammeln
4. Kontaktdaten aufnehmen
5. Zusammenfassung und Bestätigung

WICHTIG:
- Sprich Schweizer Hochdeutsch
- Sei freundlich und geduldig
- Stelle Rueckfragen wenn etwas unklar ist
- Bei sensiblen Services (Todesfallräumung, Messieräumung) sei besonders einfuehlsam
```

### Analysis Schema Beispiel (Umzug)

```json
{
  "type": "object",
  "properties": {
    "service_type": { "type": "string", "enum": ["umzug_privat", "umzug_firma"] },
    "from_plz": { "type": "string", "pattern": "^[1-9][0-9]{3}$" },
    "from_city": { "type": "string" },
    "from_floor": { "type": "string" },
    "from_has_lift": { "type": "boolean" },
    "from_rooms": { "type": "number" },
    "to_plz": { "type": "string" },
    "to_city": { "type": "string" },
    "to_floor": { "type": "string" },
    "to_has_lift": { "type": "boolean" },
    "preferred_date": { "type": "string" },
    "packing_service": { "type": "boolean" },
    "cleaning_service": { "type": "boolean" },
    "customer_name": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "string" },
    "confidence": { "type": "number" }
  },
  "required": ["service_type", "from_plz", "from_city", "customer_name", "phone", "email"]
}
```

## n8n Integration

Transform Vapi.ai output in n8n:

```javascript
// n8n Set Node
{
  "source": "ai_voice",
  "service_type": $json.analysis.service_type,
  "from_plz": $json.analysis.from_plz,
  "from_city": $json.analysis.from_city,
  "from_floor": $json.analysis.from_floor,
  "from_has_lift": $json.analysis.from_has_lift,
  "from_rooms": $json.analysis.from_rooms,
  "to_plz": $json.analysis.to_plz,
  "to_city": $json.analysis.to_city,
  "customer_first_name": $json.analysis.customer_name.split(' ')[0],
  "customer_last_name": $json.analysis.customer_name.split(' ').slice(1).join(' '),
  "customer_phone": $json.analysis.phone,
  "customer_email": $json.analysis.email,
  "packing_service_needed": $json.analysis.packing_service || false,
  "cleaning_service_needed": $json.analysis.cleaning_service || false,
  "preferred_date": $json.analysis.preferred_date,
  "conversation_transcript": $json.transcript,
  "conversation_duration": $json.call.duration,
  "ai_confidence_score": $json.analysis.confidence
}
```

## Confidence Score

Calculate a confidence score between 0 and 100 at the end of each call:

| Criteria | Score |
|--------|------|
| Full address provided (PLZ + city) | +10 |
| Floor information provided | +5 |
| Lift information provided | +5 |
| m2 or room count provided | +10 |
| Date provided | +10 |
| Valid phone (+41...) | +10 |
| Valid email | +10 |
| Additional services asked | +5 |
| Summary confirmed | +15 |
| Call duration 2+ minutes | +10 |
| Call duration 3+ minutes | +10 |

**Toplam: 100**

- **70+ score:** lead is auto-verified
- **Below 70:** manual verification required

## Related Files

- `docs/VAPI_CONVERSATION_GUIDE.md` - Detailed conversation guide
- `docs/N8N_VAPI_INTEGRATION.md` - n8n integration guide
- `supabase/functions/n8n-lead-webhook/index.ts` - Webhook endpoint

## Questions?

If you have questions, check the conversation guide (`VAPI_CONVERSATION_GUIDE.md`).
