# i18n Katalog Lazy-Loading — Analiz & Ertelenmiş Migration Planı

> **Durum: ERTELENDİ (2026-07-16).** Kod DEĞİŞTİRİLMEDİ. Bu doküman, ileride ayrı
> bir oturumda yapılacak migration için hazır referanstır. Karar gerekçesi: kazanç
> tek seferlik + kalıcı cache'lenen ~80–95 KB gz iken, gerekli değişiklik müşteriye
> giden PDF/e-posta kritik yolunu (~25–40 dosya) yeniden yazıyor ve tek bir kaçırılan
> preload = **müşteriye yanlış dilde belge** (sistemdeki en ağır hata modu). Canlı
> sistem firma tarafından kullanılıyor → risk/kazanç dengesi "şimdilik dokunma" dedi.

## Ölçülen baseline (npm run build:vite, doğrulanmış)

Üç katalog da **her zaman yüklenen `index` chunk'ında** (694 KB raw / **183 KB gz**):

| Locale (kaynak) | raw | gz |
|---|---:|---:|
| de | 246 KB | 61.5 KB |
| fr | 244 KB | 59.5 KB |
| en | 228 KB | 54.2 KB |

Kataloglar 183 KB-gz index chunk'ının baskın kısmı. Yalnız aktif dili yüklemek ilk
yükten **~80–95 KB gz** düşürür (~394 KB-gz initial'in ~%20'si). **Ama** bu tek
seferlik bir maliyet: statik string'ler, hash'li asset olarak `immutable` cache'lenir
(bkz. nginx.conf), ilk ziyaretten sonra tekrar inmez.

## Neden ≤5 dosya DEĞİL — kök mimari

`translator.ts` iki dil ekseninin de arkasındaki **tek** modül ve
[translator.ts:2-4](../src/i18n/translator.ts#L2-L4) üçünü de statik import eder.

- **Dashboard ekseni** (`useT()`): yalnız **aktif** locale'i gerekir → async gate
  edilebilir (I18nProvider render'ı bekletir). Kolay kısım.
- **Doküman ekseni** (`documentI18nFor`/`createTranslator`): **senkron** ve
  **rastgele** (müşterinin) locale'i ile, `await` edilemeyen yerlerde çağrılıyor:
  - 20+ `@react-pdf` render bileşeni (`Header`, `Footer`, `ServiceTable`, …)
  - 6 public token sayfası (OfferView, AppointmentCancel/Reschedule, …)
  - Offer canlı önizleme bileşenleri (OfferteErstellen/Bearbeiten/LivePreview/…)
  - **Modül-üstü sabitler (import anında çalışır):**
    [offerPricing.ts:288](../src/lib/offerPricing.ts#L288),
    [generateRechnungPdf.ts:128-129](../src/lib/generateRechnungPdf.ts#L128-L129),
    [RechnungDetail.tsx:59-60](../src/pages/firma/RechnungDetail.tsx#L59-L60) —
    bunlar `createTranslator("de")`'yi **yüklemede** çalıştırır → Almanca'nın eager
    olmasını yapısal olarak zorunlu kılar.

`createTranslator` bir locale yüklü değilse **sessizce Almanca'ya düşer**
([translator.ts:66-67,72](../src/i18n/translator.ts#L66-L72)). Preload kaçarsa
Fransız müşteri **Almanca PDF** alır. Kataloglar iki eksen tarafından paylaşıldığı
için, **gerçek bundle kazancı = doküman eksenini preload'lu/async erişime çevirmek
zorunda.** Yalnız dashboard'a dokunan "bedava" bir alt küme yok.

## İleride yapılırsa — güvenli migration sırası (öneri)

Tam lazy yerine **kademeli** git. Her adım tek başına deploy edilebilir + geri
alınabilir olmalı.

1. **Tip güvenliğini ayır (davranış değişmez, bundle değişmez).**
   `MessageKey`'i **type-only** kaynağa çek:
   `export type MessageKey = keyof typeof import("@/i18n/catalog/de").de` biçiminde,
   runtime `de` import'unu koparmadan. Önce bunu izole doğrula.

2. **Senkron registry + async loader.** Yeni `catalogRegistry.ts`:
   - `catalogLoaders = { de: () => import(...), fr, en } satisfies Record<Locale, ...>`
     (wildcard/glob YOK — açık üç loader).
   - `ensureCatalog(locale): Promise<Messages>` — locale-başına Promise cache;
     **rejected Promise'i cache'te bırakma** (hata → kaydı sil, tekrar denenebilsin).
   - `getLoadedCatalog(locale): Messages | undefined` — senkron erişim.
   - `createTranslator` bu senkron registry'den okur; locale yüklü değilse eskisi gibi
     Almanca fallback (ilk aşamada Almanca hâlâ eager kalır → davranış korunur).

3. **Dashboard eksenini gate et.** `I18nProvider` aktif locale'i `ensureCatalog` ile
   yükleyene kadar mevcut tam-ekran loader zinciriyle uyumlu şekilde render'ı bekletir.
   Dil sıçraması yok, form state unmount YOK. Race guard: request-id / effect cleanup —
   `de→fr→en` hızlı geçişte geç gelen `fr` aktif `en`'i ezmemeli.

4. **Doküman ekseni preload'ları — asıl iş, en riskli.** Her PDF üretici GİRİŞ
   fonksiyonu (`generateOfferPdf`, `generateAuftragPdf`, `generateChecklistPdf`,
   `generateRechnungPdf`, `generateAgbPdf`, `generateBoxRentalPdf`, Quittung, box) —
   react-pdf ağacını kurmadan **ÖNCE** `await ensureCatalog(docLocale)`. Böylece 20+
   derin bileşen DEĞİŞMEDEN senkron katalogu bulur. Public sayfalar + canlı önizleme:
   render'ı katalog-yüklendi'ye gate et. Modül-üstü sabitleri fonksiyona/lazy-getter'a
   taşı (import anında çalışmasınlar).

5. **Almanca'yı eager'dan çıkar (opsiyonel son adım).** Ancak 1–4 canlıda sağlamsa.
   Runtime Almanca fallback'i kaldırmak **davranış değişikliğidir** (stale-chunk'ta
   eksik anahtar → müşteriye ham anahtar) — ayrı değerlendir, belki hiç yapma.

6. **Testler (i18n.test.ts genişlet):** katalog tamlığı korunur; `ensureCatalog`
   cache/tekilleştirme; başarısız import cache zehirlememe; eski request yeni locale'i
   ezmez; dashboard locale ≠ doküman locale izolasyonu.

7. **Doğrulama:** `npx tsc --noEmit -p tsconfig.app.json` (hollow gate DEĞİL),
   `npm test`, `npm run build:vite`, ve **Network paneliyle 3 dilde manuel**: aktif
   olmayan kataloglar ilk açılışta İNMEMELİ; **Almanca dashboard'dan Fransızca PDF
   doğru dilde** üretilmeli (kritik kabul kriteri).

## Kesin kabul kriteri (regresyon kapısı)

> Alman operatör → Fransız teklif PDF'i **Fransızca** çıkmalı, hangi katalogların
> yüklü olduğundan bağımsız. Bu kırılırsa migration BAŞARISIZ — geri al.

## Kapsam dışı (bilinçli teknik borç)

- `format.ts` date-fns de/fr/en eager import'u — küçük, ayrı ve düşük öncelik.
- Bu iş, `perf/bundle-optimization` (nginx .mjs cache + Rechnungen route defer) ile
  KARIŞTIRILMAMALI — ayrı branch `perf/i18n-lazy-catalogs`.
