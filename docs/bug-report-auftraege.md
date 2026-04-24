# Bug Report: Aufträge Modülü

**Tarih:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/Auftraege.tsx`
- `src/components/firma/AuftragModal.tsx`
- `src/components/firma/SahaExtrasModal.tsx`
- `src/lib/generateAuftragPdf.ts`

---

## Kritik Hatalar

### 1. completed_at Status Değişince Temizlenmiyor ✅ DÜZELTİLDİ
**Dosyalar:** `Auftraege.tsx` (handleStatusChange), `AuftragModal.tsx` (update)

**Sorun:** Status "abgeschlossen"dan başka bir duruma (örn. "in_bearbeitung") geçirildiğinde `completed_at` değeri sıfırlanmıyor.

- **handleStatusChange:** Sadece `newStatus === "abgeschlossen"` iken `completed_at` set ediliyor; diğer durumlarda temizlenmiyor.
- **AuftragModal (update):** `auftragData` içinde `completed_at` yok; status değişse bile `completed_at` güncellenmiyor.

**Sonuç:** Veri tutarsızlığı – status "in_bearbeitung" olsa bile `completed_at` dolu kalıyor.

**Öneri:**
```typescript
// handleStatusChange
if (newStatus === "abgeschlossen") {
  updateData.completed_at = new Date().toISOString();
} else {
  updateData.completed_at = null;
}

// AuftragModal update
auftragData.completed_at = formData.status === "abgeschlossen" 
  ? new Date().toISOString() 
  : null;
```

---

### 2. Delete – Loading State / Double Click ✅ DÜZELTİLDİ
**Dosya:** `Auftraege.tsx` (satır 324-350)

**Sorun:** Silme sırasında loading state yok. Kullanıcı "Löschen"e birden fazla kez tıklayabilir.

**Risk:** Çift silme denemesi, gereksiz API çağrıları.

**Öneri:** `isDeleting` state ekle, delete sırasında butonu devre dışı bırak.

---

### 3. handleStatusChange – Race Condition ✅ DÜZELTİLDİ
**Dosya:** `Auftraege.tsx` (satır 352-379)

**Sorun:** Hızlı status değişikliklerinde eşzamanlı güncellemeler çakışabilir. Optimistic update yok, her durumda tam `fetchData` çağrılıyor.

**Öneri:** `updatingIds` Set ile aynı anda tek güncelleme, optimistic update ve hata durumunda rollback.

---

## Orta Öncelikli Sorunlar

### 4. Form Validation Eksik
**Dosya:** `AuftragModal.tsx` (satır 668-678)

**Sorun:** Sadece title, customer_name, scheduled_date zorunlu. Eksik:
- E-posta format kontrolü
- Geçmiş tarih uyarısı (yeni oluşturma)
- Negatif fiyat kontrolü
- `hourly_rate` / `subtotal` için max değer kontrolü

---

### 5. Filter – Null/Undefined Crash Riski ✅ DÜZELTİLDİ
**Dosya:** `Auftraege.tsx` (satır 418-424)

**Sorun:** `a.title.toLowerCase()` – `a.title` null ise hata verir. DB schema `title` için NOT NULL olsa da, edge case’lerde hata oluşabilir.

**Öneri:** Defensive: `a.title?.toLowerCase()` veya `(a.title || "").toLowerCase()`.

---

### 6. scheduled_time Format
**Dosya:** `Auftraege.tsx` (satır 633)

**Sorun:** `auftrag.scheduled_time.substring(0, 5)` – `scheduled_time` DB’de TIME tipinde; Supabase "HH:mm" veya "HH:mm:ss" dönebilir. `substring(0, 5)` çoğu durumda çalışır ama format değişirse hata riski var.

---

## Düşük Öncelik / İyileştirme

### 7. fetchData Dependency
**Dosya:** `Auftraege.tsx` – `fetchData` zaten `useCallback` ile tanımlı ve dependency array’de doğru kullanılıyor. Bu nokta düzeltilmiş.

### 8. Checkbox
**Dosya:** `AuftragModal.tsx` – `onCheckedChange` kullanılıyor. Bu nokta düzeltilmiş.

### 9. Pagination / Search Debounce
- Tüm Aufträge tek seferde yükleniyor (büyük listelerde performans sorunu).
- Arama her tuş vuruşunda tetikleniyor, debounce yok.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 3 | ✅ Düzeltildi |
| Orta | 3 | İsteğe bağlı |
| Düşük | 2 | İyileştirme |

### Önerilen Düzeltme Sırası
1. **completed_at** – Status değişiminde veri tutarlılığı
2. **Delete loading state** – Double delete önleme
3. **Status change race condition** – Concurrent update önleme
