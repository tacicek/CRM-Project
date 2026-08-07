# Offerte-Preismodell: teşhis, karar ve uygulama — devir belgesi

> **Bu belge ne işe yarar.** Başka bir CRM'de aynı işi yaptırmak için. Doğrudan Claude Code'a
> (ya da başka bir geliştiriciye) verilebilir. Kod parçası değil, **karar zinciri** taşır:
> hangi ölçüm neyi kanıtladı, hangi tasarım neden seçildi, hangi yollar denenip terk edildi.
>
> **Önce oku, sonra ölç, sonra yaz.** Buradaki kararlar bu repodaki ölçümlere dayanıyor.
> Başka bir CRM'de sayılar farklı çıkarsa **karar da farklı olabilir** — §2'deki sorguları
> kendi verinde çalıştırmadan §4'ü uygulama.

---

## 1. Problem kalıbı

Offerte fiyatı **üç bağımsız eksende** modellenmişti, ama toplam sadece ikisinden hesaplanıyordu:

| # | Eksen | Nerede | Toplama giriyor mu? |
|---|---|---|---|
| 1 | `offers.price_model` (`pauschal`/`stundenansatz`/`kostendach`) + `offers.hourly_rate` + `offers.kostendach_max` | Offerte satırı | **Hayır — sadece PDF'te bir kutu** |
| 2 | `offer_items.price_type` (`pauschale`/`per_unit`/`per_hour`/`inkl`/`optional`) | Kalem, **birim** ekseni | Evet (`inkl`/`optional` hariç) |
| 3 | `offer_items.amount_basis` (`fixed`/`rate`/`range`) | Kalem, **tutar** ekseni | Evet (`rate` hariç) |

Toplam tek bir yerde hesaplanıyor (`computeItemsSubtotal`) ve orada `price_model` **hiç geçmiyor**.

**Sonuç:** operatör "Preismodell"i bir ayar sanıyor, sistem onu bir etiket olarak görüyor.
Belgede "Kostendach" yazarken toplam pauschal hesaplanıyor.

### Aynı kalıbın diğer belirtileri (kendi CRM'inde bunları ara)

- Kalem düzeyinde **çelişkili durumlar**: `price_type='per_hour'` ama `amount_basis='fixed'` →
  ekranda "Pro Stunde" yazan iki kalemden biri toplama giriyor, diğeri girmiyor.
- **Bayat tavan**: `kostendach_max` dolu ama kalem artık `rate` değil → sabit fiyatlı bir
  offerte'nin PDF'inde "Kostendach" kutusu çıkıyor.
- **İki kayıt yolu** (oluşturma / düzenleme ekranları) aynı kalemi farklı normalize ediyor →
  aynı offerte hangi ekranda kaydedildiğine göre farklı satır tutarı üretiyor.

---

## 2. Teşhis: önce ölç, tahmin etme

Bu üç sorgu kararın tamamını belirledi. **Salt okunur.** Kendi CRM'inde çalıştır ve sayıları not al.

### 2.1 Kutu gerçekten kullanılıyor mu?

```sql
SELECT price_model, count(*) FROM offers GROUP BY 1 ORDER BY 2 DESC;
```

Bizde: `pauschal 63 · stundenansatz 2 · kostendach 1`.
→ %95 varsayılan değerde. Kutu neredeyse hiç kullanılmamış.

### 2.2 Kalemler ne diyor?

```sql
SELECT price_type, amount_basis, count(*) AS pos,
       count(*) FILTER (WHERE kostendach_max IS NOT NULL) AS mit_cap
FROM offer_items GROUP BY 1,2 ORDER BY 3 DESC;
```

Bizde: `per_hour+rate` 8 (7'si cap'li, **çalışan kalıp**), `per_hour+fixed` 4 + `per_hour+range` 1
(**çelişkili**), gerisi `pauschale+fixed` / `inkl`.

### 2.3 Kutu ile kalemler örtüşüyor mu? — **belirleyici sorgu**

```sql
WITH k AS (
  SELECT o.id, o.price_model,
         count(*) FILTER (WHERE i.price_type NOT IN ('inkl','optional'))            AS bezahlt,
         count(*) FILTER (WHERE i.amount_basis='rate')                              AS rate_pos,
         count(*) FILTER (WHERE i.price_type='per_hour' AND i.amount_basis<>'rate') AS celiskili,
         count(*) FILTER (WHERE i.kostendach_max IS NOT NULL)                       AS pos_cap,
         count(DISTINCT i.service_type)
           FILTER (WHERE i.price_type NOT IN ('inkl','optional'))                   AS gruppen
  FROM offers o LEFT JOIN offer_items i ON i.offer_id=o.id GROUP BY 1,2)
SELECT count(*) FILTER (WHERE price_model='pauschal'  AND rate_pos>0) AS kutu_pauschal_ama_saatlik,
       count(*) FILTER (WHERE price_model<>'pauschal' AND rate_pos=0) AS kutu_saatli_ama_kalem_yok,
       count(*) FILTER (WHERE celiskili>0)                            AS celiskili_offerte,
       count(*) FILTER (WHERE pos_cap>0)                              AS pozisyon_capli,
       count(*) FILTER (WHERE gruppen>1)                              AS COK_SERVISLI,
       count(*) FILTER (WHERE bezahlt>1)                              AS cok_kalemli
FROM k;
```

Bizde: `8 · 3 · 5 · 7 · **19** · 20` (toplam 66 offerte).

**İki sonuç tasarımı belirledi:**

1. `kutu_saatli_ama_kalem_yok = 3` ve kutunun `pauschal` dışında kullanıldığı toplam offerte
   sayısı da **3**. Yani operatör kutuyu **her kullandığında** seçim kalemlere hiç ulaşmamış.
   Kutu %0 isabetli.
2. `COK_SERVISLI = 19` (66'da 19). "Umzug saatlik + Reinigung götürü" **istisna değil, kural**.
   → **Offerte başına tek bir Preismodell tanım gereği yanlış.** Model servis grubuna aittir.

> Kendi CRM'inde `COK_SERVISLI` küçükse (örn. 0–2), offerte başına tek model savunulabilir ve
> tasarım basitleşir. Bu sayıyı görmeden §4'ü uygulama.

---

## 3. Kararlar ve gerekçeleri

### K1 — Model **servis grubuna** ait, offerte'ye değil
19 çok servisli offerte yüzünden. Ayrıca sistem bunu zaten yarı yarıya biliyordu: PDF
Kostendach'ı grup başına basıyor, saat ücretini grup meta'sından okuyor, formda grup başına
alan bloğu zaten var. Eksik olan tek şey kutunun oraya inmesiydi.

### K2 — Kutu **kalemleri yazar**; rozet **kalemlerden okunur**
Kutunun tek işi kalemleri kurmak. Belge/liste/e-posta etiketi ise hep kalemlerden türetilir.
Böylece kutu ile belge **çelişemez**. `offers.price_model/hourly_rate/kostendach_max` artık
**yazılmaz**; kolonlar geçmiş için durur.

> **Kanıt:** doğru çıkan gerçek bir offerte'de (`10056`) `offers.price_model='pauschal'`,
> `hourly_rate` ve `kostendach_max` NULL — ama PDF'i doğru: "CHF 260.– / Stunden",
> "Kostendach max. CHF 1'560 (6 Std.)". Doğru çıktı **zaten** sadece kalemlerden geliyordu.

### K3 — Kaldırmak değil, düzeltmek
İlk denemede kutuyu tamamen kaldırıp her şeyi türetime bağladım. **Yanlıştı ve geri alındı.**
Kolonun ölü olması, kutunun gereksiz olduğu anlamına gelmez: kutu operatörün ana kontrolü.
Doğru hamle onu **etkili kılmak**.

### K4 — Gönderilmiş offerte'nin satırları yeniden yazılmaz
`draft` → kutu kalemleri yazar. `sent`/`viewed` → kutu **kilitli**, "yeni versiyon açın"
der (belge müşterinin elinde). `accepted`/`rejected` → zaten kilitli.

> Bu repoda `sent`/`viewed` offerte'ler **düzenlenebilir** durumdaydı. Kendi CRM'inde
> hangi statülerin yazmaya açık olduğunu **kontrol et** — kilidi oraya kur.

### K5 — Popup yok, geri alma var
Kontrol kendi servis kartında, kalemlerin hemen üstünde. Ne değiştiğini altında görüyorsun;
aynı listeyi bir pencerede tekrar göstermek boş tıklama. Karşılığında yanlış tıklama kendi
kendine dönmez (Pauschal 2'080 → Ansatz 290 → geri Pauschal = 290, 2'080 değil), bu yüzden
**tam eski değerleri** tutan bir "Rückgängig" şeridi var.

**Şeridin ömrü değil, geçerlilik koşulu olmalı.** İlk hâli basılana kadar duruyordu. Operatör
uygulamadan sonra bir kalemi elle düzeltince kart kendi kendisiyle çelişiyordu: şerit
„2 Positionen auf ‚Nach Ansatz' gesetzt" derken üstteki buton „Pauschalpreis" yanıyordu — çünkü
rozet kalemlerden okunur (K2), şerit ise okumuyordu. Kozmetik değil: geri alma grubun **tüm**
kalemlerini uygulama anındaki değerlere yazar, yani aradaki her el emeği tek tıkla sessizce
gider. Çözüm: uygulama, eskisinin yanında **ürettiği** durumu da saklar; grup hâlâ o durumdaysa
şerit durur, değilse kendiliğinden kaybolur (`umstellungUnveraendert`, saf + testli). Kendi
CRM'inde bir "geri al" sunuyorsan aynı soruyu sor: *bu tıklama şu an neyi kaybettirir?*

### K6 — Hiçbir mevcut offerte'ye dokunulmaz
Çelişkili durumdaki 13 offerte olduğu gibi bırakıldı. **Düzeltme migration'ı, backfill, script
yok.** Gerekirse yalnızca *okunur liste* çıkarılır; düzeltme kararı firmaya aittir.

---

## 4. Uygulama

### 4.1 İki saf fonksiyon (çekirdek — önce bunlar, testleriyle)

**`priceTypeShape(priceType, current) → { unit, amountBasis, quantity, kostendachMax }`**

Bir kalemin preistyp'ı değişince nasıl göründüğünü **tek yerde** yanıtlar.

| Preistyp | unit | amountBasis | quantity | kostendachMax |
|---|---|---|---|---|
| `pauschale` | `Pauschal` (sabit) | `fixed` | **1** | `null` |
| `per_unit` | mevcut korunur, yoksa `Stk.` | `fixed` | mevcut (>0), yoksa 1 | `null` |
| `per_hour` | `Stunden` (sabit) | `rate` — geçerli Zeitschätzung varsa `range` | **1** | `rate` ise korunur, değilse `null` |
| `inkl` | `` (boş) | `fixed` | **1** | `null` |
| `optional` | mevcut korunur, yoksa `Stk.` | `fixed` | mevcut | `null` |

Kritik kurallar:
- **`pauschale` → quantity 1.** Aksi halde eski Menge 3 kalır, girilen 400 CHF toplamda 1200 olur.
- **`rate` değilse `kostendachMax = null`.** Tavan yalnız **açık** tutarın üst sınırıdır.
- **Preistyp'ın dayattığı birim taşınmaz.** `Pauschal`/`Stunden` birimi `per_unit`'e geçerken
  `Stk.`'ye döner; aksi halde "3 Pauschal" gibi saçmalık çıkar.
- `priceTypeFixesUnit(priceType)` aynı tablodan türer — form kendi `fixedUnit` listesini
  tutmasın, **ikinci gerçek** olur.

**`derivePriceModel(items) → { model, hourlyRate, kostendachMax }`**

Bir **kalem kümesinin** modelini söyler. Küme = servis grubu (form, PDF grup kutusu) veya
tüm offerte (liste etiketi). Aynı fonksiyon.

```
ücretli kalemler = inkl/optional olmayanlar
rate kalemler   = ücretli ∧ amount_basis='rate'

rate yok                       → pauschal,       hourlyRate null, cap null
rate var + pozisyon cap'i var  → kostendach,     cap = cap'lerin toplamı
rate var, cap yok              → stundenansatz,  cap null

hourlyRate = rate kalemlerin ansatzları TEK bir değerse o değer, farklıysa null
             (ansatz kaynağı: grup meta ansatzı ?? kalemin unit_price'ı)
```

> `hourlyRate` farklı ansatzlarda **null** olmalı. Üç ansatzdan birini kutuda göstermek
> hiç göstermemekten kötüdür.

### 4.2 Grup kontrolü bileşeni

**Girdi:** grup etiketi, grubun kalemleri, grup meta ansatzı (ön dolgu), kilit durumu.
**Çıktı:** `onAnwenden(değişiklikler[])` — her değişiklik `{ id, priceType, unit, amountBasis, quantity, unitPrice, kostendachMax }`.

Davranış:
- Üç düğme + yanlarında **Ansatz** ve **Kostendach** alanları (pencere yok).
- Seçili model `derivePriceModel(grubunKalemleri)` ile **hesaplanır**, ayrı state'te tutulmaz.
- Ansatz boşken `stundenansatz`/`kostendach` düğmeleri **pasif** + "Stundensatz eingeben" notu.
  (Sessizce hiçbir şey yapmamak en kötüsü.)
- Ansatz/Kostendach alanı `onBlur`'da değişirse grup **yeniden uygulanır** (yukarıdan doldurma).
- Uygulamadan **önce** grubun mevcut değerleri saklanır → "Rückgängig" onları **birebir** geri yazar.
- Kilitliyse hepsi `disabled` + gerekçe notu.
- Kostendach **grubun ilk ücretli kalemine** yazılır (PDF onu orada okur), hepsine değil.

### 4.3 Bağlanacak yerler

| Yer | Ne yapılır |
|---|---|
| Oluşturma formu | Kontrol her servis kartının içinde, kalemlerin üstünde |
| Düzenleme formu | Aynısı + kilit; kalemler **grup başına** listelenir |
| PDF | Preismodell kutusu **grup başına**; offerte geneli kutu kaldırılır |
| Public offerte sayfası | Etiket türetilir |
| Offerte listesi | Rozet türetilir (kalemleri embed et: `price_type, amount_basis, kostendach_max, quantity, unit_price, time_estimate`) |
| E-posta (Edge Function) | **Aynı türetimin kopyası** — Deno `src/` import edemiyorsa elle aynala, yoksa e-posta PDF'ten ayrışır |

### 4.4 Form düzeni (UX — sondan başa öğrenildi)

**Yanlış:** tüm grupların Preismodell kutularını sayfanın üstünde alt alta dizmek. Üç aynı
görünen kutu, hangisi hangi servise ait belli değil.

**Doğru:** her servis kendi kartında; kartın içinde sırayla **Termin → Preismodell →
Service-Details → o servisin kalemleri**. Kontrol etkilediği şeyin hemen üstünde durur.

Sürükle-bırak: kartlı düzende her grubun **kendi listesi** olur (`droppableId = group-<key>`),
`index` artık **grup içindeki** sıra. Düz listeden gelen "global index" mantığı yanlış satırı
taşır — taşıma, grubun mevcut yuvaları içinde yapılmalı, diğer grupların yerleri bozulmadan.

---

## 5. Yapılmayacaklar (bu oturumda pahalıya mal olanlar)

1. **Kutuyu kaldırma.** Kolonun ölü olması kontrolün gereksiz olduğunu göstermez.
2. **Mevcut offerte'lere yazma.** Migration/backfill/script yok. Müşteriye gitmiş belgeler.
3. **Gönderilmiş offerte'nin satırlarını yeniden yazma.** Yeni versiyon aç.
4. **Onaysız kapsam büyütme.** İlk denemede "10 dosya" 17 oldu; okuma yüzeyleri sonradan
   çıktı. Önce **`price_model` okuyan/yazan tüm yerleri gerçekten ara**, listeyi öyle ver:
   ```
   grep -rn "price_model\|priceModel" src supabase/functions --include="*.ts" --include="*.tsx"
   ```
   Bizde beklenmedik çıkanlar: public offerte sayfası, offerte detay sayfasının PDF payload
   guard'ı (aralık dışı eski değer önizlemeyi bloke ediyordu), e-posta attachment kurucusu.
5. **Edge Function'ı unutma.** E-posta kutuyu doğrudan `offers.price_model`'dan basıyorsa,
   kolon yazılmayı bırakınca kutu **sessizce kaybolur**. Ya aynı türetimi aynala ya deploy'u
   aynı ana bağla.
6. **Ölçmeden onarım önerme.** "Kaç satır bozuk" sorusunun cevabı yoksa düzeltme önerilmez.
7. **"Std." sabitini yalnız bir yerde arama.** Sistem saat-eksenli doğduğu için birim adı
   kodun her katmanına yazılmıştı: belgede, grup ipucunda ve **kalem satırındaki Kostendach
   yardımcısında** ayrı ayrı çıktı. Hesap üçünde de birim-nötrdü (tutar ÷ ansatz), yanlış olan
   yalnızca **etiket** — bu yüzden testler yakalamadı, ekranda görüldü: m³ ansatzlı bir kalem
   „= CHF 1'200.00 (20 Std × CHF 60.00)" diyordu. Süpürürken metni ara, hesabı değil:
   ```
   grep -rn "Std\.\|Stunden\|hourlyRate\|/ h\b" src supabase/functions
   ```
   Ve saat testini **tek bir yerde** tut (`istStundenEinheit`); iki ayrı liste er geç ayrışır.

---

## 5b. Sıradaki adım: model **servisin doğasına** göre değişmeli

Bu turda yapılmadı, ama aynı kalıbın devamı ve kendi CRM'inde de çıkacaktır.

### Bulgu

Üç model (`Pauschal` / `Stundenansatz` / `Stundenansatz mit Kostendach`) **taşıma servisi
merkezli**. Entsorgung m³ başına, Lagerung ay başına faturalanır — orada "Stundenansatz"
anlamsız bir soru. Kullanıcı bunu ekranda gördü: Entsorgung kartında sistem çöp servisi için
saat ücreti istiyordu.

### İkinci kayıt yeri: `offer_item_volume_meta`

Hacim servislerinin altında ayrı bir kart var: `volume_m3` · `rate` · `rate_unit`
(`m³` | `monthly`). PDF'e "ca. 20 m³ · CHF 60/m³" diye basılıyor — **ama hesaba girmiyor.**
Toplam yalnızca kalem satırından gelir (`Menge × Preis/Einheit`); `20 × 60 = 1200` hiçbir
yerde hesaplanmaz.

> Bu, §1'deki hatanın **birebir aynısı**: fiyat belirliyormuş gibi görünen, aslında yalnızca
> yazı olan bir alan. `offer_item_area_meta` (Reinigung: `area_m2`) ve
> `offer_item_effort_meta` (`hourly_rate`) için de aynı soruyu sor.

Sonuç: aynı kartta birbirinden habersiz **iki ücret alanı** durur — Preismodell'in ansatzı
(hesaba girer) ve meta'nın Tarif'i (girmez).

### Yön

Model seçenekleri servis türünden türetilmeli:

| Servis | Anlamlı modeller |
|---|---|
| Umzug / Transport / Möbellift | Pauschal · **Stundenansatz** · + Kostendach |
| Entsorgung / Räumung | Pauschal · **pro m³** · + Kostendach |
| Lagerung | Pauschal · **pro Monat** |
| Reinigung | Pauschal · (pro m² değerlendirilebilir) |

Teknik olarak yeni bir eksen **gerekmiyor**: "pro m³" demek kalem düzeyinde
`price_type='per_unit'` + `amount_basis='rate'` + `unit='m³'` demektir. Yani `rate` ekseni
aynı kalır, yalnızca **birim** değişir. `priceTypeShape`'e `alsAnsatz` bayrağı eklemek yeterli
(o olmadan `per_unit` yalnızca sabit tutar olabiliyor).

> **Bu tabloyu kısıt yapma — varsayılan yap.** Tablo yalnızca hangi birimin *önce* önerileceğini
> söyler; üçü de seçilebilir kalmalı. Bir firma çöp işini pekâlâ saatlik teklif edebilir. Uygulama:
> model düğmeleri **birim-nötr** ("Nach Ansatz" / "Nach Ansatz mit Kostendach"), yanlarında bir
> **birim seçici** (pro Stunde | pro m³ | pro Monat) servisin varsayılanıyla dolu. Kalemler zaten
> bir ansatz taşıyorsa **onların birimi** kazanır, servis varsayılanı değil — yoksa alan
> "CHF/m³" gösterirken belge "CHF/Stunden" basar.

Bunu yapınca meta'daki `rate` alanı da ayrı bir yazı olmaktan çıkıp kalemin `unit_price`'ına
bağlanır — iki ücret alanı **teke** iner. Meta kartında yalnızca ölçü (`volume_m3`, `area_m2`)
kalır; fiyat hep kalemde durur.

**Dikkat:** `derivePriceModel` ansatz kaynağı olarak zaten `effort_meta.hourly_rate ??
volume_meta.rate` okuyor. Meta'daki fiyat alanı kaldırılırsa bu okuma da sadeleşmeli, yoksa
üçüncü bir yarı-gerçek doğar.

---

## 6. Doğrulama listesi

Kod tarafı:
- [ ] `priceTypeShape` için her geçişin testi (özellikle `pauschale`→quantity 1, `rate`→`fixed`
      cap silinmesi, dayatılan birimin taşınmaması)
- [ ] `derivePriceModel` için: rate yok / rate var / cap'li / **farklı ansatzlar → null** /
      `inkl`+`optional` sayılmaz / `range` ≠ `rate`
- [ ] **Gerçek bir üretim offerte'siyle regresyon testi**: doğru çalışan bir saatlik offerte'nin
      satırlarını teste koy, çıktının değişmediğini kanıtla
- [ ] type-check / lint (toplam sayı **artmamalı**) / test / build

Elle (izole, sentetik veriyle — prod'da değil):
- [ ] Grup A saatlik, Grup B götürü — birbirini etkilemiyor
- [ ] Ansatz değiştir → grubun satırları güncelleniyor
- [ ] Kostendach → PDF'te "Ansatz + max + saat sayısı" çıkıyor, toplam kutusu **yok**
- [ ] Yanlış tıkla → Rückgängig eski tutarı **birebir** geri getiriyor
- [ ] `sent` offerte → kutu pasif, gerekçe görünür
- [ ] Bir satırı sürükle → sadece kendi grubunda yer değiştiriyor
- [ ] PDF ile e-posta aynı rozeti gösteriyor

---

## 7. Bu repoda dosya karşılıkları (yön bulmak için)

| Kavram | Dosya |
|---|---|
| Saf fonksiyonlar | `src/lib/offerPricing.ts` |
| Testler | `src/lib/__tests__/offerPricing.test.ts` |
| Grup kontrolü | `src/components/offerte/GruppenPreismodell.tsx` |
| Oluşturma / düzenleme | `src/pages/firma/OfferteErstellen.tsx` · `OfferteBearbeiten.tsx` |
| PDF | `src/components/pdf/utils/mapOfferData.ts` · `components/ServiceTable.tsx` |
| Public sayfa / liste | `src/pages/public/OfferView.tsx` · `src/pages/firma/Offerten.tsx` |
| E-posta | `supabase/functions/send-offer/index.ts` |

Karar kaydı ayrı bir dosyada değil — **bu belgenin kendisi**. (İlk denemedeki `docs/ADR_offerte_preismodell.md`, kutuyu kaldıran yaklaşımı anlatıyordu ve o commit geri alınınca birlikte silindi.)

Bu repoda **açık kalanlar:** e-posta aynası (deploy bekliyor); tek bir satırın kendi Preistyp
dropdown'ı hâlâ yalnız birimi senkronluyor (`priceTypeShape` hazır, bağlanmadı); prompt'taki
F2–F11'in geri kalanı (kayıt yolu normalizasyonu, bayat cap render gate'i, yuvarlama,
`rate` offerte'lerin aşağı akışta 0 sayılması).
