# Claude Code Görev Prompt'u — Offerte Fiyat Modeli: Kök Neden Onarımı

> Bu dosya bir **uygulama prompt'udur**. Claude Code'a bunu ver, o da sırayla uygulasın.
> Kaynak: 2026-08-07 tarihli derin analiz (canlı kod okunarak, satır satır doğrulanmış).
> **Bu prompt kod içermez — teşhis + kabul kriteri + çalışma disiplini içerir.** Çözümü sen üreteceksin.

---

## 0. Rol ve zorunlu ön okuma

Sen bu repoda çalışan bir senior geliştiricisin. Aşağıdakileri **kod yazmadan önce** oku:

1. `CLAUDE.md` — özellikle §2 (NEVER / yama yasağı), "Bug fix akışı", "Kök neden zorunluluğu"
2. `docs/SISTEM_PRD.md` — lead→offer→auftrag→quittung akışı, aktif-vs-kalıntı ayrımı
3. `src/i18n/README.md` — **iki dil ekseni** (dashboard dili ≠ doküman dili)
4. `docs/SUPABASE_MCP_BAGLANTI.md` — self-hosted DB bağlantısı, tünel, migration uygulama

**Konuşma dili: Türkçe.** Kod, kod yorumları ve UI metinleri: İngilizce/Almanca (ürün UI'ı DE/FR/EN).

### Bu görevde kesinlikle yasak

- **Yama.** Semptomu bastıran guard/try-catch/fallback/default değer ile "çözüldü" deme.
  Kök nedeni bulamıyorsan **DUR ve sor**.
- `as any`, `// eslint-disable`, sessiz `try/catch`, hard-code fiyat/dil.
- Barrel export (`index.ts` re-export). Doğrudan import.
- `npx supabase db push` — **bu repoda migration defteri YOK, bu komut yıkıcıdır.**
  Migration `ssh → docker exec supabase-db-… psql` ile elle uygulanır.
- `types.ts`'i tam regen etme — sürüm uyumsuzluğu ~1500 satır gürültü üretir. **Cerrahi elle ekleme yap.**
- Subagent kullanacaksan prompt'una **`git checkout/reset/stash/commit` yasağı** yaz. Ölçüm için stash kullanma; yedek istersen `tar`.
- Gerçek müşteri offerte'lerine test verisi yazma. Doğrulama gerekiyorsa `BEGIN … ROLLBACK` transaction'ı içinde yap.
- Sırf cleanup commit'i atma — temizliği ilgili fix ile birlikte ver.

### Her faz sonunda zorunlu kapı

```
npm run type-check          # temiz olmalı (bu gerçek kapı, tsc -b)
npx eslint . | tail -3      # dokunduğun dosyalarda 0 hata + toplam sayı ARTMASIN
npm test                    # tüm testler yeşil
```
Repoda `main` üzerinde zaten 88 eski lint hatası var — onları çözmek bu görevin kapsamı değil, ama **artırma**.

---

## 1. Problemin özeti (teşhis — yeniden türetmene gerek yok)

Offerte fiyatı **üç bağımsız eksende** modellenmiş, ama toplam sadece ikisinden hesaplanıyor:

| # | Eksen | Kaynak | Toplama giriyor mu? |
|---|---|---|---|
| 1 | `offers.price_model` (`pauschal`/`stundenansatz`/`kostendach`) + `offers.hourly_rate` | Offerte seviyesi | **HAYIR — sadece PDF rozeti** |
| 2 | `offer_items.price_type` (`pauschale`/`per_unit`/`per_hour`/`inkl`/`optional`) | Kalem, birim ekseni | Evet (`inkl`/`optional` hariç) |
| 3 | `offer_items.amount_basis` (`fixed`/`rate`/`range`) | Kalem, tutar ekseni | Evet (`rate` hariç) |

Ayrıca **saat ücreti 5 ayrı yerde** yaşıyor ve hiçbiri diğerinin doğruluk kaynağı değil:
`offers.hourly_rate` · `offer_item_effort_meta.hourly_rate` · `offer_items.time_estimate.hourlyRate` ·
`offer_items.unit_price` (per_hour ise) · `offer_item_volume_meta.rate`.

Toplam tek yerde hesaplanıyor — `src/lib/offerPricing.ts:166-179` (`computeItemsSubtotal`) — ve orada
`price_model` **hiç geçmiyor**.

**Sonuç:** Operatör "Preismodell"i bir ayar sanıyor; sistem onu bir etiket olarak görüyor.

---

## 2. FAZ 0 — KARAR KAPISI (kod yazma, önce sor)

Aşağıdaki üç eksen birleştirilmeden diğer düzeltmeler yama olur. **Önce kullanıcıya bu kararı sor**,
seçeneği kısa tut, tavsiyeni belirt, cevabı beklemeden kod yazma.

**Soru: `offers.price_model` ne olacak?**

- **(A) Türetilmiş rozet — TAVSİYE EDİLEN.**
  Preismodell kutusu UI'dan kalkar. Rozet artık kalemlerden türetilir (`offerHasRateItem` +
  item `kostendach_max` zaten var). Tek doğruluk kaynağı `amount_basis`. `offers.price_model`
  kolonu geriye dönük okuma için durur ama **yazılmaz**; okuyan tüm yüzeyler türetilmiş değere geçer.
  → Kullanıcı bir daha "modeli değiştirdim ama fiyat değişmedi" diyemez, çünkü değiştirecek bir model kalmaz.

- **(B) Sihirbaz kutusu.**
  Preismodell kutusu kalır ama artık **kalemleri dönüştürür**: `pauschal→stundenansatz` seçildiğinde
  ücretli kalemlerin `price_type`/`amount_basis`/`unit_price`'ı, onaylı bir diyalog üzerinden
  gerçekten değiştirilir. Daha fazla iş, daha fazla kenar durum, ama mevcut zihinsel modeli korur.

- **(C) Uyarı katmanı.**
  Kutu olduğu gibi kalır, sadece kalemlerle çeliştiğinde uyarı çıkar.
  → Bu bir **yamadır**. Kök neden (iki paralel gerçek) yerinde kalır. Kullanıcı ısrar etmezse önerme.

**Ek karar 2:** `offer_items.list_price` / `discount_percent` / `discount_amount` kolonları
(bkz. F8) → **tamamla** mı, **DROP** mu?

**Ek karar 3:** `agb_ip_address` (bkz. F11) → sunucu tarafı IP yakalama eklensin mi, yoksa
kabul kanıtı IP'siz mi kalsın?

> Kararlar alınana kadar FAZ 1'e geçme. Alınınca kararı `docs/` altında kısa bir ADR notu olarak
> yaz (dosya adı: `docs/ADR_offerte_preismodell.md`) — sonraki oturumlar için.

---

## 3. BÖLÜM A — Semantik onarım (zorunlu, sırayla)

Her F# ayrı commit. Her commit'ten sonra **DUR**, kullanıcıya canlı test ettir, onay al, sonra devam et.
Lokal dev `.env.local` prod Supabase'e bağlı — test offerte'lerini sonradan DB'den temizle.

---

### F1 — Kalem seviyesi mod geçişi (kök neden #1)

**Teşhis (doğrulanmış):**

`src/components/offerte/OfferteItemRow.tsx:213-220` — Preistyp dropdown'ı **sadece `unit`'i** senkronize ediyor:

```
onUpdate(index, "priceType", value);
if (option) onUpdate(index, "unit", option.defaultUnit);
// amountBasis, quantity, kostendachMax → hiç dokunulmuyor
```

Bunun üç somut sonucu var:

1. **`Pauschale → Pro Stunde`**: `amountBasis` `"fixed"` kalıyor. Oysa katalogdan eklenen bir
   `per_hour` kalemi `defaultAmountBasisForPriceType` (`offerPricing.ts:81-82`) ile `"rate"`
   damgalanıyor ve toplamdan **çıkarılıyor**. Ekranda birebir aynı görünen iki kalem toplamda
   farklı davranıyor.
2. **`Pro Einheit (Menge 3) → Pauschale`**: Menge alanı gizleniyor (`OfferteItemRow.tsx:334`)
   ama değer `3` olarak duruyor; kayıt yolu da koruyor (`OfferteErstellen.tsx:1387`).
   Girilen pauschal fiyat 400 ise toplam **1200** oluyor, görünür sebebi olmadan.
3. **`rate → fixed`**: `kostendachMax` state'te kalıyor. Erstellen kayıtta temizliyor
   (`:1404`), **Bearbeiten temizlemiyor** (`:842`) → bkz. F3.

**Ayrıca `OfferteBearbeiten.tsx`'te Preistyp seçici hiç yok.** Sadece `unit` dropdown'ı var ve
`price_type` şöyle yazılıyor (`:829`):
```
price_type: item.price_type || inferPriceType(item.unit, item.unit_price)
```
Sol taraf DB'den yüklenen kayıtta **her zaman dolu** → `inferPriceType` asla çalışmıyor.
Operatör birimi `Pauschal → Stunden` yapsa bile kalem downstream'de `pauschale` kalıyor:
müşteri "Stunden" görüyor, sistem "pauschale" hesaplıyor.

**Beklenen çözüm:**

- `src/lib/offerPricing.ts`'e **saf, tek kaynak** bir geçiş fonksiyonu ekle: bir `price_type`
  verildiğinde o tipin kanonik `unit` / `amountBasis` / `quantity` / `kostendachMax` sonucunu döndürsün.
  İsimlendirmeyi sen seç, ama **tek yer** olsun — CLAUDE.md §8 ve dosyanın kendi "SINGLE SOURCE"
  yorumları bunu şart koşuyor.
- `OfferteItemRow` dropdown'ı bu fonksiyonu çağırsın (bugünkü `unit` senkronu dahil).
- `OfferteBearbeiten`'e **aynı Preistyp seçicisini** ekle, aynı fonksiyonu çağırsın.
  `inferPriceType` yalnızca gerçekten `price_type`'ı NULL olan legacy satırların **yüklenmesinde**
  anlamlı; kayıt yolunda ölü. Ölü kullanımı kaldır.
- Kayıt yolundaki `quantity` normalizasyonunu da aynı tek kaynağa taşı (F2 ile birlikte).

**Kabul kriteri:**
- `Pauschale ⇄ Pro Stunde ⇄ Pro Einheit ⇄ Optional ⇄ Inklusive` her geçişte, kalemin
  birimi/tutar-modu/miktarı tutarlı; ekrandaki "Total" ile kaydedilen değer aynı.
- Katalogdan eklenen `per_hour` kalem ile elle `Pro Stunde`'ye çevrilen kalem **aynı davranıyor**.
- Erstellen ve Bearbeiten aynı geçiş fonksiyonunu kullanıyor (iki kopya yok).
- Yeni saf fonksiyon için `src/lib/__tests__/offerPricing.test.ts`'e test eklendi (CLAUDE.md §9).

---

### F2 — İki kayıt yolunun `quantity` sapması (kök neden #2)

**Teşhis (doğrulanmış):**

- `OfferteErstellen.tsx:1387`:
  `quantity: item.priceType === "inkl" || teValid || item.amountBasis === "rate" ? 1 : item.quantity`
- `OfferteBearbeiten.tsx:826`:
  `quantity: item.unit === "inkl." ? 1 : item.quantity`

`offer_items.total` **GENERATED `quantity * unit_price`**. Ve bu tutar müşteriye basılıyor
(`src/components/pdf/utils/mapOfferData.ts:276`), OfferView/OfferteDetail'de gösteriliyor,
kabul anında Auftrag'a `jsonb` olarak donduruluyor.

Sonuç: **aynı offerte, hangi ekranda kaydedildiğine göre farklı satır tutarı üretiyor.**
Bu, `offerPricing.ts:46-52`'de "Lesson #8" olarak yazılmış sapmanın aynısı — hâlâ açık.

**Beklenen çözüm:**

- Kayıt yolundaki kalem normalizasyonunu **tek saf fonksiyona** çıkar (F1'deki geçiş fonksiyonuyla
  aynı dosyada, aynı disiplinle). Erstellen ve Bearbeiten aynı fonksiyonu çağırsın.
- `unit === "inkl."` gibi **string tabanlı** ayrımı bırak; `price_type` semantiğini kullan
  (`isFreeItem` zaten var — dosyanın kendi yorumu bunu şart koşuyor).
- **Veri onarımı gerekli mi?** Canlı DB'de `amount_basis='rate' AND quantity <> 1` veya
  `time_estimate IS NOT NULL AND quantity <> 1` satırları var mı, önce **read-only** sorgula ve
  sayıyı raporla. Varsa ayrı bir onarım migration'ı öner — **STOP-gate**, kullanıcı onayı olmadan
  prod'a yazma.

**Kabul kriteri:**
- Aynı offerte önce Erstellen'de, sonra Bearbeiten'de kaydedildiğinde `offer_items.total`
  değişmiyor (bunu bir test veya elle DB karşılaştırmasıyla göster).
- Testler yeşil.

---

### F3 — Bayat `kostendach_max` müşteriye sızıyor

**Teşhis (doğrulanmış):**

- `OfferteBearbeiten.tsx:842` → `kostendach_max: item.kostendach_max ?? null`
  (`amount_basis` kontrolü **yok**; Erstellen `:1404`'te var).
- `src/components/pdf/components/ServiceTable.tsx:690` → `billable.map(it => it.kostendachMax).find(isSet)`
  — gate **sadece "dolu mu"**, `amountBasis` bakılmıyor. `:718`'de kutu basılıyor.

Sonuç: bir kalem `rate → fixed` yapıldığında sabit fiyatlı bir offerte'nin müşteri PDF'inde
"Kostendach CHF X" kutusu çıkıyor.

**Beklenen çözüm:**

- Kök neden **yazma tarafında**: `kostendach_max` yalnızca `amount_basis='rate'` iken persist edilmeli;
  iki kayıt yolu da aynı kuralı uygulamalı (F2'deki tek normalizasyon fonksiyonu).
- **Ek savunma katmanı (kök nedenin yerine geçmez, üstüne):** DB'ye
  `CHECK (kostendach_max IS NULL OR amount_basis = 'rate')` kısıtı. Bu, gelecekte hangi yol yazarsa
  yazsın veriyi tutarlı tutar. Migration eklemeden önce mevcut ihlal sayısını **read-only** ölç ve raporla.
- Render tarafında `groupCap` türetimi de `amountBasis === 'rate'` filtresi kullansın (savunma).

**Kabul kriteri:** `rate → fixed` çevrilmiş bir kalemin PDF'inde Kostendach kutusu yok; DB'de
`kostendach_max` NULL.

---

### F4 — `kostendach` gerçek bir kısıt değil, etiket

**Teşhis:** `supabase/migrations/20260411100000_offers_price_model.sql` yalnızca
"kostendach seçilirse hourly_rate + kostendach_max dolu olmalı" diyor. **Tavanın aşılmadığını
kimse kontrol etmiyor** — ne DB, ne UI. Kostendach 5'000, toplam 7'000 olan bir offerte sorunsuz gönderilir.

**Beklenen çözüm:**
- Kayıt öncesi validasyon: hesaplanabilir üst sınır (fixed + range'lerin max'ı + zamlar, **net**)
  tavanı aşıyorsa operatörü blokla veya açık onay iste. Metin i18n'den gelsin.
- Item-level Kostendach için aynı mantık kendi kalemi/servis bloğu ölçeğinde.
- Aşım Auftrag yürütmesinde de olabilir (`SahaExtrasModal` ekstra ekliyor) — bunu **kapsam dışı**
  bırakabilirsin ama raporunda açıkça belirt.

**Kabul kriteri:** tavanı aşan bir offerte sessizce kaydedilemiyor.

---

### F5 — `offers.subtotal` adı ile içeriği farklı

**Teşhis (doğrulanmış):**

`offers.subtotal` içinde **iskonto uygulanmış + zamlar dahil vergi matrahı** var
(`OfferteErstellen.tsx:1268-1269`; kural `offerPricing.ts:181-205`'te "P3b" olarak yazılı).
Ama `src/components/firma/AuftragModal.tsx:433` bunu doğrudan `auftraege.subtotal`'e kopyalıyor ve
Auftrag PDF'i (`src/lib/generateAuftragPdf.ts:906`) "Zwischensumme" diye basıyor.
Offerte PDF'indeki "Zwischensumme" ise **ham kalem toplamı**. Aynı etiket, iki farklı rakam.

Aynı kopyalama accept yolunda da var: `20260705100000_auftrag_financial_snapshot.sql` →
`COALESCE(o.subtotal, 0)`.

**Beklenen çözüm:**
- Kök neden: kolonun adı anlamını taşımıyor ve tüketiciler adı okuyup yanlış anlıyor.
  Yeniden adlandırma yıkıcı — **tavsiye:** tüketicileri düzelt + `COMMENT ON COLUMN` ile anlamı
  DB'ye yaz + `offerPricing.ts`'teki kuralı tek referans yap.
- Auftrag hem manuel hem accept yolunda **doğru** Zwischensumme'yi (ham kalem toplamı) ve
  matrahı ayrı ayrı taşımalı. Yeni kolon gerekiyorsa additive migration + STOP-gate.

**Kabul kriteri:** Offerte PDF'i ile Auftrag PDF'indeki "Zwischensumme" aynı offerte için aynı rakam.

---

### F6 — Yuvarlama sapması (Rappen)

**Teşhis (doğrulanmış):**

`supabase/migrations/20251220152159_….sql:23-24`
```sql
vat_amount NUMERIC GENERATED ALWAYS AS (subtotal * vat_rate / 100) STORED,
total      NUMERIC GENERATED ALWAYS AS (subtotal + (subtotal * vat_rate / 100)) STORED,
```
**Yuvarlama yok.** Uygulama ise `round2` kullanıyor (`offerPricing.ts:258-265`).
Offerten listesi `offers.total`'ı okuyor (`Offerten.tsx:102` select) → PDF ile Rappen farkı çıkabiliyor,
ve bu fark Auftrag/Rechnung/Quittung'a miras kalıyor. Ayrıca `subtotal NUMERIC` — ölçek sınırı yok.

**Beklenen çözüm:**
- GENERATED ifadeleri `ROUND(…, 2)` yapan migration. **GENERATED kolon değiştirmek DROP+ADD demektir**
  → mutlaka `ROLLBACK_*.sql` eşlikçisi yaz, önce lokal/test DB'de dene, prod'a uygulamadan **STOP**.
- Yazma tarafında `offers.subtotal` da 2 haneye yuvarlanarak yazılsın.
- **İsviçre 5-Rappen yuvarlaması (Rappenrundung)** ayrı bir konu — nakit ödemede gerekli.
  Bu fazın kapsamında **değil**; raporunda "açık kaldı" diye belirt, uydurma.

**Kabul kriteri:** Aynı offerte için PDF toplamı = `offers.total` = liste "Betrag" sütunu, kuruşu kuruşuna.

---

### F7 — `rate` offerte'lerin toplamı aşağı akışta sessizce eksik

**Teşhis (doğrulanmış):**

UI ve PDF, `rate` kalem varken toplam kutusunu **doğru şekilde gizliyor** (`offerHasRateItem`,
`RATE_AGGREGATE_NOTE`). Ama `offers.subtotal/total` yine de yazılıyor ve şuralara akıyor:

- Offerten KPI'ları: `Offerten.tsx:337-338` → `totalValue` / `acceptedValue` bu rakamları topluyor.
- Auftrag snapshot: `20260705100000_….sql` → `COALESCE(o.total, 0)`.
- Oradan Rechnung/Quittung ön-doldurması.

Yani asıl ciro kalemi olan **işçilik**, aşağı akışta sessizce sıfır sayılıyor.

**Beklenen çözüm:**
- KPI'lar: `rate` içeren offerte'ler toplam değere karışmasın; ya ayrı gösterilsin ya da
  "x offerte nach Aufwand" şeklinde nitelensin. Listedeki `rateOfferIds` seti (`Offerten.tsx:168`)
  zaten var — aynı tek kaynağı kullan.
- Auftrag: `pricing_type='hourly'` olan iş için `total = 0` yazmak yanlış bilgi.
  Doğru davranışa karar ver (NULL + etiket, ya da item-level cap'lerden türetilmiş üst sınır) ve
  gerekçesini yaz. RPC değişikliği → additive, `CREATE OR REPLACE`, STOP-gate.

**Kabul kriteri:** Aufwand-bazlı bir offerte kabul edildiğinde ne Auftraege listesinde ne KPI'da
"CHF 0" veya yanıltıcı kısmi rakam görünüyor.

---

### F8 — Yarım kalmış kolonlar

**Teşhis (doğrulanmış):**

`supabase/migrations/20260701160000_offer_items_rabatt.sql` üç kolon ekliyor:
`list_price`, `discount_percent`, `discount_amount` — "sadece sunum" olarak.

- `list_price` PDF'te **okunuyor** (`mapOfferData.ts:286`) ama `replace_offer_items`
  (`20260708150000_….sql:46-63`) INSERT listesinde **yok** → sonsuza kadar `NULL`.
- `discount_percent` / `discount_amount` → hiç yazılmıyor, hiç okunmuyor.
- RPC delete+insert olduğu için elle doldurulsalar bile **ilk düzenlemede silinirler**
  (aynı tuzağı `amount_basis` için not düşmüşsünüz: `OfferteBearbeiten.tsx:417-419`).

**Beklenen çözüm (FAZ 0 → Ek karar 2'ye göre):**
- **Tamamla** seçildiyse: UI (Erstellen + Bearbeiten) + `replace_offer_items` INSERT listesi +
  PDF/OfferView/Detail render + testler. Bu, Bölüm B'deki "kalem bazlı indirim" eksiğini de kapatır.
- **DROP** seçildiyse: kolonları düşür + `mapOfferData`'daki ölü okumayı kaldır +
  `ROLLBACK_*.sql`. **Karar alınmadan hiçbirini yapma.**

---

### F9 — `moebellift` meta haritasında yok

**Teşhis (doğrulanmış):**

Taksonomi commit'i `b5be8c97` ile `moebellift` ayrı bir `CatalogBase` oldu
(`offerServiceType.ts:20-27`, `SERVICE_ORDER:122-130`). Ama:

- `src/lib/offerItemMeta.ts:26-32` → `metaKindForService` yalnızca `umzug`/`transport`'a `"effort"`
  veriyor. Möbellift saatlik faturalanmasına rağmen **Stundensatz/Crew kartı hiç çıkmıyor**.
- `offerServiceType.ts:216-226` → `serviceTerminLabel`'da `moebellift` case'i yok, generic "Termin".
- Aynı fonksiyon **hard-coded Almanca**. Müşteri yüzeyinde kullanılıyorsa bu i18n ihlali
  (bkz. `src/i18n/README.md`: müşteriye giden renderer dashboard dilinden okuyamaz).

**Beklenen çözüm:**
- `moebellift` için doğru meta türünü ekle.
- `serviceTerminLabel`'ın **nerede** kullanıldığını önce tespit et. Müşteri yüzeyindeyse
  doküman diline (`documentT`) taşınmalı; sadece dashboard'daysa `useT()`. Yeni anahtar eklersen
  **de/fr/en üçünü birden** ekle (Almanca anahtar kümesi tek doğruluk kaynağı, eksik anahtar
  derleme hatasıdır).

---

### F10 — Ölü `PricingSummary` bileşeni

**Teşhis (doğrulanmış):** `src/components/offerte/PricingSummary.tsx` hiçbir yerden import edilmiyor
(kullanılan olan `src/components/offers/moving-calculator/PricingSummary.tsx`). İçinde hard-coded
Almanca metin ("Zusammenfassung", "Zwischensumme", "MwSt.") ve **iskonto/rate/range bilmeyen kendi
KDV matematiği** var. Bir sonraki geliştirici için mayın.

**Beklenen çözüm:** sil. CLAUDE.md §14 gereği **ayrı cleanup commit'i atma** — F1 veya F2 commit'ine iliştir.

---

### F11 — Kabul kanıtında IP boşluğu

**Teşhis (doğrulanmış):** Güncel `update_offer_by_token`
(`20260705100000_auftrag_financial_snapshot.sql`) `agb_ip_address`'i UPDATE listesinden çıkarmış ve
yorumda "intentionally NOT updated from caller-supplied value" demiş. Gerekçe doğru (client
gönderdiği IP'yi uydurabilir), ama **yerine sunucu tarafı bir yakalama konmamış** → yeni kabullerde
kolon `NULL`. Eski migration'larda dolduruluyordu; sessiz bir gerileme.

**Beklenen çözüm (FAZ 0 → Ek karar 3'e göre):**
- Sunucu tarafı yakalama: kabul akışını bir Edge Function üzerinden geçirip `x-forwarded-for`'u
  orada okumak, ya da mevcut RPC'ye güvenilir bir kaynak eklemek.
- Ya da: IP'den vazgeçilip kanıtın (token + timestamp + email log + AGB versiyonu) yeterli
  sayıldığının açıkça yazılması. **Sessizce NULL bırakma bir seçenek değil** — ya doldur ya karar belgele.

---

## 4. BÖLÜM B — Piyasa eksikleri (AYRI ONAY, Bölüm A bitmeden başlama)

Bunlar bug değil, **eksik özellik**. Bexio / Abacus / Odoo / Zoho / PandaDoc / SmartMoving
karşılaştırmasından. Bölüm A tamamlanıp canlıda doğrulanmadan bunlara **girme**;
her biri kendi `superpowers:brainstorming` → plan → onay döngüsünü hak ediyor.

**Yüksek değer / düşük efor:**

- **B1 — Müşterinin seçebildiği opsiyonel kalemler.** `is_optional` var ama müşteri sadece
  "Auf Anfrage" çipi görüyor (`OfferView.tsx:1106-1111`), işaretleyemiyor, toplam yeniden
  hesaplanmıyor. Nakliyede en kârlı upsell kanalı (Verpackung, Einlagerung, Reinigung).
- **B2 — Kalem bazlı indirim.** Kolonlar hazır (F8), UI yok. Her rakipte standart.
- **B3 — Anzahlung / Akonto.** Hiç yok. `payment_due_days`/`payment_method` var ama depozito veya
  milestone tahsilat planı yok. Nakliyede kabulde %20-30 peşin sektör normu.
- **B4 — Müşteriye otomatik nachfass.** `20260728260000_pipeline_automatik.sql` sadece **iç görev**
  üretiyor (`offer_no_response` 5 gün, `offer_expiring` 3 gün). Müşteriye giden otomatik hatırlatma yok.

**Orta:**

- **B5 — Varyant offerte (Gut / Besser / Best).** Versiyonlama var
  (`version_number`/`supersedes_offer_id`) ama o *revizyon*; müşterinin aynı anda üç paketten
  seçtiği yapı yok. Proposal araçlarında kapanış oranını en çok artıran özellik.
- **B6 — Kalem bazlı KDV oranı.** Offerte başına tek `vat_rate`. CH'de 8.1 / 2.6 / 3.8 karışık
  offerte şu an imkânsız.
- **B7 — Offerte şablonu.** Leistungskatalog var ama "bu offerte'yi şablon olarak kaydet" yok.
- **B8 — Belge etkileşim analitiği.** `viewed_at` tek timestamp; kaç kez / ne kadar süre açıldığı yok.
- **B9 — Yapılandırılmış kayıp nedeni.** Sadece serbest metin `customer_response_note`.
  `Kennzahlen.tsx`'te huni var ama "neden kaybettik" kırılımı yok.
- **B10 — İskonto onay akışı.** `discount_percent` için rol kapısı yok; herkes %50 verebilir.

**Düşük:** çoklu para birimi, çizilebilir e-imza (mevcut checkbox+timestamp CH'de basit elektronik
imza olarak savunulabilir — önce F11'i kapat), kısmi kabul.

---

## 5. Çalışma disiplini

### Faz akışı
Her F# için sırayla:
1. **Kök nedeni 1-3 cümlede yaz** (CLAUDE.md "Bug fix akışı"). Yukarıdaki teşhisi kopyalama —
   kodu kendin doğrula, yanlışsa düzelt ve bana söyle.
2. **Yan etkiyi söyle:** hangi başka dosya/fonksiyon etkileniyor, ne tür değişiklik
   (signature / davranış / tip). Sessizce başka dosyaya dokunma.
3. 5+ dosyaya yayılıyorsa **uygulamadan önce onay al**.
4. Uygula → `type-check` + `lint` + `test` → **ayrı commit** → **DUR** → canlı test → onay → sonraki F#.

### Test
- Saf fonksiyon eklediysen test de ekle (`src/lib/__tests__/`). React bileşeni ve Supabase
  çağrısı test edilmez — tarayıcıda elle doğrula.
- PDF değişikliği varsa headless render ile doğrula, ekran görüntüsü/çıktı göster.

### DB
- Migration dosya adı: `YYYYMMDDHHmmss_<açıklama>.sql`. **Mevcut migration düzenlenmez**, yeni dosya eklenir.
- Yıkıcı olan her migration (GENERATED kolon değişimi, DROP COLUMN) için `ROLLBACK_*.sql` eşlikçisi zorunlu.
- Uygulama: SSH → `docker exec supabase-db-… psql`. Tünel gerekiyorsa **önce IP'yi doğrula**
  (Coolify restart'ında değişir, stale IP sessiz hata verir).
- Şema değiştiyse `types.ts`'e **cerrahi** elle ekleme (ilgili `Row`/`Insert`/`Update` satırları).
  Full regen yapma.
- Migration + types + ilgili Edge Function/RLS **aynı commit'te**.
- Prod'a yazan her adım **STOP-gate**: önce read-only ölç, sayıyı raporla, onay al, sonra yaz.

### Edge Function
- `send-offer/index.ts` `offerPricing.ts` mantığının **Deno kopyasını** taşıyor
  (`:567-579` — `resolveAmountBasis` / `offerHasRateItem` aynadır). Frontend'de mantık değiştirdiysen
  **bu aynayı da güncelle**, yoksa e-posta ile PDF ayrışır.
- Deploy: `scp index.ts` → `/data/coolify/.../volumes/functions/<fn>/` + edge container restart.
  `.env` değiştiyse restart yetmez, Coolify Redeploy gerek.
- Deploy'u PR/rapor notunda açıkça belirt. Repodaki kod ≠ prod'daki kod olabilir; varsayma, doğrula.

### i18n (bozmaması kritik)
- Yeni metin → **de + fr + en** üçü birden. Almanca anahtar kümesi tek doğruluk kaynağı;
  eksik anahtar derleme hatasıdır, sessiz Almanca fallback değil.
- **Dashboard yüzeyi** → `useT()`. **Müşteri yüzeyi** (PDF, e-posta, public offerte sayfası) →
  doküman dilini **argüman olarak** alır, asla React context'ten okumaz.
- İsviçre QR-fatura etiketleri (`doc.qr.*`) SIX tarafından normlanmış — serbest çeviri yasak.

---

## 6. Bitirme raporu (zorunlu format)

İş bitince şunu üret:

1. **Her F# için:** kök neden (1-3 cümle) · ne değişti · hangi dosyalar · nasıl doğrulandı (komut + çıktı).
2. **Kapanmayanlar:** yapmadıkların ve **neden** — kapsam dışı mı, karar bekliyor mu, bloke mi.
   Sessizce atlama.
3. **Deploy durumu:** hangi commit prod'da, hangi Edge Function deploy edildi, hangisi stale kaldı.
4. **Veri onarımı:** prod'da kaç satır değişti, rollback yolu ne.
5. **Kanıt:** `npm run type-check` / `npx eslint . | tail -3` / `npm test` çıktıları — özet değil, gerçek çıktı.

> Testler kırmızıysa **kırmızı olduğunu söyle ve çıktıyı ver**. Bir adım atlandıysa atlandığını söyle.
> "Tamamlandı" sadece gerçekten tamamlanıp doğrulandıysa yazılır.
