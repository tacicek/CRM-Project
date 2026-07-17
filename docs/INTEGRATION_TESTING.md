# CRM Test Altyapısı — Kritik İş Akışı Koruması

> **Durum (2026-07-16):** İterasyon 1 (ağsız güvenli temel) **ve** İterasyon 2 (local
> Supabase DB/RLS/token/ilişki testleri) **uygulandı ve yeşil**. DB testleri sanitize
> edilmiş bir **baseline** üzerinde çalışır (276-migration zinciri from-scratch bootlamıyor).
> Tam rehber: **[../supabase-test/README.md](../supabase-test/README.md)**. TypeScript
> gate düzeltildi: `npm run type-check` artık `tsc -b` (gerçek, 108 baseline hatasıyla
> kırmızı); `npm run type-check:test-infra` test altyapısı için yeşil. Edge Function + E2E
> hâlâ İterasyon 3. Bu görevde commit/push yapılmadı.

## Test piramidi (bu proje için seçilen katmanlar)

| Katman | Ne test eder | Araç | Durum |
|---|---|---|---|
| **Unit** (saf fonksiyon) | pricing, status machine, PDF/QR invariant, i18n, domain | Vitest | ✅ 233 mevcut + yeni |
| **Contract** (compile-time) | `types.ts` ↔ migration kritik kolonlar; fixture ↔ Insert tipi | Vitest + `tsc` | ✅ uygulandı |
| **Env guard** (fail-closed) | testin prod'a bağlanmasını reddetme | Vitest (saf) | ✅ uygulandı |
| **DB integration** | RLS izolasyonu, FK, trigger, RPC atomiklik, status geçiş | local Supabase + pg | ⏳ İterasyon 2 |
| **Edge Function** | auth/validation/redaction, provider adapter mock | handler + adapter | ⏳ İterasyon 2 |
| **Browser E2E** | 3-4 kritik yol | Playwright (kurulu değil) | ⏳ İterasyon 3, onay gerek |

**Kural:** her işi en düşük maliyetli doğru katmanda tut. RLS/token yalnız gerçek
DB'de doğrulanır; şema sözleşmesi compile-time'da; saf mantık unit'te. Her şeyi E2E
yapma.

## Ortam stratejisi — neden local Supabase

| Seçenek | RLS | Auth JWT | RPC | Edge Fn | Prod'a yanlış bağlanma | Karar |
|---|---|---|---|---|---|---|
| A. `supabase start` (local) | ✅ | ✅ | ✅ | ✅ | Guard ile engellenir | **Seçildi** (İter. 2) |
| B. Docker Compose Postgres | ✅ | kısmi | ✅ | ✗ | düşük | gereksiz, A varken |
| C. Yalnız Postgres container | ✅ | ✗ | ✅ | ✗ | düşük | JWT/Storage yok |
| D. Rollback-only DB | ✅ | ✗ | kısmi | ✗ | düşük | auth eksik |
| E. Tam mock | ✗ | ✗ | ✗ | ✗ | yok | RLS'i gerçekten test etmez |

Docker + Supabase CLI 2.98.2 makinede **mevcut**. Ama **276 migration + 341 RLS
policy** var ve **5 migration `vault.` + birkaçı `pg_cron`/`pg_net`** kullanıyor →
`supabase db reset`'in sıfırdan temiz bootlayacağı **doğrulanmadan** DB testleri
"geçti" sayılamaz. `supabase start` ~10 Docker imajı çeker (ağ) → İterasyon 2 onaya
bağlı.

## Production koruma kilidi (fail-closed) — UYGULANDI

[src/test/env-guard.ts](../src/test/env-guard.ts): `assertSafeTestEnvironment()` saf
fonksiyon. Her DB/edge integration testi bağlanmadan ÖNCE çağırır. **Varsayılan
reddeder**; şu üç sinyalin HEPSİ gerekmedikçe throw eder:

1. `CRM_TEST_ENV=1` açık opt-in (yalnız `NODE_ENV=test` **yetmez**),
2. Supabase URL host'u yerel allowlist'te (`localhost`/`127.0.0.1`/test container),
3. API portu 54321, DB host/portu yerel.

Prod host, gerçek domain, boş/bozuk URL, yanlış port → **çalışmayı reddeder**.
11 unit testi ([env-guard.test.ts](../src/test/__tests__/env-guard.test.ts)) bunu kanıtlar.

## Fixture & izolasyon — UYGULANDI

[src/test/fixtures.ts](../src/test/fixtures.ts): tamamen sentetik, deterministik,
generated `Insert` tiplerine karşı **tipli** (şema kayması = derleme hatası).

- Sentetik: `@example.test` (routing yapmayan reserved TLD), `+41790000000`,
  `Teststrasse 1, 8000 Zürich`. Gerçek müşteriye benzemez.
- Deterministik: sabit UUID + sabit tarih (Date.now/Math.random YOK) → flaky yok,
  paralel çalışmada id çakışması yok.
- **İki tenant** (A + B) → İterasyon 2 RLS izolasyon testleri için hazır.

Şema sözleşmesi ([schema-contract.test.ts](../src/test/__tests__/schema-contract.test.ts)):
tüm `types.ts`'i snapshot'lamaz; yalnız son migration'larda oynayan kritik kolonları
compile-time pinler — `quittungen.auftrag_id`, `rechnungen.auftrag_id`/`qr_*`,
`offer_items.amount_basis`/`kostendach_max`, `offers.access_token`, `companies.translations`,
`auftrag_status` enum. Migration var + type eksikse `tsc -p tsconfig.app.json`'da **fail eder**.

## Komut matrisi (tasarım)

Bugün çalışan (ağsız):

```
npm test                 # tüm Vitest (unit + contract + guard) — 253 test
npx vitest run src/test  # yalnız yeni test-altyapısı
npx tsc --noEmit -p tsconfig.app.json   # GERÇEK type gate (kök type-check boştur)
```

İterasyon 2'de eklenecek (local Supabase onaylanınca):

```
test:unit         vitest run                         # hızlı, DB'siz
test:db           supabase start && supabase db reset && vitest run -c vitest.integration.ts
test:edge         deno test supabase/functions/**    # handler + adapter mock
test:e2e          playwright test                    # 3-4 kritik yol
test:ci           type-check → lint → unit → build → (db) → (edge) → (e2e)
```

**CI kuralı:** `supabase start` başarısızsa integration adımı **"passed" gösteremez** —
açık fail veya bilinçli skip sebebi üretir. Unit adımı hızlı ve DB'den bağımsız kalır.

## İterasyon 2 planı (onay + `supabase start` doğrulaması sonrası)

1. `supabase start` + `db reset` ile **276 migration'ın sıfırdan bootladığını doğrula**
   (vault/cron migration'ları ilk şüpheli). Bootlamazsa: hangi migration, neden —
   raporla; gerekirse **test-only** seed/uyarlama öner (mevcut migration'ları değiştirme).
2. `vitest.integration.ts` (ayrı proje/config) + testte `assertSafeTestEnvironment` gate.
3. **RLS izolasyonu** (fixtures A/B): A kendi lead'ini okur; B'ninkini okuyamaz; giriş
   yapmamış kullanıcı okuyamaz; membership'siz erişim yok. (341 policy → çekirdek tablolar önce.)
4. **Public token** (`get_offer_by_token`/`update_offer_by_token`/`replace_offer_items`):
   geçerli token yalnız ilgili kaydı döndürür; geçersiz/expired reddedilir; dönüş
   **allowlist kolonları** (tüm row snapshot değil); public fiyat/company değiştiremez;
   ham token log'a düşmez.
5. **Lead→Offer→Auftrag→Rechnung/Quittung** ilişki + nummer trigger + status başlangıç.
6. **Atomiklik**: `atomic_accept_lead`, `replace_offer_items` — yarım veri kalmaz;
   eşzamanlı iki accept tutarlı sonuç.
7. **Status geçiş sorusu**: "FE'nin yasakladığı geçiş doğrudan Supabase update ile
   yapılabiliyor mu?" — DB bilinçli serbest bırakıyorsa **mimari karar olarak raporla**,
   otomatik değiştirme.

## İterasyon 3 (edge + E2E)

- Edge Function: provider (Resend/Twilio/Google/AI) çağrısını küçük saf adaptöre ayır,
  gerçek çağrı yapma. Test: 401/400/cross-company-reddi/adapter-payload/provider-hatasında
  status `sent`/`paid` OLMAZ/alıcı log'da maskeli/PDF base64 log'a yazılmaz.
- E2E: Playwright kurulumu **kullanıcı onayı gerektirir** (kurulu değil). Local Supabase'e
  karşı, gerçek e-posta yok, artifact'te müşteri verisi yok, prod URL'ye karşı reddeder.

## Kesin kurallar (hatırlatma)

- Prod Supabase'e yazma testi YOK. RLS kapatma/bypass YOK. `as any`/suppression YOK.
- Gerçek müşteri verisi/PDF fixture YOK. Gerçek Resend/Twilio/Google/AI çağrısı YOK.
- Service-role key frontend teste/çıktıya girmez. `.env`/secret commit edilmez.
- `dist`, test DB, secret commit edilmez.
