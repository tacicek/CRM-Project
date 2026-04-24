# Code Review: Team Module

**Reviewer:** Code Review AI  
**Tarih:** 2025-01-15  
**Dosyalar:** 
- `src/pages/firma/Team.tsx`
- `src/components/firma/TeamWeekView.tsx`

---

## OeZET

| Oencelik | Sayi | Kategori |
|---------|------|----------|
| 🔴 Critical | 3 | Memory leak, Race condition, Anti-pattern query |
| 🟠 High | 7 | Validation, Error handling, Loading states |
| 🟡 Medium | 8 | Accessibility, Performance, DRY |

---

## 🔴 CRITICAL ISSUES

### 1. Memory Leak - useEffect Cleanup Eksik (Team.tsx)

**Konum:** Satir 141-156 ve 185-187

**Problem:** Her iki `useEffect` de async islem baslatiyor ama cleanup function yok. Component unmount olursa state update hala calisir.

```typescript
// ❌ Mevcut kod
useEffect(() => {
  const loadCompany = async () => {
    if (!user) return;
    // ... async operations
    if (company) setCompanyId(company.id); // 💥 unmount sonrasi crash
  };
  loadCompany();
}, [user]);
```

**Coezuem:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const loadCompany = async () => {
    if (!user) return;
    try {
      const company = await fetchSingleCompanyForUser<{ id: string }>({...});
      if (isMounted && company) setCompanyId(company.id);
    } catch (e) {
      if (isMounted) console.error("Error:", e);
    }
  };
  
  loadCompany();
  return () => { isMounted = false; };
}, [user]);
```

---

### 2. Race Condition Protection Yok (Team.tsx)

**Konum:** `saveMember`, `saveResource`, `handleDelete` fonksiyonlari

**Problem:** Butona cift tiklama yapilirsa duplicate kayit olusur. Kaydetme esnasinda baska islem baslatilabilir.

```typescript
// ❌ Mevcut kod
const saveMember = async () => {
  if (!companyId) return;
  // Hic saving kontrolue yok!
  // ...
};
```

**Coezuem:**
```typescript
const [isSaving, setIsSaving] = useState(false);
const [pendingOperation, setPendingOperation] = useState<string | null>(null);

const saveMember = async () => {
  if (!companyId || isSaving || pendingOperation) return;
  
  setIsSaving(true);
  setPendingOperation("save-member");
  try {
    // ... save logic
  } finally {
    setIsSaving(false);
    setPendingOperation(null);
  }
};
```

---

### 3. Anti-Pattern: Nested Async Query (TeamWeekView.tsx)

**Konum:** Satir 110-133

**Problem:** `Promise.all` icinde nested await var - bu paralel calismayi bozuyor ve race condition olusturuyor.

```typescript
// ❌ Mevcut kod
const [teamRes, apptRes, availRes] = await Promise.all([
  supabase.from("team_members")...,
  supabase.from("appointments")...,
  supabase
    .from("team_availability")
    .select("*")
    .in("team_member_id", (await supabase  // 💥 Bu OeNCE calisir!
      .from("team_members")
      .select("id")
      ...
    ).data?.map(t => t.id) || []),
]);
```

**Coezuem:**
```typescript
// ✅ Oence team members'i al, sonra availability
const [teamRes, apptRes] = await Promise.all([
  supabase.from("team_members").select("id, first_name, last_name, color_code, role")
    .eq("company_id", companyId).eq("is_active", true),
  supabase.from("appointments").select("...")
    .eq("company_id", companyId)...
]);

if (teamRes.error) throw teamRes.error;
if (apptRes.error) throw apptRes.error;

const memberIds = teamRes.data?.map(t => t.id) || [];

// Availability'yi ayri cek
const availRes = memberIds.length > 0 
  ? await supabase.from("team_availability").select("*").in("team_member_id", memberIds)
  : { data: [], error: null };

if (availRes.error) throw availRes.error;
```

---

## 🟠 HIGH PRIORITY ISSUES

### 4. Email Validation Eksik (Team.tsx)

**Konum:** Satir 239-276 (`saveMember`)

**Problem:** Email formati validate edilmiyor.

```typescript
// ❌ Mevcut kod
email: memberForm.email || null,
```

**Coezuem:**
```typescript
const isValidEmail = (email: string): boolean => {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const saveMember = async () => {
  if (!isValidEmail(memberForm.email)) {
    toast.error("Bitte eine gueltige E-Mail-Addressse eingeben");
    return;
  }
  // ...
};
```

---

### 5. Phone Validation/Sanitization Eksik (Team.tsx)

**Konum:** Satir 239-276

**Problem:** Telefon numarasi sanitize edilmiyor.

**Coezuem:**
```typescript
const sanitizePhone = (phone: string): string | null => {
  if (!phone) return null;
  // Remove all non-digit characters except + at start
  const cleaned = phone.replace(/(?!^\+)\D/g, '');
  return cleaned || null;
};

// Usage
phone: sanitizePhone(memberForm.phone),
```

---

### 6. Time Parsing Crash Riski (TeamWeekView.tsx)

**Konum:** Satir 175-183 (`getTotalHoursForMember`)

**Problem:** `start_time` veya `end_time` null/undefined ise crash olur.

```typescript
// ❌ Mevcut kod
const start = apt.start_time.split(":").map(Number);  // 💥 null ise crash
const end = apt.end_time.split(":").map(Number);
```

**Coezuem:**
```typescript
const getTotalHoursForMember = (memberId: string): number => {
  const memberAppts = appointments.filter(apt => apt.assigned_team_member_ids?.includes(memberId));
  return memberAppts.reduce((total, apt) => {
    if (!apt.start_time || !apt.end_time) return total;
    
    const startParts = apt.start_time.split(":");
    const endParts = apt.end_time.split(":");
    
    if (startParts.length < 2 || endParts.length < 2) return total;
    
    const start = [parseInt(startParts[0]) || 0, parseInt(startParts[1]) || 0];
    const end = [parseInt(endParts[0]) || 0, parseInt(endParts[1]) || 0];
    
    const hours = (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60;
    return total + Math.max(0, hours); // Negative hours'u oenle
  }, 0);
};
```

---

### 7. Save/Delete Butonlarinda Loading State Eksik (Team.tsx)

**Konum:** Satir 864-866, 994-996

**Problem:** Kaydetme esnasinda buton disabled olmuyor, loading goesterilmiyor.

```typescript
// ❌ Mevcut kod
<Button onClick={saveMember} className="gap-2">
  {editingMember ? "Aktualisieren" : "Hinzufuegen"}
</Button>
```

**Coezuem:**
```typescript
<Button onClick={saveMember} disabled={isSaving} className="gap-2">
  {isSaving ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      Speichern...
    </>
  ) : (
    editingMember ? "Aktualisieren" : "Hinzufuegen"
  )}
</Button>
```

---

### 8. parseFloat/parseInt Error Handling (Team.tsx)

**Konum:** Satir 286-294 (`saveResource`)

**Problem:** `parseFloat("")` returns `NaN`, bu database'e giderse hata olusur.

```typescript
// ❌ Mevcut kod
capacity_m3: resourceForm.capacity_m3 ? parseFloat(resourceForm.capacity_m3) : null,
quantity: parseInt(resourceForm.quantity) || 1,
```

**Coezuem:**
```typescript
const parseCapacity = (value: string): number | null => {
  if (!value.trim()) return null;
  const num = parseFloat(value);
  return isNaN(num) || num < 0 ? null : num;
};

const parseQuantity = (value: string): number => {
  const num = parseInt(value, 10);
  return isNaN(num) || num < 1 ? 1 : num;
};

// Usage
capacity_m3: parseCapacity(resourceForm.capacity_m3),
quantity: parseQuantity(resourceForm.quantity),
```

---

### 9. Time Validation Eksik (TeamWeekView.tsx)

**Konum:** Satir 206-254 (`saveAvailability`)

**Problem:** `startTime >= endTime` kontrolue yok.

**Coezuem:**
```typescript
const saveAvailability = async () => {
  if (!editState) return;
  
  // Validate times
  if (editForm.isAvailable && editForm.startTime >= editForm.endTime) {
    toast.error("Endzeit muss nach Startzeit sein");
    return;
  }
  
  setSaving(true);
  // ...
};
```

---

### 10. Initial Name Character Access Crash Riski (Team.tsx)

**Konum:** Satir 480-481

**Problem:** Bos string olursa `first_name[0]` crash eder (validation var ama TypeScript bilmiyor).

```typescript
// ❌ Mevcut kod
{member.first_name[0]}
{member.last_name[0]}
```

**Coezuem:**
```typescript
{member.first_name?.[0] || "?"}
{member.last_name?.[0] || "?"}
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 11. ARIA Labels Eksik (Team.tsx)

**Konum:** Satir 512-519, 634-641, 714-721

**Problem:** MoreVertical icon butonlarinda aria-label yok.

```typescript
// ❌ Mevcut kod
<Button variant="ghost" size="icon" className="h-8 w-8 ...">
  <MoreVertical className="w-4 h-4" />
</Button>
```

**Coezuem:**
```typescript
<Button 
  variant="ghost" 
  size="icon" 
  className="h-8 w-8 ..."
  aria-label={`${member.first_name} ${member.last_name} Optionen`}
>
  <MoreVertical className="w-4 h-4" />
</Button>
```

---

### 12. useMemo Eksik - vehicles/equipment (Team.tsx)

**Konum:** Satir 370-371

**Problem:** Her render'da filter calisiyor.

```typescript
// ❌ Mevcut kod
const vehicles = resources.filter((r) => r.resource_type === "vehicle");
const equipment = resources.filter((r) => r.resource_type === "equipment");
```

**Coezuem:**
```typescript
const vehicles = useMemo(() => 
  resources.filter((r) => r.resource_type === "vehicle"),
  [resources]
);

const equipment = useMemo(() => 
  resources.filter((r) => r.resource_type === "equipment"),
  [resources]
);
```

---

### 13. DRY Violation - Constants (Team.tsx)

**Konum:** Satir 89-108

**Problem:** `roleOptions` ve `colorOptions` local tanimli, baska yerlerde de kullanilabilir.

**Coezuem:** `src/constants/team.ts` olustur:
```typescript
export const ROLE_OPTIONS = [
  { value: "fahrer", label: "Fahrer", icon: "Car" },
  // ...
] as const;

export const COLOR_OPTIONS = [
  { value: "#3B82F6", name: "Blau" },
  // ...
] as const;

export const DEFAULT_WORK_HOURS = {
  START: "08:00",
  END: "17:00",
} as const;
```

---

### 14. Magic Numbers (TeamWeekView.tsx)

**Konum:** Satir 88-93

**Problem:** "08:00" ve "17:00" hardcoded.

**Coezuem:** Constants dosyasindan import et.

---

### 15. Memory Leak in TeamWeekView.tsx

**Konum:** Satir 148-150

**Problem:** useEffect cleanup eksik.

**Coezuem:** isMounted pattern ekle.

---

### 16. Type Definitions Paylasilmiyor

**Problem:** `TeamMember` interface'i hem `Team.tsx` hem `TeamWeekView.tsx`'de tanimli (DRY violation).

**Coezuem:** `src/types/team.ts` olustur:
```typescript
export interface TeamMember {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  skills: string[] | null;
  is_active: boolean;
  color_code: string;
  created_at: string;
}

export interface Resource {
  id: string;
  company_id: string;
  resource_type: "vehicle" | "equipment";
  name: string;
  description: string | null;
  license_plate: string | null;
  capacity_m3: number | null;
  quantity: number;
  is_available: boolean;
  created_at: string;
}

export interface TeamAvailability {
  id: string;
  team_member_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  notes: string | null;
}
```

---

### 17. Edit Button Accessibility (TeamWeekView.tsx)

**Konum:** Satir 388-394

**Problem:** Button'da aria-label yok, focus style eksik.

```typescript
// ❌ Mevcut kod
<button
  onClick={() => openEditAvailability(member, day)}
  className="absolute top-1 right-1 p-1 rounded bg-background/80 border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
  title="Verfuegbarkeit bearbeiten"
>
```

**Coezuem:**
```typescript
<button
  onClick={() => openEditAvailability(member, day)}
  className="absolute top-1 right-1 p-1 rounded bg-background/80 border opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
  aria-label={`${member.first_name} ${member.last_name} Verfuegbarkeit fuer ${format(day, "d. MMMM", { locale: de })} bearbeiten`}
>
```

---

### 18. AlertDialog Delete Button Loading State (Team.tsx)

**Konum:** Satir 1017-1020

**Problem:** Delete islemi sirasinda loading goesterilmiyor.

**Coezuem:** `isDeleting` state ekle ve AlertDialogAction'da goester.

---

## OeNCE DUeZELTILMESI GEREKENLER (Oencelik Sirasi)

1. ✅ Memory leak fix (useEffect cleanup) - her iki dosyada
2. ✅ Race condition protection (isSaving, isDeleting states)
3. ✅ Fix nested async query anti-pattern (TeamWeekView.tsx)
4. ✅ Add validation (email, phone, time) - lib/validation.ts
5. ✅ Add loading states to save/delete buttons
6. ✅ Fix parseFloat/parseInt error handling (parseCapacity, parseQuantity)
7. ✅ Fix time parsing crash risk (calculateHoursBetween helper)
8. ✅ Add ARIA labels
9. ✅ Add useMemo for vehicles/equipment
10. ✅ Create shared types (src/types/team.ts) and constants (src/constants/team.ts)

---

## REFACTORING OeNERILERI

### File Structure Oenerisi

```
src/
├── types/
│   └── team.ts                 # TeamMember, Resource, TeamAvailability interfaces
├── constants/
│   └── team.ts                 # ROLE_OPTIONS, COLOR_OPTIONS, DEFAULT_WORK_HOURS
├── lib/
│   └── validation.ts           # isValidEmail, sanitizePhone, parseCapacity, etc.
├── pages/firma/
│   └── Team.tsx               # Ana sayfa
└── components/firma/
    └── TeamWeekView.tsx       # Week view component
```

---

## TEST OeNERILERI

Manuel test senaryolari:

1. **Double-click test:** Save butonuna hizli cift tikla → Duplicate kayit olusmamali
2. **Unmount test:** Kaydetme islemi baslayinca hizlica sayfadan cik → Console error olmamali
3. **Invalid email:** Gecersiz email formati gir → Hata mesaji goermeli
4. **Empty time:** Randevu start_time null olan data → Crash olmamali
5. **Time validation:** startTime > endTime → Hata mesaji goermeli
6. **Keyboard navigation:** Tab ile edit butonlarina ulasabilmeli
