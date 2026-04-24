# SEO Landing Pages - Photo Rehberi

Bu dokuemantasyon, Offerio.ch SEO landing sayfalari icin photolarin nasil hazirlanacagini ve sisteme eklenecegini aciklar.

---

## 📁 Klasoer Yapisi

```
public/
└── images/
    └── services/
        ├── umzugsfirma/
        │   ├── hero.jpg           ← Ana hero imagei
        │   ├── content-1.jpg      ← Content imagei 1
        │   └── content-2.jpg      ← Content imagei 2
        │
        ├── umzugsunternehmen/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        ├── moebeltransport/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        ├── privatumzug/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        ├── firmenumzug/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        ├── bueroumzug/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        ├── umzugshelfer/
        │   ├── hero.jpg
        │   ├── content-1.jpg
        │   └── content-2.jpg
        │
        └── entrumpelung/
            ├── hero.jpg
            ├── content-1.jpg
            └── content-2.jpg
```

---

## 🖼️ Image Gereksinimleri

### Hero Imageleri (`hero.jpg`)

| Property | Value |
|---------|-------|
| **Boyut** | 1920 x 1080 px (16:9) |
| **Format** | JPG veya WebP |
| **Dosya boyutu** | Max. 300 KB |
| **Quality** | 80-85% sikistirma |

**Content Oenerileri:**
- Profesyonel umzug ekibi calisirken
- Umzug kamyonu yuekleme/bosaltma
- Temiz, aydinlik, profesyonel goeruenuem
- Isvicre'ye oezgue imageler tercih edilmeli

### Content Imageleri (`content-1.jpg`, `content-2.jpg`)

| Property | Value |
|---------|-------|
| **Boyut** | 800 x 600 px (4:3) |
| **Format** | JPG veya WebP |
| **Dosya boyutu** | Max. 150 KB |
| **Quality** | 80-85% sikistirma |

---

## 📸 Her Service Icin Recommended Imageler

### 1. Umzugsfirma (Umzug Firmasi)
- **Hero:** Umzug kamyonu oenuende profesyonel ekip
- **Content-1:** Mobilya tasiyan isciler
- **Content-2:** Paketlenmis kutular

### 2. Umzugsunternehmen (Umzug Companyi)
- **Hero:** Company logosu olan kamyon
- **Content-1:** Ofis ortaminda planlama
- **Content-2:** Muesteri ile el sikisma

### 3. Moebeltransport (Mobilya Tasima)
- **Hero:** Koltuk/kanepe tasiyan isciler
- **Content-1:** Mobilya sarma/paketleme
- **Content-2:** Kamyona yuekleme

### 4. Privatumzug (Oezel Moving)
- **Hero:** Aile evinin oenuende umzug
- **Content-1:** Ev esyalari paketleme
- **Content-2:** Mutlu aile yeni evde

### 5. Firmenumzug (Company Moving)
- **Hero:** Ofis mobilyalari tasima
- **Content-1:** Bilgisayar/IT ekipmani paketleme
- **Content-2:** Bos ofis hazirligi

### 6. Bueroumzug (Ofis Moving)
- **Hero:** Modern ofis tasinmasi
- **Content-1:** Dosya dolaplari tasima
- **Content-2:** IT altyapi kurulumu

### 7. Umzugshelfer (Moving Yardimcilari)
- **Hero:** Ekip halinde calisan yardimcilar
- **Content-1:** Kutu tasiyan kisiler
- **Content-2:** Mobilya montaji

### 8. Entruempelung (Ev Clearance)
- **Hero:** Ev bosaltma operasyonu
- **Content-1:** Eski esyalarin toplanmasi
- **Content-2:** Temiz bos oda

---

## 🔧 Image Ekleme Steplari

### Step 1: Klasoerleri Olusturun

```bash
# Terminal'de calistirin
mkdir -p public/images/services/umzugsfirma
mkdir -p public/images/services/umzugsunternehmen
mkdir -p public/images/services/moebeltransport
mkdir -p public/images/services/privatumzug
mkdir -p public/images/services/firmenumzug
mkdir -p public/images/services/bueroumzug
mkdir -p public/images/services/umzugshelfer
mkdir -p public/images/services/entrumpelung
```

### Step 2: Imageleri Optimize Edin

**Online Araclar:**
- [TinyPNG](https://tinypng.com/) - PNG/JPG sikistirma
- [Squoosh](https://squoosh.app/) - Google'in image optimizasyon araci
- [ImageOptim](https://imageoptim.com/) - Mac icin

**Komut Satiri (ImageMagick):**

```bash
# Hero imageini boyutlandir ve optimize et
convert input.jpg -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 hero.jpg

# Content imageini boyutlandir ve optimize et
convert input.jpg -resize 800x600^ -gravity center -extent 800x600 -quality 85 content-1.jpg
```

### Step 3: Imageleri Klasoerlere Kopyalayin

```bash
# Example: Umzugsfirma imageleri
cp /path/to/your/hero-image.jpg public/images/services/umzugsfirma/hero.jpg
cp /path/to/your/content-1.jpg public/images/services/umzugsfirma/content-1.jpg
cp /path/to/your/content-2.jpg public/images/services/umzugsfirma/content-2.jpg
```

### Step 4: Imageleri Test Edin

Tarayicida su URL'leri acarak imagelerin yueklendigini kontrol edin:

```
http://localhost:8080/images/services/umzugsfirma/hero.jpg
http://localhost:8080/images/services/umzugsfirma/content-1.jpg
http://localhost:8080/images/services/umzugsfirma/content-2.jpg
```

---

## 📝 Kod Referansi

Imageler `src/data/seo/serviceTypes.ts` dosyasinda tanimlanmistir:

```typescript
{
  id: "umzugsfirma",
  slug: "umzugsfirma",
  heroImage: "/images/services/umzugsfirma/hero.jpg",
  contentImages: [
    "/images/services/umzugsfirma/content-1.jpg",
    "/images/services/umzugsfirma/content-2.jpg"
  ],
  // ...
}
```

Farkli image yollari kullanmak istiyorsaniz bu dosyayi duezenleyin.

---

## 🎨 Image Standartlari

### Renk Paleti
- Marka renkleriyle uyumlu imageler tercih edin
- Asiri doygun veya soluk renklerden kacinin
- Dogal isik altinda cekilmis photolar idealdir

### Kompozisyon
- Ana konu ortada veya uecte bir kuralina goere yerlestirilmeli
- Arka plan temiz ve duezenli olmali
- Insan yuezleri varsa, pozitif ifadeler tercih edilmeli

### Telif Hakki
- ⚠️ Sadece lisansli imageler kullanin
- Recommended kaynaklar:
  - [Unsplash](https://unsplash.com/) - Uecretsiz
  - [Pexels](https://pexels.com/) - Uecretsiz
  - [Shutterstock](https://shutterstock.com/) - Uecretli
  - [Adobe Stock](https://stock.adobe.com/) - Uecretli

---

## ✅ Kontrol Listesi

Her servis icin asagidaki adimlari tamamlayin:

- [ ] **Umzugsfirma**
  - [ ] hero.jpg (1920x1080, <300KB)
  - [ ] content-1.jpg (800x600, <150KB)
  - [ ] content-2.jpg (800x600, <150KB)

- [ ] **Umzugsunternehmen**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Moebeltransport**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Privatumzug**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Firmenumzug**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Bueroumzug**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Umzugshelfer**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

- [ ] **Entruempelung**
  - [ ] hero.jpg
  - [ ] content-1.jpg
  - [ ] content-2.jpg

---

## 🚀 WebP Formati (Recommended)

Daha iyi performans icin WebP formatini kullanabilirsiniz:

```bash
# JPG'yi WebP'ye doenuestuer
cwebp -q 85 hero.jpg -o hero.webp
```

Kod degisikligi icin `serviceTypes.ts` dosyasinda uzantilari `.webp` olarak guencelleyin.

---

## 📞 Destek

Image ekleme konusunda sorun yasarsaniz:
- Bu dokuemantasyonu kontrol edin
- Dosya boyutlarini ve formatlari dogrulayin
- Tarayici konsolunda hata mesajlarini kontrol edin

---

*Son update: 26 Aralik 2025*

