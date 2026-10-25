# Teklif → Auftrag → Quittung adres aktarımı

## Kanıtlanan ayrı kaynak hatası

`AuftragModal` kabul edilmiş teklifi okumasına rağmen adresleri yalnız güncel lead'den oluşturuyordu. Teklifin `frozen_from_house_number` / `frozen_to_house_number` alanları doluyken lead numarası silinmişse Auftrag numarasız kaydediliyordu. Lead kaydı bulunamazsa teklifin müşteri/adres ön-doldurması tamamen atlanıyordu. Quittung mapper'ı Auftrag'ın adres string'ini doğru biçimde aynen koruduğu için kayıp makbuza taşınıyordu.

Gerçek React modal ve gerçek Quittung draft/payload fonksiyonlarıyla iki senaryo düzeltmeden önce başarısız oldu. `order-source-before.json`: başlangıç `Alte Landstrasse` / varış `Rue du Lac`, eksik `12a` / `8B`; lead yokken her iki adres boş. Aynı tekliften doğrudan makbuz oluşturma yolu numaraları koruyordu.

## Değişiklik

- `offerAddressSnapshot.ts`: her yön için teklifin dondurulmuş adresini bir bütün olarak seçen ortak saf modül. Dondurulmuş posta adresi yoksa o yönün lead adresi kullanılır; eski sokak yeni numara veya kat/asansör bilgisiyle birleştirilmez.
- `quittungDraft.ts`: mevcut `getReceiptOfferAddresses()` API'si ortak seçiciyi kullanır; dış arayüzü korunur.
- `AuftragModal.tsx`: yeni Auftrag teklif adresini bu seçiciden alır. Lead bulunmasa veya bağlantısı silinse de teklif müşteri/adresi doldurulur. Hizmet türü mevcut şema gereği lead’den gelir; lead yoksa uydurulmaz. Dondurulmuş kat/asansör bilgileri hem adres metnine hem hizmet detaylarına aynı kaynaktan taşınır. Gerçek sorgu hatası kullanıcıya gösterilir. Mevcut Auftrag'ın operatörce yazılmış adresleri tekrar türetilmez. Hem teklif aktarımı hem mevcut Auftrag düzenlemesi `0` KDV oranını korur; adres düzeltmesi kaydında oranı varsayılan `8.1` değerine çevirmemelidir.
- `quittungAddress.test.ts`: frozen numaralar, silinen lead, yön başına fallback, `0` kat/`false` asansör, snapshot'a yeni alan karıştırmama ve input immutability kontrolleri.

## Doğrulama

```sh
node docs/audits/quittung-house-number-2026-10-26/order-source-browser.cjs
npm test -- --run src/lib/__tests__/quittungAddress.test.ts src/lib/__tests__/quittungDraft.test.ts src/lib/__tests__/auftragLead.test.ts src/lib/__tests__/auftragPayload.test.ts
npx eslint src/lib/offerAddressSnapshot.ts src/lib/quittungDraft.ts src/components/firma/AuftragModal.tsx src/lib/__tests__/quittungAddress.test.ts
npm run type-check
```

Sonuç: 5/5 browser senaryosu, 84/84 hedefli saf fonksiyon testi, ESLint ve TypeScript başarılı. Browser: lead numarası silinmiş, lead bulunamıyor, `lead_id=null`, operatör adresi korunuyor, eski numarasız order sessizce yeniden yazılmıyor. Her senaryoda gerçek modalın kaydetme butonuna basılır; gerçek `buildAuftragInsertPayload`/`buildAuftragUpdatePayload` sonucu sentetik DB adaptöründe tutulur ve bu kayıt gerçek Quittung mapper/payload fonksiyonuna aktarılır. Sadece input değerleri karşılaştırılmaz. Lead varsa kaydedilen `service_type=umzug`, lead yoksa mevcut kontrata uygun `null`, her durumda `vat_rate=0` ve iki adresin Quittung payload'ına değişmeden taşınması da doğrulanır. Veri erişimi sentetik adaptördür; üretim kaydı değiştirilmedi.

`order-transfer-before.json` gerçek kaydetme testiyle saptanan KDV aktarım hatasını korur: yeni/eski Auftrag’da KDV `0 → 8.1`. Bu ara testin hizmet türü beklentisi daha sonra şema ile düzeltildi: `offers.service_type` alanı yoktur; lead yokken türün `null` kalması hata olarak değerlendirilmez. Nihai `order-source-results.json` aynı kayıt zincirinde doğru değerleri içerir.

## Mevcut kayıt sorunu için sınır

Bu düzeltme yeni Auftrag aktarımını düzeltir. Mevcut numarasız Auftrag veya Quittung kayıtlarını kendiliğinden onarmaz. `existing-numberless-order` kontrolü bu sınırı bilerek doğrular: geçmişte yazılmış string aynen kalır. Kullanıcının belirttiği mevcut makbuzun sorunu yalnız bu değişiklikle çözüldü denemez.

Taslak Quittung'ın adresi kaynak kanıtla karşılaştırılıp adres alanlarına özel, sürüm kontrollü bir düzeltme yapılabilir. Teklifi baştan seçtirmek fiyat ve satırları da değiştirdiği için adres onarımı için uygun değildir. Kesinleşmiş belge/snapshot ve arşivlenmiş PDF sessizce değiştirilmemeli; düzeltme veya yeniden düzenleme iş akışı ayrıca kararlaştırılmalıdır. Güncel müşterinin posta adresi, hizmetin başlangıç adresi yerine otomatik kullanılmamalıdır.
