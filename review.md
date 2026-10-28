# Code Review — CRM-Project

**Branch:** `feat/offerte-form-f1a-header` · **Tarih:** 2026-07-03
**Yöntem:** 6 paralel review (güvenlik · React frontend · iş mantığı/lib · Edge Functions · konvansiyon denetimi · statik kontroller). Bulgular dedupe edilip severity'ye göre sıralandı.

## Statik kontrol durumu

| Kontrol | Sonuç |
|---|---|
| `npm run type-check` | ✅ PASS (0 hata) |
| `npm test` | ✅ PASS (131/131) |
| `npm run lint` | ⚠️ 88 hata — **hepsi `vibecosystem/hooks/` altında**, uygulama kaynağı (`src/`, `supabase/`) temiz |
| Commit edilmemiş kaynak | `src/lib/generateRechnungPdf.ts` (+246/−77) |

> Not: `src/`'de relative import zinciri (0) ve hardcoded secret (0) yok — bu iki kategori temiz.

---

## Özet tablo (severity'ye göre)

| # | Severity | Başlık | Ana konum |
|---|---|---|---|
| C1 | 🔴 CRITICAL | `handle-reschedule-response` çöküyor **ve** token doğrulaması yok (phishing relay) | `supabase/functions/handle-reschedule-response/index.ts` |
| C2 | 🔴 CRITICAL | `auto-archive` modülü hiç yüklenmiyor — otomatik arşivleme tümüyle ölü | `supabase/functions/auto-archive/index.ts:313` |
| C3 | 🔴 CRITICAL | `send-purchase-confirmation` syntax hatası — boot etmiyor | `supabase/functions/send-purchase-confirmation/index.ts:122` |
| H1 | 🟠 HIGH | Offerte düzenlemede km-Zuschläge sessizce sıfırlanıyor (para kaybı) | `OfferteBearbeiten.tsx:237,510` |
| H2 | 🟠 HIGH | `optional` pozisyonlar faturaya/Auftrag'a sızıyor — müşteri fazla faturalanıyor | `erstelleRechnung.ts:77`, `generateAuftragPdf.ts:769` |
| H3 | 🟠 HIGH | ~10 fonksiyonda Resend hata sonucu kontrol edilmiyor → "sent" yalanı | çok sayıda edge fn |
| H4 | 🟠 HIGH | AGB/checklist normalizer taksonomiyle uyuşmuyor → ekler sessizce eksik gidiyor | `normalizeServiceType.ts:9` |
| H5 | 🟠 HIGH | `send-offer` çift-gönderim koruması yarış ve hataya açık; hata 200 dönüyor | `send-offer/index.ts:270,302,875,977` |
| H6 | 🟠 HIGH | Hatırlatma e-postalarında timezone kayması + başarısız gönderimde flag set | `notify-appointment-reminder`, `notify-team-reminder` |
| H7 | 🟠 HIGH | `auto-archive` snapshot başarısızken satırları siliyor (veri kaybı) | `auto-archive/index.ts:94-230` |
| H8 | 🟠 HIGH | Cron secret fail-open (env yoksa auth atlanıyor) | `notify-*`, `cleanup-besichtigung` |
| H9 | 🟠 HIGH | Logo/Signature yüklemede sessiz fallback (kural ihlali) | `LogoUpload.tsx:74`, `SignatureUpload.tsx:74` |
| H10 | 🟠 HIGH | Aktif Stripe subscription edge fonksiyonları repo'da (NEVER ihlali) | `sync/import-stripe-subscriptions`, `subscription-manager` |
| H11 | 🟠 HIGH | `swiss-qr/core.ts`'de Türkçe runtime `throw` mesajları | `swiss-qr/core.ts:178,188,191` |
| M1 | 🟡 MEDIUM | `discount_percent` hiçbir yerde uygulanmıyor + client validasyonu yok | `OfferteErstellen.tsx:1058` |
| M2 | 🟡 MEDIUM | Blind te ile quantity çarpımı iki katı faturalıyor | `OfferteErstellen.tsx:1123` |
| M3 | 🟡 MEDIUM | `QuittungDetail` eski makbuzun MwSt oranını 8.1%'e eziyor | `QuittungDetail.tsx:129,242,347` |
| M4 | 🟡 MEDIUM | Dashboard "Heute"/aylık istatistik timezone kayması | `Dashboard.tsx:98,130,172` |
| M5 | 🟡 MEDIUM | `generateAuftragPdf` VAT=0'ı "8.1%" olarak etiketliyor (falsy-zero) | `generateAuftragPdf.ts:892` |
| M6 | 🟡 MEDIUM | Rechnung PDF çok-satırda QR-Zahlteil üzerine basıyor | `generateRechnungPdf.ts:607` |
| M7 | 🟡 MEDIUM | `spellCheckService` timeout ölü kod → save flow sonsuza kilitlenebilir | `spellCheckService.ts:30` |
| M8 | 🟡 MEDIUM | OfferteDetail blind offer'ı sabit fiyat gösteriyor (`offers.time_estimate` hiç yazılmıyor) | `OfferteDetail.tsx:387` |
| M9 | 🟡 MEDIUM | PDF preview per-item `time_estimate` düşürüyor → preview ≠ gönderilen PDF | `OfferteDetail.tsx:1391` |
| M10 | 🟡 MEDIUM | Google Places/Distance proxy'leri rate-limit'siz (finansal DoS) | `google-places-*`, `calculate-distance` |
| M11 | 🟡 MEDIUM | Public token e-postalarında HTML escape yok (injection) | `handle-proposal-response`, `notify-offer-response`, vb. |
| M12 | 🟡 MEDIUM | `notify-offer-response` alıcı/tutarı body'den alıyor (DB yerine) | `notify-offer-response/index.ts:24,187` |
| M13 | 🟡 MEDIUM | `handle-proposal-response` replay koruması atomik değil → çift randevu | `handle-proposal-response/index.ts:114` |
| M14 | 🟡 MEDIUM | `confirm-lead-by-token` iki-adımlı non-transactional → lead takılı kalır | `confirm-lead-by-token/index.ts:113` |
| M15 | 🟡 MEDIUM | `send-quittung` `company.id` undefined + kısmi başarı "success" | `send-quittung/index.ts:167,287` |
| M16 | 🟡 MEDIUM | `confirm-besichtigung` idempotency yok → çift randevu | `confirm-besichtigung/index.ts:210` |
| M17 | 🟡 MEDIUM | `admin-create-user` non-atomik + sandbox sender + yanlış 403 eşleme | `admin-create-user/index.ts:106,257` |
| M18 | 🟡 MEDIUM | `admin-delete-user` auth kullanıcıyı en son siliyor → yarı-silik hesap | `admin-delete-user/index.ts:56` |
| M19 | 🟡 MEDIUM | `notify-appointment-cancelled` `${getAppName()}` interpolasyon hatası | `notify-appointment-cancelled/index.ts:149,240` |
| M20 | 🟡 MEDIUM | `import-manual-lead` DB hatasını 200 ile dönüyor | `import-manual-lead/index.ts:240` |
| M21 | 🟡 MEDIUM | OfferteErstellen "core fallback" insert artık yeni kolonları içeriyor → kendini yeniyor | `OfferteErstellen.tsx:1027` |
| M22 | 🟡 MEDIUM | Live preview aritmetiği Zuschlag varken tutmuyor | `OfferteLivePreview.tsx:348` |
| M23 | 🟡 MEDIUM | Ölü portal sayfaları + tracking/cookie yığını hâlâ derleniyor | `src/pages/*`, `TrackingProvider`, `CookieBanner` |
| M24 | 🟡 MEDIUM | pdf.js worker üçüncü-parti CDN'den yükleniyor | `PdfPreviewDialog.tsx:20` |
| M25 | 🟡 MEDIUM | Aktif CRM kodunda ~39 dosyada Türkçe yorum | çeşitli |
| L1–L14 | ⚪ LOW | Bkz. LOW bölümü | — |

---

## CRITICAL

### C1 — `handle-reschedule-response`: hem çöküyor hem güvenlik açığı
**Konum:** `supabase/functions/handle-reschedule-response/index.ts` (import satırları 1–4; kullanım 176,186,250,260; handler geneli)
**Sorun (iki katmanlı):**
1. **Çöküyor:** `getCalendarFrom()` ve `getAppName()` çağrılıyor ama hiç import edilmemiş → her çağrıda `ReferenceError`. Firma "Termin bestätigen"e basınca randevu DB'de `confirmed`'e çekiliyor (108–117), sonra e-posta kurulurken throw → 500; müşteri onay maili almıyor, `email_logs` yazılmıyor. **DB "onaylandı" der, müşteriye hiç haber gitmez.**
2. **Token doğrulaması yok:** Fonksiyon public (`verify_jwt` default, anon key ile erişilebilir). `appointmentId` + tamamen saldırgan-kontrollü `customerEmail`, `customerName`, `companyName`, `message`, `appointmentTitle` body'den güveniliyor. URL'deki `token` parametresi hiçbir yerde saklanmıyor/kontrol edilmiyor (`reschedule_token` kolonu şemada yok) — güvenlik tiyatrosu.

**Failure scenario:** `appointmentId` ele geçiren biri (e-posta linklerinden sızar) herhangi bir randevuyu onaylayabilir/reddedebilir/erteleyip `appointment_date`/`start_time`/`status`'u ezebilir; ve şirketin Resend gönderen domain'inden istediği `customerEmail`'e serbest HTML e-posta gönderebilir (`message`/`companyName`/`customerName` escape'siz gömülüyor) → **açık phishing relay**.

**Fix:**
- Eksik importu ekle: `import { getCalendarFrom, getAppName } from "../_shared/envConfig.ts";`
- Appointment başına gizli bir `reschedule_token` sakla ve fonksiyon içinde doğrula (`notify-offer-response`'un `.eq("id", offerId).eq("access_token", token)` yaptığı gibi).
- `customerEmail`, `customerName`, `companyName`, `appointmentTitle`'ı body yerine service-role ile DB satırından türet; serbest metni (`message`) HTML-escape et.
- CI'ya `deno check supabase/functions/**/index.ts` ekle.

### C2 — `auto-archive` modülü hiç yüklenmiyor
**Konum:** `supabase/functions/auto-archive/index.ts:313`
**Sorun:** `if (settings.notify_on_archive ...)` bloğunun **içinde** static `import { getDefaultFrom, ... } from "../_shared/envConfig.ts"` var. Static importlar sadece modül top-level'ında geçerli → modül parse edilemiyor.
**Failure scenario:** Aylık arşiv cron'u fonksiyonu çağırınca Deno modülü yükleyemiyor → her run boot'ta patlıyor. **Hiç arşivleme olmuyor; retention ayarlarının hiçbir etkisi yok** (üstelik e-posta bloğu zaten "for now, just log" stub'ı, satır 315).
**Fix:** Importu dosyanın tepesine taşı (ya da stub e-posta bloğuyla birlikte sil).

### C3 — `send-purchase-confirmation` syntax hatası
**Konum:** `supabase/functions/send-purchase-confirmation/index.ts:122`
**Sorun:** `` `<a href=`${getDashAppUrl()}/firma/anfragen`` — dış template literal içinde çıplak backtick literal'i sonlandırıyor → SyntaxError (`node --check` doğruladı). Fonksiyon boot etmiyor.
**Failure scenario:** Herhangi bir çağrı → worker modülü yükleyemiyor → 500.
**Fix:** Çift tırnak kullan: `href="${getDashAppUrl()}/firma/anfragen"`. **Ya da fonksiyonu tümden sil** — token satın almaları CRM fork'unda kaldırıldı (Offerio kalıntısı, iş etkisi düşük).

---

## HIGH

### H1 — Offerte düzenleyince km-bazlı Zuschläge sessizce sıfırlanıyor
**Konum:** `src/pages/firma/OfferteBearbeiten.tsx:237, 510-512`; kök neden `OfferteErstellen.tsx:1019-1022`
**Sorun:** `OfferteBearbeiten`, `per_km` Zuschlag mesafesini `offers.moving_distance_km`'den okuyor (`setDistanceKm(offerData.moving_distance_km ?? null)`) ama bu kolon hiçbir aktif kod yolunca yazılmıyor — create akışı per-km tutarı `lead.distance_km`'den hesaplayıp offer'a mesafeyi hiç kaydetmiyor (tek yazıcı `update_offer_moving_details` RPC'si `src/`'de çağrılmıyor).
**Failure scenario:** `distance_km = 40` ve "CHF 2.50/km" Zuschlag'lı lead'den offer oluştur → `amount = 100` subtotal'e girer. "Bearbeiten"de aç, hiçbir şeye dokunmadan "Speichern": `withComputedAmounts(surcharges, itemsSubtotal, null)` per-km tutarı `2.50 × 0 = 0`'a çeker; `subtotal`/`vat_amount`/`total` CHF 100 düşük yeniden yazılır. Hiçbir uyarı yok.
**Fix:** Create sırasında mesafeyi offer'a yaz (`coreOfferData`'ya `moving_distance_km: lead.distance_km`), ya da Bearbeiten'de `moving_distance_km` null ise `offer.lead_id` üzerinden `lead.distance_km` fetch et. Geçici asgari: `per_km` için null mesafeyle yeniden hesaplamak yerine saklı `amount` snapshot'ını kullan.

### H2 — `optional` pozisyonlar faturaya ve Auftrag'a sızıyor
**Konum:** `src/lib/erstelleRechnung.ts:77-94`; `src/lib/generateAuftragPdf.ts:769-910`; kök neden `OfferteErstellen.tsx:1129-1131` + `OfferItemInput`/Auftrag snapshot `price_type` düşürüyor
**Sorun:** `erstelleRechnungAusAuftrag` **tüm** item'ları faturaya topluyor — offer total'inden kasıtlı dışlanan (`EXCLUDED_FROM_SUBTOTAL`) `price_type = "optional"` dahil. `OfferItemInput` `price_type`'ı tümden düşürdüğü için filtre downstream'de imkânsız. OfferteErstellen sadece "inkl" için `unit_price`'ı sıfırlıyor, "optional" için değil; `offer_items.total` GENERATED `quantity*unit_price` olduğundan optional satır 300 saklıyor.
**Failure scenario:** Umzug CHF 1'000 (pauschale) + Einpackservice CHF 300 (optional, sipariş edilmedi). `offers.total` = 1'081. "Rechnung erstellen" → zwischensumme 1'300, total **1'405.30** — müşteri kabul edilen offer'dan CHF 324.30 fazla faturalanıyor. Auftrag PDF'inde de tablo satırları 1'300 toplarken "Zwischensumme" 1'000 basıyor — tutarsız imza belgesi.
**Fix:** `price_type`'ı Auftrag item snapshot'ından ve `OfferItemInput`'tan geçir; `positionen` kurmadan önce `isFreeItem(priceType)` (tek kaynak `offerPricing.ts`) ile filtrele. Auftrag PDF'inde optional satırları "auf Anfrage" (satır toplamı yok) işaretle.

### H3 — ~10 fonksiyonda Resend hata sonucu yutuluyor
**Konum:** `handle-proposal-response/index.ts:199,246,327`; `notify-appointment-reminder:367,434,472,593,634`; `notify-auftrag-reminder:164,256`; `notify-appointment-reschedule:169,231`; `notify-box-pickup:272,336`; `validate-lead-quality:182-192`; `notify-appointment-cancelled:252`; `subscription-manager:191,218`
**Sorun:** `resend@2.0.0` `emails.send()` `{ data, error }` döndürür ve API hatasında **throw etmez**. Bu çağrı yerleri sonucu ya atıyor ya sadece try/catch'e güveniyor → gönderim hataları sessizce yutuluyor.
**Failure scenario:** Resend 403 (doğrulanmamış domain) / 429 dönerse: `handle-proposal-response` yine `email_logs`'a `status: "sent"` yazıyor; `notify-auftrag-reminder` `team_reminder_sent = true` yapıyor (hatırlatma bir daha denenmez, ekip yarınki işi öğrenmez); `validate-lead-quality` double-opt-in için `true` döner (lead hiç gelmeyen maili sonsuza bekler).
**Fix:** Her çağrıda `const { error } = await resend.emails.send(...)` destructure et ve dallan (`send-quittung`, `notify-offer-response`, `send-appointment-confirmation` zaten doğru yapıyor); sent-flag/`status:"sent"` sadece `error == null` iken yazılsın.

### H4 — AGB/checklist normalizer taksonomiyle uyuşmuyor
**Konum:** `src/lib/normalizeServiceType.ts:9-44` (`normalizeServiceTypeForAgb`), tüketici `buildOfferEmailAttachments.ts:142-161`
**Sorun:** Normalizer hem lead-form enum'uyla (`validations/leadForm.ts`) hem template saklama anahtarlarıyla (`constants/service-catalog.ts`) çelişiyor: (a) `reinigung_end`/`reinigung_grund` haritada yok; (b) `usm_transport`/`wasserbett_transport` → `transport`'a maplenmiş ama AGB bölümleri/checklist template'leri tam olarak `usm_transport`/`wasserbett_transport` anahtarlarıyla saklı — `transport` diye bir template tipi yok.
**Failure scenario:** `service_type = "reinigung_end"` lead → lookup `"reinigung_end"` ile sorguluyor, template'ler `"reinigung"` altında → offer e-postası **AGB ve checklist PDF'leri olmadan** gidiyor. `usm_transport`/`wasserbett_transport` lead'lerde mapping tam eşleşmeyi aktif olarak bozuyor.
**Fix:** El-yapımı haritayı kanonik taksonomiyle değiştir: `reinigung_end|reinigung_grund → reinigung`; `usm_transport`/`wasserbett_transport → transport` girdilerini kaldır (exact key eşleşsin). İdeali `normalizeToCatalogBase` + exact-key passthrough'dan türet ki üç mapper diverge etmesin.

### H5 — `send-offer` çift-gönderim koruması yarış/hataya açık, hatalar 200 dönüyor
**Konum:** `supabase/functions/send-offer/index.ts:270-276, 302-308, 875-881, 977-989`
**Sorun:** Çift-gönderim koruması check-then-act; `status="sent"` update'i e-postadan sonra ve hatası sadece loglanıyor — ne concurrent-safe ne failure-safe. Ayrıca "Offerte nicht gefunden" ve "E-Mail-Dienst nicht konfiguriert" gövdeleri HTTP **200** dönüyor.
**Failure scenario:** (a) Post-send status update başarısız → fonksiyon `success:true` döner, offer `draft` kalır; sonraki gönderim guard'ı geçer → müşteri offer'ı iki kez alır. (b) İki hızlı tık: ikisi de `draft` okur, ikisi de gönderir. (c) 200 dönen hatalar: frontend `invoke` hata görmez, UI "gönderildi" der ama hiçbir şey gitmemiştir.
**Fix:** Göndermeden önce atomik claim: `update offers set status='sending' where id=? and status not in ('sent','viewed','accepted','rejected')`; sadece satır etkilendiyse devam et, e-posta hatasında geri al. "Bulunamadı" için 404, "servis yok" için 422/503 dön.

### H6 — Hatırlatma e-postalarında timezone kayması + başarısızlıkta flag set
**Konum:** `notify-appointment-reminder/index.ts:240-248, 322-324, 456-467, 529-537`; `notify-team-reminder/index.ts:620, 644-650`
**Sorun:** (1) Randevu tarih/saati (İsviçre yerel) timezone'suz `Date`'e sokuluyor (`new Date(\`${date}T${time}\`)` / UTC-gece-yarısı date'te `setHours()`); UTC edge runtime bunu UTC sanıyor. (2) 2-saatlik e-posta başarısız olsa bile `reminder_sent_firma:true` / `reminder_sent_customer` koşulsuz yazılıyor.
**Failure scenario:** CEST (UTC+2)'de 14:00 yerel randevu 14:00 UTC sanılıyor → `hoursUntil` 2 saat fazla → "1 saat" hatırlatması aslında randevu başladıktan 0.5–1.5 saat **sonra** atılıyor, konu "in 3 Stunden" diyor. `notify-team-reminder`'da pencere UTC gece yarısını aşınca ertesi gün randevuları hiç çekilmiyor. Resend kesintisinde flag set edilince sonraki cron'lar randevuyu atlıyor → kimse hatırlatılmıyor.
**Fix:** Yerel saati açıkça UTC'ye çevir (`Europe/Zurich` ile `date-fns-tz`/`Temporal`, ya da `timestamptz` sakla) ve pencerenin dokunduğu iki takvim gününü de sorgula. Her flag'ı yalnız ilgili gönderim başarılıysa yaz.

### H7 — `auto-archive` snapshot başarısızken satırları siliyor
**Konum:** `supabase/functions/auto-archive/index.ts:94-112, 158-170, 217-230` (C2 syntax hatasının arkasında latent)
**Sorun:** `archive_snapshots` insert başarısız olsa bile satırlar siliniyor (leads: snapshot hatası sadece `console.warn`; email_logs/notifications: insert sonucu hiç kontrol edilmiyor).
**Failure scenario:** Snapshot insert başarısız (boyut/RLS/şema) → uyarı loglanıyor → silme devam ediyor → eski lead'ler/email_logs **arşiv kopyası olmadan kalıcı yok oluyor**, `archive_logs` ise "başarılı" diyor.
**Fix:** Bir veri tipi için snapshot insert başarısızsa silmeyi iptal et; zaman/status filtresini yeniden uygulamak yerine sadece snapshot'lanan ID'leri sil (`.in("id", ids)` — bu ayrıca select→delete TOCTOU'yu kapatır).

### H8 — Cron secret fail-open
**Konum:** `notify-team-reminder/index.ts:583-591`, `notify-auftrag-reminder:61-68`, `notify-appointment-reminder:213-221`, `cleanup-besichtigung:26-34`
**Sorun:** İç-secret guard'ı fail-open: `const cronSecret = Deno.env.get("INTERNAL_CRON_SECRET"); if (cronSecret) { ...compare... }` — env yoksa yetki kontrolü tümüyle atlanıyor.
**Failure scenario:** `INTERNAL_CRON_SECRET` eksik/yanlış yapılandırılırsa, herhangi bir internet çağrısı bu `verify_jwt=false` fonksiyonları tetikleyip toplu e-posta gönderebilir (Resend kredisi harcar) ya da veri silebilir (`cleanup-besichtigung`).
**Fix:** Fail-closed: `if (!cronSecret) return 500; if (provided !== cronSecret) return 401;`.

### H9 — Logo/Signature yüklemede sessiz fallback
**Konum:** `src/components/firma/LogoUpload.tsx:74`, `src/components/firma/SignatureUpload.tsx:74`
**Sorun:** Sıkıştırma hatası sessizce orijinal dosyaya düşüyor (`fileToUpload = originalFile`), log yok — CLAUDE.md sessiz fallback'ı açıkça yasaklıyor.
**Fix:** Catch içinde en azından `console.warn` + toast; fallback'ı gözlemlenebilir kıl (no-patch kuralı).

### H10 — Aktif Stripe subscription edge fonksiyonları repo'da
**Konum:** `supabase/functions/sync-stripe-subscriptions/`, `import-stripe-subscriptions/`, `subscription-manager/`; ayrıca `supabase/config.toml:63,66` (dizini olmayan `stripe-webhook`/`recover-stripe-purchase` blokları)
**Sorun:** Tam işlevsel Stripe subscription kodu (`stripe@18.5.0` import, `STRIPE_SECRET_KEY`, `companies.stripe_subscription_id`/`crm_enabled`/`subscription_type` okuma/yazma; `subscription-manager` expiry'de **şirket deaktive ediyor**). Deploy edilebilir halde repo'da duran canlı ödeme/subscription-tier mantığı — "Stripe/ödeme mantığı" NEVER kuralının doğrudan ihlali.
**Fix:** Üç fonksiyon dizinini sil (Coolify edge runtime'da deploy edilmediklerini doğrula); config.toml'daki iki bayat bloğu kaldır.

### H11 — `swiss-qr/core.ts`'de Türkçe runtime throw mesajları
**Konum:** `src/lib/swiss-qr/core.ts:178,188,191`
**Sorun:** Runtime `throw new Error` mesajları Türkçe: `"buildQrPayload: creditor IBAN zorunlu"`, `"QR-IBAN için QRR referans zorunlu..."`, `"QRR referans yalnızca QR-IBAN ile..."`. Bunlar log/hata UI'ında yüzeye çıkabilir. Memory kuralı: Türkçe hiçbir yerde olmaz.
**Fix:** Almanca veya İngilizce'ye çevir.

---

## MEDIUM

### M1 — `discount_percent` hiçbir yerde uygulanmıyor + validasyon yok
**Konum:** `src/pages/firma/OfferteErstellen.tsx:1058` (input 1739-1748); ayrıca `erstelleRechnung.ts:110` (`rabatt: 0` hardcoded), `mapOfferData.ts`
**Sorun:** Offer-seviyesi `discount_percent` yakalanıp saklanıyor ama **hiçbir yerde uygulanmıyor**: `computeOfferTotals`, offer PDF, public OfferView, `erstelleRechnungAusAuftrag` hepsi görmezden geliyor. Ek olarak `Number(discountPercent)` clamp'lenmiyor; `min/max` attribute'ları sadece spinner'ı etkiliyor, DB CHECK (`>=0 AND <=100`) reddediyor.
**Failure scenario:** "Rabatt gesamt 10%" gir, kaydet, gönder → müşteri indirimsiz tam fiyattan offer alır, Rabatt satırı yok; fatura da yok sayar. `150` yaz → offer insert'i ham Postgres `23514` hatasıyla patlar, kullanıcı sadece "Offerte konnte nicht gespeichert werden" görür.
**Fix:** F3'e kadar: client'ta 0–100 clamp/validasyon (`Number.isFinite && >=0 && <=100`) + alan-özel toast, ve alanı gizle ya da "wird noch nicht verrechnet" etiketle. F3'te `computeOfferTotals`'da uygula (Zwischensumme sonrası, VAT öncesi tek çarpan) ve `NeueRechnung.rabatt`'a taşı.

### M2 — Blind Zeitschätzung ile quantity çarpımı iki katına faturalıyor
**Konum:** `src/pages/firma/OfferteErstellen.tsx:1123-1131` + `src/lib/offerPricing.ts:109-118`
**Sorun:** Zeitschätzung'lu item için subtotal `minHours × hourlyRate` (quantity yok sayılır) kullanıyor, ama DB satırı `unit_price = minHours × hourlyRate` **ve gerçek quantity** ile yazılıyor; `offer_items.total` GENERATED `quantity × unit_price`.
**Failure scenario:** Blind item, quantity 2, te {10h, 100 CHF/h}: offer 1'000 saklıyor; `offer_items.total` = 2'000; Auftrag PDF ve ondan üretilen Rechnung 2'000 faturalar — teklif edilenin iki katı. (Quantity 0 → ayna bug: 1'000 teklif, 0 fatura.)
**Fix:** Geçerli te varsa insert'te `quantity = 1`'e zorla ("inkl"de zaten yapıldığı gibi), ya da quantity'yi `hourlyRange` fiyatına iki tarafta da tutarlı kat.

### M3 — `QuittungDetail` eski makbuzun MwSt oranını 8.1%'e eziyor
**Konum:** `src/pages/firma/QuittungDetail.tsx:129` (`useState(8.1)` — setter yok), 242-272 (`loadQuittung` `mwst_satz` hariç her şeyi restore), 347-352 (save `mwst_satz: 8.1` yazar)
**Failure scenario:** `mwst_satz = 7.7` (2024 öncesi) ya da `0` saklı Quittung'u aç, küçük bir değişiklik (Notiz) kaydet → `calculateTotals(pos, 8.1, rabatt)` `mwst_betrag`/`gesamttotal`'i 8.1%'de yeniden hesaplar ve saklı değerleri ezer — muhtemelen imzalanmış bir makbuz üzerinde.
**Fix:** Setter ekle, `loadQuittung`'da `setMwstSatz(q.mwst_satz)` çağır, 8.1'i sadece yeni makbuzlara default yap (`RechnungDetail.tsx:166` zaten böyle yapıyor).

### M4 — Dashboard timezone kayması
**Konum:** `src/pages/firma/Dashboard.tsx:98-103, 130-133, 172-179`
**Sorun:** `appointments.appointment_date` DATE kolonu, ama `todayStart` = yerel gece yarısı → `toISOString()` = önceki günün `...T22:00:00Z`'si (UTC+2); Postgres bunu `yesterday`'e cast ediyor, `gte` dünün satırlarını yakalıyor.
**Failure scenario:** İsviçre'de "Heute" paneli dünün+bugünün randevularını listeler; 1 Temmuz'da "Jobs diesen Monat" 30 Haziran işlerini içerir.
**Fix:** Düz tarih string'leriyle karşılaştır: `format(new Date(), "yyyy-MM-dd")`.

### M5 — `generateAuftragPdf` VAT=0'ı "8.1%" etiketliyor
**Konum:** `src/lib/generateAuftragPdf.ts:892`
**Sorun:** `` `MwSt. (${auftrag.vat_rate || 8.1}%)` `` — falsy-zero: `vat_rate = 0` (MwSt kapalı) → "MwSt. (8.1%)" yazar.
**Failure scenario:** `mwstEnabled = false` offer → Auftrag PDF "MwSt. (8.1%): CHF 0.00" basar — kendiyle çelişen, hukuken yanlış müşteri belgesi.
**Fix:** `auftrag.vat_rate ?? 8.1` kullan; efektif oran 0 iken MwSt satırını tümden atla (`generateRechnungPdf.ts:558` zaten yapıyor).

### M6 — Rechnung PDF çok-satırda QR-Zahlteil üzerine basıyor
**Konum:** `src/lib/generateRechnungPdf.ts:607-614` (overflow guard), 479-535 (autoTable)
**Sorun:** Tek-sayfa varsayımı; pozisyon tablosunun QR-Zahlteil zonuna (y ≥ 192) girmesini engelleyen bir şey yok. Kırmızı uyarı sadece totals/imza bandında tetikleniyor, tablonun kendisi `PP_TOP`'u geçebiliyor ve `drawQrBill` tablo satırlarının üstüne basıyor.
**Failure scenario:** ~15+ pozisyonlu fatura: satırlar y=192 altına çiziliyor, Swiss-QR Zahlteil üstüne basılıyor → taranamayan/okunamayan ödeme slip'i müşteriye gidiyor.
**Fix:** Multi-page gelene kadar: tablo yüksekliğini önden hesapla (ya da autoTable `margin.bottom`) ki `PP_TOP` öncesi kırılsın; guard'ı `doc.lastAutoTable.finalY` + sayfa sayısına dayandır. (Kodda zaten `TODO(root-cause)` notu var.)

### M7 — `spellCheckService` timeout ölü kod → save flow kilitlenebilir
**Konum:** `src/lib/spellCheckService.ts:30-49`
**Sorun:** `AbortController` + 5s timer kuruluyor ama `controller.signal` `supabase.functions.invoke`'a hiç geçilmiyor — timeout ölü kod.
**Failure scenario:** `spell-check-ai` edge fn hang → `runSpellCheck` hiç resolve olmaz → offer save flow (`OfferteErstellen.tsx:998`, kaydetmeden önce await ediliyor) UI "Prüfe Rechtschreibung"da sonsuza takılır.
**Fix:** Signal'i geçir (ya da `Promise.race` ile timeout) ve abort'ta docstring'in vaat ettiği gibi `null` resolve et.

### M8 — OfferteDetail blind offer'ı sabit fiyat gösteriyor
**Konum:** `src/pages/firma/OfferteDetail.tsx:387-396` (875-909, 968-1002'de kullanılıyor)
**Sorun:** `getBlindRange()` aralığı `offer.time_estimate`'ten türetiyor, ama create/edit sadece item bazında (`offer_items.time_estimate`) saklıyor; `offers.time_estimate` hiç yazılmıyor → hep `null`.
**Failure scenario:** 7–9h × CHF 95 item'lı blind offer oluştur. Müşteri OfferView ve e-posta PDF "CHF 665–855" gösterir ama firmanın kendi detay sayfası sadece min ("CHF 665") gösterir — firma sabit fiyat verdiğini sanır.
**Fix:** Aralığı yüklü item'lardan hesapla (`computeItemsSubtotal(items, "max")`/`hourlyRange`, OfferteErstellen/Bearbeiten zaten yapıyor).

### M9 — PDF preview per-item `time_estimate` düşürüyor
**Konum:** `src/pages/firma/OfferteDetail.tsx:1391-1398` (preview payload) vs 475-478 (`buildOfferPayload`)
**Sorun:** `PdfPreviewDialog` payload'ı item'ları `{position, description, quantity, unit, unit_price, total}` mapliyor — `time_estimate` yok → `mapOfferData`'nın `hasItemTe` kontrolü false, blind aralık bloğu preview'de kayıp; download/send (`buildOfferPayload`) ise gösteriyor.
**Failure scenario:** Firma blind offer preview'da sabit fiyat görür, müşteri saatlik aralıklı PDF alır.
**Fix:** Preview payload'ına `time_estimate: item.time_estimate ?? null` ekle (ya da preview için de `buildOfferPayload()` kullan).

### M10 — Google Places/Distance proxy'leri rate-limit'siz
**Konum:** `supabase/functions/google-places-autocomplete/`, `google-places-details/`, `calculate-distance/`
**Sorun:** Kimliksiz (`verify_jwt=false`), wildcard-CORS, paralı Google API'sine proxy; rate-limit/caller kontrolü yok. (API key doğru şekilde server-side, response'a sızmıyor.)
**Failure scenario:** Herhangi biri sınırsız çağrı scriptleyip her biri faturalanan Google isteği harcayabilir → hesabın Google faturasını şişirir (finansal DoS).
**Fix:** `confirm-lead-by-token`'daki paylaşılan `createRateLimiter`'ı client IP ile uygula; public form yolu için `verify-recaptcha` ile kapıla.

### M11 — Public token e-postalarında HTML escape yok
**Konum:** `handle-proposal-response:218,224,230,345,350`; `notify-offer-response:133-176`; `notify-appointment-reschedule:138-145`; `handle-reschedule-response:166,236`; `send-offer:555,696,731,797` (`item.description`, surcharge label, `paymentTerms` escape'siz)
**Sorun:** Müşteri-kaynaklı stringler public token endpoint'lerinde escape'siz e-posta HTML'ine gömülüyor.
**Failure scenario:** Müşteri `<img src=x onerror=...>` veya `<style>` içeren mesaj gönderirse firmanın aldığı e-postaya keyfi HTML enjekte olur (phishing); `<`/`&` içeren zararsız girdi bile render'ı bozar.
**Fix:** send-offer'ın `escapeHtml` helper'ını `_shared/`'a taşı ve her kullanıcı-kaynaklı interpolasyona uygula.

### M12 — `notify-offer-response` alıcı/tutarı body'den alıyor
**Konum:** `supabase/functions/notify-offer-response/index.ts:24-27, 187-192`
**Sorun:** Offer token doğrulandıktan sonra bildirim alıcısı (`companyEmail`), tutar (`offerTotal`), başlık/isim hepsi client body'sinden alınıyor — DB satırı (57-62'de fetch ediliyor) token dışında yok sayılıyor.
**Failure scenario:** Hatalı/kötü niyetli client üçüncü tarafın `companyEmail`'ini ya da yanlış `offerTotal` gönderirse firma uydurma tutarlı "Offerte angenommen" maili alır ya da bildirim yanlış kutuya gider; `email_logs` bunu meşru kaydeder.
**Fix:** Token doğrulamasından sonra `customer_*`, `title`, `total` ve şirket bildirim e-postasını DB'den yükle, body değerlerini yok say.

### M13 — `handle-proposal-response` replay koruması atomik değil
**Konum:** `supabase/functions/handle-proposal-response/index.ts:114-131, 152-172`
**Sorun:** Replay koruması non-atomik count-then-insert; eşzamanlı istekler ikisi de `confirmedCount = 0` görür.
**Failure scenario:** Müşteri public sayfada "Termin bestätigen"e çift tıklar → iki confirmed besichtigung randevusu oluşur, dört e-posta gider.
**Fix:** DB'de uniqueness zorla (partial unique index `appointments(lead_id) where appointment_type='besichtigung' and status='confirmed'`); unique-violation'ı 409 yolu olarak ele al.

### M14 — `confirm-lead-by-token` non-transactional → lead takılı kalır
**Konum:** `supabase/functions/confirm-lead-by-token/index.ts:113-137`
**Sorun:** İki-adımlı, transactional olmayan onay: `lead_confirmations.confirmed_at` önce set ediliyor; sonraki `leads` status update'i başarısız olursa sadece loglanıp yine `{ success: true }` dönülüyor.
**Failure scenario:** Lead update başarısız (geçici DB hatası) → müşteri "confirmed" görür; retry'da token `already_confirmed` döner → lead sonsuza `awaiting_customer_confirmation`'da takılır, verification'a hiç girmez.
**Fix:** İki update'i tek RPC/transaction'da yap, ya da önce lead'i güncelle sonra confirmation'ı işaretle; lead flip başarısızsa 500 dön.

### M15 — `send-quittung`: `company.id` undefined + kısmi başarı "success"
**Konum:** `supabase/functions/send-quittung/index.ts:167-171 vs 256,281; 287-304`
**Sorun:** (1) `companies(...)` select'inde `id` yok ama `company.id` `logEmail`'e `companyId` olarak geçiyor → hep `undefined` → her quittung e-postası `company_id = NULL` loglanıyor. (2) Müşteri e-postası başarısız ama firma kopyası başarılıysa status `sent`, response `success:true`.
**Failure scenario:** Şirket-kapsamlı e-posta geçmişi/RLS quittung maillerini hiç göstermez; müşteri makbuzu almasa da UI "gönderildi" der.
**Fix:** Select'e `id` ekle; müşteri teslimatını birincil sonuç say, `q.customer_email` varken o gönderim başarısızsa ayrı partial-failure status dön.

### M16 — `confirm-besichtigung` idempotency yok → çift randevu
**Konum:** `supabase/functions/confirm-besichtigung/index.ts:210-241, 273-292`
**Sorun:** Randevu insert'i e-postadan önce; e-posta hatası idempotency guard'ı olmadan 500 fırlatıyor.
**Failure scenario:** E-posta başarısız → 500 → kullanıcı tekrar "Bestätigen" → ikinci özdeş besichtigung satırı eklenir (çift takvim), muhtemelen iki e-posta.
**Fix:** Insert öncesi `offer_id` için mevcut confirmed besichtigung kontrol et (ya da unique index); "randevu oluştu, e-posta başarısız"ı çıplak 500 yerine ayrı raporla.

### M17 — `admin-create-user` non-atomik + sandbox sender + yanlış 403
**Konum:** `supabase/functions/admin-create-user/index.ts:106-188, 257, 296-301`
**Sorun:** (1) Non-atomik: auth kullanıcı oluştuktan sonra rol atama başarısız olursa throw. (2) Welcome e-postası `from` hardcoded `"LeadFlow <onboarding@resend.dev>"` (Resend sandbox — sadece hesap sahibine gider). (3) 403 eşlemesi hiç fırlatılmayan "Only admins can create users" string'ini kontrol ediyor.
**Failure scenario:** Rol insert başarısız → admin retry → "email already registered", rolsüz kullanıcı manuel temizlik bekler. Welcome e-postası kimlik bilgileriyle yeni kullanıcıya hiç ulaşmaz. İzin hataları 403 yerine 400 döner.
**Fix:** Rol atama başarısızsa auth kullanıcıyı sil (kompanzasyon); `getDefaultFrom()` kullan; gerçek hata string'leriyle eşle veya typed error kullan.

### M18 — `admin-delete-user` auth kullanıcıyı en son siliyor
**Konum:** `supabase/functions/admin-delete-user/index.ts:56-103`
**Sorun:** Önce `user_roles`, `companies`, `profiles` siliniyor, sonra auth kullanıcı; auth-delete başarısız olursa her şey gitmişken 500 dönüyor.
**Failure scenario:** `auth.admin.deleteUser` başarısız → single-tenant `companies` satırı ve profil zaten yok edilmişken login hâlâ çalışıyor — yarı-silik hesap, şirket verisi gitmiş.
**Fix:** Önce auth kullanıcıyı sil (ya da silinebilir olduğunu doğrula), sonra app satırlarını cascade et; ya da app-satır silmeyi auth silme başarılı olduktan sonra çalışan RPC transaction'a sar.

### M19 — `notify-appointment-cancelled` `${getAppName()}` interpolasyon hatası
**Konum:** `supabase/functions/notify-appointment-cancelled/index.ts:149, 154, 240, 245`
**Sorun:** `${isCompanyEmail ? request.companyName : "Ihr ${getAppName()} Team"}` — fallback dalı düz çift tırnaklı string, `${getAppName()}` interpolate olmuyor.
**Failure scenario:** Herhangi bir iptal → şirket ve müşteri e-postaları harfiyen "Ihr ${getAppName()} Team" imzalı gelir.
**Fix:** İç template literal: `` `Ihr ${getAppName()} Team` ``.

### M20 — `import-manual-lead` DB hatasını 200 ile dönüyor
**Konum:** `supabase/functions/import-manual-lead/index.ts:240-245`
**Sorun:** Lead insert DB hatası HTTP **200** ile dönüyor (`{ success:false, error:... }`).
**Failure scenario:** Constraint ihlali → `functions.invoke` hata görmez → import UI başarı gösterebilir/retry etmez, lead sessizce kaybolur.
**Fix:** 500 (ya da validasyon-tipi için 422) dön.

### M21 — OfferteErstellen "core fallback" insert kendini yeniyor
**Konum:** `src/pages/firma/OfferteErstellen.tsx:1027-1061, 1097-1105`
**Sorun:** Fallback "enhanced" kolonları olmayan DB için var ama `coreOfferData` artık `customer_number`/`discount_percent`/`frozen_*` gibi bazı enhanced kolonlardan da yeni kolonlar taşıyor → böyle bir DB'de fallback insert de aynı şekilde patlar, offer hiç kaydedilmez.
**Fix:** Fallback'ı kaldır (canlı DB'de tüm kolonlar var — gerçek hataları maskeleyen ölü kod), ya da `coreOfferData`'yı orijinal şemaya sıkı sınırla.

### M22 — Live preview aritmetiği Zuschlag varken tutmuyor
**Konum:** `src/pages/firma/OfferteErstellen.tsx:2182-2185, 2272-2275`; `src/components/offerte/OfferteLivePreview.tsx:348-356`
**Sorun:** Preview `subtotal = calculateSubtotal()` (yalnız item) alıyor ama `vatAmount`/`total` item+surcharge üzerinden; surcharge satırı render etmiyor → ekranda `Zwischensumme + MwSt ≠ Total`.
**Failure scenario:** Item 1000 + fixed Zuschlag 120, MwSt 8.1% → preview 1000 / 90.72 / 1210.72 gösterir, ekranda toplanmıyor.
**Fix:** `surcharges`'ı `OfferteLivePreview`'a geçir ve Zwischensumme ile MwSt arasında render et (`mapOfferData` üzerinden PDF zaten yapıyor).

### M23 — Ölü portal sayfaları + tracking/cookie yığını
**Konum:** `src/pages/{PartnerRegistrierung,Index,DashIndex,Anfrage,AnfrageErfolg,FuerFirmen,SoFunktioniertEs}.tsx`, `src/components/home/*`, `src/components/dash/*`, `CookieBanner.tsx`, `TrackingProvider.tsx`, `useTrackingScripts.ts`
**Sorun:** `App.tsx`'ten erişilemeyen ama hâlâ derlenen/birbirini import eden portal ölü kodu (GA4/GTM/Meta/LinkedIn/TikTok pixel loader dahil). `App.tsx:11` CRM-FORK yorumu bunların kaldırıldığını söylüyor ama duruyorlar.
**Fix:** Sil — bir lazy-import uzaklıkta portalı diriltme riski ve §6/§10 ihlallerini canlı tutuyor.

### M24 — pdf.js worker üçüncü-parti CDN'den
**Konum:** `src/components/offerte/PdfPreviewDialog.tsx:20`
**Sorun:** pdf.js worker `https://unpkg.com/pdfjs-dist@4.0.379/...`'den yükleniyor — production özelliği üçüncü-parti CDN'e bağımlı (offline/CSP'de patlar, bundle'daki `pdfjs-dist`'le versiyon drift'i).
**Fix:** Worker'ı lokal paketten Vite `?url` import ile serve et.

### M25 — Aktif CRM kodunda ~39 dosyada Türkçe yorum
**Konum:** `generateRechnungPdf.ts` (25+), `useRechnungen.ts`, `useQuittungen.ts`, `CatalogServiceSelector.tsx` (15+), `AuftragModal.tsx`, `OfferteErstellen.tsx:660,1035`, `mapOfferData.ts:285-290`, `SurchargeEditor.tsx`, `TeamWeekView.tsx`, `UploadZone.tsx`, `Rechnungen.tsx`, `RechnungDetail.tsx`, `OfferteDetail.tsx`, `ServiceTable.tsx`, `OfferPDF.tsx` vb.
**Sorun:** Yorum/JSDoc'larda Türkçe (UI JSX/toast string'leri Almanca — temiz). Memory kuralı: Türkçe hiçbir yerde olmaz.
**Fix:** Yorumları İngilizce/Almanca'ya çevir. (H11'deki runtime string'ler öncelikli.)

---

## LOW

- **L1** — `delete-besichtigung-photo/index.ts:50-53`: token→session doğrulandıktan sonra `photo_id`'nin session'a ait olduğu kontrol edilmiyor (IDOR). Photo ID'leri unguessable UUID olduğundan pratik risk düşük. **Fix:** delete'i session'a scope et.
- **L2** — `.env.example`: `VITE_RESEND_API_KEY=` — Vite `VITE_*`'ı bundle'a gömer; şablon operatörü gerçek key koymaya yönlendirebilir. **Fix:** satırı kaldır, Resend key'leri sadece Supabase Secrets olarak belgele.
- **L3** — `generateChecklistPdf.ts:89-97`: `hexToRgb` 3-haneli hex/geçersiz girdiyi işlemiyor (`#fff` → mavi, geçersiz → NaN). **Fix:** `generateAuftragPdf.ts`'in doğrulanmış `hexToRgb`'sini kullan.
- **L4** — `generateChecklistPdf.ts:286`: Poppins `italic` kayıtlı değil → jsPDF sessizce Times-Italic'e düşer (slogan). **Fix:** italic face kaydet ya da `normal` kullan.
- **L5** — `generateRechnungPdf.ts:299-301` + `swiss-qr/core.ts:194-232`: normal IBAN'da 27-hane olmayan numerik referans `NON` sınıflanıyor ama ham referans yine payload'a giriyor; SIX spec NON'da Ref boş olmalı → katı tarayıcılar reddeder. **Fix:** çözülen tip NON iken referansı boşalt.
- **L6** — `validation.ts:22-25` (`sanitizePhone`): operatör önceliği `('+' + digits) || null`; `"+"` truthy → çıplak artı işareti saklanır. **Fix:** `const digits = ...; return digits ? '+' + digits : null;`
- **L7** — `mapOfferData.ts:284-298` (documented `TODO(3b)`): blind `maxSubtotal` optional/inkl item'ları içeriyor, OfferView max'ı dışlıyor. H2 fix'iyle birlikte çöz.
- **L8** — `handle-proposal-response:397-403`, `confirm-besichtigung:49-55`: `calculateEndTime` `% 24` ile gece yarısını aşan randevuda `end_time < start_time`. **Fix:** 23:59'a clamp'le ya da tarihi ilerlet.
- **L9** — `handle-reschedule-response:108-117`: onayda `appointment_date`/`start_time` güncelleniyor ama `end_time` değil → end < start. **Fix:** `end_time`'ı aynı delta ile kaydır.
- **L10** — `admin-add-company-member:72-82`: `listUsers()` paginated (default 50), sadece sayfa 1'de e-posta arıyor. **Fix:** pagination loop ya da `profiles`'tan sorgula.
- **L11** — `auto-archive:14-23`: `offers_retention_days`/`appointments_retention_days` ayarları var ama offers/appointments hiç arşivlenmiyor. **Fix:** eksik arşivleyicileri yaz ya da ayarları kaldır.
- **L12** — `_shared/cors.ts:22-34`: `getCorsHeaders()` (origin-allowlist) ölü kod; allowlist `8080` dev portunu içermiyor, `*`+`credentials:true` kombinasyonu tarayıcıca reddedilir. **Fix:** `8080` ekle, `*`+credentials'ı kaldır ya da helper'ı sil.
- **L13** — `resend-email/index.ts:57-98`: "Resend" orijinal içeriği/PDF'i generic şablonla değiştiriyor, müşterilere "hesabınıza giriş yapın" diyor (müşterilerin hesabı yok). **Fix:** type-özel sender'a yönlendir ya da orijinal HTML'i dahil et.
- **L14** — Kalender/Auftraege haftalık/bugün istatistikleri date-only string'i UTC parse edip yerel hafta sınırıyla karşılaştırıyor (`Kalender.tsx:582`, `Auftraege.tsx:297`) → Pazar/bugün randevuları sayımdan düşüyor. **Fix:** tarih string'leriyle karşılaştır ya da `endOfWeek(..., {weekStartsOn:1})`.

**Konvansiyon düşük öncelik toplu:** `as any` (13, çoğu `AppointmentModal`/`LeadFormWizard`/`OfferteErstellen`) + eşleşen 10 `eslint-disable no-explicit-any` — types.ts regen edip typed client kullanınca çözülür; frontend `console.log` (57, 34'ü debug-gated; en kötüsü `LeadFormWizard.tsx:696` lead ID sızdırıyor, `useRecaptcha.ts:9`); toast'sız `console.error`-only catch'ler (191 içinden alt küme); 18 barrel export (aktif olan `moving-calculator/index.ts` öncelikli); 110 inline style (çoğu haklı-dinamik).

---

## Fix öncelik listesi

**Şimdi (production'da bozuk / veri kaybı / güvenlik):**
1. **C1** — `handle-reschedule-response`: eksik importu ekle + token doğrulaması + body yerine DB'den türet + HTML escape. (Çöküyor **ve** phishing relay.)
2. **C2** — `auto-archive`: importu top-level'a taşı. (Arşivleme tümüyle ölü.)
3. **C3** — `send-purchase-confirmation`: syntax'ı düzelt ya da fonksiyonu sil (Offerio kalıntısı).
4. **H1** — Offerte'ye `moving_distance_km` yaz / Bearbeiten'de lead'den fallback. (Düzenlemede sessiz para kaybı.)
5. **H2 + M2 + L7** — `price_type`'ı Auftrag snapshot + `OfferItemInput`'a plumb'la, blind te'de `quantity=1`. (Müşteri fazla/eksik faturalanıyor — birlikte çözülmeli.)
6. **H7** — `auto-archive`: snapshot başarısızsa silme; sadece snapshot'lanan ID'leri sil. (C2 arkasında latent veri kaybı.)
7. **H3** — Tüm Resend call site'larında `{ error }` kontrolü; flag'leri yalnız başarıda yaz.
8. **H5** — `send-offer` atomik send-claim + hata status kodları.
9. **H8** — Cron secret fail-closed.
10. **H10** — Stripe subscription fonksiyonlarını sil + config.toml bloklarını temizle. (NEVER ihlali.)

**Sonra (yanlış müşteri-belgesi / yanlış istatistik / dayanıklılık):**
11. **H4** — AGB/checklist normalizer'ı kanonik taksonomiye bağla. (Ekler sessizce eksik gidiyor.)
12. **H6** — Hatırlatma timezone + başarısızlıkta flag.
13. **M1** — `discount_percent` clamp + gizle/etiketle (F3'e kadar); F3'te totals'a entegre.
14. **M3** — `QuittungDetail` MwSt oranını restore et.
15. **M5** — `generateAuftragPdf` VAT=0 etiketi.
16. **M6** — Rechnung PDF çok-satır guard'ı.
17. **M7** — spellCheck timeout signal'i geçir.
18. **M8 + M9** — OfferteDetail blind aralığı item'lardan hesapla + preview payload'a `time_estimate`.
19. **M4 + L14** — Timezone: date-string karşılaştırması (Dashboard/Kalender/Auftraege).
20. **M11 + M12** — Public token e-postalarında HTML escape + alıcı/tutarı DB'den al.
21. **M13, M14, M16** — Idempotency/atomiklik (proposal, lead-token, besichtigung).
22. **M15, M17, M18, M19, M20** — Edge fn robustluk düzeltmeleri.

**Hijyen (bug değil ama kural/temizlik):**
23. **H9** — Logo/Signature sessiz fallback'ı gözlemlenebilir kıl.
24. **H11 + M25** — Türkçe runtime string'leri (öncelik) ve yorumları çevir.
25. **M10** — Google proxy rate-limit.
26. **M21** — OfferteErstellen core-fallback insert'i kaldır/sınırla.
27. **M22** — Live preview'a surcharge geçir.
28. **M23** — Ölü portal + tracking yığınını sil.
29. **M24** — pdf.js worker'ı lokalleştir.
30. **L1–L13** + konvansiyon toplu (`as any`, `console.log`, barrel, inline style) — fırsat buldukça.

> **CI önerisi:** `deno check supabase/functions/**/index.ts`'yi pipeline'a ekle — C1/C2/C3 üçü de bu tek adımla önceden yakalanırdı.
