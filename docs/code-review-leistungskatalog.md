# Code Review: Leistungskatalog (Service Catalog)

**Tarih:** 2026-01-15  
**Reviewer:** AI Code Review  
**Dosyalar Incelendi:**
- `src/pages/firma/Leistungskatalog.tsx` (1531 satir)
- `src/components/offerte/CatalogServiceSelector.tsx` (382 satir)
- `src/components/offerte/LeistungsuebersichtSection.tsx` (1001 satir)

---

## Oezet

| Oencelik | Sayi | Description |
|---------|------|----------|
| 🔴 Kritik | 4 | Veri kaybi, guevenlik, race condition |
| 🟠 Yueksek | 5 | Memory leak, validation, state yoenetimi |
| 🟡 Orta | 8 | DRY ihlali, performans, UX |

---

## 🔴 KRITIK SORUNLAR

### 1. Memory Leak - useEffect'te Cleanup Eksik

**Dosya:** `Leistungskatalog.tsx:284-288`

```typescript
useEffect(() => {
  if (user) {
    loadCompanyAndServices();
  }
}, [user]);
```

**Risk:** Component unmount olduktan sonra state update edilirse memory leak ve "Can't perform a React state update on an unmounted component" hatasi.

**Coezuem:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const loadData = async () => {
    if (!user) return;
    try {
      const company = await fetchSingleCompanyForUser<{ id: string }>({ ... });
      if (isMounted && company) {
        setCompanyId(company.id);
        await loadServices(company.id);
      }
    } catch (error) {
      if (isMounted) console.error("Error:", error);
    } finally {
      if (isMounted) setLoading(false);
    }
  };
  
  loadData();
  return () => { isMounted = false; };
}, [user]);
```

---

### 2. Template Yuekleme - Duplicate Data Kontrolue Yok

**Dosya:** `Leistungskatalog.tsx:497-537`

```typescript
const loadTemplate = async (templateKey: string) => {
  // ...
  const { error } = await supabase
    .from("company_service_items")
    .insert(servicesToInsert);  // ❌ Duplicate kontrolue yok!
```

**Risk:** Ayni template birden fazla kez yueklenirse duplicate servisler olusur. Kullanici farkinda olmadan 50+ gereksiz kayit olusturabilir.

**Coezuem:**
```typescript
const loadTemplate = async (templateKey: string) => {
  // Oence mevcut servisleri kontrol et
  const existingServices = services.filter(s => s.service_type === template.serviceType);
  
  if (existingServices.length > 0) {
    const proceed = confirm(
      `Bu hizmet tuerue icin ${existingServices.length} mevcut leistung var. ` +
      `Yine de ${template.services.length} yeni eklemek istiyor musunuz?`
    );
    if (!proceed) return;
  }
  
  // VEYA: Oence mevcut servisleri sil
  // await supabase.from("company_service_items")
  //   .delete()
  //   .eq("company_id", companyId)
  //   .eq("service_type", template.serviceType);
};
```

---

### 3. Race Condition - Concurrent Save/Delete

**Dosya:** `Leistungskatalog.tsx:420-477`, `479-495`

```typescript
const handleSave = async () => {
  setSaving(true);
  // ...
  await loadServices(companyId);  // Reload data
};

const handleDelete = async (serviceId: string) => {
  // No pending check!
  await loadServices(companyId);
};
```

**Risk:** Kullanici hizlica save + delete yaparsa, ikisi paralel calisir ve data inconsistency olusur.

**Coezuem:**
```typescript
const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

const handleDelete = async (serviceId: string) => {
  if (saving || pendingOperations.has(serviceId)) return;
  
  setPendingOperations(prev => new Set(prev).add(serviceId));
  try {
    // ... delete logic
  } finally {
    setPendingOperations(prev => {
      const next = new Set(prev);
      next.delete(serviceId);
      return next;
    });
  }
};
```

---

### 4. LeistungsuebersichtSection - Optimistic UI Problemi

**Dosya:** `LeistungsuebersichtSection.tsx:213-254`

```typescript
const createServicesFromTemplate = async (templateKey: string) => {
  // ...
  const { data: insertedServices, error } = await supabase
    .from("company_service_items")
    .insert(servicesToInsert)
    .select();

  if (error) throw error;
  
  setAvailableServices(insertedServices || []);  // ❌ Mevcut servisleri siliyor!
  onSelectedServicesChange(defaultServices);
```

**Risk:** Eger sirketin baska servisleri varsa, bunlar UI'dan siliniyor (DB'de var ama state'te yok).

**Coezuem:**
```typescript
setAvailableServices(prev => [...prev, ...(insertedServices || [])]);
```

---

## 🟠 YUeKSEK OeNCELIKLI SORUNLAR

### 5. Input Validation - Negatif Fiyat Kontrolue Yok

**Dosya:** `Leistungskatalog.tsx:386`, `LeistungsuebersichtSection.tsx:356`

```typescript
const price = parseFloat(inlineEditPrice) || 0;  // ❌ Negatif olabilir!
```

**Risk:** Kullanici negatif fiyat girebilir.

**Coezuem:**
```typescript
const price = Math.max(0, parseFloat(inlineEditPrice) || 0);
```

---

### 6. Missing loadServices Dependency

**Dosya:** `CatalogServiceSelector.tsx:87-95`

```typescript
useEffect(() => {
  if (open) {
    loadServices();
    // ...
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, companyId, serviceType]);
```

**Risk:** `loadServices` fonksiyonu her render'da yeniden olusturulur, eslint-disable kullanimi gercek bir dependency sorununu gizliyor olabilir.

**Coezuem:** `useCallback` kullan veya dependency'i dogru ekle.

---

### 7. Inline Edit - State Kaybolmasi

**Dosya:** `Leistungskatalog.tsx:373-418`

```typescript
const startInlineEdit = (service: ServiceItem) => {
  setInlineEditingId(service.id);
  setInlineEditPrice(service.default_price.toString());
  setInlineEditName(service.name);
};
```

**Risk:** Kullanici edit yaparken tab degistirirse (selectedServiceType), inline edit state kaybolmaz ama artik goeruenmeyen bir item'i edit ediyor olur.

**Coezuem:**
```typescript
// Tab degistiginde inline edit'i iptal et
useEffect(() => {
  cancelInlineEdit();
}, [selectedServiceType]);
```

---

### 8. Template Icindeki Service ID'ler Stale Olabilir

**Dosya:** `LeistungsuebersichtSection.tsx:307-316`

```typescript
const applyTemplate = (template: LeistungTemplate) => {
  const templateServiceIds = template.included_service_ids || [];
  const templateServices = availableServices.filter(s => templateServiceIds.includes(s.id));
  // ...
};
```

**Risk:** Eger template olusturulduktan sonra bazi servisler silinmisse, `templateServices` bos veya eksik olur. Kullanici bunu anlamaz.

**Coezuem:**
```typescript
const applyTemplate = (template: LeistungTemplate) => {
  const templateServiceIds = template.included_service_ids || [];
  const templateServices = availableServices.filter(s => templateServiceIds.includes(s.id));
  
  const missingCount = templateServiceIds.length - templateServices.length;
  if (missingCount > 0) {
    toast.warning(`${missingCount} Leistung wurde geloescht und ist nicht mehr verfuegbar`);
  }
  
  onSelectedServicesChange(templateServices);
  // ...
};
```

---

### 9. Double Submit - Saving State Kontrolue Yetersiz

**Dosya:** `Leistungskatalog.tsx:751-758`

```typescript
<Button 
  onClick={openAddModal} 
  size="lg"
  // ❌ disabled={saving} yok!
>
  <Plus className="w-5 h-5" />
  Leistung hinzufuegen
</Button>
```

**Risk:** Kullanici save islemi suererken yeni modal acabilir.

---

## 🟡 ORTA OeNCELIKLI SORUNLAR

### 10. ✅ DRY Ihlali - Duplicate Interface Tanimlari (FIXED)

**Dosyalar:** `Leistungskatalog.tsx`, `CatalogServiceSelector.tsx`, `LeistungsuebersichtSection.tsx`

**Coezuem Uygulandi:** `src/types/leistungskatalog.ts` dosyasi olusturuldu ve tuem dosyalar bu shared types'i kullaniyor.

---

### 11. ✅ DRY Ihlali - Duplicate CATEGORIES Constant (FIXED)

**Coezuem Uygulandi:** `src/constants/service-catalog.ts` dosyasi olusturuldu.

---

### 12. ✅ DRY Ihlali - Duplicate PREDEFINED_TEMPLATES (FIXED)

**Coezuem Uygulandi:** Tuem template'ler `src/constants/service-catalog.ts` dosyasinda birlestirildi.

---

### 13. ✅ Performans - Gereksiz Re-render (FIXED)

**Coezuem Uygulandi:** `useMemo` hook'u ile `filteredServices` ve `groupedServices` optimize edildi.

---

### 14. ✅ UX - Arama Debounce Eksik (FIXED)

**Coezuem Uygulandi:** 300ms debounce eklendi (`VALIDATION.SEARCH_DEBOUNCE_MS`).

---

### 15. ✅ Magic Numbers (FIXED)

**Coezuem Uygulandi:** `DEFAULT_PRICES` ve `VALIDATION` constant'lari `src/constants/service-catalog.ts` dosyasina tasindi.

---

### 16. ✅ Erisilebilirlik - Missing ARIA Labels (FIXED)

**Coezuem Uygulandi:** Tuem icon-only butonlara `aria-label` eklendi.

---

### 17. Console Logs Production'da

**Dosya:** `Leistungskatalog.tsx`, `CatalogServiceSelector.tsx`

```typescript
console.error("Error loading services:", error);
```

**Not:** Bu hatalar debug amaclidir ve production'da goeruenmez (browser console). Gelecekte merkezi logging coezuemue eklenebilir.

---

## OeNERILEN REFACTORING

### 1. Shared Types Dosyasi Olustur

```typescript
// src/types/leistungskatalog.ts
export interface ServiceItem {
  id: string;
  company_id: string;
  service_type: string;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  default_price: number;
  is_default_included: boolean;
  is_optional: boolean;
  display_order: number;
}

export interface SelectedService extends ServiceItem {
  customPrice?: number;
  customQuantity?: number;
}

export interface LeistungTemplate {
  id: string;
  company_id: string;
  service_type: string;
  name: string;
  description: string | null;
  included_service_ids: string[] | null;
  excluded_services: string[] | null;
  notes: string | null;
  is_active: boolean;
}
```

### 2. Constants Dosyasi Olustur

```typescript
// src/constants/service-catalog.ts
export const SERVICE_TYPES = [ ... ];
export const CATEGORIES = [ ... ];
export const UNITS = [ ... ];
export const PREDEFINED_TEMPLATES = { ... };
```

### 3. Custom Hook Olustur

```typescript
// src/hooks/useServiceCatalog.ts
export function useServiceCatalog(companyId: string | null, serviceType?: string) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [templates, setTemplates] = useState<LeistungTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ... load, save, delete functions
  
  return { services, templates, loading, reload, addService, deleteService, ... };
}
```

---

## OeNCE DUeZELTILMESI GEREKENLER (Oencelik Sirasi)

1. ✅ Memory leak fix (useEffect cleanup)
2. ✅ Template duplicate kontrolue
3. ✅ Race condition protection (pendingOperations state)
4. ✅ Negatif fiyat validation
5. ✅ Shared types/constants refactoring (`src/types/leistungskatalog.ts`, `src/constants/service-catalog.ts`)
6. ✅ useMemo performans iyilestirmesi (filteredServices, groupedServices)
7. ✅ Arama debounce (300ms)
8. ✅ useCallback for loadServices dependency fix
9. ✅ ARIA labels for accessibility
10. ✅ disabled={saving} for double-submit protection

---

## TEST KONTROL LISTESI

- [ ] Template yuekle → Tekrar yuekle → Duplicate var mi?
- [ ] Inline edit baslat → Tab degistir → State dogru mu?
- [ ] Hizlica Save + Delete → Data tutarli mi?
- [ ] Negatif fiyat gir → Kabul ediyor mu?
- [ ] Silinen servis iceren template uygula → Hata var mi?
- [ ] 100+ servis ile performans testi
