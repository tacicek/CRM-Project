# Self-Hosted Supabase — MCP & Bağlantı Rehberi

## Genel Bilgi

| Alan | Değer |
|------|-------|
| Sunucu IP | `213.199.45.205` |
| Supabase platform | Self-hosted (Coolify üzerinde) |
| Coolify path | `/data/coolify/services/aw0c0w440o8k0cccokow0csw/` |
| DB kullanıcı | `postgres` |
| DB adı | `postgres` |
| DB şifre | `9rOpP6kv1FGkRd1Cu4nvNzkKTxO1t6sd` |

---

## 1. MCP Bağlantısı (Cursor içinden)

MCP ayarları `~/.cursor/mcp.json` dosyasında tanımlı (iki sunucu var):

```json
{
  "mcpServers": {
    "supabase-postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:9rOpP6kv1FGkRd1Cu4nvNzkKTxO1t6sd@localhost:5433/postgres"
      ]
    },
    "selfhosted-supabase": {
      "command": "/home/tuncay/.bun/bin/bun",
      "args": [
        "run",
        "/home/tuncay/Documents/selfhosted-supabase-mcp/dist/index.js",
        "--url", "http://213.199.45.205:8000",
        "--anon-key", "<ANON_KEY>",
        "--service-key", "<SERVICE_ROLE_KEY>",
        "--db-url", "postgresql://postgres:<DB_PASS>@localhost:5433/postgres"
      ]
    }
  }
}
```

| Sunucu | Araçlar | Gereksinim |
|--------|---------|------------|
| `supabase-postgres` | Ham SQL sorguları | SSH tüneli |
| `selfhosted-supabase` | 50+ Supabase tool (schema, auth, storage, RLS...) | SSH tüneli + Supabase URL |

> **Önemli:** Her iki MCP sunucusu da `localhost:5433` üzerinden bağlanıyor.
> Bu bağlantı çalışmak için SSH tüneli **açık olmalı**.

---

## 2. SSH Tüneli (MCP çalışmadan önce açılmalı)

SSH tünelini local terminalinde aç:

```bash
ssh -L 5433:localhost:5432 root@213.199.45.205 -N
```

**Not — CachyOS SSH config warning fix:**
`/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` dosyası `nobody` sahibiyle geliyor, SSH bunu warning olarak gösteriyor ama SSH çalışmaya devam eder. Uyarıyı bastırmak için:
```bash
ssh -F /dev/null -L 5433:localhost:5432 root@213.199.45.205 -N
```

- `-L 5433:localhost:5432` → localhost:5433 portunu sunucudaki postgres:5432'ye yönlendirir
- `-N` → sadece tünel, komut çalıştırmaz
- `-F /dev/null` → CachyOS SSH config uyarısını atlar

Tünelin çalışıp çalışmadığını test et:
```bash
ss -tlnp | grep 5433
# Çıktıda "ssh" görünüyorsa tünel aktif
```

---

## 3. SSH ile Sunucuya Bağlanma

```bash
ssh root@213.199.45.205
```

---

## 4. DB'ye Doğrudan Erişim (Sunucu üzerinden)

SSH'a girdikten sonra PostgreSQL container'ına bağlan:

```bash
docker exec -i $(docker ps --filter "name=supabase-db" -q | head -1) psql -U postgres -d postgres
```

Tek satır komut çalıştırmak için:
```bash
docker exec -i $(docker ps --filter "name=supabase-db" -q | head -1) psql -U postgres -d postgres -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
```

---

## 5. Edge Functions Yönetimi

### Fonksiyon dosyalarının yolu (sunucuda):
```
/data/coolify/services/aw0c0w440o8k0cccokow0csw/volumes/functions/<fonksiyon-adı>/index.ts
```

### Güncelleme (local Mac'ten SCP ile):
```bash
scp supabase/functions/<fonksiyon-adı>/index.ts \
  root@213.199.45.205:/data/coolify/services/aw0c0w440o8k0cccokow0csw/volumes/functions/<fonksiyon-adı>/index.ts
```

### Edge functions container'ını yeniden başlat:
```bash
docker restart $(docker ps --filter "name=supabase-edge" -q | head -1)
```

### Edge function loglarını izle:
```bash
docker logs -f $(docker ps --filter "name=supabase-edge" -q | head -1) 2>&1 | grep -A5 "import-manual-lead\|extract-anfrage"
```

---

## 6. Ortam Değişkenleri

Edge function'ların ortam değişkenleri:
```
/data/coolify/services/aw0c0w440o8k0cccokow0csw/.env
```

Mevcut kritik değişkenler:
- `ANTHROPIC_API_KEY` → Claude AI (extract-anfrage-ai için)
- `SUPABASE_URL` → Supabase API adresi
- `SUPABASE_SERVICE_ROLE_KEY` → Service role key

> **Not:** `.env` dosyasını değiştirdikten sonra `docker restart` yetmez!
> Coolify üzerinden **Redeploy** yapman gerekir (veya `docker compose up --force-recreate`).

---

## 7. Supabase Studio (UI)

Tarayıcıdan erişim:
```
http://213.199.45.205:8000
```

Login bilgileri Coolify'daki environment variables içinde:
- `DASHBOARD_USERNAME`
- `DASHBOARD_PASSWORD`

---

## 8. Sık Kullanılan Komutlar

```bash
# Tüm container'ları listele
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# DB migration çalıştır
docker exec -i $(docker ps --filter "name=supabase-db" -q | head -1) \
  psql -U postgres -d postgres < supabase/migrations/dosya.sql

# Leads tablosunun kolonlarını gör
docker exec -i $(docker ps --filter "name=supabase-db" -q | head -1) \
  psql -U postgres -d postgres -c "\d public.leads"

# RLS politikalarını listele
docker exec -i $(docker ps --filter "name=supabase-db" -q | head -1) \
  psql -U postgres -d postgres -c \
  "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename;"
```
