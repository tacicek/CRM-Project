# Kesinleşmiş makbuz indirme: istemci sınırı incelemesi

Tarih: 2026-10-26. Üretim verisi veya oturumu kullanılmadı; yalnız yerel sentetik kayıtlar.

## Tekrar komutu

```sh
node docs/audits/quittung-download-2026-10-26/frontend-download.cjs
```

Harness gerçek `QuittungDetail`, `Quittungen`, `mapQuittungRow`, `quittungDocuments`, PDF renderer ve kurulu Supabase Storage SDK'sını çalıştırır. Backend sorguları ve ağ taşıması sentetik adaptörlerdir. Edge handler'ın canlı ortam konfigürasyonunu doğrulamaz. Eski browser-flow harness'i belge helper'ını tamamen stub'ladığı için bu sınıra ulaşmıyordu.

## Sonuç

- Ödenmiş kayıt için detay ve liste, aynı `id/version` ile arşiv `lookup` çağırıyor. Detay `persist()` frozen kaydı güncellemeden döndürüyor; iki ekranda da DB yazımı sıfır.
- SDK signed URL'yi `http://kong:8000` üzerinden oluşturduğunda gerçek browser fetch başarısız: `net::ERR_NAME_NOT_RESOLVED`, UI `Failed to fetch`, indirme olayı yok.
- Aynı kayıt ve sürümde yalnız signed URL origin'i tarayıcıdan erişilebilir yapıldığında iki ekrandan da PDF indiriliyor.
- İlk arşivleme için gerçek renderer yaklaşık 23,8 KB PDF üretip gerçek `uploadToSignedUrl` çağrısına veriyor. `lookup → prepare → PUT upload → archive` tamamlandıktan sonra internal signed URL yine indirilemiyor; erişilebilir signed URL ile indirme başarılı.
- Taslak, Edge arşiv yoluna girmeden gerçek renderer üzerinden indiriliyor.
- Kesinleşmiş önizleme de `ArchivedPreview` içinden aynı `archived.url` için `fetch()` kullanır; aynı erişilebilirlik sınırına tabidir.

Bu bulgular internal-origin signed URL koşulunun kullanıcı semptomunu ürettiğini kanıtlar. Bunun üretimdeki kök neden olduğu ayrıca canlı Edge konfigürasyonu/yanıt origin'i ile doğrulanmalıdır; bu harness üretime erişmez.

`frontend-download-before.json` başlangıç kanıtını korur. `expectedDownload:false` olan vakalar mevcut bozuk koşulun yeniden üretimidir; `passed:true` bu beklenen başarısızlığın doğru yakalandığını ifade eder, üretim hatasının giderildiğini değil.

## Kod sınırları

- `src/pages/firma/QuittungDetail.tsx`: `persist()` frozen canonical row'u döndürür; `captureSignatures()` mevcut imza string'ini korur.
- `src/pages/firma/Quittungen.tsx`: download öncesi `select('*')` ve `mapQuittungRow`; lightweight liste projection'ı PDF girdisi değildir.
- `src/lib/quittungDocuments.tsx`: kesinleşmiş indirmede `getArchivedQuittungDocument()` sonucundaki URL doğrudan `fetch()` edilir.
- `supabase/functions/send-quittung/index.ts`: `documentResponse()` Storage SDK `createSignedUrl()` sonucunu istemciye verir.
- `src/components/quittung/QuittungPDFPreview.tsx`: kesinleşmiş önizleme aynı arşiv URL'sini alır.

Uygulama kaynak dosyaları bu incelemede değiştirilmedi.

## Düzeltme sonrası gerçek helper regresyonu

```sh
node docs/audits/quittung-download-2026-10-26/frontend-download.cjs --fixed
```

`--fixed` modu, kurulu SDK'nın `http://kong:8000` origin'iyle oluşturduğu ham signed URL'yi `supabase/functions/send-quittung/document.ts` içindeki **gerçek exported `publicReceiptPdfUrl()`** fonksiyonuna verir. Beklenen URL test içinde elle üretilmez. HTTPS public Storage yapılandırması ve HTTP public Storage nedeniyle HTTPS CRM proxy seçimi ayrı ayrı kapsanır.

Altı başarılı senaryo: paid detail/list mevcut arşiv; paid detail/list ilk arşivleme; mevcut/yeni arşiv için gerçek `ArchivedPreview` ve içindeki indirme bağlantısı. Her senaryoda açık isimli `Quittung-QU-FIXTURE.pdf` indirmesi alınır ve indirilen dosyanın baytları arşiv fixture'ı veya gerçek renderer'dan upload edilen PDF baytlarıyla birebir karşılaştırılır. Frozen kayıtlarda DB yazımı sıfırdır. Sonuç: `frontend-download-after.json`.

Headless Chromium bu ortamda iframe'in `blob:` PDF'ini yerleşik viewer ile çizmek yerine ayrıca indirme olayına dönüştürür; bunun local `blob:` isteği `ERR_ABORTED` olarak kaydolur. Bu durum ayrı sınıflandırılır, başarılı dış Storage/CRM fetch'iyle karıştırılmaz. Test preview'ın arşiv baytlarını aldığını, blob URL'yi iframe'e verdiğini ve açık indirme bağlantısının aynı baytları teslim ettiğini doğrular; PDF viewer'ın görsel çizimini bu kontrol doğrulamaz. Herhangi bir dış istek hatası veya açık dosya indirmesinin yokluğu regresyonu başarısız yapar.

Başlangıçtaki yedi tanı vakası varsayılan komutla korunmuştur; `frontend-download-before.json` değiştirilmez.
