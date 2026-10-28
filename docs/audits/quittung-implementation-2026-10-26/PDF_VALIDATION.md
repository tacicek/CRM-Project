# Makbuz PDF doğrulaması — 26.10.2026

Bu klasördeki makbuzlar tamamen sentetiktir. Gerçek müşteri, firma hesabı, canlı veritabanı veya e-posta kullanılmadı.

Gerçek `QuittungPDF` ve `@react-pdf/renderer` ile 19 PDF üretildi. Metin, sayfa sınırları ve koordinatlar üzerinde **71 kontrolün 71'i geçti** (`pdf-verification.json`). Normal, Türkçe karakterli, Fransızca kısmi ödeme ve uzun belge sayfası PNG olarak da incelendi.

- Taslak, imzalı, gönderilmiş ve ödenmiş dijital belgelerde toplam/indirim görünür.
- Boş alanlar sadece açıkça seçilen worksheet çıktısında; bu belgede ödeme kanıtı olmadığı belirtilir.
- `Işıl Çiçek Şahin Güneş Ğğ İı` ve `→` değişmeden PDF'ye geçer. Yerel DejaVu fontları gömülür.
- 50 satırın her birinde açıklama ve tutar aynı sayfada; devam sayfalarında belge numarası, tablo başlıkları ve sayfa x/y var.
- Çok uzun tek açıklama kontrollü devam parçalarına ayrılır. Stres çıktısında sayfa dışına taşan metin bulunmadı.
- Açık, kısmi, ödenmiş ve kredi notuyla kapanan fatura için tutar/bakiye senaryoları kontrol edildi. Fatura bakiyesi makbuz toplamından türetilmez.
- Dahil hizmet, eski birim fiyatıyla hesaplanan ücret yerine `Included / Inclus / Inklusive` olarak gösterilir.
- Tarih ve imza saati Europe/Zurich takvim/saat politikasıyla; LA ve Zurich süreçlerinde aynı çıktı.

Gerçek Chromium, React ve PDF renderer ile önizleme denemesi (`preview-result.json`):

- Bir iframe; aç/indir bağlantıları aynı blob'u kullanıyor.
- Taslak önizlemede gerçek WebP logo ortak hazırlama işleviyle PNG’ye çevriliyor ve PDF içinde görüntü olarak bulunuyor; bozuk logo görünür hataya dönüşüyor.
- Belge Almanca, kontroller Fransızca seçilebiliyor.
- Renderer hatası yerel hata alanına dönüşüyor; tekrar deneme düzelmiş veriyle çalışıyor, sayfa hatası yok.
- Kesinleşmiş belge önizlemesi arşivden alınan dosyayla **aynı SHA-256** değerine sahip.
- Arşiv okuma hatası ve tekrar deneme çalışıyor.

Önizleme denemesinde yalnız Supabase API sınırı sentetik adaptörle değiştirildi. Logo hazırlama ve arşiv istemcisi gerçek uygulama kodudur. React/PDF renderer, blob indirme, iframe ve hata sınırı gerçek uygulama kodudur. SQL veya üretim arşivi bu denemede çağrılmaz.

## Tekrar çalıştırma

Repo kökünden, bağımlılıklar kurulu ve Poppler (`pdftotext`) mevcutken:

```bash
node --loader ./docs/audits/quittung-implementation-2026-10-26/ts-loader.mjs ./docs/audits/quittung-implementation-2026-10-26/render-pdf-fixtures.tsx
TZ=America/Los_Angeles AUDIT_CASE=signed-image AUDIT_SUFFIX=-la node --loader ./docs/audits/quittung-implementation-2026-10-26/ts-loader.mjs ./docs/audits/quittung-implementation-2026-10-26/render-pdf-fixtures.tsx
TZ=Europe/Zurich AUDIT_CASE=signed-image AUDIT_SUFFIX=-zurich node --loader ./docs/audits/quittung-implementation-2026-10-26/ts-loader.mjs ./docs/audits/quittung-implementation-2026-10-26/render-pdf-fixtures.tsx
python3 docs/audits/quittung-implementation-2026-10-26/verify-pdfs.py
node docs/audits/quittung-implementation-2026-10-26/verify-preview.mjs
```

Chromium başka konumdaysa son komutta `CHROMIUM_PATH` verilebilir. Betikler bu klasördeki sentetik çıktı/sonuç dosyalarını yeniler; uygulama verisi yazmaz. Browser testinin bundle dosyası geçici `/tmp` dizinindedir.

Saf fonksiyon regresyonları: `src/lib/__tests__/quittungPresentation.test.ts` — 6 test geçti. Değişen PDF/çeviri dosyalarının ESLint kontrolü geçti. Ana ajan sistemin tamamına ait typecheck, build ve bütün test sonuçlarını ayrıca raporlar.
