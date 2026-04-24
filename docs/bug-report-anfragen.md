# Bug Report: Anfragen Modülü

**Tarih:** 2026-03-01  
**İncelenen Dosyalar:**
- `src/pages/firma/Anfragen.tsx`

---

## Kritik Hatalar

### 1. Token Logging – Güvenlik Açığı ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 415)

```typescript
console.log("[accept-lead] Invoking with session token:", session.access_token.substring(0, 30) + "...");
```

**Sorun:** JWT token'ın ilk 30 karakteri loglanıyor. Production'da bu loglar toplanabilir; güvenlik riski.

**Öneri:** Token'ı hiç loglama. Sadece `hasToken: !!session?.access_token` gibi bilgi loglanabilir.

---

### 2. companyId – Kalender/Offerten ile Aynı Sorun ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 282-284, 328-332)

```typescript
const [companyId, setCompanyId] = useState<string | null>(cachedCompany?.id || null);
// ...
const fetchData = async () => {
  const company = getCachedCompany();
  if (!company?.id) return;
  setCompanyId(company.id);
```

**Sorun:** `getCachedCompany()` sadece ilk render'da okunuyor. Cache boşsa `companyId` null kalır. `fetchData` useEffect'te boş dependency ile bir kez çalışıyor; cache sonradan dolsa bile yeniden fetch yapılmıyor.

**Öneri:** `useCachedCompany` hook kullan; `companyId` değişince `fetchData` tetiklensin.

---

### 3. PDF – Zusatzleistungen Yanlış Yol ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 846-850)

```typescript
if (detailedData?.inventar?.zusatzleistungen) {
  for (const [key, value] of Object.entries(detailedData.inventar.zusatzleistungen)) {
```

**Sorun:** `UmzugDetailedData` interface'inde `zusatzleistungen` top-level'da, `inventar` içinde değil. `inventar` sadece `items`, `geschaetzte_kartons`, `schwere_gegenstaende` içeriyor. `detailedData.inventar.zusatzleistungen` her zaman `undefined`; Zusatzleistungen PDF'e hiç eklenmiyor.

**Öneri:** `detailedData?.zusatzleistungen` kullan.

---

### 4. Birden Fazla Offer – Sadece Sonuncu Gösteriliyor ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 353-365)

```typescript
const { data: existingOffers } = await supabase
  .from("offers")
  .select("id, lead_id, status, created_at, sent_at")
  .eq("company_id", company.id)
  .in("lead_id", leadIds);

const offerMap = new Map<...>();
existingOffers?.forEach(offer => {
  offerMap.set(offer.lead_id, { ... });  // Aynı lead_id için overwrite
});
```

**Sorun:** Bir lead için birden fazla offer varsa (örn. reddedilip yeniden oluşturulmuş) sadece son işlenen gösteriliyor. Sıra belirsiz; en güncel offer seçilmiyor.

**Öneri:** `created_at` desc ile sırala, her `lead_id` için ilk (en yeni) offer'ı al:
```typescript
.order("created_at", { ascending: false })
// forEach'te ilk gelen (en yeni) kalsın - zaten doğru sıra
```

---

## Orta Öncelikli Sorunlar

### 5. Memory Leak – useEffect Cleanup ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 384-386)

**Sorun:** `fetchData` async; component unmount olduktan sonra `setDistributions`, `setCompanyId` vb. çağrılabilir.

**Öneri:** `isMounted` flag veya `AbortController` ile cleanup.

---

### 6. useEffect Dependency – Tek Seferlik Fetch ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 384-386)

```typescript
useEffect(() => {
  fetchData();
}, []); // Company cache'den yüklenene kadar boş kalabilir
```

**Sorun:** Boş dependency ile sadece mount'ta çalışıyor. Cache başlangıçta boşsa `fetchData` erken döner; cache sonradan dolsa bile yeniden çalışmaz.

---

### 7. handleRejectLead – company_id Filtresi Yok ✅ DÜZELTİLDİ

**Dosya:** `Anfragen.tsx` (satır 519-527)

**Sorun:** Update sadece `eq("id", distribution.id)` ile yapılıyor. RLS koruma sağlıyor olsa da, ek güvenlik için `company_id` de filtrelenebilir.

---

## Düşük Öncelik / İyileştirme

### 8. inventar.items – kategorie

**Dosya:** `Anfragen.tsx` (satır 721)

Interface'de `items: { name: string; anzahl: number }[]` – `kategorie` yok. Kod `item.kategorie || "Sonstiges"` kullanıyor; `undefined` durumunda "Sonstiges" ile çalışıyor. Sorun yok.

### 9. Error Handling – fetchData

Hata durumunda sadece `console.error`; kullanıcıya toast veya retry gösterilmiyor.

---

## Özet

| Öncelik | Sayı | Durum |
|---------|------|-------|
| Kritik | 4 | ✅ Düzeltildi |
| Orta | 3 | ✅ Düzeltildi |
| Düşük | 2 | İyileştirme |

### Önerilen Düzeltme Sırası

1. **Token logging** – Kaldır
2. **companyId** – `useCachedCompany` kullan
3. **PDF zusatzleistungen** – `detailedData.zusatzleistungen` kullan
4. **offerMap** – `created_at` desc ile sırala, en güncel offer'ı al
5. **Memory leak** – `isMounted` cleanup ekle
