# Code Review: Checkliste (Customer Checklist)

**Tarih:** 2026-01-15  
**Reviewer:** AI Code Review  
**Dosyalar Incelendi:**
- `src/pages/firma/Checkliste.tsx` (1214 satir)
- `src/lib/checklistTemplates.ts` (196 satir)
- `src/lib/generateChecklistPdf.ts` (365 satir)

---

## Oezet

| Oencelik | Sayi | Description |
|---------|------|----------|
| 🔴 Kritik | 2 | Memory leak, race condition |
| 🟠 Yueksek | 5 | DRY ihlali, validation, inline fonksiyonlar |
| 🟡 Orta | 6 | Performans, erisilebilirlik, magic numbers |

---

## 🔴 KRITIK SORUNLAR

### 1. Memory Leak - useEffect Cleanup Eksik

**Dosya:** `Checkliste.tsx:135-169`

```typescript
useEffect(() => {
  const fetchData = async () => {
    if (!user) return;
    try {
      const companyData = await fetchSingleCompanyForUser<Company>({ ... });
      // ❌ Component unmount olduysa bu calismamali
      setCompany(companyData);
      // ...
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchData();
}, [user]);
```

**Risk:** Component unmount olduktan sonra state update edilirse memory leak olusur.

**Coezuem:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const fetchData = async () => {
    if (!user) return;
    try {
      const companyData = await fetchSingleCompanyForUser<Company>({ ... });
      if (isMounted && companyData) {
        setCompany(companyData);
        // ... diger state updateleri
      }
    } catch (error) {
      if (isMounted) console.error("Error:", error);
    } finally {
      if (isMounted) setIsLoading(false);
    }
  };
  
  fetchData();
  return () => { isMounted = false; };
}, [user]);
```

---

### 2. Race Condition - Concurrent Operations

**Dosya:** `Checkliste.tsx:294-405`

```typescript
const handleSave = async () => {
  // ...
  setIsSaving(true);
  // ...
};

const handleDelete = async () => {
  if (!templateId) return;  // ❌ isSaving kontrolue yok!
  // ...
};

const handleCopyToServiceType = async () => {
  // isSaving kontrol ediliyor ama baska operasyonlar degil
};
```

**Risk:** Save ve delete ayni anda cagrilabilir, data inconsistency olusur.

**Coezuem:**
```typescript
const [pendingOperation, setPendingOperation] = useState<string | null>(null);

const handleDelete = async () => {
  if (!templateId || isSaving || pendingOperation) return;
  
  setPendingOperation("delete");
  try {
    // ... delete logic
  } finally {
    setPendingOperation(null);
  }
};
```

---

## 🟠 YUeKSEK OeNCELIKLI SORUNLAR

### 3. DRY Ihlali - cleanedSections Logic 5 Kez Tekrarlaniyor

**Dosyalar:** `Checkliste.tsx:306-312, 421-428, 872-878, 921-927, 1159-1165`

```typescript
// Bu kod 5 farkli yerde tekrarlaniyor:
const cleanedSections = sections
  .filter(s => s.timeline.trim())
  .map(s => ({
    ...s,
    items: s.items.filter(item => item.trim())
  }))
  .filter(s => s.items.length > 0);
```

**Risk:** Maintenance nightmare. Bir yerde fix yapilinca digerleri unutulabilir.

**Coezuem:**
```typescript
// checklistTemplates.ts'e ekle:
export const cleanSections = (sections: ChecklistSection[]): ChecklistSection[] => {
  return sections
    .filter(s => s.timeline.trim())
    .map(s => ({
      ...s,
      items: s.items.filter(item => item.trim())
    }))
    .filter(s => s.items.length > 0);
};
```

---

### 4. DRY Ihlali - SERVICE_TYPES Duplicate

**Dosya:** `Checkliste.tsx:95-102`

```typescript
const SERVICE_TYPES = [
  { value: "umzug", label: "Umzug", icon: Truck, color: "from-blue-500 to-blue-600" },
  // ... ayni tanim src/constants/service-catalog.ts'te var!
];
```

**Coezuem:** `src/constants/service-catalog.ts`'ten import et:
```typescript
import { SERVICE_TYPES, getServiceTypeConfig } from "@/constants/service-catalog";
```

---

### 5. Inline Async Functions in JSX

**Dosya:** `Checkliste.tsx:867-905, 917-947, 1156-1184`

```typescript
<Button
  onClick={async () => {
    if (!company) return;
    setIsGeneratingPdf(true);
    try {
      // 30+ satir kod
    } finally {
      setIsGeneratingPdf(false);
    }
  }}
>
```

**Risk:** Her render'da yeni fonksiyon olusturulur, debug zor, kod okunabilirligi duesuek.

**Coezuem:**
```typescript
const handlePdfPreview = useCallback(async () => {
  if (!company) return;
  setIsGeneratingPdf(true);
  try {
    const doc = await generateChecklistPdf({ ... });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfBlobUrl(url);
    setShowPdfPreview(true);
  } finally {
    setIsGeneratingPdf(false);
  }
}, [company, title, subtitle, sections]);

// JSX'te:
<Button onClick={handlePdfPreview} disabled={!title.trim() || isGeneratingPdf}>
```

---

### 6. Missing Validation Before Copy

**Dosya:** `Checkliste.tsx:407-480`

```typescript
const handleCopyToServiceType = async () => {
  if (!company?.id || !copyTargetServiceType) return;
  
  // ❌ Mevcut template kaydedilmemis olabilir!
  // templateId olmadan bile kopyalama deneniyor
```

**Coezuem:**
```typescript
const handleCopyToServiceType = async () => {
  if (!company?.id || !copyTargetServiceType) return;
  
  // Oence mevcut template'i kontrol et
  if (!title.trim()) {
    toast({
      title: "Fehler",
      description: "Bitte speichern Sie zuerst die aktuelle Checkliste.",
      variant: "destructive",
    });
    return;
  }
  // ...
};
```

---

### 7. Delete Butonu Loading State Eksik

**Dosya:** `Checkliste.tsx:968-977`

```typescript
{templateId && (
  <Button
    variant="destructive"
    onClick={handleDelete}
    className="w-full gap-2"
    // ❌ disabled={isSaving} yok!
  >
    <Trash2 className="w-4 h-4" />  // ❌ Loading spinner yok
    Loeschen
  </Button>
)}
```

**Coezuem:**
```typescript
{templateId && (
  <Button
    variant="destructive"
    onClick={handleDelete}
    disabled={isSaving || !!pendingOperation}
    className="w-full gap-2"
  >
    {pendingOperation === "delete" ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <Trash2 className="w-4 h-4" />
    )}
    Loeschen
  </Button>
)}
```

---

## 🟡 ORTA OeNCELIKLI SORUNLAR

### 8. Erisilebilirlik - Missing ARIA Labels

**Dosya:** `Checkliste.tsx` (coklu yerler)

```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={() => removeSection(sectionIndex)}
  disabled={sections.length === 1}
  // ❌ aria-label eksik
>
  <Trash2 className="w-4 h-4" />
</Button>
```

**Coezuem:**
```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={() => removeSection(sectionIndex)}
  disabled={sections.length === 1}
  aria-label="Abschnitt loeschen"
>
```

---

### 9. useMemo Eksik - Computed Values

**Dosya:** `Checkliste.tsx:487-488`

```typescript
const totalSections = sections.filter(s => s.timeline.trim()).length;
const totalItems = sections.reduce((acc, s) => acc + s.items.filter(i => i.trim()).length, 0);
```

**Risk:** Her render'da hesaplaniyor.

**Coezuem:**
```typescript
const totalSections = useMemo(() => 
  sections.filter(s => s.timeline.trim()).length,
  [sections]
);

const totalItems = useMemo(() => 
  sections.reduce((acc, s) => acc + s.items.filter(i => i.trim()).length, 0),
  [sections]
);
```

---

### 10. Console Logs Production'da

**Dosyalar:** `Checkliste.tsx:162`, `generateChecklistPdf.ts:89,211`

```typescript
console.error("Error fetching data:", error);
console.error("Failed to load Poppins font:", error);
console.error("Failed to load logo:", e);
```

**Not:** Debug amaclidir, gelecekte merkezi logging coezuemue eklenebilir.

---

### 11. PDF Blob URL Memory Leak

**Dosya:** `Checkliste.tsx:1137-1145`

```typescript
<Dialog 
  open={showPdfPreview} 
  onOpenChange={(open) => {
    setShowPdfPreview(open);
    if (!open && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);  // ✅ Bu dogru!
      setPdfBlobUrl(null);
    }
  }}
>
```

**Not:** Bu kisim dogru implement edilmis, URL.revokeObjectURL cagriliyor.

---

### 12. Missing Type Export for Shared Use

**Dosya:** `generateChecklistPdf.ts:3-8`

```typescript
interface ChecklistSection {
  id: string;
  timeline: string;
  items: string[];
  order: number;
}
```

**Problem:** Bu interface `checklistTemplates.ts`'te de tanimli. Export edip kullanilmali.

**Coezuem:**
```typescript
// generateChecklistPdf.ts
import type { ChecklistSection } from "@/lib/checklistTemplates";
```

---

## OeNERILEN REFACTORING

### 1. Helper Function for Cleaned Sections

```typescript
// src/lib/checklistTemplates.ts'e ekle:
export const cleanSections = (sections: ChecklistSection[]): ChecklistSection[] => {
  return sections
    .filter(s => s.timeline.trim())
    .map(s => ({
      ...s,
      items: s.items.filter(item => item.trim())
    }))
    .filter(s => s.items.length > 0);
};
```

### 2. Extract PDF Handlers to useCallback

```typescript
const handlePdfPreview = useCallback(async () => { ... }, [deps]);
const handlePdfDownload = useCallback(async () => { ... }, [deps]);
```

### 3. Use Shared SERVICE_TYPES

```typescript
import { SERVICE_TYPES, getServiceTypeConfig } from "@/constants/service-catalog";
```

---

## OeNCE DUeZELTILMESI GEREKENLER (Oencelik Sirasi)

1. ✅ Memory leak fix (useEffect cleanup with isMounted flag)
2. ✅ Race condition protection (pendingOperation state)
3. ✅ Extract cleanSections helper function
4. ✅ Use shared SERVICE_TYPES from constants
5. ✅ Extract inline async functions to useCallback (handlePdfPreview, handlePdfDownload)
6. ✅ Add ARIA labels to icon buttons
7. ✅ Add useMemo for computed values (totalSections, totalItems)
8. ✅ Add delete button loading state
9. ✅ Fix type import in generateChecklistPdf.ts

---

## TEST KONTROL LISTESI

- [ ] Template olustur → Kaydet → Tab degistir → Geri doen → Data dogru mu?
- [ ] Save + Delete ayni anda tikla → Data tutarli mi?
- [ ] PDF Preview → Dialog kapat → Memory leak var mi?
- [ ] Drag & drop sections → Order dogru mu?
- [ ] Copy to other service → Hedefte template zaten varsa → Hata mesaji goesteriyor mu?
- [ ] 20+ section ile performans testi
