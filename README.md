# Offerio - Lead Management Platform

Lead yönetim platformu - Umzug, Reinigung, Entsorgung ve diğer hizmetler için otomatik lead dağıtım sistemi.

**URL**: https://offerio.ch

## 🚀 Teknoloji Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth
- **Email**: Resend API
- **Security**: Google reCAPTCHA v3
- **Deployment**: Vercel / Netlify

## 📋 Gereksinimler

- Node.js 18+ ve npm
- Supabase hesabı ve projesi
- Google reCAPTCHA v3 keys (opsiyonel)

## 🛠️ Kurulum

### 1. Repository'yi klonla

```bash
git clone <YOUR_GIT_URL>
cd leadflow-swiss-connect
```

### 2. Dependencies yükle

```bash
npm install
```

### 3. Environment Variables ayarla

`.env` dosyası oluştur ve şu değişkenleri ekle:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# reCAPTCHA (Opsiyonel - spam koruması için)
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

### 4. Supabase Secrets ayarla

Edge Functions için gerekli secrets'ları ekle:

```bash
npx supabase secrets set RESEND_API_KEY=your-resend-api-key
npx supabase secrets set RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
```

### 5. Database migrations uygula

```bash
npx supabase db push
```

### 6. Edge Functions deploy et

```bash
# Tüm edge functions'ları deploy et
npx supabase functions deploy match-lead --no-verify-jwt
npx supabase functions deploy accept-lead --no-verify-jwt
npx supabase functions deploy verify-recaptcha --no-verify-jwt
# ... diğer functions
```

### 7. Development server'ı başlat

```bash
npm run dev
```

Uygulama `http://localhost:5173` adresinde çalışacak.

## 📁 Proje Yapısı

```
leadflow-swiss-connect/
├── src/
│   ├── components/          # React bileşenleri
│   │   ├── umzug/           # Umzug wizard
│   │   ├── reinigung/       # Reinigung wizard
│   │   ├── admin/           # Admin panel bileşenleri
│   │   └── firma/           # Company dashboard bileşenleri
│   ├── hooks/               # Custom React hooks
│   │   └── useRecaptcha.ts  # reCAPTCHA hook
│   ├── lib/                 # Utility fonksiyonlar
│   │   ├── generateAuftragPdf.ts
│   │   ├── generateOfferPdf.ts
│   │   ├── generateBoxRentalPdf.ts
│   │   └── recaptchaVerify.ts
│   ├── pages/               # Sayfa bileşenleri
│   ├── integrations/        # Supabase client ve types
│   └── types/               # TypeScript type tanımları
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── match-lead/      # Lead eşleştirme
│   │   ├── accept-lead/     # Lead kabul etme
│   │   └── verify-recaptcha/# reCAPTCHA doğrulama
│   └── migrations/          # Database migrations
└── public/                  # Static dosyalar
```

## 🔐 Özellikler

### Lead Yönetimi
- ✅ Çok adımlı form wizard'ları (Umzug, Reinigung, Entsorgung, vb.)
- ✅ Otomatik lead dağıtımı (PLZ bazlı eşleştirme)
- ✅ Token sistemi (lead satın alma)
- ✅ Lead verification sistemi
- ✅ PDF oluşturma (Offerte, Auftrag, Umzugsboxen)

### Güvenlik
- ✅ Google reCAPTCHA v3 entegrasyonu
- ✅ Row Level Security (RLS) policies
- ✅ Edge Functions ile backend doğrulama

### Admin Panel
- ✅ Lead verification ve yönetimi
- ✅ Company ve user yönetimi
- ✅ Token paket yönetimi
- ✅ Email log görüntüleme

### Company Dashboard
- ✅ Gelen lead'leri görüntüleme
- ✅ Lead kabul/reddetme
- ✅ Offer oluşturma ve gönderme
- ✅ Auftrag yönetimi
- ✅ Umzugsboxen yönetimi

## 🧪 Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run type-check
```

## 📦 Deployment

### Vercel

1. Vercel'e projeyi bağla
2. Environment variables ekle (`.env` dosyasındaki tüm `VITE_*` değişkenleri)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy!

### Supabase Edge Functions

Edge function değişikliklerinden sonra:

```bash
npx supabase functions deploy <function-name> --no-verify-jwt
```

## 🔧 Önemli Notlar

- **Database Migrations**: Migration değişikliklerinden sonra mutlaka `npx supabase db push` çalıştır
- **Edge Functions**: Function değişikliklerinden sonra mutlaka deploy et
- **Environment Variables**: Production'da hosting platformuna (Vercel/Netlify) env variables ekle
- **reCAPTCHA**: Eğer reCAPTCHA key'leri yoksa sistem normal çalışır (fail-open)

## 📚 Dokümantasyon

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [shadcn/ui Docs](https://ui.shadcn.com)

## 📝 License

Proprietary - All rights reserved
