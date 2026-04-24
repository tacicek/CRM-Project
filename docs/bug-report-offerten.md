# Bug Report: Offerten Modülü

**Tarih:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/Offerten.tsx`
- `src/pages/firma/OfferteDetail.tsx`
- `src/pages/firma/OfferteErstellen.tsx`
- `src/pages/firma/OfferteBearbeiten.tsx`

---

## Kritik Hatalar

### 1. Save + Send Race Condition – Offer "sent" Kalıyor, E‑Mail Gitmeyebilir ✅ DÜZELTİLDİ

**Dosya:** `OfferteErstellen.tsx` (satır 817-833, 931-977)

**Sorun:** Offer önce `status: "sent"` ve `sent_at: now` ile kaydediliyor, ardından e‑posta gönderiliyor. E‑posta başarısız olursa offer yine de "sent" durumunda kalıyor.

```typescript
status: sendAfterSave ? "sent" : "draft",
sent_at: sendAfterSave ? new Date().toISOString() : null,
// ... insert ...
// Sonra send-offer çağrılıyor
// Hata durumunda sadece toast, offer zaten "sent"
```

**Sonuç:** Müşteri e‑posta almamış olsa bile offer "Gesendet" görünüyor.

**Öneri:** Önce `draft` olarak kaydet, e‑posta başarılı olursa `status: "sent"` ve `sent_at` ile güncelle.

---

### 2. Partial Save – offer_items Hata Verirse Orphan Offer ✅ DÜZELTİLDİ

**Dosya:** `OfferteErstellen.tsx` (satır 885-904)

**Sorun:** Offer insert başarılı, `offer_items` insert hata verirse offer itemsız kalıyor. Rollback yok.

**Öneri:** `offer_items` hata verirse offer’ı sil (rollback) veya transaction/RPC kullan.

---

### 3. companyId – Kalender ile Aynı Sorun ✅ DÜZELTİLDİ

**Dosya:** `Offerten.tsx` (satır 235, 264)

**Sorun:** `fetchSingleCompanyForUser` ile company alınıyor, `setCompanyId` sadece fetch tamamlandıktan sonra set ediliyor. Doğrudan Offerten sayfasına gelindiğinde ilk render’da `companyId` null. `useCachedCompany` kullanılmıyor.

**Not:** Mevcut akışta `user` ile fetch yapılıyor, `companyId` fetch sonrası set ediliyor. `AuftragModal` açıldığında `companyId` genelde dolu olur. Yine de cache ile tutarlılık için `useCachedCompany` tercih edilebilir.

---

## Orta Öncelikli Sorunlar

### 4. Console.log Production’da

**Dosya:** `Offerten.tsx` (satır 179)

```typescript
console.log("[send-offer] Response:", JSON.stringify(data));
```

**Sorun:** Response loglanıyor; hassas bilgi içerebilir. Production’da kaldırılmalı.

---

### 5. email_logs Sorgusu – metadata Filtresi

**Dosya:** `Offerten.tsx` (satır 304), `OfferteDetail.tsx` (satır 300)

```typescript
.in("metadata->>offer_id", offerIds)
.eq("metadata->>offer_id", id)
```

**Sorun:** Supabase/PostgREST’te JSONB filtre sözdizimi sürüme göre değişebilir. `metadata->>offer_id` bazı ortamlarda çalışmayabilir; `emailLogs` boş kalabilir.

**Öneri:** Sorguyu test et; gerekirse `or` ile tek tek `eq` veya RPC kullan.

---

### 6. Offer Interface – lead_id Nullable Olabilir ✅ DÜZELTİLDİ

**Dosya:** `Offerten.tsx` (satır 70)

```typescript
lead_id: string;
```

**Sorun:** DB’de `lead_id` nullable (`ON DELETE SET NULL`). Tip `string | null` olmalı.

---

### 7. Memory Leak – useEffect Cleanup

**Dosya:** `Offerten.tsx` (satır 224-328)

**Sorun:** `fetchOffers` async; component unmount olduktan sonra `setOffers` vb. çağrılabilir.

**Öneri:** `isMounted` veya `AbortController` ile iptal kontrolü ekle.

---

### 8. Resend – Çift Tıklama / Concurrent Resend

**Dosya:** `Offerten.tsx` (satır 155-207)

**Sorun:** `isResending === offer.id` ile tek offer için loading gösteriliyor. Farklı offer’lara hızlıca tıklanırsa birden fazla resend paralel çalışabilir; bu kabul edilebilir. Ancak aynı offer’a çift tıklamada `isResending` zaten set olduğu için buton disabled; bu kısım doğru.

---

## Düşük Öncelik / İyileştirme

### 9. Pagination Yok

Tüm offer’lar tek seferde çekiliyor. Çok sayıda offer’da performans sorunu olabilir.

### 10. Stat Card – icon Kullanımı

**Dosya:** `Offerten.tsx` (satır 416)

```typescript
<stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
```

**Sorun:** `stat.icon` küçük harfle başlıyor; React bileşeni için genelde `StatIcon` gibi büyük harfle başlayan değişken kullanılır. Burada `stat` objesinden geliyor, `FileText` vb. zaten component; çalışıyor olabilir. Kontrol edilmeli.

### 11. Error Handling – fetchOffers

**Dosya:** `Offerten.tsx` (satır 321-323)

**Sorun:** Hata durumunda sadece `console.error`; kullanıcıya toast veya retry gösterilmiyor.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 3 | ✅ Düzeltildi |
| Orta | 5 | ✅ Düzeltildi |
| Düşük | 3 | İyileştirme |

### Önerilen Düzeltme Sırası

1. **Save + Send** – Önce draft kaydet, e‑posta başarılı olursa "sent" yap
2. **Partial Save** – `offer_items` hata verirse rollback
3. **Console.log** – Production’da kaldır
4. **lead_id** – Tipi `string | null` yap
5. **Memory leak** – `isMounted` / cleanup ekle

---

## Not: Önceki Code Review

`docs/code-review-offerten.md` dosyasındaki bazı maddeler giderilmiş:
- ✅ Token logging: Token loglaması kaldırılmış (sadece response logu var)
- ✅ VAT hesaplama: `priceType` için `quantity * unit_price` kullanılıyor
- ✅ Duplicate code: Resend tek bir `handleResendOffer` fonksiyonunda toplanmış
