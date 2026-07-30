# Self-Hosted Supabase — MCP & Bağlantı Rehberi

## Genel Bilgi

| Alan | Değer |
|------|-------|
| Sunucu IP | `213.199.45.205` |
| Supabase platform | Self-hosted (Coolify üzerinde) |
| Coolify path | `/data/coolify/services/aw0c0w440o8k0cccokow0csw/` |
| DB kullanıcı | `postgres` |
| DB adı | `postgres` |
| DB şifre | **burada durmuyor** — aşağıya bak |


### DB parolası nerede duruyor (2026-07-30)

**Tek kaynak Coolify'dır.** Bu dosyada, başka bir dokümanda ya da repoda
herhangi bir yerde parolanın kopyası tutulmaz.

Okumak için (sunucuda):
```bash
grep '^SERVICE_PASSWORD_POSTGRES=' \
  /data/coolify/services/aw0c0w440o8k0cccokow0csw/.env
```

Compose bu **tek** değişkenden türetiyor: `PGRST_DB_URI` (PostgREST),
`GOTRUE_DB_DATABASE_URL` (Auth), `DATABASE_URL` (Storage), `DB_PASSWORD`
(Realtime/Analytics), `PG_META_DB_PASSWORD`, `SUPABASE_DB_URL` (Edge
Functions). Parolası olan yedi rolün hepsi aynı değeri taşıyor:
`postgres`, `authenticator`, `pgbouncer`, `supabase_admin`,
`supabase_auth_admin`, `supabase_functions_admin`, `supabase_storage_admin`.

⚠️ **Aynı `.env` içinde dört yanıltıcı anahtar var:** `POSTGRES_PASSWORD`,
`DB_PASSWORD`, `PGPASSWORD`, `PG_META_DB_PASSWORD`. Bunlar **eski, artık
geçersiz** 28 karakterlik bir değer taşıyor ve compose onları kullanmıyor —
compose her yerde `${SERVICE_PASSWORD_POSTGRES}` yazıyor. Bir sorunu teşhis
ederken bu dördüne bakıp yanlış sonuca varma.

Parola değiştirme: `scripts/rotate-db-password.sh` (varsayılan kuru
çalıştırma; yedi rolü, `.env`'i ve yukarıdaki dört kalıntıyı birlikte günceller).

> **Geçmiş not:** Bu dosya 2026-07-30'a kadar canlı parolayı düz metin
> taşıyordu ve o hâliyle git geçmişinde duruyor. Geçmişi yeniden yazmak
> gerekmiyor — parola döndürüldüğünde oradaki değer kendiliğinden değersizleşir.

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
        "postgresql://postgres:<DB_PAROLASI>@localhost:5433/postgres"
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
        "--db-url", "postgresql://postgres:<DB_PAROLASI>@localhost:5433/postgres"
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

### Sunucudaki `localhost:5432` gerçekte nedir (2026-07-30)

Bu tünelin hedefi **doğrudan Postgres değil.** Coolify, veritabanı için
"herkese açık port" ayarı açıldığında bir nginx TCP proxy'si kuruyor:

```
sunucu 127.0.0.1:5432
  → x0ww444o440wgkkw04s0s8c8-proxy   (nginx stream, /data/coolify/databases/x0ww…/proxy/)
    → supabase-db-aw0c0w440o8k0cccokow0csw:5432
```

CLAUDE.md'de yıllarca "localhost:5432'ye yönlendirirsen başka bir projenin
proxy container'ına düşersin" diye duran not **bunu** kastediyordu. Başka bir
proje değil — CRM veritabanının kendi Coolify kaynağı.

**Bu proxy 2026-07-30'da loopback'e bağlandı.** Öncesinde `0.0.0.0:5432` idi,
yani veritabanı internetten erişilebilirdi: günlüklerde 5 gün içinde
**59 749 başarısız giriş denemesi** vardı (`dbadmin`, `dbuser`, `postgres`,
`ALICE` …), başarılı giriş **yok**. Değiştirilen tek şey port eşlemesi:

```yaml
# /data/coolify/databases/x0ww444o440wgkkw04s0s8c8/proxy/docker-compose.yaml
ports:
  - '127.0.0.1:5432:5432'   # önceden: '5432:5432'
```

Yedek aynı dizinde: `docker-compose.yaml.vor-loopback`.

⚠️ **Bu, Coolify arayüzünün dışında yapılmış elle bir düzenlemedir.** Coolify
o veritabanının "Public Port" ayarına dokunulursa dosyayı yeniden üretebilir ve
port tekrar `0.0.0.0`'a açılabilir. Kalıcı çözüm arayüzden kapatmaktır — ama o
zaman `localhost:5432` tamamen kaybolur ve bu tünel container IP'sini
(`10.0.2.14` gibi, restart'larda değişir) hedeflemek zorunda kalır. Şu anki
durum bilinçli bir tercih: internet kapalı, tünel IP'den bağımsız çalışıyor.

Kontrol:
```bash
# sunucuda — yalnızca 127.0.0.1 görünmeli, 0.0.0.0 GÖRÜNMEMELİ
ss -tlnp | grep :5432
# dışarıdan — "Connection refused" beklenir
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/213.199.45.205/5432'
```

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
