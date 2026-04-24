/**
 * Shared Prompt Templates for Edge Functions
 * 
 * Centralized prompts for AI operations in Supabase Edge Functions
 */

// ============================================
// LEAD EXTRACTION PROMPT - Multi-Service Support
// ============================================
export const EXTRACT_LEAD_PROMPT = `Du bist ein Experte für das Extrahieren von Dienstleistungsanfragen aus unstrukturiertem Text. Du arbeitest für eine Schweizer Plattform, die verschiedene Dienstleistungen vermittelt: Umzüge, Reinigungen, Räumungen, Entsorgungen, Lagerungen, Klaviertransporte und Möbellifte.

**WICHTIG**: Erkenne ZUERST den Service-Typ und extrahiere dann NUR die relevanten Felder für diesen Service.

### Kontext — heutiges Datum
Heute ist **{{today_iso}}** (Jahr: {{current_year}}).
Bei relativen Zeitangaben ("nächster Monat", "Ende April", "bald", "in 2 Wochen", "nächsten Samstag"):
- Verwende IMMER {{current_year}} oder {{next_year}} — NIEMALS ein vergangenes Jahr.
- Wenn nur Monat/Tag ohne Jahr genannt wird und dieses Datum in {{current_year}} bereits vergangen ist, verwende {{next_year}}.
- Wenn das Datum komplett unklar bleibt → preferred_date = null.

### Input Text:
\`\`\`
{{raw_text}}
\`\`\`

### Service Type Detection (ERSTE PRIORITÄT!)

Erkenne den detected_service_type basierend auf Schlüsselwörtern:

| Service Type | Schlüsselwörter |
|--------------|-----------------|
| umzug_privat | Umzug, Wohnungsumzug, Privatumzug, zügeln, umziehen, Wohnung wechseln |
| umzug_firma | Firmenumzug, Büroumzug, Geschäftsumzug, Firmenwechsel |
| reinigung | Reinigung, Endreinigung, Putzservice, putzen, Wohnungsreinigung, Grundreinigung, sauber machen |
| raeumung | Räumung, Hausräumung, Wohnungsräumung, Entrümpelung, räumen, entrümpeln |
| entsorgung | Entsorgung, Sperrmüll, entsorgen, Müll, Abfall |
| lagerung | Lagerung, Einlagerung, Storage, lagern, zwischenlagern, Lagerraum |
| klaviertransport | Klavier, Piano, Flügel, Keyboard, Klaviertransport |
| moebellift | Möbellift, Aussenlift, Fassadenlift, Aussenaufzug |

### JSON-Struktur nach Service-Typ

Gib ein JSON-Objekt mit den Basis-Feldern und den service-spezifischen Feldern zurück.

#### Basis-Felder (IMMER):

{
  "detected_service_type": "string (PFLICHTFELD!)",
  "first_name": "string | null",
  "last_name": "string | null",
  "email": "string | null",
  "phone": "string | null (Swiss format: +41 79 123 45 67)",
  "preferred_date": "string | null (YYYY-MM-DD)",
  "preferred_time": "string | null",
  "special_notes": "string | null",
  "confidence_score": "number (0-100)"
}

#### UMZUG (umzug_privat, umzug_firma) - Zusätzliche Felder:

{
  "from_street": "string | null",
  "from_house_number": "string | null",
  "from_plz": "string | null",
  "from_city": "string | null",
  "from_floor": "number | null",
  "from_has_elevator": "boolean",
  "from_rooms": "number | null",
  "from_living_space_m2": "number | null",
  "to_street": "string | null",
  "to_house_number": "string | null",
  "to_plz": "string | null",
  "to_city": "string | null",
  "to_floor": "number | null",
  "to_has_elevator": "boolean",
  "packing_service_needed": "boolean",
  "furniture_assembly_needed": "boolean",
  "cleaning_service_needed": "boolean",
  "storage_needed": "boolean",
  "piano_transport_needed": "boolean"
}

#### REINIGUNG - Zusätzliche Felder:

{
  "address_street": "string | null",
  "address_house_number": "string | null",
  "address_plz": "string | null",
  "address_city": "string | null",
  "property_type": "string | null — NUR: \\"Wohnung\\" | \\"Haus\\" | \\"Studio\\" | \\"Büro\\"",
  "number_of_rooms": "number | null",
  "living_space_m2": "number | null",
  "bathroom_count": "number | null",
  "kitchen_type": "string | null — NUR: \\"offen\\" | \\"geschlossen\\" | \\"kochnische\\"",
  "has_balcony": "boolean",
  "has_garage": "boolean",
  "has_basement": "boolean",
  "has_attic": "boolean",
  "cleaning_type": "string | null — NUR: \\"Endreinigung\\" | \\"Grundreinigung\\" | \\"Unterhaltsreinigung\\""
}

#### RÄUMUNG - Zusätzliche Felder:

{
  "address_street": "string | null",
  "address_house_number": "string | null",
  "address_plz": "string | null",
  "address_city": "string | null",
  "property_type": "string | null — NUR: \\"Wohnung\\" | \\"Haus\\" | \\"Keller\\" | \\"Estrich\\"",
  "number_of_rooms": "number | null",
  "clearing_type": "string | null — NUR: \\"Wohnungsräumung\\" | \\"Hausräumung\\" | \\"Kellerräumung\\" | \\"Dachbodenräumung\\" | \\"Büroräumung\\"",
  "estimated_volume": "string | null — NUR: \\"klein\\" | \\"mittel\\" | \\"gross\\" | \\"sehr_gross\\" (kein ß, kein Umlaut)",
  "has_heavy_items": "boolean",
  "heavy_items_description": "string | null"
}

#### ENTSORGUNG - Zusätzliche Felder:

{
  "address_street": "string | null",
  "address_house_number": "string | null",
  "address_plz": "string | null",
  "address_city": "string | null",
  "disposal_type": "string | null — NUR: \\"Sperrmüll\\" | \\"Elektroschrott\\" | \\"Bauschutt\\" | \\"Hausrat\\" | \\"Möbel\\" | \\"Gemischt\\"",
  "items_description": "string | null",
  "estimated_volume": "string | null — NUR: \\"klein\\" | \\"mittel\\" | \\"gross\\" | \\"sehr_gross\\""
}

#### LAGERUNG - Zusätzliche Felder:

{
  "pickup_street": "string | null",
  "pickup_house_number": "string | null",
  "pickup_plz": "string | null",
  "pickup_city": "string | null",
  "pickup_floor": "number | null",
  "pickup_has_elevator": "boolean",
  "storage_duration": "string | null — NUR: \\"kurzfristig\\" | \\"1-3_monate\\" | \\"3-6_monate\\" | \\"6-12_monate\\" | \\"langfristig\\"",
  "storage_volume": "string | null — NUR: \\"klein\\" | \\"mittel\\" | \\"gross\\" | \\"sehr_gross\\"",
  "access_frequency": "string | null — NUR: \\"nie\\" | \\"selten\\" | \\"monatlich\\" | \\"wöchentlich\\"",
  "needs_climate_control": "boolean",
  "storage_items_description": "string | null"
}

#### KLAVIERTRANSPORT - Zusätzliche Felder:

{
  "from_street": "string | null",
  "from_house_number": "string | null",
  "from_plz": "string | null",
  "from_city": "string | null",
  "from_floor": "number | null",
  "from_has_elevator": "boolean",
  "to_street": "string | null",
  "to_house_number": "string | null",
  "to_plz": "string | null",
  "to_city": "string | null",
  "to_floor": "number | null",
  "to_has_elevator": "boolean",
  "piano_type": "string | null — NUR: \\"klavier\\" (aufrecht) | \\"fluegel\\" (Konzertflügel) | \\"e_piano\\" | \\"keyboard\\" (kleingeschrieben, ohne Umlaut)",
  "piano_brand": "string | null",
  "piano_weight_kg": "number | null",
  "staircase_type": "string | null — NUR: \\"keine\\" | \\"gerade\\" | \\"kurvig\\" | \\"wendel\\"",
  "staircase_width_cm": "number | null",
  "window_access_possible": "boolean"
}

#### MÖBELLIFT - Zusätzliche Felder:

{
  "address_street": "string | null",
  "address_house_number": "string | null",
  "address_plz": "string | null",
  "address_city": "string | null",
  "moebellift_floor": "number | null",
  "moebellift_item_description": "string | null",
  "moebellift_item_dimensions": "string | null",
  "direction": "string | null — NUR: \\"hoch\\" (Einzug) | \\"runter\\" (Auszug) | \\"beides\\""
}

### Wichtige Regeln

1. **Service-Typ ZUERST erkennen** — bestimme zuerst, um welche Art von Anfrage es sich handelt.
2. **Nur relevante Felder** — Gib NUR die Basis-Felder + die Felder für den erkannten Service-Typ zurück.
3. **Schweizer Adressen**: PLZ 4-stellig (1000–9999).
4. **Telefon**: \`+41 XX XXX XX XX\` Format.
5. **Datum**: \`YYYY-MM-DD\` Format.
6. **Booleans**: Default \`false\` wenn nicht erwähnt.
7. **Enum-Werte**: Alle Felder mit "NUR: ..." dürfen AUSSCHLIESSLICH einen der aufgeführten Werte enthalten. Keine freien Texte, keine Umschreibungen, keine Umlaute wo "ohne Umlaut" steht.

### HALLUCINATION CHECK (streng anwenden!)

**Grundprinzip: Lieber \`null\` als raten.** Jede erfundene Information ist ein Fehler.

**FALSCH — NIEMALS tun:**
- Input: "Umzug nach Bern."  →  Output: \`{"to_plz": "3000"}\`  ❌ PLZ wurde erfunden!
- Input: "Tel 123456789"     →  Output: \`{"phone": "+41 12 345 67 89"}\`  ❌ Keine gültige CH-Nummer
- Input: "ab 1. April"        →  Output: \`{"preferred_date": "2023-04-01"}\`  ❌ Falsches Jahr

**RICHTIG:**
- "Umzug nach Bern." → \`{"to_city": "Bern", "to_plz": null}\`
- "Tel 123456789"   → \`{"phone": null}\` und confidence um 25 senken
- "ab 1. April" (heute liegt danach) → \`{"preferred_date": "{{next_year}}-04-01"}\`

**Telefon-Gültigkeit (Schweiz):**
- Gültig: \`+41\` + 9 Ziffern ODER lokal beginnend mit \`07\`, \`04\`, \`03\`, \`02\`.
- \`123456789\`, \`000000000\`, \`111111111\`, \`0123456789\` → \`null\`.

**Tastaturmuster im Text erkennen:**
Wenn der Text vor allem aus \`asdf\`, \`qwer\`, \`1234\`, \`xxxx\` etc. besteht:
- Alle Daten \`null\` lassen (außer zweifelsfrei Extrahierbarem).
- \`confidence_score\` unter 30.

### Confidence Score — EXAKTE RUBRIK

Start bei 100. Abzüge (summieren, Minimum 0):

| Situation | Abzug |
|---|---|
| Kein Nachname gefunden | -15 |
| Keine E-Mail UND kein Telefon | -30 |
| Telefon ungültig (nicht-CH-Muster) | -20 |
| Keine Quelladresse (Umzug/Klavier) oder Hauptadresse (andere) | -25 |
| Keine PLZ gefunden | -15 |
| Keine Datumsangabe | -10 |
| Text kürzer als 50 Zeichen | -20 |
| Text enthält Tastaturmuster (asdf/qwer/1234/xxxx) | -40 |
| Service-Typ nicht eindeutig | -15 |
| Daten mussten erfunden/geschätzt werden | -30 |

**Referenzwerte:**
- \`90–100\`: Vollständige Anfrage (Name + Kontakt + Adressen + Service klar).
- \`70–89\`: Haupt-Infos da, einzelne Felder fehlen.
- \`50–69\`: Basics erkannt, viele Lücken.
- \`<50\`: Sehr unvollständig — Firma muss nachfragen.
- \`<30\`: Junk / Spam-verdächtig.

### Mehrere Services im Text

Wenn der Kunde mehrere Services gleichzeitig anfragt (z. B. "Möbellift + Entsorgung", "Umzug + Klaviertransport"):
1. Wähle den **primären Service** (zuerst oder ausführlichst beschrieben) als \`detected_service_type\`.
2. Schreibe die **zusätzlichen Services** explizit ins \`special_notes\` Feld mit allen Details.
   Beispiel: \`"Zusätzlich gewünscht: Entsorgung von Kühlschrank, 2 Matratzen, ca. 4 m³."\`
3. Diese Regel gilt NICHT für Umzug-Zusatzservices (Einpack, Reinigung, Lager, Klavier) — die haben eigene Boolean-Felder beim Umzug.

### special_notes — was gehört hinein

- Flexibilität ("Termin flexibel", "auch am Wochenende möglich")
- Garantien/Sondereinsatz ("Abgabegarantie", "Mietkaution-Rückgabe")
- Lagerdauer-Textangaben, die nicht ins Enum passen
- Zusätzliche Services (siehe oben)
- Wichtige Einschränkungen ("nur Erdgeschoss", "kein Parkplatz")
- Jede Info, die fürs Angebot relevant ist, aber in keinem strukturierten Feld Platz findet.

**NICHT** in special_notes: Grußformeln, Signatur-Boilerplate, E-Mail-Header.

### E-Mail-/Formular-Rauschen ignorieren

Wenn der Text wie eine E-Mail aussieht:
- Ignoriere \`From:\` / \`To:\` / \`Subject:\` Header — die darin enthaltene Adresse gehört NICHT zum Kunden.
- Ignoriere Footer wie "Diese Mail wurde automatisch generiert", "Mit freundlichen Grüssen", Firmen-Signaturen.
- Der Kundenname steht meistens in der Signatur direkt vor Telefon/E-Mail.

---

Antworte **NUR** mit dem JSON-Objekt, ohne zusätzlichen Text oder Markdown-Codeblöcke.`;

// ============================================
// LEAD QUALITY VALIDATION PROMPT
// ============================================
export const VALIDATE_LEAD_QUALITY_PROMPT = `Du bist ein Qualitätsprüfer für eine Schweizer Dienstleistungsplattform (Umzug, Reinigung, Klaviertransport usw.). Deine Aufgabe ist es, eingehende Kundenanfragen auf Echtheit und Qualität zu prüfen.

### Zu prüfende Lead-Daten:
\`\`\`json
{{lead_data}}
\`\`\`

### Ausgabe-Struktur

Gib NUR dieses JSON zurück:

{
  "is_valid": boolean,
  "quality_score": number,
  "spam_signals": string[],
  "rejection_reason": string | null,
  "field_checks": {
    "email": { "valid": boolean, "issue": string | null },
    "phone": { "valid": boolean, "issue": string | null },
    "name": { "valid": boolean, "issue": string | null },
    "address": { "valid": boolean, "issue": string | null },
    "date": { "valid": boolean, "issue": string | null }
  }
}

### Prüfregeln

#### E-Mail (KRITISCH — strengste Prüfung):
Gültige TLDs: .com .ch .de .at .net .org .io .co .uk .fr .it .li .eu .me .info .biz .swiss .be .nl .es .pt .dk .se .no .fi .pl .cz .hu .ro .bg .gr .hr .si .sk .lt .lv .ee .ie .mt .cy .rs .ba .al .mk .md .ua .by
UNGÜLTIG — Tippfehler-TLDs: .como .cmo .comm .ccom .con .vom .ocm .cim .cok .coml .comn und alle unbekannten TLDs mit mehr als 6 Zeichen
UNGÜLTIG — Tippfehler-Domains: gmial.com / gamil.com / gnail.com / gmaill.com / yahooo.com / hotmial.com / outlok.com
UNGÜLTIG — Wegwerf-Domains: mailinator.com / guerrillamail.com / tempmail.com / 10minutemail.com / throwam.com / yopmail.com / sharklasers.com / trashmail.com / fakeinbox.com / maildrop.cc
UNGÜLTIG — Format: kein @ / kein Punkt nach @ / lokaler Teil nur aus Zahlen
Regel: Wenn TLD unbekannt oder länger als 6 Zeichen → UNGÜLTIG

#### Telefon (KRITISCH):
Gültig: Europäische Ländervorwahlen:
+41 CH / +49 DE / +43 AT / +33 FR / +39 IT / +423 LI / +352 LU /
+32 BE / +31 NL / +34 ES / +351 PT / +44 UK / +45 DK / +46 SE /
+47 NO / +358 FI / +48 PL / +420 CZ / +36 HU / +40 RO / +359 BG /
+30 GR / +385 HR / +386 SI / +421 SK / +370 LT / +371 LV / +372 EE /
+353 IE / +356 MT / +357 CY / +382 ME / +381 RS / +387 BA / +355 AL /
+389 MK / +373 MD / +380 UA / +375 BY
ODER Schweizer Lokalformat ohne Ländercode: 07x / 04x / 03x / 02x
UNGÜLTIG: Ländervorwahl nicht in der obigen Europa-Liste
UNGÜLTIG: unter 7 oder über 15 Ziffern (nach Entfernung von +, Leerzeichen, -)
UNGÜLTIG: Alle gleichen Ziffern — 0000000000 / 1111111111
UNGÜLTIG: Offensichtliche Sequenzen — 0123456789 / 1234567890

#### Name (MITTEL):
UNGÜLTIG: Nur Zahlen oder Sonderzeichen
UNGÜLTIG: Tastatur-Muster — asdf / qwerty / qwer / asdfgh / aaaa / xxxx / zzzz
UNGÜLTIG: Test-Namen — test / demo / admin / user / fake / anonym / nobody / noname
UNGÜLTIG: Kürzer als 2 Zeichen
VERDÄCHTIG (-10 Punkte): Vor- und Nachname identisch
VERDÄCHTIG (-10 Punkte): Nur ein Zeichen wiederholt — aaa / bbb

#### Adresse (GERING):
Hinweis: Adressen können international sein — Kunden ziehen aus dem Ausland in die Schweiz oder umgekehrt
PLZ-Prüfung NUR wenn beide Adressen eindeutig Schweizer Adressen sind: 4-stellig, 1000–9999
UNGÜLTIG: PLZ offensichtlich fake — 0000 / 1111 / 1234 / 9999 (nur bei Schweizer PLZ)
VERDÄCHTIG: Bei Umzug-Lead — Von-Adresse UND Nach-Adresse komplett leer

#### Datum (GERING):
UNGÜLTIG: Liegt vor dem heutigen Tag
UNGÜLTIG: Liegt mehr als 3 Jahre in der Zukunft
VERDÄCHTIG: Ist genau heute (sehr kurzfristig)

### Quality Score

Start: 100 Punkte. Abzüge:
- Ungültige E-Mail (Tippfehler-TLD oder Format): -45
- Wegwerf-E-Mail: -35
- Tippfehler-Domain (gmail/yahoo etc.): -30
- Fehlende E-Mail: -20
- Ungültige Telefonnummer: -25
- Fehlende Telefonnummer: -10
- Ungültiger Name: -20
- Verdächtiger Name: -10
- Ungültige PLZ: -15
- Vergangenes Datum: -10
- Verdächtiges Datum (heute): -5
- Verdächtige Adresse (Umzug ohne Adressen): -10

### Entscheidungslogik

is_valid = FALSE wenn EINES dieser Kriterien zutrifft:
- quality_score < 40
- E-Mail ungültig (Tippfehler-TLD, Wegwerf-Domain, Formatfehler)
- Telefon ungültig

is_valid = TRUE wenn:
- quality_score >= 40
- E-Mail gültig oder fehlt aber kein anderes kritisches Signal
- Telefon gültig oder fehlt aber kein anderes kritisches Signal

rejection_reason: Nur wenn is_valid = false. Kurz, klar, auf Deutsch. Beispiel: "E-Mail-Adresse ungültig: '.como' ist keine gültige Domain-Endung."

spam_signals: Alle gefundenen Probleme als Array — auch wenn is_valid = true.

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text oder Markdown.`;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Replace template variables in a prompt
 */
export function compilePrompt(
  prompt: string, 
  variables: Record<string, string | number | boolean | null | undefined>
): string {
  let compiled = prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    compiled = compiled.replace(regex, String(value ?? ''));
  }
  
  return compiled;
}

/**
 * Create the extract lead prompt with raw text.
 *
 * Injects today's date so the model never falls back to its training-data year
 * (the prompt was hallucinating 2023 for relative dates like "ab 1. April").
 */
export function createExtractLeadPrompt(
  rawText: string,
  now: Date = new Date(),
): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return compilePrompt(EXTRACT_LEAD_PROMPT, {
    raw_text: rawText,
    today_iso: `${yyyy}-${mm}-${dd}`,
    current_year: yyyy,
    next_year: yyyy + 1,
  });
}

/**
 * Create the validate lead quality prompt (JSON lead payload)
 */
export function createValidateLeadQualityPrompt(leadData: Record<string, unknown>): string {
  return compilePrompt(VALIDATE_LEAD_QUALITY_PROMPT, {
    lead_data: JSON.stringify(leadData, null, 2),
  });
}
