# Bug Report: Kalender Modülü

**Tarih:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/Kalender.tsx`
- `src/components/firma/AppointmentModal.tsx`
- `src/components/firma/MobileCalendarNav.tsx`
- `src/components/firma/TeamWeekView.tsx`
- `src/components/firma/CalendarExportMenu.tsx`

---

## Kritik Hatalar

### 1. companyId Hiç Güncellenmiyor – Kalender Boş Kalabilir ✅ DÜZELTİLDİ

**Dosya:** `Kalender.tsx` (satır 147)

```typescript
const [companyId] = useState<string | null>(cachedCompany?.id || null);
```

**Sorun:** `getCachedCompany()` sadece ilk render'da okunuyor. Kullanıcı doğrudan Kalender sayfasına giderse (örn. bookmark) veya cache henüz dolu değilse `companyId` `null` kalır ve hiç güncellenmez. `useState` ilk değeri sadece bir kez kullanır.

**Sonuç:** `fetchAppointments()` ve `fetchTeamMembers()` hiç çalışmaz, kalender boş görünür.

**Öneri:**
```typescript
const { companyId } = useCachedCompany();
// veya
const cachedCompany = getCachedCompany();
const [companyId, setCompanyId] = useState<string | null>(cachedCompany?.id || null);
useEffect(() => {
  const c = getCachedCompany();
  if (c?.id && c.id !== companyId) setCompanyId(c.id);
}, []); // veya useCachedCompany hook kullan
```

---

### 2. Drag & Drop – Race Condition ve Rollback Yok ✅ DÜZELTİLDİ

**Dosya:** `Kalender.tsx` (satır 288-314, 316-339)

**Sorun:**
- `handleEventDrop` ve `handleEventResize` hata durumunda optimistic update yapmıyor; başarısız olursa event UI'da yeni konumda kalıyor, DB'de eski yerde.
- Her drag/resize sonrası tam `fetchAppointments()` çağrılıyor; hızlı ardışık işlemlerde state tutarsızlığı oluşabilir.
- Hata durumunda rollback yok.

**Öneri:** Optimistic update + hata durumunda rollback (Aufträge'deki gibi).

---

### 3. Sidebar – Filtre Tutarsızlığı ✅ DÜZELTİLDİ

**Dosya:** `Kalender.tsx` (satır 379-384, 816-872)

```typescript
const selectedDateAppointments = useMemo(() => {
  if (!selectedDate) return [];
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  return appointments.filter(apt => apt.appointment_date === dateStr);
}, [selectedDate, appointments]);
```

**Sorun:** `selectedDateAppointments` sadece tarihe göre filtreliyor. Ana takvimde kullanılan `filters.types`, `filters.statuses`, `filters.teamMemberIds` uygulanmıyor. Sidebar, takvimde gizlenen terminleri gösterebilir.

**Öneri:** Aynı filtreleri uygula:
```typescript
return appointments
  .filter(apt => apt.appointment_date === dateStr)
  .filter(apt => {
    const typeMatch = filters.types.includes(apt.appointment_type);
    const statusMatch = filters.statuses.includes(apt.status);
    const teamMatch = filters.teamMemberIds.length === 0 ||
      (apt.assigned_team_member_ids?.some(id => filters.teamMemberIds.includes(id)) ?? false);
    return typeMatch && statusMatch && teamMatch;
  });
```

---

## Orta Öncelikli Sorunlar

### 4. handleEventResize – appointment_date Güncellenmiyor ✅ DÜZELTİLDİ

**Dosya:** `Kalender.tsx` (satır 316-339)

**Sorun:** Resize sadece `start_time` ve `end_time` güncelliyor. Event gece yarısını geçecek şekilde resize edilirse (react-big-calendar izin verse) `appointment_date` değişmez, veri tutarsız olur. Standart kullanımda nadir.

---

### 5. Conflict Detection – Debounce Yok

**Dosya:** `AppointmentModal.tsx` (satır 268-294)

**Sorun:** Tarih/saat her değiştiğinde anında conflict kontrolü yapılıyor. Hızlı değişimde paralel istekler ve stale sonuç riski var.

**Öneri:** 300ms debounce + AbortController ile önceki istekleri iptal et.

---

### 6. EventComponent – first_name Boş Olabilir ✅ DÜZELTİLDİ

**Dosya:** `Kalender.tsx` (satır 373)

```typescript
{tm.first_name[0]}
```

**Sorun:** `first_name` boş string ise `[0]` `undefined` döner; crash olmaz ama avatar boş görünür. DB'de NOT NULL olsa da edge case olarak mümkün.

**Öneri:** `(tm.first_name || "?")[0]`

---

### 7. Filter Badge Sayısı – Karışık Formül

**Dosya:** `Kalender.tsx` (satır 504-506)

```typescript
{5 - filters.types.length + 6 - filters.statuses.length + filters.teamMemberIds.length}
```

**Sorun:** "Seçilmeyen tip + seçilmeyen status + takım filtre sayısı" şeklinde hesaplanıyor. Kullanıcı için anlaması zor; "aktif filtre sayısı" daha anlaşılır olabilir.

---

## Düşük Öncelik / İyileştirme

### 8. Pagination Yok

Tüm appointments tek seferde çekiliyor. Çok sayıda termin olan firmalarda performans sorunu olabilir.

### 9. Context Menu – Ekran Kenarı ✅ DÜZELTİLDİ

Context menu ekran kenarına yakınsa taşabilir. `window.innerWidth/Height` ile pozisyon sınırlandı.

### 10. Agenda View – handleNavigate

`Views.AGENDA` için toolbar'daki prev/next `subMonths`/`addMonths` kullanıyor; agenda view'da farklı bir mantık gerekebilir.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 3 | ✅ Düzeltildi |
| Orta | 4 | ✅ Düzeltildi |
| Düşük | 3 | İyileştirme |

### Önerilen Düzeltme Sırası

1. **companyId** – `useCachedCompany` veya `useEffect` ile güncelleme
2. **selectedDateAppointments** – Filtreleri sidebar'a da uygula
3. **handleEventDrop/Resize** – Optimistic update + rollback

---

## Not: Önceki Code Review

`docs/code-review-kalender.md` dosyasındaki bazı maddeler giderilmiş:
- ✅ CalendarEvent interface: `ICSCalendarEvent` olarak import edilmiş
- ✅ Week calculation: `startOfWeek` + `weekEnd` ile düzeltilmiş (Date mutasyonu yok)
- ✅ Time validation: AppointmentModal'da `start_time < end_time` ve süre kontrolleri var
