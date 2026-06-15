# CLAUDE.md

Bu dosya, Claude Code (ve diğer AI ajanları) için bu repoda çalışırken referans rehberidir.
Kod yazmadan önce oku — proje fork geçmişi ve "yapılmayacaklar" listesi nedeniyle
varsayılan davranışlar yanıltıcı olabilir.

> 📐 **Mimari + domain modeli için → [docs/SISTEM_PRD.md](docs/SISTEM_PRD.md)** (Claude kalıcı
> referansı; canlı DB üzerinde doğrulanmış). Bu CLAUDE.md **kuralları** verir, SISTEM_PRD
> **sistemi** (lead→offer→auftrag→quittung akışı, şema, edge fn'ler, aktif-vs-kalıntı) anlatır.
> Sistemi geliştirmeye/analiz etmeye başlamadan önce ikisini de oku.

---

## 1. Proje Özeti

Tek müşteriye (single-tenant) hizmet eden, ayakta duran bir **CRM uygulaması**.
**Offerio** isimli çok-kiracılı (multi-tenant) bir SaaS'tan fork edilmiştir; portal,
marketplace, Stripe ve token mantığı çıkarılmıştır. Kalan tek amaç: lead → offer →
auftrag → quittung akışını yöneten dahili dashboard.

- Frontend: Vite 7 + React 18 + TypeScript (strict)
- UI: Tailwind CSS + shadcn/ui + Radix
- State / data: TanStack React Query, react-hook-form + zod
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions, Deno)
- Email: Resend (Edge Functions üzerinden, server-side)
- PDF: `@react-pdf/renderer` + `jspdf`
- Test: Vitest (sadece saf fonksiyonlar)
- Deploy: Coolify / Hetzner VPS (Docker) veya Vercel/Netlify

Dev server: **`http://localhost:8080`** (port 8080 — 3000 değil).

---

## 2. NEVER / Yapılmayacaklar

Bu kurallar Offerio fork'undan dolayı kritiktir. İhlal etmek, çoktan kaldırılmış
özellikleri geri sokar.

- **Yama (patch / workaround) yasak.** Bozuk bir sistemi yama ile düzeltme — kök
  nedeni bul ve düzelt. Çözülemiyorsa **dur ve kullanıcıya sor**; gerekirse o
  parça baştan yazılır. Hata bastırma (`// eslint-disable`, `as any`, sessiz
  `try/catch`, fallback değer, bypass, hard-code) yasak. Yeni yama ile eski
  yamayı destekleme — ya temiz çözüm ya yeniden yapım.
- **Stripe / ödeme mantığı eklenmez.** Token bakiyesi, subscription tier vb. yok.
- **Multi-tenant mantık eklenmez.** Her şey tek `company` üzerinden yürür.
  `company_members` tablosu var ama owner zaten 1 kişi — yine de RLS'leri kırma.
- **Portal/marketplace bileşenleri** (CookieBanner, TrackingProvider, partner
  registrierung public akışı vb.) geri eklenmez. `App.tsx`'teki `CRM-FORK:` yorumları
  kasıtlıdır.
- `console.log` üretime girmez — `sonner` toast veya proper error boundary kullan.
- **Barrel export** (`index.ts` re-export) yazma. Doğrudan import.
- **`any` tipi** kullanma. Zod schema'dan tip türet.
- **Service role key** frontend'e sızdırılmaz. Edge Function içinde Deno env'den.
- **RLS olmadan tablo yazılmaz.** `supabase-schema-needed.md` referans.
- `.env` / `.env.local` commit edilmez (zaten `.gitignore`'da).
- Resend / SMTP credentials Supabase Secrets'a — `VITE_*` değil.

### Bug fix akışı (zorunlu)

Bir bug'ı düzeltmeden **önce**:

1. **Kök nedeni 1-3 cümlede açıkla** — hangi varsayım/kod yolu kırık, neden bu davranışı üretiyor.
2. **Yan etkiyi söyle** — düzeltme başka dosya/fonksiyon etkiliyorsa hangileri ve ne tür değişiklik (signature, davranış, tip). Sessizce başka dosyaya dokunma.
3. Sonra düzelt.

Tek satırlık trivial fix'lerde (typo, import path) kısa tut — gereksiz tören yaratma.
5+ dosyaya yayılan değişikliklerde uygulamadan önce kullanıcı onayı al.

---

## 3. Klasör Yapısı (Hızlı Harita)

```
src/
├── App.tsx                    # Tüm router tanımları (lazy + Suspense)
├── config/modules.ts          # Sidebar feature flag'leri (gizle/göster)
├── hooks/
│   ├── useAuth.tsx            # AuthProvider, useAuth, isAdmin, adminRole
│   ├── useCompanyContext.tsx  # Aktif şirket context'i (CompanyProvider)
│   └── useCachedCompany.ts    # Şirket fetch + cache
├── pages/
│   ├── Auth.tsx               # Login + forgot-password
│   ├── auth/ResetPassword.tsx
│   ├── firma/                 # ⭐ Tüm CRM sayfaları burada
│   │   ├── Dashboard.tsx, Anfragen.tsx, Auftraege.tsx,
│   │   ├── Besichtigungen.tsx, Kalender.tsx, Offerten.tsx,
│   │   ├── OfferteErstellen/Detail/Bearbeiten.tsx,
│   │   ├── Quittungen.tsx, QuittungDetail.tsx,
│   │   ├── Checkliste.tsx, Leistungskatalog.tsx, Preisgestaltung.tsx,
│   │   ├── Team.tsx, Umzugsboxen.tsx, ManualImport.tsx,
│   │   ├── Datenarchiv.tsx, Einstellungen.tsx
│   └── public/                # Token ile paylaşılan sayfalar (offer, termin)
├── components/
│   ├── firma/FirmaLayout.tsx  # Sidebar + header shell (tüm /firma sayfaları)
│   ├── ui/                    # shadcn/ui primitives
│   └── (umzug, reinigung, malerarbeit, ...)/  # Servis-spesifik form bileşenleri
├── lib/
│   ├── authUtils.ts           # Saf auth util — TESTLİ
│   ├── adminPermissions.ts    # Rol/permission hiyerarşisi — TESTLİ
│   ├── crmAccess.ts           # Standalone modda no-op
│   ├── fetchSingleCompanyForUser.ts / fetchCompaniesForUser.ts
│   ├── generateOfferPdf.tsx / generateAuftragPdf.ts / generateChecklistPdf.ts
│   └── (validations, plzLookup, recaptchaVerify, audit, spell-check, ...)
├── integrations/supabase/
│   ├── client.ts              # `import { supabase } from "@/integrations/supabase/client"`
│   └── types.ts               # ⚠️ Auto-generated (~5200 satır). Elle düzenleme.
└── types/                     # Manuel TS tipleri

supabase/
├── config.toml                # Local dev port'ları (db:54322, studio:54323)
├── migrations/                # 25+ SQL migration, ISO tarih prefixli
└── functions/                 # 45+ Edge Function (Deno)
    ├── _shared/               # Ortak helpers
    ├── accept-lead, send-offer, send-quittung, send-purchase-confirmation,
    ├── notify-*, admin-*, validate-*, calculate-*, ...

scripts/
├── generate-sitemap.mjs       # Build pre-step
├── prerender.mjs              # Public sayfaları için SSG
└── optimize-images.mjs

docs/                          # Bug raporları, code-review notları, session log
```

`@` alias = `src/` ([vite.config.ts:155](vite.config.ts#L155)).

---

## 4. NPM Scripts

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Vite dev server (port 8080) |
| `npm run build` | sitemap → vite build → prerender |
| `npm run build:vite` | Sadece sitemap + vite (prerender atlanır) |
| `npm run type-check` | `tsc --noEmit` — TS hatalarını yakalar, output yok |
| `npm run lint` / `lint:fix` | ESLint 9 (flat config: [eslint.config.js](eslint.config.js)) |
| `npm test` | Vitest (tek seferlik) |
| `npm run test:watch` | Vitest watch |
| `npm run test:coverage` | HTML coverage → `./coverage/` |

PR/commit öncesi en azından `type-check` + `lint` + `test` koştur.

---

## 5. Auth & Yetkilendirme

`src/hooks/useAuth.tsx` — `AuthProvider` tüm app'i sarar.

| Hook field | İçerik |
|---|---|
| `user`, `session` | Supabase auth state |
| `isLoading` | İlk session resolve oluyor mu |
| `isAdmin`, `adminRole` | `user_roles` tablosundan türev |
| `signIn/signOut/resetPassword/updatePassword` | Action'lar |

Rol hiyerarşisi (`src/lib/adminPermissions.ts`):

```
super_admin (100)  — tam erişim
admin       (50)   — user mgmt hariç tam erişim
moderator   (10)   — leads, verification, blog
(rolsüz)           — normal şirket kullanıcısı → /firma
```

Login akışı: `Auth.tsx` → `fetchSingleCompanyForUser` →
- Şirket yok → "Keine Firma verknüpft"
- `is_verified=false` → "Verifizierung ausstehend"
- `is_verified=true` → `/firma`

---

## 6. Veritabanı Notları

> **Uyarı:** Bu proje **Supabase Cloud değil** — Coolify üzerinde self-hosted Supabase.
> README'deki "Supabase Dashboard → API" ve `npx supabase db push` yönergeleri yanıltıcı,
> bu kurulum için **geçerli değil**. Gerçek bağlantı yolları:
> **[docs/SUPABASE_MCP_BAGLANTI.md](docs/SUPABASE_MCP_BAGLANTI.md)** (tam rehber).
>
> Özet:
> - Sunucu: `213.199.45.205`, Coolify path: `/data/coolify/services/aw0c0w440o8k0cccokow0csw/`
> - **SSH tüneli zorunlu**: `ssh -L 5433:10.0.2.9:5432 root@213.199.45.205 -N`
>   - ⚠️ Hedef IP `10.0.2.9` — sunucudaki **CRM DB container'ının Docker network IP'si**.
>     `localhost:5432`'ye yönlendirme yaparsan başka bir proje'nin proxy container'ına düşersin
>     ("server closed the connection unexpectedly" hatası bu yüzden). IP değişirse:
>     `ssh root@213.199.45.205 "docker inspect supabase-db-aw0c0w440o8k0cccokow0csw --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'"`
> - **MCP** (Claude Code): `crm-postgres` server `~/.claude.json`'da kayıtlı, `postgres-mcp` (crystaldba)
>   `--access-mode=restricted` (read-only). Tunnel açıksa Claude Code restart sonrası kullanılabilir.
>   Schema değişikliği gerekirse `--access-mode=unrestricted`'a geçir.
> - **CLI**: tünel + `psql`, ya da `ssh → docker exec supabase-db-aw0c0w440o8k0cccokow0csw psql -U postgres -d postgres`
> - **Studio**: `http://213.199.45.205:8000`
> - **Edge fn deploy**: `scp index.ts → /data/coolify/.../volumes/functions/<fn>/` + edge container restart
> - **Edge fn `.env` değişikliği** → `docker restart` yetmez, Coolify Redeploy gerek

- 22+ tablo, hepsinde **RLS aktif**. Şema referansı: [supabase-schema-needed.md](supabase-schema-needed.md).
- Tipler `src/integrations/supabase/types.ts` içinde auto-generated (~5200 satır) —
  elle düzenleme. Şema değişti mi → SSH tüneli açıkken
  `npx supabase gen types typescript --db-url 'postgresql://postgres:***@localhost:5433/postgres'`
  ile yenile (cloud `--linked` çalışmaz).
- Önemli tablolar: `companies`, `company_members`, `user_roles`, `leads`, `offers`,
  `offer_items`, `auftraege`, `appointments`, `quittungen`, `checklist_templates`,
  `company_service_items`, `leistungsuebersicht_templates`, `firma_resources`,
  `umzugsboxen` (box rentals), `manual_imported_leads`, `archive_*`,
  `email_logs`, `notifications`.
- Servis-spesifik anfrage tabloları: `klaviertransport_anfragen`,
  `moebellift_anfragen`, vb. — her servis tipinin kendi formu var.
- RPC fonksiyonları: `atomic_accept_lead`, `find_companies_in_radius`,
  `submit_lead`, `validate_offer_access_token`, `get_offer_by_token`,
  `update_offer_by_token`, `has_role`, `is_company_owner`, ...
- Migration commit kuralı: dosya adı `YYYYMMDDHHmmss_<uuid>.sql`, **mevcut
  migration düzenlenmez** — yeni dosya eklenir.

---

## 7. Edge Functions

`supabase/functions/` altında 45+ Deno fonksiyonu. Public olanlar
(`verify_jwt = false`) [supabase/config.toml](supabase/config.toml)'da işaretli — bunlar `x-internal-secret`
veya RPC token doğrulaması yapar.

Sık dokunulanlar:
- `accept-lead`, `confirm-lead-by-token`, `validate-lead-quality` — lead lifecycle
- `send-offer`, `notify-offer-response`, `handle-proposal-response` — teklif akışı
- `send-quittung`, `send-purchase-confirmation` — fatura/makbuz
- `notify-appointment-*`, `notify-team-reminder`, `notify-auftrag-reminder` — bildirimler
- `analyze-besichtigung`, `complete-besichtigung`, `confirm-besichtigung`,
  `create-besichtigung-session`, `validate-besichtigung-token` — virtual besichtigung
- `extract-anfrage-ai`, `transcribe-voice`, `spell-check-ai` — AI yardımcıları
- `admin-create-user`, `admin-delete-user`, `admin-add-company-member`,
  `admin-remove-company-member`, `admin-reset-password`, `admin-update-user-email`
- `google-places-autocomplete`, `google-places-details`, `calculate-distance`,
  `import-swiss-plz`

Deploy: `npx supabase functions deploy <name>`. Secret: `npx supabase secrets set KEY=...`.

---

## 8. Kod Konvansiyonları

- **Arrow function** her component ve handler'da. `function` keyword sadece util'de.
- **`const` > `let`**. Mümkün her yerde.
- **PascalCase** component dosyaları, **camelCase** util dosyaları.
- **Zod schema** form validation için — `src/lib/validations/` ve component yanındaki dosyalar.
- **`cn()`** util'i ile koşullu class — inline style ve CSS module yasak.
- **Mobile-first** Tailwind (`base` mobil → `sm:` / `md:` / `lg:` yukarı).
- **Async + try/catch** her yerde — sessiz hata yok, toast veya re-throw.
- Tüm Radix dialog/popover/select için **shadcn/ui** wrapper'ı tercih et —
  düz Radix import'u nadir.
- Path import: `@/components/...`, `@/lib/...`, `@/hooks/...`. Relative `../../`
  zinciri yazma.

---

## 9. Test Stratejisi

Sadece **saf fonksiyonlar** test edilir. React component'leri ve Supabase çağrıları
test edilmez (entegrasyon testi yok).

| Dosya | Kapsam |
|---|---|
| `src/lib/__tests__/authUtils.test.ts` | `resolveAdminRole`, `getResetPasswordUrl`, `validateAuthForm`, `validateResetPasswordForm` |
| `src/lib/__tests__/adminPermissions.test.ts` | Rol hiyerarşisi, `hasPermission`, `canModifyRole`, menu erişimi |

Yeni saf fonksiyon eklediğinde test de ekle. UI component test edilmez — bunun
yerine browser'da elle doğrula.

---

## 10. Feature Flags

`src/config/modules.ts`. Bir bayrağı `false` yapmak **sadece sidebar linkini gizler**
— route hâlâ erişilebilir kalır. Tamamen kaldırmak için route'u da `App.tsx`'ten sil.

Şu an `integrations: false` (henüz yok); diğer hepsi `true`.

---

## 11. Build & Bundling

`vite.config.ts` agresif `manualChunks` yapıyor — vendor chunk'ları (`vendor-react`,
`vendor-router`, `vendor-ui`, `vendor-supabase`, `vendor-pdf`, `vendor-react-pdf`,
`vendor-pdfjs`, `vendor-qr`, `vendor-form`, `vendor-query`, `vendor-icons`).
Yeni büyük lib eklerken bunlardan birine assign et ya da yeni chunk tanımla,
yoksa main bundle şişer.

PDF render motoru (`@react-pdf/renderer`, `pdfjs-dist`) lazy chunk olarak ayrık;
sayfa-içi import'ta `lazy()` veya dynamic import kullan.

`build` script'i prerender'ı tetikler ([scripts/prerender.mjs](scripts/prerender.mjs)) — public sayfalar (offer
token view, appointment) için statik HTML. Yeni public route ekledikten sonra
prerender konfigünü güncelle.

---

## 12. Hızlı Trouble-Shoot

- **Supabase 401** → `.env.local`'deki `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` doğru mu, anon key public mı?
- **RLS hatası** → `auth.uid()` ile `companies.user_id` veya `company_members` üzerinden eşleşme var mı?
- **Edge fn timeout** → 60s default, ağır işleri (PDF, AI) chunk'la veya queue'ya at.
- **Type kayıp** → `types.ts` stale. Regenerate et.
- **Port 8080 dolu** → Vite başka bir proje kalıntısı. `lsof -i:8080`.
- **`window is not defined`** prerender'da → SSR-safe guard ekle (`typeof window !== "undefined"`).

---

## 13. İlgili Dokümanlar

- **[docs/SISTEM_PRD.md](docs/SISTEM_PRD.md) — ⭐ Sistem mimarisi + domain modeli (Claude kalıcı referansı, canlı DB doğrulamalı).**
- [README.md](README.md) — Setup özeti, deployment notları.
- [docs/AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) — Auth detay.
- [docs/CRM_IMPLEMENTATION_ROADMAP.md](docs/CRM_IMPLEMENTATION_ROADMAP.md) — Geçmiş ve aktif adım (`CURRENT_STEP`).
- [docs/OFFERTEN_SYSTEM.md](docs/OFFERTEN_SYSTEM.md) — Teklif akışı.
- [docs/LEISTUNGSKATALOG.md](docs/LEISTUNGSKATALOG.md) — Servis kataloğu modeli.
- [docs/MOVING_CALCULATOR.md](docs/MOVING_CALCULATOR.md) — Fiyat hesaplayıcı.
- [docs/N8N_VAPI_INTEGRATION.md](docs/N8N_VAPI_INTEGRATION.md) — Telefon / sesli akış entegrasyonu.
- [supabase-schema-needed.md](supabase-schema-needed.md) — 22 tablo + RLS pattern referansı.
- [.cursor/rules/](.cursor/rules/) — Coding conventions, model routing, roadmap (Cursor için ama içerik geçerli).

---

## 14. Commit / PR Kuralları

- Commit mesajı kısa, eylem-fiili — Türkçe ya da İngilizce, tutarlı kal.
- Migration ekledin → SQL dosyası + types regen + ilgili Edge Function/RLS güncelleme aynı commit'te.
- Edge Function değişikliği → mümkünse o function'ı tek commit'te tut, deploy notunu PR'da belirt.
- Sırf cleanup commit'i atma (rename, unused remove) — fix/feature ile birlikte.
- `npm run type-check` ve `npm run lint` temiz olmadan commit yok.
