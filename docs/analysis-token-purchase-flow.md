# Token Kaufen – Ödeme Akışı Analizi

**Tarih:** 2026-03-01  
**Soru:** Kredi kartı bağlanıyor, ödeme yapılıyor – gerçekten token yükleniyor mu?

---

## Akış Özeti

### 1. Checkout Başlatma
- **Dosya:** `src/pages/firma/Tokens.tsx` → `handlePurchase()`
- **Edge Function:** `create-token-checkout`
- Kullanıcı paket seçer → Stripe Checkout URL alınır → Yeni sekmede Stripe sayfası açılır

### 2. Ödeme (Stripe)
- Kullanıcı Stripe’da kart bilgilerini girer ve öder
- Stripe `checkout.session.completed` event’i gönderir

### 3. Token Yükleme (Webhook)
- **Edge Function:** `stripe-webhook`
- Stripe imzası doğrulanır
- `payment_status === "paid"` kontrol edilir
- Metadata doğrulanır (company_id, total_tokens, package_id)
- **Idempotency:** Aynı session için tekrar işlem yapılmaz
- **RPC:** `atomic_adjust_token_balance` ile token eklenir
- `companies.token_balance` güncellenir
- `token_transactions` tablosuna kayıt yazılır

### 4. Success Redirect
- Stripe kullanıcıyı `/firma/tokens?success=true&tokens=X` adresine yönlendirir
- Toast gösterilir, `window.location.reload()` ile sayfa yenilenir

---

## Sonuç: Token Yükleme Mantığı Doğru

Akış doğru tasarlanmış:
- Webhook ile token yükleme
- Idempotency ile çift işlem engelleme
- Atomic RPC ile race condition önleme
- Metadata validasyonu (Zod)

---

## Potansiyel Sorun: Success Sayfası / Webhook Zamanlaması

**Sorun:** Stripe ödeme sonrası kullanıcıyı hemen success URL’e yönlendirir. Webhook aynı anda veya biraz sonra tetiklenir. `window.location.reload()` anında çalıştığı için, webhook henüz işlenmemiş olabilir.

**Sonuç:** Kullanıcı "Kauf erfolgreich! 50 Tokens wurden gutgeschrieben" görür ama bakiye hâlâ eski değeri gösterebilir (örn. 100 yerine 150).

**Öneri:** Success durumunda balance artana kadar poll et.

**✅ Düzeltildi:** Tokens.tsx – success durumunda balance artana kadar poll (max 6 deneme, ~7.5s). Webhook hızlıysa ilk denemede, gecikmeliyse birkaç saniye içinde bakiye güncellenir.

---

## Kontrol Listesi (Production)

| Kontrol | Açıklama |
|--------|----------|
| Stripe Webhook URL | Stripe Dashboard → Webhooks → `https://[PROJECT].supabase.co/functions/v1/stripe-webhook` |
| Webhook Events | `checkout.session.completed` seçili olmalı |
| STRIPE_WEBHOOK_SECRET | Supabase Secrets’ta tanımlı olmalı |
| STRIPE_SECRET_KEY | Supabase Secrets’ta tanımlı olmalı |
| token_packages.stripe_price_id | Her paket için Stripe Price ID set edilmiş olmalı |

---

## Özet

- Token yükleme mantığı doğru; webhook ve RPC ile token ekleniyor.
- Olası sorun: Success sayfasında reload çok erken yapılırsa bakiye güncel görünmeyebilir.
- Production’da webhook URL ve secret’ların doğru ayarlandığından emin olunmalı.
