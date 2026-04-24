# Bug Report: Besichtigung Modülü

**Tarih:** 2026-03-01  
**Düzeltildi:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/Besichtigungen.tsx`
- `src/components/firma/AcceptBesichtigungDialog.tsx`
- `src/components/firma/AppointmentModal.tsx`
- `supabase/functions/confirm-besichtigung/index.ts`
- `src/pages/public/BesichtigungProposalResponse.tsx`
- `supabase/functions/upload-besichtigung-photo/index.ts`
- `src/pages/public/VirtualBesichtigung.tsx`
- `supabase/functions/analyze-besichtigung/index.ts`
- `supabase/functions/complete-besichtigung/index.ts`
- `supabase/functions/validate-besichtigung-token/index.ts`

---

## Virtual Besichtigung (Foto-Analyse)

### VB-1. AI’a room_type Bilgisi Gönderilmiyordu
**Dosya:** `supabase/functions/analyze-besichtigung/index.ts`

**Sorun:** Müşteri her fotoğrafı yüklerken oda tipini (Wohnzimmer, Küche, vb.) seçiyor. Bu bilgi veritabanında `room_type` olarak tutuluyordu ancak AI prompt’una hiç gönderilmiyordu. AI sadece görüntüden odayı tahmin etmeye çalışıyordu; özellikle “Sonstiges” veya benzer odalar için yanlış gruplandırma yapılabiliyordu.

**✅ Düzeltildi:** Her fotoğraf için müşterinin seçtiği `room_type` prompt’a ekleniyor: `Foto 1 = Wohnzimmer, Foto 2 = Küche, ...` AI artık bu eşleştirmeyi `room_breakdown` için kullanıyor.

---

## Kritik Hatalar

### 1. Duplicate Appointment Creation (Çift Termin Oluşturma)
**Dosyalar:** `AcceptBesichtigungDialog.tsx` (satır 244) + `confirm-besichtigung/index.ts` (satır 222)

**Sorun:** Kullanıcı "Termin bestätigen" tıkladığında appointment iki kez oluşturuluyor:
1. **AcceptBesichtigungDialog** → `supabase.from("appointments").insert(...)` ile direkt oluşturuyor
2. **confirm-besichtigung** Edge Function → E-posta gönderdikten sonra tekrar `appointments.insert` yapıyor

**Sonuç:** Aynı Besichtigung için 2 adet appointment kaydı oluşuyor. Takvimde çift görünüm.

**Öneri:** Edge Function'dan appointment oluşturmayı kaldır; sadece e-posta göndersin. Veya Dialog'dan appointment oluşturmayı kaldır, sadece Edge Function yapsın.

**✅ Düzeltildi:** `type === "confirm"` (AcceptBesichtigungDialog) durumunda Edge Function appointment oluşturmuyor. OfferteDetail akışında (type yok) Edge Function oluşturuyor. E-posta DB işlemlerinden sonra gönderiliyor.

---

### 2. "Termin bearbeiten" – Pending Request için Yanlış Davranış
**Dosya:** `Besichtigungen.tsx` (satır 834-842)

**Sorun:** Henüz kabul edilmemiş (pending) bir Besichtigung talebi için "Termin bearbeiten" tıklandığında:
- `transformToAppointment` ile `id: request.offer_id` atanıyor (appointment id değil, offer id)
- AppointmentModal bu id ile **UPDATE** yapmaya çalışıyor
- `appointments` tablosunda `id = offer_id` olan kayıt yok (appointment henüz oluşturulmadı)
- UPDATE 0 satır etkiler, kullanıcı "Termin aktualisiert" görür ama hiçbir değişiklik olmaz

**Öneri:** Pending request için "Termin bearbeiten" yerine "Annehmen" akışına yönlendir veya butonu devre dışı bırak.

**✅ Düzeltildi:** "Termin anpassen" butonu artık Accept dialog'unu açıyor (handleAcceptClick).

---

### 3. E-posta Önce, Veritabanı Sonra
**Dosya:** `confirm-besichtigung/index.ts` (satır 164 → 222)

**Sorun:** Sıra yanlış:
1. Önce e-posta gönderiliyor (satır 164)
2. Sonra appointment oluşturuluyor (satır 222)

**Risk:** Appointment insert hata verirse müşteri zaten onay e-postası almış olur; takvimde ise kayıt yok.

**Not:** Bug #1 düzeltmesiyle birlikte sıra da düzeltildi: Önce appointment (OfferteDetail) veya skip (Dialog), sonra offer update, sonra e-posta.

---

### 4. Race Condition – Conflict Check vs Submit
**Dosya:** `AcceptBesichtigungDialog.tsx` (satır 176-211, 213-238)

**Sorun:** Conflict kontrolü 300ms debounce ile yapılıyor. Kullanıcı hızlıca "Termin bestätigen" tıklarsa debounce bitmeden submit edebilir. `conflicts.length > 0` kontrolü eski (stale) state'e dayanabilir.

**Risk:** Çakışan saatlerde appointment oluşturulabilir.

**Öneri:** Submit öncesi anlık conflict kontrolü yap:
```typescript
const handleAccept = async () => {
  setCheckingConflicts(true);
  const hasConflicts = await checkConflictsImmediate();
  if (hasConflicts) { toast.error("..."); return; }
  // ...
};
```

---

## Orta Öncelikli Sorunlar

### 5. JSON.parse Try-Catch Eksikliği
**Dosya:** `BesichtigungProposalResponse.tsx` (satır 61)

**Sorun:** `JSON.parse(decodeURIComponent(proposalsParam))` hata fırlatırsa sadece genel catch bloğuna düşüyor. Kullanıcıya daha net mesaj verilebilir.

**✅ Düzeltildi:** Try-catch ile özel hata mesajı: "Die Terminvorschläge konnten nicht geladen werden..."

---

### 6. URL Double-Encoding
**Dosya:** `confirm-besichtigung/index.ts` (satır 294-302)

**Sorun:** `companyName: encodeURIComponent(company.company_name)` kullanılıyor; `URLSearchParams` zaten encode ediyor. Sonuç: çift encoding (örn. "M%C3%BCller").

**Öneri:** `encodeURIComponent` kaldır, sadece `company.company_name` geç.

**✅ Düzeltildi:** URLSearchParams otomatik encode ediyor, pre-encode kaldırıldı.

---

### 7. Customer Name Parsing
**Dosyalar:** `Besichtigungen.tsx` (transformToAppointment), `AcceptBesichtigungDialog`, `handle-proposal-response`

**Sorun:** `customer_name.split(" ")[0]` ile ad/soyad ayrımı yapılıyor. "Hans Peter Müller" gibi isimlerde yanlış bölünebilir.

---

## Düşük Öncelik / İyileştirme

### 8. Arama Debounce Yok
**Dosya:** `Besichtigungen.tsx` – Search her tuş vuruşunda tetikleniyor, büyük listelerde performans sorunu olabilir.

### 9. Rate Limiting
**Dosyalar:** `confirm-besichtigung`, `handle-proposal-response` – Abuse’e karşı rate limit yok.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 4 | Düzeltilmeli |
| Orta | 3 | İsteğe bağlı |
| Düşük | 2 | İyileştirme |
| Virtual Besichtigung | 1 | ✅ Düzeltildi |

### Önerilen Düzeltme Sırası
1. **Duplicate Appointment** – En yüksek etki
2. **Termin bearbeiten (pending)** – Yanıltıcı UX
3. **E-posta/DB sırası** – Veri tutarlılığı
4. **Race condition** – Çakışan termin riski
