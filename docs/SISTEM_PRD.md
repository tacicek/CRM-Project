# SİSTEM PRD — CRM Projesi (Claude Kalıcı Referansı)

> **Bu dosyanın amacı:** Claude'un (ve diğer AI ajanlarının) bu sistemi her oturumda
> sıfırdan keşfetmeden, doğru bir zihinsel modelle çalışabilmesi. Buradaki her madde
> **canlı sistem üzerinde doğrulanmıştır** (DB sorguları + dosya listesi), tahmin değildir.
> Doğrulama tarihi: **2026-06-15**.
>
> **2026-07-16 doküman-senkron güncellemesi:** Rechnungen (QR-fatura) modülü, `useAuth` gerçek
> alanları, `adminPermissions.ts`'in kaldırılışı, `quittungen.auftrag_id` eklenmesi ve genişleyen
> test kümesi eklendi. Bu güncellemeler **repo + migration + generated types üzerinden** doğrulandı;
> deployed edge-fn durumu ve canlı satır sayıları **canlı ortamda ayrıca doğrulanmalıdır**.
>
> **Okuma sırası:** Önce [CLAUDE.md](../CLAUDE.md) (kurallar + NEVER listesi), sonra bu dosya
> (mimari + domain modeli). Bu dosya CLAUDE.md'yi tekrar etmez, **tamamlar**.
>
> **Bakım kuralı:** Şema/edge function/route değişince ilgili bölümü güncelle ve
> "Doğrulama tarihi"ni yenile. Yanlış bir referans, doğru bir referanstan daha tehlikelidir.

---

## 0. Claude bunu nasıl kullanmalı

Bu proje **Offerio** adlı çok-kiracılı (multi-tenant) bir SaaS'tan fork edilmiş, tek
müşteriye hizmet eden (single-tenant) bir CRM'dir. Fork sırasında portal, marketplace,
Stripe/token ve lead-dağıtım mantığı **uygulamadan** çıkarıldı — ama **veritabanında ve
edge function dizininde fiziksel kalıntıları hâlâ duruyor**. Bu yüzden:

1. **Bir tablo/fonksiyon var olması, aktif kullanıldığı anlamına gelmez.** Önce
   [§2 Aktif vs Kalıntı](#2-aktif-sistem-vs-fork-kalıntısı-kritik) tablosuna bak.
2. **Geliştirme isteği geldiğinde** çekirdek domaini ([§3](#3-domain-modeli--state-machine))
   ve gerçek veri akışını esas al; kalıntı tabloları "var diye" işin içine katma.
3. **Şüphede kalırsan** `crm-postgres` MCP ile DB'ye sor (read-only). Tünel açıksa
   doğrulama saniyeler sürer — varsayma, sorgula.

---

## 1. Teknoloji ve çalışma ortamı (özet)

| Katman | Teknoloji |
|---|---|
| Frontend | Vite 7 + React 18 + TypeScript (strict) |
| UI | Tailwind + shadcn/ui + Radix |
| Form/validation | react-hook-form + zod (ağırlıklı lead formlarında) |
| Data | **Doğrudan Supabase client + `useState`/`useEffect`** (aşağıdaki nota bak) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions/Deno) self-hosted (Coolify) |
| Email | Resend (yalnızca Edge Function içinden) |
| PDF | `@react-pdf/renderer` + `jspdf` |
| Test | Vitest (yalnızca saf fonksiyonlar) |

- **Dev server:** `http://localhost:8080` (port 8080, 3000 değil).
- **DB bağlantısı:** Cloud değil, Coolify self-hosted. SSH tüneli + MCP/psql zorunlu.
  Tam rehber: [docs/SUPABASE_MCP_BAGLANTI.md](SUPABASE_MCP_BAGLANTI.md).
- **`@` alias = `src/`**.

> ⚠️ **Data-layer gerçeği:** `QueryClientProvider` [src/App.tsx](../src/App.tsx) içinde
> kuruludur ama CRM sayfalarında **`useQuery` çağrısı yoktur** (doğrulandı: 0 kullanım).
> Sayfalar `supabase.from(...).select()` + `useState`/`useEffect` + `useCallback` deseniyle
> manuel fetch/loading/error yönetir. Yeni sayfa yazarken **mevcut deseni izle** —
> React Query'yi tek bir sayfaya sokup tutarlılığı bozma; tüm sayfayı bilinçli migrate
> etmiyorsan.

---

## 2. AKTİF SİSTEM vs FORK KALINTISI (KRİTİK)

Aşağıdaki satır sayıları canlı DB'den alındı (2026-06-15). "Kalıntı" = fork'tan kalan,
aktif CRM akışında kullanılmayan yapı. **Bunlara dokunmadan önce kullanıcıya sor.**

### 2.1 Aktif çekirdek (gerçek veri var / akışın kalbi)

| Tablo | Satır | Rol |
|---|---|---|
| `companies` | **1** | Tek kiracı — tüm sistem bu tek şirket üzerinden yürür |
| `company_members` | 1 | Sahibin üyeliği |
| `leads` | 4 | Gelen talepler (118 kolon — tüm servis tiplerini tek tabloda taşır) |
| `offers` | 3 | Teklifler |
| `offer_items` | — | Teklif kalemleri |
| `auftraege` | 0 | Siparişler (henüz veri yok ama akış aktif) |
| `quittungen` | 1 | Makbuz/fatura |
| `appointments` | 1 | Randevu/keşif takvimi |
| `team_members` | 0 | Ekip (akış aktif, veri yok) |

> **`leads` tablosu tek ve geniştir (118 kolon).** Servise özel `umzug_anfragen` (72 kolon),
> `raeumung_anfragen`, `klaviertransport_anfragen`, `moebellift_anfragen` tabloları **mevcut
> ama 0 satır** — bunlar eski/alternatif form modeli. Aktif akış `leads` üzerinden gider.
> Yeni servis formu için önce: bu detaylar `leads`'e mi yazılıyor yoksa servis tablosuna mı?
> — koddan doğrula, varsayma.

### 2.2 Fork kalıntısı (var ama aktif CRM'de kullanılmıyor)

| Yapı | Kanıt | Not |
|---|---|---|
| `lead_distributions` | 0 satır | Multi-tenant lead-dağıtım. `offers.lead_distribution_id` FK'si hâlâ var ama tek-kiracıda anlamsız. |
| `subscription_payments`, `subscription_reminders` | 0 satır | Stripe/abonelik. Fork'ta kaldırıldı. |
| Stripe edge fn'leri (`import-stripe-subscriptions`, `sync-stripe-subscriptions`, `subscription-manager`, `create-token-checkout`*) | — | `src/` içinde Stripe **yalnızca** auto-generated `types.ts`'de geçer → frontend kullanmıyor. |
| `landing_pages` (125 satır), `blog_posts` (3), `landing_page_analytics`, `blog_*` | leftover | Offerio marketing/SEO katmanı. CRM dashboard'ı bunları yönetmez. |
| `api_keys`, `ip_blacklist`, `cookie_consent_log`, `shared_content`, `support_tickets*` | — | SaaS altyapısı kalıntısı. |
| `manual_imported_leads`, `*_anfragen` servis tabloları | 0 satır | Aktif akış `leads` + `ManualImport.tsx` (→ `leads`) üzerinden. |

> **Kural (CLAUDE.md NEVER):** Bu kalıntıları "geri canlandırma" — Stripe/token/multi-tenant
> mantığı **eklenmez**. Kalıntı bir tabloyu silmek/şema değiştirmek gerekirse **önce sor**.

---

## 3. Domain Modeli & State Machine

### 3.1 Çekirdek akış

```
  LEAD  ──"Neue Offerte"──▶  OFFER  ──"Auftrag erstellen"──▶  AUFTRAG
 (talep)                   (teklif)      (kabul sonrası)      (saha işi)
                              │                                   │
                              │  müşteri public link ile          │ tamamlanınca (abgeschlossen)
                              │  görüntüler/kabul eder            ├──────────────▶  QUITTUNG (makbuz)
                              └──────────────────────────────────┴──────────────▶  RECHNUNG (İsviçre QR-fatura)
```

**Quittung vs Rechnung (işlevsel fark):**
- **QUITTUNG** = makbuz. `offer_id`'e bağlı (+ opsiyonel tracking `auftrag_id`, UNIQUE değil).
  status: `draft → signed → sent → paid`. Ödeme kanıtı; daha basit.
- **RECHNUNG** = resmî **İsviçre QR-faturası**. Sadece `status='abgeschlossen'` Auftrag'tan,
  Auftrag'ın **frozen snapshot**'ından ([src/lib/erstelleRechnung.ts](../src/lib/erstelleRechnung.ts))
  üretilir; vade tarihli (`faellig_am`), QR-IBAN ödeme referanslı (`qr_iban`/`qr_referenz`),
  **sipariş başına tek** (`auftrag_id` UNIQUE). status: `entwurf → versendet → bezahlt → ueberfaellig`.

### 3.2 Tablolar arası gerçek FK ilişkileri (doğrulandı)

```
leads ──< offers          (offers.lead_id → leads.id)
        └─ offers.lead_distribution_id → lead_distributions   [KALINTI FK, tek-kiracıda boş]
offers ──< offer_items     (offer_items.offer_id → offers.id)
offers ──< auftraege       (auftraege.offer_id → offers.id;  ayrıca lead_id, team_leader_id)
offers ──< quittungen      (quittungen.offer_id → offers.id;  ayrıca quittungen.auftrag_id → auftraege.id)
auftraege ──< quittungen   (quittungen.auftrag_id → auftraege.id)   [tracking, UNIQUE DEĞİL, ON DELETE SET NULL]
auftraege ──1 rechnungen   (rechnungen.auftrag_id → auftraege.id)   [isOneToOne=true → sipariş başına TEK fatura]
offers ──< rechnungen      (rechnungen.offer_id → offers.id, nullable)
offers ──< appointments    (appointments.offer_id → offers.id; ayrıca lead_id)
companies ──< [her şey].company_id
```

> ⚠️ **GÜNCELLEME (migration `20260705120000_quittung_auftrag_link.sql`):** `quittungen`
> tablosuna **`auftrag_id` EKLENDİ** (tracking amaçlı; **UNIQUE DEĞİL** — bir sipariş birden
> çok makbuza sahip olabilir, ör. taksit; `ON DELETE SET NULL`). Migration + generated types
> uyumlu, sync riski yok. Eski "quittungen'de auftrag_id yoktur" ifadesi artık geçersiz.
> `rechnungen` ise `auftrag_id`'yi **UNIQUE** taşır (sipariş başına tek fatura).

### 3.3 Status alanları (canlı DB'den doğrulandı)

| Tablo | Tip | Değerler |
|---|---|---|
| `leads.status` | varchar, default `pending_verification` | serbest metin (pending_verification, …) |
| `offers.status` | varchar, default `draft` | `draft → sent → viewed → accepted / rejected` (enum değil, serbest metin) |
| `auftraege.status` | **enum `auftrag_status`** | `geplant, bestaetigt, in_bearbeitung, abgeschlossen, storniert` |
| `quittungen.status` | text, default `draft` | draft → signed → sent → paid |
| `rechnungen.status` | text, default `entwurf` | `entwurf → versendet → bezahlt → ueberfaellig` ([src/lib/rechnungStatus.ts](../src/lib/rechnungStatus.ts)) |
| `appointments.status` | **enum `appointment_status`** | `pending, confirmed, completed, cancelled, rescheduled, no_show` |
| `appointments.type` | **enum `appointment_type`** | `besichtigung, service, follow_up, meeting, blocked` |

Auftrag geçiş kuralları (izin verilen transition'lar) frontend'de
[src/lib/auftragStatus.ts](../src/lib/auftragStatus.ts) state machine'inde tanımlı —
status dropdown'u bunu uygular.

Diğer iş enum'ları: `box_rental_status`, `raeumungs_art`, `clearance_scope`,
`condition_level`, `urgency_level`, `requester_role`, `umzugsbox_type`, `app_role`.

### 3.4 Akış adımları (hangi UI aksiyonu → hangi DB/edge etkisi)

| Geçiş | UI aksiyonu (sayfa) | Sonuç |
|---|---|---|
| Lead oluştur | Web form / `ManualImport.tsx` | `leads` INSERT |
| Lead → Offer | "Neue Offerte" ([Anfragen.tsx](../src/pages/firma/Anfragen.tsx)) | `/firma/offerten/neu?lead=…`'e git |
| Offer hazırla | [OfferteErstellen.tsx](../src/pages/firma/OfferteErstellen.tsx) | `offers` + `offer_items` INSERT (pricing: pauschal/stundenansatz/kostendach) |
| Offer gönder | "Senden" ([Offerten.tsx](../src/pages/firma/Offerten.tsx)) | Frontend PDF'leri (offer/AGB/checklist base64) üretir → `send-offer` edge fn → Resend → `offers.status=sent, sent_at` |
| Müşteri yanıtı | Public link [OfferView.tsx](../src/pages/public/OfferView.tsx) (token) | `update_offer_by_token` RPC → viewed/accepted/rejected; `notify-offer-response`/`handle-proposal-response` firmaya bildirir |
| Offer → Auftrag | "Auftrag erstellen" + `AuftragModal` (offer kabul edildiyse) | `auftraege` INSERT (`offer_id`, `lead_id`, status=`geplant`) |
| Auftrag yürüt | Status dropdown ([Auftraege.tsx](../src/pages/firma/Auftraege.tsx)) | `auftraege.status` geçişi (state machine) |
| Auftrag → Quittung | [QuittungDetail.tsx](../src/pages/firma/QuittungDetail.tsx) | `quittungen` INSERT (`offer_id` + opsiyonel `auftrag_id`) |
| Quittung gönder | "Senden" | `send-quittung` edge fn → Resend (PDF) → status=sent |
| Auftrag → Rechnung | [RechnungDetail.tsx](../src/pages/firma/RechnungDetail.tsx) ([erstelleRechnung.ts](../src/lib/erstelleRechnung.ts)) | `rechnungen` INSERT (`auftrag_id` frozen snapshot'tan; `rechnung_nr`/`faellig_am` DB trigger, `qr_referenz` insert sonrası) |
| Rechnung gönder | "Senden" ([Rechnungen.tsx](../src/pages/firma/Rechnungen.tsx)) | `send-rechnung-email` edge fn (prepare: signed upload URL → Storage; send: PDF'i Storage'dan yükle → Resend → sil) → status=versendet |

---

## 4. Veritabanı Haritası

- **72 tablo**, hepsinde **RLS aktif** (politika sayıları tablo başına 1–7).
- RLS deseni: erişim `auth.uid()` → `companies.user_id` veya `company_members` üzerinden;
  yardımcılar: `is_company_member()`, `is_company_owner()`, `has_role()`, `is_admin()`,
  `get_user_company_ids()`.
- **Public (token'lı) erişim** RPC üzerinden: `get_offer_by_token`,
  `validate_offer_access_token`, `update_offer_by_token`, `get_offer_items_by_token`,
  `get_besichtigung_session_by_token`, `get_checklist_by_offer_token`,
  `get_agb_sections_by_offer_token`. Public sayfalar tabloya doğrudan değil bu RPC'lere vurur.
- **Tip üretimi:** `src/integrations/supabase/types.ts` auto-generated (~5200 satır) —
  **elle düzenleme**. Şema değişince tünel açıkken `npx supabase gen types …` ile yenile.
- **Migration kuralı:** Mevcut migration düzenlenmez; yeni `YYYYMMDDHHmmss_*.sql` eklenir.
  Migration + types regen + RLS/edge güncellemesi **aynı commit'te**.

Önemli RPC grupları (toplam ~100 fonksiyon `public` şemada):
- **Lead:** `submit_lead`, `submit_lead_json`, `create_appointment_from_lead`,
  `expire_unverified_leads`, `calculate_lead_spam_score`
- **Offer/token:** yukarıdaki token RPC'leri + `replace_offer_items`, `generate_offer_number` (trigger)
- **Besichtigung:** `create_besichtigung_session`, `get_besichtigung_*`, `save_besichtigung_analysis`,
  `insert_besichtigung_photo`, `cleanup_expired_besichtigung_data`
- **Numara üretimi (trigger):** `generate_auftrag_nummer`, `generate_quittung_nr`,
  `generate_umzug_nummer`, `generate_klavier_nummer`, `generate_moebellift_nummer`,
  `generate_raeumung_nummer`
- **Pricing:** `get_company_pricing_config`, `upsert_company_pricing_config`, `save_moving_calculation`
- **Kalıntı (kullanma):** `atomic_accept_lead`, `atomic_adjust_token_balance`,
  `find_companies_in_radius`, `grant_trial`, `extend_subscription`, `activate_self_trial`

> Not: `execute_sql(query, read_only)` adında bir RPC mevcut — MCP read-only erişim bunun
> üzerinden gelir. Yazma için MCP `unrestricted` moda alınmadıkça çalışmaz.

---

## 5. Edge Functions — Deployed Durum (2026-06-15 doğrulandı)

> ⚠️ **Bu bölüm 2026-06-15 tarihli deployed anlık görüntüsüdür.** O tarihten sonra repo'ya
> eklenen fonksiyonların (**`send-rechnung-email`, `translate-content`**) deploy durumu bu
> listeye dahil DEĞİLDİR — **canlı ortamda doğrulanmalı**. "Repo'da mevcut ≠ prod'da deployed":
> aşağıdaki C/B/A sınıflandırması yalnızca doğrulanma tarihindeki sunucu durumunu yansıtır.

> **Runtime davranış notu (2026-06-15 doğrulandı):**
> Bu self-hosted Supabase Edge Runtime'da "deployed değil" = HTTP 500
> `{"msg":"InvalidWorkerCreation: ... could not find an appropriate entrypoint"}`
> (404 değil). Fonksiyon sağlıklıysa kendi auth/validasyon kodundan 400/401/404 döner.

### C) Prod'da aktif — repo + sunucuda (38 fonksiyon)
admin-add-company-member, admin-create-user, admin-delete-user,
admin-remove-company-member, admin-reset-password, admin-update-user-email,
analyze-besichtigung, auto-archive, calculate-distance, cleanup-besichtigung,
cleanup-box-rentals, complete-besichtigung, confirm-besichtigung,
confirm-lead-by-token (deployed ama akış kopuk — validate-lead-quality deployed
değil + /lead-bestaetigen sayfası yok; public intake açılırsa bu zincir birlikte
aktive edilmeli), create-besichtigung-session, delete-besichtigung-photo,
estimate-job-price, extract-anfrage-ai, generate-sitemap,
google-places-autocomplete, google-places-details, handle-proposal-response,
import-manual-lead, notify-appointment-reminder, notify-auftrag-reminder,
notify-offer-response, notify-team-reminder, send-offer, send-quittung,
test-resend-email,
**handle-reschedule-response, notify-appointment-cancelled,
notify-appointment-reschedule, notify-besichtigung, send-appointment-confirmation,
spell-check-ai, upload-besichtigung-photo, validate-besichtigung-token**
(son 8: 2026-06-15 deploy edildi)

### B) Repo'da var, sunucuda YOK — deployed değil (11 fonksiyon)

⚪ Deployed değil — public wizard yolu bu sistemde aktif değil (ManualImport kullanılıyor) (3):
`send-lead-confirmation`, `validate-lead-quality`, `verify-recaptcha`

⚪ Çağrılmıyor — prod etkisi yok (8):
import-stripe-subscriptions, sync-stripe-subscriptions, subscription-manager
(Stripe kalıntısı), import-swiss-plz, notify-box-pickup, resend-email,
send-purchase-confirmation, transcribe-voice

### A) Sadece sunucuda — scaffold + eski kalıntı (3)
hello, main (Supabase Edge Runtime scaffold'ları), accept-lead (multi-tenant
kalıntısı — repo'dan silindi, sunucuda deployed, çağıran yok)

> Not: 2026-06-15'te 8 fonksiyon deploy edildi (temiz boot doğrulandı). Runtime
> kesinliği ilk gerçek çağrıda teyit edilmeli (lazy boot + env var/`_shared` bağımlılığı).

---

## 6. Frontend Mimari

### 6.1 Routing — [src/App.tsx](../src/App.tsx)

- React Router v6, hepsi `lazy()` + `Suspense` + `ErrorBoundary`.
- **Sağlayıcı zinciri:** `AuthProvider` → (route) → `CompanyProvider` + `FirmaLayout`.
- **Public (token'lı) rotalar:** `/auth`, `/auth/reset-password`, `/offerte/:token`
  (→ OfferView), `/termin/:appointmentId/{absagen,verschieben,antwort}`,
  `/besichtigung/:leadId/antwort`, `/besichtigung/:token` (VirtualBesichtigung).
- **Korumalı `/firma/*` rotaları:** dashboard, anfragen, offerten(+neu/:id/bearbeiten),
  auftraege, quittungen(+neu/:id/bearbeiten), rechnungen(+neu/:id), besichtigungen, kalender,
  umzugsboxen, team, checkliste, leistungskatalog, preisgestaltung, manual-import, datenarchiv,
  einstellungen.
- **Feature-flag route guard:** `/firma/*` rotaları [FirmaModuleGuard](../src/components/firma/FirmaModuleGuard.tsx)
  ile korunur — [moduleRoutes.ts](../src/config/moduleRoutes.ts)'teki tek path→module haritası
  bir modülü kapalı bulursa `/firma`'ya redirect eder (sidebar da aynı haritayı kullanır). `/firma`
  dashboard guard'sız (güvenli hedef, loop yok). **Bu bir UX kontrolü, yetkilendirme değil** —
  veri güvenliği Auth + RLS'te; public token rotaları wrapper dışında, etkilenmez.

### 6.2 Sayfalar — [src/pages/firma/](../src/pages/firma/) (19 dosya)

`Anfragen` (lead listesi), `Offerten`/`OfferteErstellen`/`OfferteDetail`/`OfferteBearbeiten`
(teklif), `Auftraege` (sipariş), `Quittungen`/`QuittungDetail` (makbuz),
`Rechnungen`/`RechnungDetail` (İsviçre QR-fatura), `Besichtigungen`
(keşif), `Kalender` (takvim, drag-drop), `Dashboard` (KPI), `Umzugsboxen` (kutu kiralama),
`Team`, `Leistungskatalog` (servis kataloğu), `Checkliste`, `Preisgestaltung` (fiyat
kuralları), `ManualImport`, `Datenarchiv` (soft-delete arşivi), `Einstellungen`.
Public: [src/pages/public/](../src/pages/public/) — `OfferView`, `VirtualBesichtigung`,
`AppointmentCancel/Reschedule`, `RescheduleResponse`, `BesichtigungProposalResponse`.

### 6.3 Auth & Company context

- [src/hooks/useAuth.tsx](../src/hooks/useAuth.tsx) — `AuthProvider`: `user`, `session`,
  `isLoading`, `signIn/signOut/resetPassword/updatePassword`. **`isAdmin`/`adminRole` YOK**
  (koddan doğrulandı). `onAuthStateChange` aboneliği; `PASSWORD_RECOVERY` → `/auth/reset-password`.
- [src/hooks/useCompanyContext.tsx](../src/hooks/useCompanyContext.tsx) — aktif şirket;
  `company_members ⋈ companies` sorgusu, `sessionStorage` cache. (Tek şirket olsa da
  context multi-company API'sini korur — RLS'yi kırma.)
- [src/hooks/useCachedCompany.ts](../src/hooks/useCachedCompany.ts) — geriye-uyumlu wrapper.
- Login akışı: `Auth.tsx` → `fetchSingleCompanyForUser` → firma yok / `is_verified=false` /
  `is_verified=true → /firma`.

### 6.4 Kilit lib'ler — [src/lib/](../src/lib/)

PDF: `generateOfferPdf.tsx`, `generateAuftragPdf.ts`, `generateChecklistPdf.ts`,
`generateAgbPdf.tsx`, `buildOfferEmailAttachments.ts` (offer+AGB+checklist toplu üretim).
Rechnung/QR: `erstelleRechnung.ts` (Auftrag→Rechnung map), `generateRechnungPdf.ts`,
`rechnungStatus.ts`, `swiss-qr/core.ts` (QR-IBAN/QRR referans).
Mantık: `auftragStatus.ts` (state machine), `crmAccess.ts` (feature guard, standalone'da no-op),
`fetchSingleCompanyForUser.ts`/`fetchCompaniesForUser.ts`, `normalizeServiceType.ts`,
`serviceLabels.ts`. Saf+TESTLİ: `authUtils.ts`, `erstelleRechnung.ts`, `generateRechnungPdf.ts`,
`rechnungStatus.ts`, `swiss-qr/core.ts`, `auftragStatus.ts`, `offerPricing`/`offerSurcharges`/
`offerItemMeta` vb. **`adminPermissions.ts` artık YOK** (silindi). Validation:
`src/lib/validations/` (zod, lead formları).

### 6.5 Önemli desenler

- **Veri:** doğrudan `supabase.from` + `useState`/`useEffect`/`useCallback`; toast = `sonner`.
- **Form:** `useState` ağırlıklı; zod yalnızca lead formlarında. Offer item'ları drag-drop
  (`@hello-pangea/dnd`).
- **Yetkilendirme:** CRM UI erişimi yalnızca **authenticated + company membership (RLS)**
  üzerinden. Frontend rol-hiyerarşisi tüketmez ve `adminPermissions.ts` **yoktur** (silindi).
  (`app_role` enum'u + `has_role()`/`is_admin()` RPC'leri DB'de kalabilir ama CRM sayfaları okumaz.)

### 6.6 Çok dillilik — İKİ EKSEN (kritik)

> Tam rehber: [src/i18n/README.md](../src/i18n/README.md)

```
DASHBOARD dili  ── companies.default_language ──▶  /firma/*        ──▶  useT()  (React context)
                                                   (operatörün dili)

DOKÜMAN dili    ── leads.language ──frozen──▶ offers.language ──▶ appointments
                   (müşterinin dili)                             ──▶ auftraege
                                                                 ──▶ rechnungen / quittungen
                                                   ▼
                                    PDF · e-posta · SMS · public token sayfaları
                                    → locale ARGÜMAN olarak geçirilir, ASLA context'ten okunmaz
```

Alman operatör, Fransız müşteriye Fransızca teklif gönderir — iki eksen aynı anda canlıdır.
Müşteriye giden bir renderer `useT()` çağırırsa operatörün dili müşterinin belgesine sızar.

- Dil **DB'de kalıcı olmak zorunda**: `notify-appointment-reminder` / `notify-auftrag-reminder`
  pg_cron ile çalışır, dil geçirecek çağıranı yoktur → satırdan okur.
- Katalog anahtar kümesi: **Almanca tek doğruluk kaynağı**. `fr`/`en` = `Record<keyof typeof de, string>`
  → eksik anahtar **derleme hatası**.
- Firma içeriği (katalog/AGB/checklist) `translations` JSONB: `{"fr":{...},"en":{...}}`,
  Almanca temel kolon fallback. `offer_items` çeviri kolonu almaz — oluşturma anında
  müşterinin dilinde snapshot alınır.
- QR-fatura etiketleri (`doc.qr.*`) SIX-normlu — serbest çeviri yasak.

---

## 7. Dış Servisler

| Servis | Kullanım | Anahtar yeri |
|---|---|---|
| **Resend** | Tüm e-posta (offer, quittung, bildirim) — yalnız edge fn'den | `RESEND_API_KEY` (sistem) veya `companies.resend_api_key` (şirket override) |
| **Anthropic Claude** | anfrage extraction, lead-quality, besichtigung görsel analizi, spell-check, transcribe | `ANTHROPIC_API_KEY` |
| **OpenAI** | extract-anfrage-ai için opsiyonel fallback | `OPENAI_API_KEY` |
| **Google Places / Distance Matrix** | adres autocomplete, mesafe | `GOOGLE_PLACES_API_KEY` |
| **Google reCAPTCHA v3** | public form bot koruması | `RECAPTCHA_*` |
| **Stripe** | **KALINTI** — aktif değil | — |

> **Sır yönetimi:** Service role key ve tüm sağlayıcı anahtarları **yalnızca** Edge Function
> içinde `Deno.env` ile. Frontend'e (`VITE_*`) sızdırma. (CLAUDE.md NEVER.)

---

## 8. Geliştirme yaparken (Claude için davranış kuralları)

Bunlar [CLAUDE.md](../CLAUDE.md) §2'nin operasyonel özetidir — çelişki olursa CLAUDE.md kazanır.

1. **Yama yasak.** Kök nedeni bul; çözülemiyorsa **dur ve sor**. `as any`, sessiz
   `try/catch`, fallback/hard-code, `eslint-disable` ile hata bastırma yok.
2. **Bug fix öncesi:** kök nedeni 1–3 cümlede açıkla → yan etkiyi (etkilenen dosya/fonksiyon)
   söyle → sonra düzelt. (Trivial typo/import için kısa tut.)
3. **5+ dosyaya yayılan değişiklikte** uygulamadan önce onay al.
4. **Stripe/token/multi-tenant/portal/marketplace eklenmez.** Kalıntı yapıları canlandırma.
5. **RLS olmadan tablo yazma. `any` kullanma** (zod'dan tip türet). **Barrel export yazma.**
   **`console.log` üretime girmez.**
6. **PR öncesi:** `npm run type-check` + `npm run lint` + `npm test` temiz olmalı.
7. **Migration eklersen** types regen + RLS/edge güncellemesi aynı commit'te; mevcut
   migration düzenlenmez.

---

## 9. Açık sorular / doğrulanması gerekenler

Bunlar PRD yazımında netleşmeyen, geliştirme sırasında teyit edilmesi gereken noktalar:

- [ ] `leads` (118 kolon) vs servise-özel `*_anfragen` tabloları: yeni servis detayları
      hangisine yazılmalı? (Şu an `*_anfragen` 0 satır → muhtemelen `leads` esas.)
- [ ] `landing_pages` (125 satır) gerçekten ölü mü, yoksa public/SEO tarafında kullanılıyor mu?
- [ ] Kalıntı tablolar/edge fn'ler kalıcı olarak silinsin mi? (Risk: types.ts + olası trigger
      bağımlılıkları — silmeden önce bağımlılık taraması gerekir.)
- [ ] JWT isteyen ~8 edge function hangileri ve neden public değil?

---

*Bu doküman canlı sistem üzerinde doğrulanarak üretildi (DB sorguları + dosya listesi).
Doğrulama tarihi: 2026-06-15. Güncel tutulması bakım sorumluluğundadır.*
