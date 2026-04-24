# Bug Report: Anfrage Import (Manual Import)

**Tarih:** 2026-03-01  
**Düzeltildi:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/ManualImport.tsx`
- `supabase/functions/import-manual-lead/index.ts`
- `supabase/functions/extract-anfrage-ai/index.ts`

---

## Kritik Hatalar

### 1. lead_distributions Insert Hatası Kullanıcıya Bildirilmiyor
**Dosya:** `import-manual-lead/index.ts` (satır 248-266)

**Sorun:** `lead_distributions` insert başarısız olduğunda hata sadece loglanıyor, client'a `success: true` dönülüyor.

```typescript
if (distError) {
  logStep("Distribution insert error", { error: distError });
} else {
  logStep("Distribution created", { distribution_id: distribution?.id });
}
// → Client'a success dönülüyor, lead oluşuyor ama firma Anfragen'da göremiyor!
```

**Risk:** Lead veritabanına kaydedilir ama firma "Anfragen" listesinde göremez. Kullanıcı "başarılı" mesajı alır ama lead'e erişemez.

**Öneri:** distError durumunda `success: false` dön ve lead'i rollback/delete et veya kullanıcıyı bilgilendir.

**✅ Düzeltildi:** distError durumunda lead siliniyor ve `success: false` dönülüyor.

---

### 2. lead_data Null/Undefined Kontrolü Yok
**Dosya:** `import-manual-lead/index.ts` (satır 49, 97+)

**Sorun:** `lead_data` null veya undefined ise `lead_data.customer_first_name` erişimi `TypeError` fırlatır.

```typescript
const { company_id, lead_data, raw_text, confidence_score, user_id } = await req.json();
// ...
customer_first_name: lead_data.customer_first_name || "Unbekannt",  // lead_data null ise crash
```

**Risk:** Malformed request veya client hatası durumunda 500 Internal Server Error.

**Öneri:** Request başında validation ekle.

**✅ Düzeltildi:** lead_data null/object kontrolü eklendi.

---

### 3. PLZ Fallback "0000" Geçersiz
**Dosya:** `import-manual-lead/index.ts` (satır 108)

**Sorun:** PLZ yoksa `"0000"` kullanılıyor. İsviçre PLZ aralığı 1000–9999; `"0000"` `swiss_plz` tablosunda yok.

```typescript
from_plz: lead_data.from_plz || lead_data.address_plz || lead_data.pickup_plz || "0000",
```

**Risk:**
- Admin lead'i verify edip `match-lead` çalışırsa → `status: "unknown_plz"` atanır
- Kötü veri kalitesi, raporlama hataları

**Öneri:** 
- Frontend'de PLZ zorunlu yap (service type'a göre from/address/pickup)
- Backend'de PLZ yoksa 400 dön

**✅ Düzeltildi:** Backend PLZ validasyonu (4 digit), frontend service-type bazlı PLZ zorunluluğu.

---

### 4. E-posta Fallback "import@offerio.ch"
**Dosya:** `import-manual-lead/index.ts` (satır 99)

**Sorun:** E-posta boşsa `"import@offerio.ch"` kullanılıyor.

```typescript
customer_email: lead_data.customer_email || "import@offerio.ch",
```

**Risk:**
- Tüm e-postalar aynı adrese gider
- Yanlış alıcı, veri kalitesi sorunu

**Öneri:** `null` veya boş string kullan.

**✅ Düzeltildi:** Fallback `""` (boş string) olarak değiştirildi.

---

## Orta Öncelikli Sorunlar

### 5. manual_imported_leads Insert Hatası Sessiz
**Dosya:** `import-manual-lead/index.ts` (satır 237-245)

**Sorun:** `manual_imported_leads` insert hata verirse sadece exception fırlatılır, özel handling yok. Lead ve distribution oluşur ama tracking kaydı eksik kalabilir.

**Öneri:** Hata durumunda logla; kritik değilse client'a başarı dönülebilir. İsteğe bağlı: transaction/rollback.

---

### 6. Bilinmeyen Service Type'lar
**Dosya:** `import-manual-lead/index.ts` (satır 117-215)

**Sorun:** Edge Function sadece `umzug_privat`, `umzug_firma`, `reinigung`, `raeumung`, `entsorgung`, `lagerung`, `klaviertransport`, `moebellift` için özel alanlar set ediyor. `extract-anfrage-ai` başka tipler döndürürse (örn. `renovation`, `malerarbeit`) sadece base alanlar kaydedilir.

**Risk:** Düşük – `detailed_form_data` tüm veriyi JSON olarak tutuyor. Detaylı görünümde sorun olmaz.

---

## Mantık / Sistem Sorunları

### 7. Başarılı Yanıt ile Gerçek Durum Uyumsuzluğu
**Akış:** Lead insert → manual_imported_leads insert → lead_distributions insert → subscription count update

Lead oluşur, ama `lead_distributions` insert başarısız olursa firma lead'i göremez. Buna rağmen client `success: true` alır. Bu tutarsızlık kullanıcı deneyimini bozar.

**Öneri:** `lead_distributions` insert başarısız olursa:
1. Oluşan lead'i sil (veya)
2. Client'a `success: false` + açıklayıcı hata mesajı dön

---

### 8. Klaviertransport / Moebellift – from_plz/from_city Eksik
**Dosya:** `import-manual-lead/index.ts` (satır 187-214)

**Sorun:** Klaviertransport ve Moebellift bloklarında `from_plz` ve `from_city` set edilmiyor. Base object'te `from_plz`/`from_city` zaten var; frontend bu alanları gönderiyor. Base fallback zinciri (`from_plz || address_plz || pickup_plz`) bu tipler için uygun. **Şu an için bug yok**, sadece tutarlılık için service-specific bloklarda da yazılabilir.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 4 | Düzeltilmeli |
| Orta | 2 | İsteğe bağlı |
| Mantık | 2 | İyileştirme |

### Önerilen Düzeltme Sırası
1. **lead_distributions hata handling** – Client'a doğru başarı/hata bilgisi
2. **lead_data validation** – Crash önleme
3. **PLZ fallback** – Frontend validasyonu veya null kullanımı
4. **E-posta fallback** – `null` veya zorunlu alan
