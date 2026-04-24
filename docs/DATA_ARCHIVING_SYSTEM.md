# 🗄️ Datenarchivierungssystem - Offerio

## Uebersicht

Das Datenarchivierungssystem ermoeglicht die automatische und manuelle Archivierung alter Daten aus der Supabase-Datenbank, um Speicherkosten zu optimieren und die Datenbankleistung zu verbessern.

---

## 📊 Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARCHIVIERUNGSSYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │   Admin     │    │   Supabase   │    │   External Storage  │   │
│  │   Panel     │───▶│   Database   │───▶│   (Optional)        │   │
│  └─────────────┘    └──────────────┘    └─────────────────────┘   │
│        │                   │                      │               │
│        ▼                   ▼                      ▼               │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │  Manual     │    │   Archive    │    │  • Google Drive     │   │
│  │  Export     │    │   Logs       │    │  • Dropbox          │   │
│  │  (JSON/CSV) │    │   Table      │    │  • AWS S3           │   │
│  └─────────────┘    └──────────────┘    │  • Local Download   │   │
│                                         └─────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              EDGE FUNCTION: auto-archive                    │   │
│  │              (Monatlicher Cron Job)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Dateistruktur

```
leadflow-swiss-connect/
├── supabase/
│   ├── migrations/
│   │   └── 20251230500000_data_archiving_system.sql  # DB Schema
│   └── functions/
│       └── auto-archive/
│           └── index.ts                               # Edge Function
├── src/
│   ├── types/
│   │   └── archive.ts                                 # TypeScript Types
│   ├── lib/
│   │   └── archiveUtils.ts                           # Utility Functions
│   └── pages/
│       └── admin/
│           └── ArchiveManagement.tsx                  # Admin UI
└── docs/
    └── DATA_ARCHIVING_SYSTEM.md                       # Diese Dokumentation
```

---

## 🗃️ Datenbanktabellen

### 1. `archive_settings`

Speichert die globalen Archivierungseinstellungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschluessel |
| `is_enabled` | BOOLEAN | Auto-Archivierung aktiviert |
| `auto_archive_day` | INTEGER | Tag des Monats (1-28) |
| `leads_retention_days` | INTEGER | Aufbewahrung fuer Leads |
| `offers_retention_days` | INTEGER | Aufbewahrung fuer Offerten |
| `email_logs_retention_days` | INTEGER | Aufbewahrung fuer E-Mail Logs |
| `notifications_retention_days` | INTEGER | Aufbewahrung fuer Benachrichtigungen |
| `default_export_format` | TEXT | 'json' oder 'csv' |
| `notify_on_archive` | BOOLEAN | E-Mail-Benachrichtigung |
| `notify_email` | TEXT | E-Mail-Addressse fuer Benachrichtigungen |

### 2. `archive_logs`

Protokolliert alle Archivierungsvorgänge.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschluessel |
| `archive_name` | TEXT | Name des Archivs |
| `archive_type` | TEXT | Typ (leads, offers, etc.) |
| `records_archived` | INTEGER | Anzahl archivierter Datensätze |
| `file_size_bytes` | BIGINT | Dateigroesse |
| `storage_type` | TEXT | Speicherort |
| `status` | TEXT | Status (pending, completed, failed) |
| `source_data_deleted` | BOOLEAN | Quelldaten geloescht |

### 3. `archive_snapshots`

Speichert archivierte Daten als JSONB.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschluessel |
| `archive_log_id` | UUID | Referenz zum Log |
| `data` | JSONB | Archivierte Daten |
| `record_count` | INTEGER | Anzahl Datensätze |
| `checksum` | TEXT | Pruefsumme |

---

## 🔧 Archivierbare Datentypen

| Typ | Tabelle | Archivierungskriterien |
|-----|---------|------------------------|
| **Leads** | `leads` | Status: completed, cancelled, expired, rejected |
| **Offerten** | `offers` | Status: sent, accepted, rejected, expired |
| **E-Mail Logs** | `email_logs` | Alle älteren als X Tage |
| **Benachrichtigungen** | `notifications` | Gelesen und älter als X Tage |
| **Termine** | `appointments` | Status: completed, cancelled |

---

## 🚀 Verwendung

### Admin Panel

1. Navigieren Sie zu **Admin → System → Datenarchiv**
2. Uebersicht der archivierbaren Daten
3. Manuelle Archivierung erstellen
4. Einstellungen konfigurieren

### Manuelle Archivierung

```typescript
import { createArchive } from "@/lib/archiveUtils";

const result = await createArchive({
  archive_type: "leads",
  storage_type: "local",
  export_format: "json",
  delete_after_archive: false,
});

if (result.success) {
  console.log(`${result.records_archived} Datensätze archiviert`);
  // Download URL verfuegbar
}
```

### Automatische Archivierung

Die Edge Function `auto-archive` wird automatisch am konfigurierten Tag jedes Monats ausgefuehrt.

**Deployment:**
```bash
npx supabase functions deploy auto-archive
```

**Manueller Aufruf:**
```bash
curl -X POST https://<project>.supabase.co/functions/v1/auto-archive \
  -H "Authorization: Bearer <anon-key>"
```

---

## 📤 Export-Formate

### JSON (Empfohlen)

```json
{
  "version": "1.0",
  "export_date": "2024-12-30T12:00:00Z",
  "archive_type": "leads",
  "total_records": 1250,
  "data_from": "2024-01-01T00:00:00Z",
  "data_to": "2024-09-30T23:59:59Z",
  "checksum": "a1b2c3d4",
  "data": [
    { "id": "...", "created_at": "...", ... },
    ...
  ]
}
```

**Vorteile:**
- Vollständige Datenstruktur
- Wiederherstellbar
- Nested Data unterstuetzt

### CSV

```csv
id,created_at,status,customer_email,...
abc-123,2024-01-15,completed,max@example.com,...
def-456,2024-02-20,cancelled,anna@example.com,...
```

**Vorteile:**
- Excel-kompatibel
- Einfache Analyse
- Kompaktere Groesse

---

## 💾 Speicheroptionen

### 1. Lokaler Download (Standard)

- Direkter Download als Datei
- Keine Cloud-Konfiguration noetig
- Benutzer muss manuell sichern

### 2. Google Drive (Geplant)

```typescript
// Konfiguration in archive_settings
{
  google_drive_enabled: true,
  google_drive_folder_id: "1abc..."
}
```

### 3. Dropbox (Geplant)

```typescript
{
  dropbox_enabled: true,
  dropbox_folder_path: "/Backups/Offerio"
}
```

### 4. AWS S3 (Geplant)

```typescript
{
  s3_enabled: true,
  s3_bucket_name: "offerio-archives",
  s3_region: "eu-central-1"
}
```

---

## 💰 Kostenoptimierung

### Supabase Speicherkosten

| Plan | Inklusiv | Zusätzlich |
|------|----------|------------|
| Free | 500 MB | - |
| Pro | 8 GB | $0.125/GB |
| Team | 8 GB | $0.125/GB |

### Empfohlene Strategie

1. **90-Tage-Regel**: Abgeschlossene Leads nach 90 Tagen archivieren
2. **E-Mail Logs**: Nach 90 Tagen loeschen (nur Metadaten behalten)
3. **Benachrichtigungen**: Nach 30 Tagen loeschen
4. **Monatliche Ueberpruefung**: Statistiken im Admin Panel pruefen

### Geschätzte Einsparungen

| Datenmenge | Vor Archivierung | Nach Archivierung | Einsparung |
|------------|------------------|-------------------|------------|
| 10'000 Leads | ~50 MB | ~10 MB | 80% |
| 100'000 E-Mails | ~100 MB | ~20 MB | 80% |
| Total | ~150 MB | ~30 MB | ~$15/Monat |

---

## 🔒 Sicherheit

### Row Level Security (RLS)

```sql
-- Nur Admins koennen Archive verwalten
CREATE POLICY "Admins can manage archive settings"
  ON public.archive_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );
```

### Datenintegrität

- Checksums fuer alle Archive
- Validierung vor Loeschung
- Wiederherstellungsmoeglichkeit

---

## 🔄 Wiederherstellung

### Aus JSON-Archiv

```typescript
// Archiv lesen
const archiveData = JSON.parse(fileContent);

// Daten wiederherstellen
for (const record of archiveData.data) {
  await supabase
    .from('leads')
    .upsert(record, { onConflict: 'id' });
}
```

### Aus Supabase Snapshot

```sql
-- Daten aus archive_snapshots wiederherstellen
INSERT INTO leads
SELECT * FROM jsonb_populate_recordset(
  null::leads,
  (SELECT data FROM archive_snapshots WHERE archive_log_id = 'xxx')
);
```

---

## 📊 Monitoring

### Archive Statistiken

```typescript
const stats = await getArchiveStatistics();

// Beispiel Output:
[
  { table_name: "leads", total_records: 5000, archivable_records: 1200 },
  { table_name: "offers", total_records: 3000, archivable_records: 800 },
  ...
]
```

### Benachrichtigungen

- E-Mail nach jeder automatischen Archivierung
- Warnung bei Fehlern
- Monatliche Zusammenfassung

---

## 🛠️ Fehlerbehebung

### Problem: Edge Function schlägt fehl

```bash
# Logs pruefen
npx supabase functions logs auto-archive

# Funktion neu deployen
npx supabase functions deploy auto-archive
```

### Problem: RLS blockiert Zugriff

```sql
-- Pruefen Sie die Benutzerrolle
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Policy temporär deaktivieren (nur zum Testen!)
ALTER TABLE archive_settings DISABLE ROW LEVEL SECURITY;
```

### Problem: Grosse Datenmenge

```typescript
// Daten in Chunks verarbeiten
const CHUNK_SIZE = 1000;
const totalRecords = await countRecords();

for (let offset = 0; offset < totalRecords; offset += CHUNK_SIZE) {
  const chunk = await fetchChunk(offset, CHUNK_SIZE);
  await archiveChunk(chunk);
}
```

---

## 📋 Checkliste fuer Produktion

- [ ] Migration ausfuehren: `npx supabase db push`
- [ ] Edge Function deployen: `npx supabase functions deploy auto-archive`
- [ ] Archive-Einstellungen im Admin Panel konfigurieren
- [ ] Benachrichtigungs-E-Mail eintragen
- [ ] Aufbewahrungsfristen festlegen
- [ ] Erstes manuelles Archiv erstellen und testen
- [ ] Cron Job fuer automatische Archivierung einrichten

---

## 🔗 Verwandte Dokumentation

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 📞 Support

Bei Fragen oder Problemen:
- GitHub Issues erstellen
- Admin kontaktieren: admin@offerio.ch

---

*Letzte Aktualisierung: 30. Dezember 2024*

