# Quittung uygulama ve doğrulama raporu

26 Ekim 2026

Quittung oluşturma, tahsilat, Rechnung bağlantısı, imza, PDF ve gönderim akışları
yenilendi. Değişiklikler yerel çalışma alanındadır. Üretim veritabanına veya canlı
e-posta servisine uygulanmadı; gerçek müşterilere test e-postası gönderilmedi.

## Kullanıcı açısından davranış

- Belge dili Almanca, Fransızca veya İngilizcedir. Müşteri adı/adresi çevrilmez
  veya harf dönüşümüne uğratılmaz. `Çağrı Şimşek` gibi isimler PDF'de korunur.
- Auftrag/Offerte kaynaklı makbuz; müşteriyi, dili, KDV'yi, indirimi ve fiyat
  satırlarını taşır. Sıfır KDV korunur. Opsiyonel satırlar seçilmeden ücretlenmez;
  dahil hizmetler ücretsiz ve açıkça etiketli görünür.
- Taslak düzenlenebilir. `Ausstellen` ile belge kesinleştirilir; imza zorunlu
  değildir. Varsa iki imza aynı kayıt işleminde yakalanır. Kesinleşen belge
  müşteri/fiyat/imza değişikliklerine veritabanı düzeyinde kapatılır.
- Doğrudan tahsilatta `Bezahlt` düğmesi tarih, yöntem ve referans penceresini
  açar. Ödeme ile makbuz durumu tek işlemde kaydedilir.
- Makbuza bir Rechnung bağlandığında ödeme o faturadan izlenir. Kısmi ödeme,
  tam ödeme, ödeme iptali ve kredi notu makbuza yansır. Bu eşitleme ikinci bir
  ödeme veya gelir kaydı oluşturmaz. Fatura seçimi taslak aşamasında yapılır.
- PDF toplamları taslak, kesinleşmiş, imzalı, gönderilmiş ve ödenmiş belgelerde
  görünür. Boş çalışma formu ayrı bir düğmedir.
- Kesinleşmiş belge önizlemesi, indirmesi ve e-posta eki aynı arşiv dosyasını
  kullanır. Ödeme durumu değişirse yeni sürüm oluşur; önceki arşiv korunur.
- Liste arama, filtreleme ve sayfalama kullanır. Yükleme hatası boş liste gibi
  gösterilmez. Gelir toplamı makbuzlar üzerinden ikinci kez hesaplanmaz.

## Önceki incelemenin bulguları

İlk rapor ve eski hataları gösteren örnekler tarihsel kanıt olarak korundu:
[inceleme raporu](QUITTUNG_INCELEME_RAPORU_2026-10-25.md).

| Bulgu | Uygulanan düzeltme | Doğrulama |
|---|---|---|
| Q01–Q03 | Opsiyonel/dahil hizmetler, KDV ve indirim kaynağı korunur; miktar ve birim fiyat düzenlenebilir | Saf fiyat testleri, gerçek form akışı |
| Q04, Q24 | İki imza tek payload; yeniden boyutlandırmada raster/vektör korunur | Chromium ve gerçek SignaturePad |
| Q05 | Kesinleşmiş alanlar hem UI hem DB'de kilitli | SQL yasak yazma testleri, tarayıcı |
| Q06, Q14 | Toplamlar her durumda dolu; satırların sayfalar arasında doğru bölünmesi, başlık ve sayfa numarası | Gerçek PDF renderer ve metin/yerleşim kontrolü |
| Q07, Q08, Q18, Q19 | Kaydedilmiş tam satır kullanımı; kaynak değişiminde alan sıfırlama; null ile bağlantı kaldırma; kanonik URL ve hata toparlanması | Saf testler, Chromium |
| Q09–Q11 | Tahsilat/iptal/geçmiş ve gönderimin ödeme durumunu bozmaması | SQL ve Edge handler testleri |
| Q12 | Firma snapshot'ı, sürümlü özel PDF arşivi, SHA256 ve arşivden gönderim | SQL arşiv testleri, Edge handler, önizleme byte karşılaştırması |
| Q13, Q16, Q17 | Yerel font, özgün müşteri karakterleri, takvim tarihi ve Europe/Zurich imza saati, DE/FR/EN | PDF üretimi ve saf sunum testleri |
| Q15 | Ödeme durumu/tarih/yöntem/referans ve gerçek fatura bakiyesi | SQL ve PDF örnekleri |
| Q20 | JSON satır doğrulaması; sunucuda toplam/KDV yeniden hesaplama; taslak/kesinleştirme ayrımı | Saf doğrulama ve SQL |
| Q21, Q22 | Arşivsiz gönderim reddi; alıcı başına kalıcı gönderim kaydı; tekrar denemede idempotency; DB hatasında başarısız yanıt; imzasız belge için yanlış imza beyanının kaldırılması | Saf gönderim kuralları ve gerçek handler'ın adaptör testleri |
| Q23 | Şirket/yıl sayacı ile atomik, silmede geri kullanılmayan ve dört hanede kesilmeyen numara | SQL numaralandırma testleri |
| Q25, Q26 | Görünür liste hatası ve yeniden deneme; e-postada kullanıcı metinlerinin HTML kaçışı | Liste kuralları, DE/FR/EN HTML testleri |

## Veri ve arşiv modeli

`issued_at` belgenin kesinleşmesini, `sent_at` gönderimi belirtir.
`payment_status`, `paid_amount`, `payment_open_amount` ve ödeme ayrıntıları
istemcinin beyanından alınmaz; ödeme defteri veya bağlı Rechnung'dan türetilir.
`status` eski ekranlarla uyumluluk için türetilen alandır.

`quittung_payment_links`, iptal edilen ve yeniden yapılan doğrudan tahsilatları
korur. `quittung_documents`, her belge sürümünün dosya yolunu ve SHA256 değerini
saklar. `quittung_dispatches`, müşteri/firma alıcısı için gönderim durumunu saklar.
Yeni tablolar RLS ile korunur; arşiv/gönderim yazmaları sunucu tarafındadır.

PDF dosyası tarayıcıda kaydedilmiş snapshot üzerinden üretilir; Edge dosya
boyutunu, PDF başlığını, yolunu ve SHA256 değerini doğrular. Bu, dosya bütünlüğü
ve tekrar kullanım kontrolüdür; kriptografik belge imzası değildir.

Eski logo dosyaları, firma logosu değiştirilince veya kaldırılınca silinmez.
Böylece önceki firma snapshot'ındaki logo bağlantısı korunur. Logo temizliği
yapılacaksa tarihsel belge referansları dikkate alınmalıdır.

## Yerel doğrulama

Test sonuçları ve sentetik örnekler
[uygulama kanıtları klasöründe](audits/quittung-implementation-2026-10-26/)
saklanır. Tarayıcı testleri gerçek React formunu, SignaturePad ve ödeme dialogunu
çalıştırır; DB ve e-posta adaptörleri sentetiktir. SQL testleri ayrı yerel
`crm-test` veritabanında çalışır. PDF testleri gerçek renderer kullanır.

| Kontrol | Sonuç |
|---|---|
| `npm test` | 121 dosya, 2.224 test başarılı |
| Yerel DB entegrasyon paketi | 13/13 test dosyası başarılı; Quittung için 43 SQL kontrolü dahil |
| Eşzamanlı DB işlemleri | İki ayrı bağlantıyla 3 senaryo başarılı: iki işlem sırasıyla fatura bağlantısı/güncellemesi ve paralel belge numarası üretimi |
| Migration | Yeniden uygulama ve yerel veri ön kontrolü başarılı |
| `npm run type-check` | Başarılı |
| `npm run type-check:test-infra` | Başarılı |
| `npm run build:vite` | Üretim frontend derlemesi başarılı |
| CRM proje lint kontrolü | 0 hata; değiştirilmemiş `PaginationBar.tsx` dosyasında 1 Fast Refresh uyarısı |
| Deno typecheck | `send-quittung` ve ortak şablonu kullanan `send-rechnung-email` başarılı |
| Gerçek React formu | 10 Chromium senaryosu başarılı |
| Gerçek PDF üretimi | 19 PDF üzerinde 71 kontrol başarılı |
| Önizleme | Tek blob; WebP logo dönüşümü; hata/yeniden deneme; arşiv SHA256 eşitliği başarılı |

Genel `npm run lint`, bu değişiklikte dokunulmayan `vibecosystem` git alt
modülünde 88 mevcut hataya takılır. Alt modül dışındaki proje için
`npm run lint -- --ignore-pattern 'vibecosystem/**'` başarılıdır. Bu ayrım,
uygulama lint hatalarını gizlemek için yapılandırmaya eklenmedi.

Yerel DB paketinde API bütçesi testinin beklediği, depoda zaten bulunan migration
test kurulum listesine eklenmemişti. Bu test kurulum eksiği giderildi; API bütçesi
uygulama kodu değiştirilmedi.

Tarayıcı sonuçları [frontend doğrulamasında](audits/quittung-implementation-2026-10-26/FRONTEND_VALIDATION.md),
PDF sonuçları [PDF doğrulamasında](audits/quittung-implementation-2026-10-26/PDF_VALIDATION.md)
ve SQL sonuçları [veritabanı doğrulamasında](audits/quittung-implementation-2026-10-26/DB_VALIDATION.md)
ayrıntılıdır. İncelenebilir sentetik örnekler:
[Almanca ve özgün isimler](audits/quittung-implementation-2026-10-26/turkish.pdf),
[Fransızca kısmi fatura ödemesi](audits/quittung-implementation-2026-10-26/partial-invoice.pdf).

## Üretime geçiş

Birlikte yayımlanması gereken parçalar:

1. `supabase/migrations/20261025180327_quittung_document_lifecycle.sql`.
2. `send-quittung` klasörü (`index.ts`, `document.ts`, `presentation.ts`);
   ortak `htmlEscape.ts`, `invoiceEmailTemplate.ts` ve `_shared/i18n/catalog.ts`.
   Ortak şablonu kullanan `send-rechnung-email`
   dağıtımı da aynı sürümden yapılmalıdır.
3. Frontend derlemesi ve yeni yerel font dosyaları.

Migration, Edge ve frontend aynı bakım penceresinde uygulanmalıdır. Eski
istemciler kapatılıp yenilenmelidir; eski gönderim isteği yeni endpoint ile
uyumlu değildir. `document-pdfs` özel bucket'ı, imzalı yükleme/okuma ve mevcut
Resend ayarları hazır olmalıdır. Canlıda önce yetkili test adresiyle bir taslak,
kesinleştirme, PDF arşivi, gönderim ve ödeme eşitleme kontrolü yapılmalıdır.

Migration öncesinde `supabase-test/quittung-preflight.sql` hedef veritabanında
salt okunur çalıştırılmalı; dönen kayıtlar incelenmelidir. Yerelde engelleyici
kayıt bulunmaması canlı verinin temiz olduğunu göstermez. Migration hatalı eski
taslakları, tutarsız toplamları veya birden fazla makbuza bağlanmış aynı doğrudan
ödemeyi sessizce düzeltmez; ilgili kayıtları bildirip işlemi durdurur.

Eski kesinleşmiş belgelerin tarihsel firma bilgileri geriye dönük olarak
yeniden oluşturulamaz. Migration mevcut firma bilgilerini geçiş anında
snapshot olarak kaydeder; bu zamanı eski düzenleme tarihi gibi göstermez.
Önceden üretilmiş ama arşivlenmemiş PDF'lerin eski byte içeriği de geri getirilemez.
Eski kayıtlar için Rechnung bağlantısı tahmin edilmez.

Gönderim tekrarları kalıcı dispatch kimliğiyle aynı Resend idempotency anahtarını
kullanır. Resend anahtarları 24 saat tuttuğundan, durumu belirsiz gönderim için
23 saat sonrası otomatik tekrar durdurulur; sağlayıcıdaki teslim durumu
uzlaştırılmalıdır. [Resend idempotency belgesi](https://resend.com/docs/dashboard/emails/idempotency-keys).

Üretimde migration geri alınarak eski yazılabilir belge modeline dönülmemelidir.
Sorunda yazma/gönderim durdurulup kayıtlar korunarak ileri düzeltme yapılmalıdır.
