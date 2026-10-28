# Edge Functions: `deno check` borcu — teşhis ve plan

> **Ölçüm tarihi:** 2026-10-10, commit `fix/edge-supabase-js-pinned` (PR #46, supabase-js her yerde
> `2.39.3`). Komut: her `supabase/functions/*/index.ts` için `deno check --no-lock`.
> **Sonuç:** 51 fonksiyon, **23'ü hatalı, 120 hata.** `deno check` hiçbir zaman kapı olmadı; Deno
> çalışma zamanı tip kontrolü yapmadığı için bunların hiçbiri deploy'u durdurmadı.
>
> Bu belge "hepsini düzelt" listesi değil, **kök neden kümeleri** ve sırasıdır: 120 hatanın
> 109'u **altı** kök nedene iniyor. Üçü yalnız tip hatası, üçü çalışma zamanında da yanlış
> davranış üretiyor (ya da üretecek). Önce onlar.

---

## 0. Dağılım

| Kod | Adet | Anlamı |
|---|---|---|
| TS2339 | 70 | Özellik tipte yok (`GenericStringError` 41, `never` 19, dar nesne tipleri 10) |
| TS2345 | 20 | Argüman tipi uyuşmuyor (`SecretsReader` 11, `never` client 4, diğer) |
| TS18046 | 8 | `catch (error)` → `error` `unknown`, daraltılmadan `.message` |
| TS7006 | 6 | Örtük `any` parametre (send-offer `surcharges`) |
| TS2554 | 5 | Fazla argüman (`wrapEmailDocument(inner, locale)` tek argümanlı sürüme) |
| TS2769 | 3 | Overload uyuşmazlığı (`never` client insert 2, `crypto.subtle.importKey` 1) |
| TS1005 | 3 | **Sözdizimi hatası** (generate-sitemap satır 10) |
| TS2322 / TS7005 / TS2353 / TS2304 | 5 | tekil; aşağıda |

Dosya bazında: inbound-email-lead 31 · validate-lead-quality 26 · calendar-feed 16 · send-offer 7 ·
notify-auftrag-reminder 7 · send-quittung 5 · generate-sitemap 4 · 16 dosya 1–3.

---

## 1. Kök neden kümeleri

Sıra = öncelik. **Çalışma zamanı etkisi** olanlar önce.

### A — `send-rechnung-email`: `verifyCompanyMembership` çağrılıyor ama import edilmemiş · **P0, gerçek hata**

- `send-rechnung-email/index.ts:201` — `const istMitglied = await verifyCompanyMembership(...)`;
  dosyada import yok (TS2304). Commit `e4e40a94` (Sicherheitspaket) ile geldi.
- **Canlıda patlamıyor, çünkü canlı bu dosyanın eski sürümünü çalıştırıyor** (matris §3: DRIFT).
  Repo sürümü deploy edildiği gün her fatura e-postası üyelik kontrolünde `ReferenceError` → 500.
  Fail-closed, ama kırık.
- Edge-auth-manifest kapısı bunu görmedi: regex `verifyCompanyMembership(` **çağrısını** arıyor,
  tanımlı olup olmadığını değil. Kapının dersi: *`deno check` olmadan "jwt-member prüft
  Mitgliedschaft" yeşil ama çalışmayan bir koddur.*
- **Düzeltme:** `import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";`
  Tek satır. Deploy'u §3'teki R-4 kararına bağlı (dosya canlıda eski; sadece import eklemek için
  tüm R-4 değişiklik kümesi gitmiş olur — ayrı karar).

### B — `wrapEmailDocument(inner, locale)` tek argümanlı `_shared/emailLayout.ts`'e gidiyor · **P0, i18n hatası**

- 5 × TS2554: `send-lead-confirmation:261`, `send-quittung:135`, `validate-lead-quality:202`,
  `_shared/invoiceEmailTemplate.ts:162` (send-quittung **ve** send-rechnung-email bunu kullanır).
- İki `wrapEmailDocument` var: `_shared/emailLayout.ts` (1 argüman, `<html lang="de">` sabit) ve
  `_shared/i18n/emailLayout.ts` (2 argüman, `lang` gerçekten set edilir). Çağıranlar locale geçiyor
  ama yanlış dosyadan import ediyor → JS fazla argümanı sessizce yutar → **FR/EN müşteri
  e-postası `lang="de"` ile gider.** `send-appointment-confirmation` aynı hatayı 2026-08'de
  bulup kendi içinde düzeltmişti (dosya başındaki yorum); diğerleri düzeltilmedi.
- `_shared/emailLayout.ts`'i import eden 6 dosya: `emailTemplates.ts`, `invoiceEmailTemplate.ts`,
  `send-lead-confirmation`, `send-quittung`, `send-rechnung-email`, `validate-lead-quality`.
- **Düzeltme:** altısında import'u `_shared/i18n/emailLayout.ts`'e çevir; `emailTemplates.ts`
  locale'i parametre olarak alsın (doküman dili — React context yok, argüman; CLAUDE.md §11b).
  Sonra `_shared/emailLayout.ts`'i **sil** — ikinci kopya ayrışmanın kaynağıydı.
- Test: `_shared/__tests__` altında saf bir test — her üç locale için `wrapEmailDocument` çıktısında
  `lang="fr"`/`"en"` olduğunu doğrula; ve `grep -rn 'from "../_shared/emailLayout.ts"'` boş.

### C — `SecretsReader` yapısal tipi 2.39.3 client'ına uymuyor · 11 hata, 1 düzeltme

- `_shared/companySecrets.ts:37` — `loadCompanySecrets(supabase: SecretsReader, …)`. Elle
  yazılmış `from().select().eq().maybeSingle()` zinciri postgrest-js'in gerçek dönüş tipiyle
  (`PostgrestSingleResponse`: `data`, `error: PostgrestError|null`, `count`, `status`…) uyuşmuyor.
  10 dosyada TS2345. **Yalnız tip** — çalışma zamanında sorun yok.
- **Düzeltme:** parametreyi pinlenmiş modülden `SupabaseClient` yap (`verifyCompanyMembership`
  zaten öyle). Sürümler artık tek olduğu için (PR #46) bu çalışır. `SecretsReader` interface'i sil.
- Not: `send-appointment-confirmation` ve `send-offer-acceptance-confirmation` bu helper'ı bilerek
  kullanmıyor (üç değerli sonuç: hata ≠ "anahtar yok"). Onlara dokunma.

### D — `inbound-email-lead`: `ReturnType<typeof createClient>` → `never` tablolar · 24 hata, 1 düzeltme

- `inbound-email-lead/index.ts:108` — `type ServiceClient = ReturnType<typeof createClient>`.
  Generic'ler varsayılana düşüp `SupabaseClient<unknown, never, GenericSchema>` oluyor; her
  `.from("…")` `never` → 19 × TS2339, 2 × TS2322, 2 × TS2769 (insert), 1 × TS2345 (`rpc`).
  **Yalnız tip.**
- **Düzeltme:** `import type { SupabaseClient } from ".../supabase-js@2.39.3"` ve
  `type ServiceClient = SupabaseClient;`. Bu dosya canlıda en kritik akışlardan biri (Resend
  webhook) — değişiklik yalnız tip satırı, davranış yok; yine de §4 probe'ları şart.

### E — `GenericStringError`: select string'i tip çözümleyicisi okuyamıyor · 41 hata, 2 dosya

- `validate-lead-quality` (25): `.select("a, b, " + "c, d")` — **string birleştirme** → tip `string`,
  literal değil → postgrest-js satır tipini türetemez, `GenericStringError` döner, her alan
  erişimi TS2339.
- `calendar-feed` (16): `:145`'teki çok satırlı join'li select (ve/veya template literal).
- **Yalnız tip.** Çalışma zamanı doğru.
- **Düzeltme (dürüst olan):** her sorguya açık satır tipi: `.select(…).returns<LeadRow>()` ya da
  `const { data } = await … ; const row = data as LeadRow` yerine `.returns<>()` tercih —
  interface dosyanın başında, alan adları select ile birebir. String'i tek literal satıra
  çevirmek de çözer ama 20 alanlık bir satır okunmaz; `returns<>()` niyeti söyler.
- `validate-lead-quality` **deploy değil** (manifest: not-deployed) → repo-only, risk yok.
  `calendar-feed` canlı ve müşteri takvim aboneliği — probe: token'sız GET 404, geçerli token ile
  ICS döner (kullanıcının kendi feed token'ıyla).

### F — `Object.assign(companyRow, secrets)` dar nesne tiplerini kırıyor · 10 hata, 4 dosya

- `notify-auftrag-reminder` (4), `test-resend-email` (2), `send-quittung` (2),
  `notify-offer-response` (2): `.select("company_name, resend_enabled, …")` sonrası
  `Object.assign(data, await loadCompanySecrets(…))` ve ardından `data.resend_api_key` okuma →
  TS2339. "Überlagern statt umschreiben" yorumu bunu bilerek yapıyor; tip sistemi görmüyor.
  **Yalnız tip**, ama kırılgan: `resend_api_key` adı değişirse derleyici yakalamaz.
- **Düzeltme:** `const company = { ...data, ...secrets }` ve açık tip (`CompanyRow & CompanySecrets`),
  `Object.assign` yok. `send-appointment-confirmation`'daki `loadCompany` / `loadSecrets` ayrımı
  örnek.

### G — `catch (error)` daraltılmadan `error.message` · 8 hata, 7 Besichtigung fonksiyonu

- TS18046: analyze-, cleanup-, complete-, create-besichtigung-session, delete-/upload-besichtigung-photo,
  validate-besichtigung-token. Çalışma zamanı: `error` Error değilse `.message` `undefined` →
  log'a `undefined` düşer; crash yok.
- **Düzeltme:** mekanik — `error instanceof Error ? error.message : String(error)`. Repo'nun
  diğer fonksiyonları zaten bu kalıbı kullanıyor.

### H — `send-offer`: `offer.surcharges` tipsiz · 6 hata

- `:912–:965` — `Array.isArray(offer.surcharges) ? offer.surcharges : []` → `any[] | never[]`
  → `reduce`/`map` parametreleri örtük `any`. **Yalnız tip.** Frontend'de `src/lib/offerSurcharges.ts`
  (`parseSurcharges`) var; Deno `src/` import edemez.
- **Düzeltme:** `_shared/offerSurcharges.ts` — `src/lib/offerSurcharges.ts`'in **aynısı**, bağımlılıksız
  (repo'nun `offerTermin.ts` / `offerAcceptanceWindow.ts` deseni: tek dosya, iki runtime yükler);
  frontend import'unu da oraya çevir ki kopya ikiye çıkmasın.

### I — `notify-auftrag-reminder:181` `content_type` Resend `Attachment` tipinde yok · 1 hata, **doğrulanmalı**

- resend@2.0.0 SDK tipi `content_type` tanımıyor; SDK nesneyi API'ye olduğu gibi geçiriyorsa
  alan çalışır, geçirmiyorsa HTML eki içerik tipini dosya adından alır. **Ölç:** test adresine
  bir hatırlatma gönder, ekin `Content-Type`'ına bak. Sonuca göre: alan gerçekten gidiyorsa
  `as Attachment & { content_type: string }` ile niyeti belgele; gitmiyorsa alanı sil (işe
  yaramıyor) ya da SDK'yı yükselt (ayrı karar).

### J — `crypto.subtle.importKey("raw", Uint8Array<ArrayBufferLike>, …)` · 1 hata

- `inbound-email-lead` Svix imza doğrulaması; yeni Deno lib tipleri `BufferSource` istiyor.
  Çalışma zamanı doğru. **Düzeltme:** `new Uint8Array(bytes).buffer` ya da `.slice()`; test
  `_shared/__tests__/svixWebhook` zaten var, onunla doğrula.

### K — `generate-sitemap` satır 10 sözdizimi hatası · 4 hata

- `const BASE_URL = getSiteUrl() || "${Deno.env.get("SITE_URL") || ""}";` — tırnak içinde tırnak;
  dosya **parse edilemiyor**, yani fonksiyon yüklenemez. Manifest: `undeploy` (Offerio
  marketplace sitemap kalıntısı, P0-S5).
- **Düzeltme:** düzeltme değil, **silme** — `supabase/functions/generate-sitemap/` + `config.toml`
  girişi + manifest girişi (`config_only_no_source_no_deploy`'a değil, tamamen) + canlıdan
  kaldırma (memory: silinen fonksiyon 404 değil 500 döner; ops notu).

---

## 1b. Durum

| Paket | Durum |
|---|---|
| 1 (A, B) | **Kod PR #47** (2026-10-10). Repo'da 6 hata düştü, `emailLayout.ts` + `emailTemplates.ts` silindi. Canlıya yalnız `_shared/invoiceEmailTemplate.ts` alındı (canlıda `main` ile birebir aynıydı; FR/EN fatura/makbuz `lang` artık doğru). `_shared/emailLayout.ts` **sunucuda kalıyor**: canlıdaki eski `send-quittung`, `send-rechnung-email` ve `accept-lead` hâlâ onu import ediyor — R-4 rollout'u ile birlikte kalkar. |
| 2 (C, D) | **PR #48** (2026-10-10). `SecretsReader` → `SupabaseClient`; `inbound-email-lead` `ServiceClient = SupabaseClient`. 41 hata düştü (inbound-email-lead 31→1, 5 fonksiyon 0'a indi). İki dosya canlıya alındı (canlı == main doğrulandı, boot probe'ları yeşil). |
| 3–6 | açık — sıradaki Paket 3 (E `returns<Row>()`, F `Object.assign` → spread) |

## 2. Sıra ve paketler

| Paket | Kümeler | Dosya | Hata | Tür | Deploy |
|---|---|---|---|---|---|
| **1** | A, B | send-rechnung-email, send-quittung, send-lead-confirmation, validate-lead-quality, `_shared/invoiceEmailTemplate.ts`, `_shared/emailTemplates.ts`, `_shared/emailLayout.ts` (sil) | 6 | **çalışma zamanı** | 2 canlı dosya DRIFT (§3) → R-4 kararıyla birlikte |
| **2** | C, D | `_shared/companySecrets.ts`, inbound-email-lead | 35 | tip | 11 fonksiyon `_shared` üzerinden etkilenir: yalnız tip, **deploy gerekmez** ama repo↔canlı farkı için `known_drift` R-9 |
| **3** | E, F | validate-lead-quality, calendar-feed, notify-auftrag-reminder, test-resend-email, send-quittung, notify-offer-response | 51 | tip | calendar-feed + notify-auftrag-reminder canlı "gleich" → deploy + probe |
| **4** | G, H, J | 7 Besichtigung fn, send-offer (+`_shared/offerSurcharges.ts`), inbound-email-lead | 15 | tip | gleich olanlar deploy; send-offer müşteriye dönük → kendi e-posta testi |
| **5** | I, K | notify-auftrag-reminder, generate-sitemap | 5 | ölç / sil | K: canlıdan kaldır |
| **6** | kapı | `package.json` `edge:check`, CI adımı | — | — | — |

Her paket ayrı PR. Paket 1 küçük ama **R-4 rollout kararına** bağlı (bkz. §3) — kodu yaz, PR aç,
deploy'u o karar verilene kadar bekletebilirsin; en azından repo artık deploy edildiğinde patlamaz.

**Kapı (Paket 6) en sona değil, Paket 2'den hemen sonra** konabilir: `edge:check` önce hatalı
dosya listesini "bilinen 23" olarak kabul eder, her paket listeyi kısaltır, liste boşalınca sıfır
tolerans. Böylece bu belge yazılırken 120 olan sayı bir daha artmaz.

```json
"edge:check": "cd supabase/functions && for d in */; do [ -f \"$d/index.ts\" ] && deno check --no-lock \"$d/index.ts\" || exit 1; done"
```
(CI'da Deno kurulumu: `denoland/setup-deno@v2`, sürümü canlı edge runtime'ın Deno sürümüne sabitle —
`docker exec … deno --version` ile oku.)

---

## 3. Deploy matrisi (ölçüm 2026-10-10, canlı ↔ `fix/edge-supabase-js-pinned`)

| Fonksiyon | Canlı | Anlamı |
|---|---|---|
| notify-appointment-reminder | **DRIFT** (canlı eski) | known_drift R-2 (i18n) — deploy = R-2'nin tamamı gider |
| send-quittung | **DRIFT** (canlı eski) | R-4 (fail-open auth kapatıldı) — aynı |
| send-rechnung-email | **DRIFT** (canlı eski) | R-4 — **ve A kümesi: repo sürümü şu an deploy edilemez** |
| validate-besichtigung-token | **DRIFT** (canlı eski) | known_drift? kontrol et; değilse yeni giriş |
| send-lead-confirmation, validate-lead-quality | nicht ausgerollt | repo-only; manifest `not-deployed` |
| diğer 17 | gleich | paket deploy'u: yedek → stage → hash → mv → restart → probe |

**Kural:** DRIFT satırına **yalnız kendi hatasını düzeltmek için** dokunma. O dosyayı deploy
etmek, canlıda hiç çalışmamış R-2/R-4 değişikliklerini de götürür; o ayrı bir rollout kararıdır
(memory: `project_edge_i18n_deploy_state`, `project_security_package_awaiting_rollout`). Paket 1'in
kodu bu kararı **kolaylaştırır** (A olmadan R-4 zaten çalışmazdı), yerine geçmez.

---

## 4. Her paket için doğrulama

- [ ] `deno check` o paketin dosyalarında 0; toplam sayı düştü (sayıyı PR'a yaz)
- [ ] `npm test` (edge `_shared/__tests__` + edge-auth-manifest kapısı) yeşil; yeni known_drift
      girişleri rollout_unit + sebep taşıyor
- [ ] Davranış değişen kümeler (A, B, I, K) için **ölçüm**: B → test adresine FR offerte/quittung,
      kaynakta `<html lang="fr">`; A → fatura e-postası 200 (sadece R-4 deploy'unda)
- [ ] Deploy: canlı hash == branch'in önceki commit'i (drift yok) → yedek → stage → hash → mv →
      container restart → yetkisiz probe'lar (401/404) + komşu fonksiyonlar boot
- [ ] `docker logs` restart sonrası `TS`/`uncaught` yok
- [ ] Bir sonraki `capture-production-truth` sonrası known_drift girişlerini kaldır

---

## 5. Bu turda kasıtlı olarak yapılmayanlar

- Resend SDK yükseltmesi (I için cazip, ama 15 müşteri fonksiyonunu etkiler) — ayrı karar.
- `Database` generic'i ile tam tipli client (`createClient<Database>`): `types.ts` ~5200 satır,
  Deno `src/` import edemez; kopyalamak ikinci bir types.ts demek. `returns<Row>()` yeter.
- `_shared/emailTemplates.ts`'in içeriği (B'de yalnız import ve locale parametresi) — şablonların
  i18n'i ayrı iş (bkz. `project_edge_i18n_deploy_state`).
