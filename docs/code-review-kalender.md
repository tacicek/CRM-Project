# Code Review: Kalender (Takvim) Sistemi

**Tarih:** 2026-01-25
**Incelenen Dosyalar:**
- `src/pages/firma/Kalender.tsx`
- `src/components/firma/AppointmentModal.tsx`

---

## 🔴 KRITIK SORUNLAR

### 1. **Duplicate Interface Definition - CalendarEvent**

```typescript
// Kalender.tsx:61 - Import
import { CalendarEvent } from "@/lib/calendarSync";

// Kalender.tsx:118-129 - Yeniden tanimlanmis!
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    appointment: Appointment;
    type: string;
    status: string;
    teamMembers: TeamMember[];
  };
}
```

**Sorun:**
- Ayni isimde iki farkli interface var
- Import edilen ile local tanimlanan farkli yapida
- TypeScript hata vermeyebilir ama runtime'da sorun cikabilir
- `AppointmentDetailCard` icinde kullanilan `CalendarEvent` farkli bir tip

**Coezuem:**
```typescript
// Iki farkli tip kullan
import { CalendarEvent as ICSCalendarEvent } from "@/lib/calendarSync";

interface AppointmentCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    appointment: Appointment;
    type: string;
    status: string;
    teamMembers: TeamMember[];
  };
}
```

---

### 2. **Race Condition - Drag & Drop + Fetch**

```typescript
// Kalender.tsx:302-318
const handleEventDrop = useCallback(
  async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
    const appointment = event.resource.appointment;
    const newDate = format(start as Date, "yyyy-MM-dd");
    // ...
    try {
      const { error } = await supabase
        .from("appointments")
        .update({...})
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Termin verschoben");
      fetchAppointments();  // ← Full refetch after each drag
    } catch (e) {
      // Hicbir rollback yok!
    }
  },
  [fetchAppointments]
);
```

**Sorun:**
- User hizlica birden fazla event suerueklerse, her biri `fetchAppointments()` tetikler
- Bu sirada state inconsistent olabilir
- Hata durumunda UI'da event yeni yerde goeruenueyor ama DB'de eski yerinde

**Patlama Senaryosu:**
```
1. User Event A'yi Pazartesi'den Sali'ya sueruekler
2. Update basarisiz olur (network timeout)
3. fetchAppointments() cagrilir ama hata var
4. UI'da Event A hala Sali'da goeruenueyor! (optimistic update yok)
5. Sayfa yenilenince Event A Pazartesi'ye geri doenueyor
```

**Coezuem:**
```typescript
const handleEventDrop = useCallback(
  async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
    const appointment = event.resource.appointment;
    const originalDate = appointment.appointment_date;
    const originalStartTime = appointment.start_time;
    const originalEndTime = appointment.end_time;
    
    const newDate = format(start as Date, "yyyy-MM-dd");
    const newStartTime = format(start as Date, "HH:mm:ss");
    const newEndTime = format(end as Date, "HH:mm:ss");

    // Optimistic update
    setAppointments(prev => prev.map(apt => 
      apt.id === appointment.id 
        ? { ...apt, appointment_date: newDate, start_time: newStartTime, end_time: newEndTime }
        : apt
    ));

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ appointment_date: newDate, start_time: newStartTime, end_time: newEndTime })
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Termin verschoben");
    } catch (e) {
      // Rollback
      setAppointments(prev => prev.map(apt => 
        apt.id === appointment.id 
          ? { ...apt, appointment_date: originalDate, start_time: originalStartTime, end_time: originalEndTime }
          : apt
      ));
      toast.error("Fehler beim Verschieben");
    }
  },
  []
);
```

---

### 3. **Weekday Calculation Bug**

```typescript
// Kalender.tsx:536-542
const thisWeekAppointments = appointments.filter(a => {
  const aptDate = new Date(a.appointment_date);
  const today = new Date();
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
  const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 7));
  return aptDate >= weekStart && aptDate <= weekEnd;
}).length;
```

**Sorun:**
- `today.setDate()` **mutates** the `today` object
- Ikinci `today.setDate()` cagrisi yanlis sonuc veriyor cuenkue `today` zaten degisti
- weekEnd hesaplamasi yanlis

**Example Bug:**
```javascript
// Buguen: 15 Ocak 2026 (Persembe, getDay() = 4)
const today = new Date("2026-01-15");

// weekStart hesaplama: 15 - 4 + 1 = 12 Ocak (Pazartesi) ✓
const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
// today artik 12 Ocak!

// weekEnd hesaplama: 12 - 1 + 7 = 18 Ocak DEGIL!
// Cuenkue today.getDay() artik 1 (Pazartesi)
// 12 - 1 + 7 = 18 ama today zaten degismis!
const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 7));
// Sonuc: 18 Ocak olmasi gerekirken 18 degil, cuenkue hesaplama coktan bozulmus
```

**Coezuem:**
```typescript
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

const thisWeekAppointments = useMemo(() => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Pazartesi baslangic
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  return appointments.filter(a => {
    const aptDate = new Date(a.appointment_date);
    return isWithinInterval(aptDate, { start: weekStart, end: weekEnd });
  }).length;
}, [appointments]);
```

---

### 4. **Missing Error Boundary & Loading States**

```typescript
// Kalender.tsx:192-210
const fetchAppointments = useCallback(async () => {
  if (!companyId) return;
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      // ...
    if (error) throw error;
    setAppointments((data as Appointment[]) || []);
  } catch (e) {
    console.error("Error fetching appointments:", e);
    toast.error("Fehler beim Laden der Termine");
    // appointments hala eski state'te! ❌
  } finally {
    setLoading(false);
  }
}, [companyId]);
```

**Sorun:**
- Hata durumunda `appointments` state'i temizlenmiyor veya retry mekanizmasi yok
- Loading state sadece bir kez goesteriliyor
- Error boundary yok - bueyuek hata olursa tuem sayfa coeker

**Coezuem:**
```typescript
const [error, setError] = useState<Error | null>(null);
const [retryCount, setRetryCount] = useState(0);

const fetchAppointments = useCallback(async () => {
  if (!companyId) return;
  setLoading(true);
  setError(null);
  
  try {
    const { data, error } = await supabase.from("appointments").select("*")...
    if (error) throw error;
    setAppointments(data || []);
    setRetryCount(0);
  } catch (e) {
    setError(e as Error);
    console.error("Error fetching appointments:", e);
    
    // Auto-retry with exponential backoff
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchAppointments();
      }, 1000 * Math.pow(2, retryCount));
    }
  } finally {
    setLoading(false);
  }
}, [companyId, retryCount]);
```

---

## 🟠 YUeKSEK OeNCELIKLI SORUNLAR

### 5. **Time Validation Missing**

```typescript
// AppointmentModal.tsx:356-361
const handleSubmit = async () => {
  if (!companyId) return;
  if (!formData.title.trim()) {
    toast.error("Bitte geben Sie einen Titel ein");
    return;
  }
  // start_time < end_time kontrolue YOK! ❌
```

**Sorun:**
- `start_time: "14:00"`, `end_time: "10:00"` olabilir
- Negatif suere veya gece yarisini gecen randevu kontrolue yok

**Coezuem:**
```typescript
const handleSubmit = async () => {
  if (!formData.title.trim()) {
    toast.error("Bitte geben Sie einen Titel ein");
    return;
  }
  
  if (!formData.all_day) {
    if (formData.start_time >= formData.end_time) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }
    
    // Calculate duration
    const [startH, startM] = formData.start_time.split(":").map(Number);
    const [endH, endM] = formData.end_time.split(":").map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    if (durationMinutes < 15) {
      toast.error("Termin muss mindestens 15 Minuten dauern");
      return;
    }
    if (durationMinutes > 480) {
      toast.error("Termin darf maximal 8 Stunden dauern");
      return;
    }
  }
  // ...
};
```

---

### 6. **N+1 Query in AppointmentModal**

```typescript
// AppointmentModal.tsx:203-255
useEffect(() => {
  const loadResources = async () => {
    const [teamRes, resourceRes, leadsRes] = await Promise.all([
      supabase.from("team_members").select("...")...,
      supabase.from("firma_resources").select("...")...,
      supabase.from("lead_distributions").select(`lead_id, leads (...)`)...
    ]);
    // 3 ayri query
  };
  loadResources();
}, [isOpen, companyId]);
```

**Sorun:**
- Modal her acildiginda 3 query atiliyor
- Company degismeden bu datalar cache'lenebilir
- `acceptedLeads` icin 50 limit var ama pagination yok

**Coezuem:**
```typescript
// Custom hook ile cache'le
const useCalendarResources = (companyId: string | null) => {
  const [resources, setResources] = useState({ teamMembers: [], resources: [], acceptedLeads: [] });
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);
  
  const fetchResources = useCallback(async (force = false) => {
    if (!companyId) return;
    
    // Cache for 5 minutes
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 5 * 60 * 1000) return;
    
    setLoading(true);
    // ... fetch logic
    lastFetchRef.current = now;
    setLoading(false);
  }, [companyId]);
  
  return { ...resources, loading, refresh: () => fetchResources(true) };
};
```

---

### 7. **Memory Leak - Event Listeners**

```typescript
// Kalender.tsx:376-382
useEffect(() => {
  const handleClickOutside = () => setContextMenu(null);
  if (contextMenu) {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
}, [contextMenu]);
```

**Sorun:**
- `contextMenu` null oldugunda cleanup function doenmueyor
- Ancak bu cok bueyuek bir sorun degil cuenkue listener eklenmediginde cleanup'a gerek yok
- Asil sorun: Kalender unmount oldugunda fetchAppointments devam edebilir

```typescript
// Kalender.tsx:228-231
useEffect(() => {
  fetchAppointments();  // ← No cleanup!
  fetchTeamMembers();
}, [fetchAppointments, fetchTeamMembers]);
```

**Coezuem:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("appointments").select("*")...
      if (isMounted) setAppointments(data || []);
    } finally {
      if (isMounted) setLoading(false);
    }
  };
  
  fetchData();
  return () => { isMounted = false; };
}, [companyId]);
```

---

### 8. **Conflict Detection Race Condition**

```typescript
// AppointmentModal.tsx:269-295
useEffect(() => {
  const checkConflicts = async () => {
    if (!companyId || !formData.appointment_date) return;

    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("company_id", companyId)
      .eq("appointment_date", formData.appointment_date)
      .neq("status", "cancelled")
      .neq("id", appointment?.id || "00000000-0000-0000-0000-000000000000");
    // ...
  };
  checkConflicts();
}, [formData.appointment_date, formData.start_time, formData.end_time, companyId, appointment]);
```

**Sorun:**
- User hizlica tarih/saat degistirirse birden fazla query paralel calisir
- Hangi sonuc son olarak gelirse o goeruenuer (stale data riski)
- Debounce yok

**Coezuem:**
```typescript
// Debounce with AbortController
useEffect(() => {
  const controller = new AbortController();
  const timeoutId = setTimeout(async () => {
    if (!companyId || !formData.appointment_date) return;
    
    const { data } = await supabase
      .from("appointments")
      .select("*")
      // ...
      .abortSignal(controller.signal);
    
    if (!controller.signal.aborted) {
      // Process conflicts
    }
  }, 300); // 300ms debounce
  
  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [formData.appointment_date, formData.start_time, formData.end_time, companyId, appointment]);
```

---

## 🟡 ORTA OeNCELIKLI SORUNLAR

### 9. **Pagination Missing for Appointments**

```typescript
// Kalender.tsx:196-199
const { data, error } = await supabase
  .from("appointments")
  .select("*")
  .eq("company_id", companyId)
  .order("appointment_date", { ascending: true });
  // Tuem appointments cekiliyor! ❌
```

**Sorun:**
- 1000+ randevu olan sirket icin performans sorunu
- Mobile'da memory problemi

**Coezuem:**
```typescript
// Date range based fetching
const fetchAppointmentsForRange = useCallback(async (start: Date, end: Date) => {
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("company_id", companyId)
    .gte("appointment_date", format(start, "yyyy-MM-dd"))
    .lte("appointment_date", format(end, "yyyy-MM-dd"))
    .order("appointment_date", { ascending: true });
  // ...
}, [companyId]);

// View degistiginde fetch range'i degistir
useEffect(() => {
  let start, end;
  if (view === Views.MONTH) {
    start = startOfMonth(subMonths(currentDate, 1));
    end = endOfMonth(addMonths(currentDate, 1));
  } else if (view === Views.WEEK) {
    start = startOfWeek(currentDate);
    end = endOfWeek(currentDate);
  } else {
    start = startOfDay(currentDate);
    end = endOfDay(currentDate);
  }
  fetchAppointmentsForRange(start, end);
}, [currentDate, view]);
```

---

### 10. **Type Safety Issues**

```typescript
// AppointmentModal.tsx:250-252
const leads: AcceptedLead[] = leadsRes.data
  .filter(d => d.leads)
  .map(d => ({
    lead_id: d.lead_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(d.leads as any),  // ← Type safety bypass
  }));
```

**Sorun:**
- `as any` kullanimi type safety'yi bypass ediyor
- Runtime hatalari yakalanmayabilir

**Coezuem:**
```typescript
interface LeadDistributionWithLead {
  lead_id: string;
  leads: {
    customer_first_name: string | null;
    customer_last_name: string | null;
    // ... explicit types
  } | null;
}

const leads: AcceptedLead[] = (leadsRes.data as LeadDistributionWithLead[])
  .filter((d): d is LeadDistributionWithLead & { leads: NonNullable<LeadDistributionWithLead['leads']> } => 
    d.leads !== null
  )
  .map(d => ({
    lead_id: d.lead_id,
    ...d.leads,
  }));
```

---

### 11. **Recurring Appointments - Silent Failure**

```typescript
// AppointmentModal.tsx:415-434
if (formData.is_recurring && insertedAppointment?.id) {
  try {
    const { data: countResult, error: recurringError } = await (supabase as any)
      .rpc("generate_recurring_appointments", {...});
    
    if (recurringError) {
      console.error("Error generating recurring appointments:", recurringError);
      toast.warning("Termin erstellt, aber wiederkehrende Termine konnten nicht generiert werden");
    } else {
      toast.success(`Termin erstellt mit ${countResult || 0} Wiederholungen`);
    }
  } catch (recurringErr) {
    console.error("Error generating recurring appointments:", recurringErr);
    toast.success("Termin erstellt");  // ← Hata olsa bile success goesteriliyor!
  }
}
```

**Sorun:**
- RPC fonksiyonu yoksa `as any` ile cagriliyor
- Catch block'da hata olsa bile "success" goesteriliyor
- User recurring secti ama sadece bir tane olustu - karisiklik

**Coezuem:**
```typescript
if (formData.is_recurring && insertedAppointment?.id) {
  try {
    const { data: countResult, error: recurringError } = await supabase
      .rpc("generate_recurring_appointments", {...});
    
    if (recurringError) {
      // Specific error toast
      toast.warning(`Termin erstellt, aber Wiederholung fehlgeschlagen: ${recurringError.message}`);
      // Log to monitoring
      logError("recurring_appointment_failed", recurringError, { appointmentId: insertedAppointment.id });
    } else if (countResult === 0) {
      toast.info("Termin erstellt. Keine weiteren Wiederholungen im angegebenen Zeitraum.");
    } else {
      toast.success(`Termin erstellt mit ${countResult} Wiederholungen`);
    }
  } catch (recurringErr) {
    // RPC doesn't exist or other error
    toast.warning("Termin erstellt. Wiederkehrende Termine werden nicht unterstuetzt.");
  }
}
```

---

### 12. **Context Menu Position Edge Cases**

```typescript
// Kalender.tsx:1165-1190
{contextMenu && (
  <div
    className="fixed z-50 ..."
    style={{ left: contextMenu.x, top: contextMenu.y }}
  >
```

**Sorun:**
- Ekran kenarina yakinsa menu ekran disina tasabilir
- Mobile'da context menu zor kullanilir

**Coezuem:**
```typescript
const getMenuPosition = (x: number, y: number) => {
  const menuWidth = 180;
  const menuHeight = 80;
  
  return {
    left: Math.min(x, window.innerWidth - menuWidth - 10),
    top: Math.min(y, window.innerHeight - menuHeight - 10),
  };
};

// Usage
style={getMenuPosition(contextMenu.x, contextMenu.y)}
```

---

## 🟢 DUeSUeK OeNCELIKLI SORUNLAR

### 13. **Magic Strings for Status/Type**

```typescript
// Kalender.tsx:169-172
const [filters, setFilters] = useState({
  types: ["besichtigung", "service", "follow_up", "meeting", "blocked"],
  statuses: ["pending", "confirmed"],
```

**Coezuem:**
```typescript
const APPOINTMENT_TYPES = ["besichtigung", "service", "follow_up", "meeting", "blocked"] as const;
type AppointmentType = typeof APPOINTMENT_TYPES[number];

const DEFAULT_FILTERS = {
  types: [...APPOINTMENT_TYPES],
  statuses: ["pending", "confirmed"] as AppointmentStatus[],
  teamMemberIds: [] as string[],
};
```

---

### 14. **Accessibility Issues**

```typescript
// Kalender.tsx - context menu
<div
  className="fixed z-50 bg-white ..."
  style={{ left: contextMenu.x, top: contextMenu.y }}
>
  <button ...>Neuer Termin</button>
```

**Sorun:**
- Focus trap yok
- Escape ile kapatma yok
- Screen reader icin role/aria-label eksik

**Coezuem:**
```typescript
<div
  role="menu"
  aria-label="Kalender-Kontextmenue"
  className="..."
  onKeyDown={(e) => {
    if (e.key === 'Escape') setContextMenu(null);
  }}
>
  <button role="menuitem" ...>Neuer Termin</button>
</div>
```

---

### 15. **Console Logs in Production**

```typescript
// AppointmentModal.tsx:346
console.error("Error fetching lead data:", e);
// Bircok yerde console.error var
```

**Coezuem:**
- Centralized logging service kullan
- Production'da console.log'lari suppress et

---

## 📊 OeZET

| Sorun | Oencelik | Risk | Coezuem Zorlugu |
|-------|---------|------|---------------|
| Duplicate CalendarEvent Interface | 🔴 Kritik | Type confusion | Kolay |
| Drag & Drop Race Condition | 🔴 Kritik | Data inconsistency | Orta |
| Week Calculation Bug | 🔴 Kritik | Wrong stats | Kolay |
| Missing Error Boundary | 🔴 Kritik | App crash | Orta |
| Time Validation Missing | 🟠 Yueksek | Invalid data | Kolay |
| N+1 Query | 🟠 Yueksek | Performans | Orta |
| Memory Leak | 🟠 Yueksek | Performans | Kolay |
| Conflict Detection Race | 🟠 Yueksek | Stale data | Orta |
| No Pagination | 🟡 Orta | Performans | Orta |
| Type Safety | 🟡 Orta | Runtime errors | Orta |
| Recurring Silent Failure | 🟡 Orta | UX confusion | Kolay |
| Context Menu Position | 🟡 Orta | UX | Kolay |

---

## 🎯 OeNCELIKLI DUeZELTMELER

### Hemen Yapilmali (1-2 saat):
1. ✅ Week calculation bug'i duezelt
2. ✅ Duplicate CalendarEvent interface'i kaldir
3. ✅ Time validation ekle

### Bu Hafta:
4. Drag & drop optimistic update + rollback
5. Memory leak'leri duezelt
6. Conflict detection debounce

### Gelecek Sprint:
7. Date range based pagination
8. Error boundary ekle
9. Resource caching
10. Accessibility iyilestirmeleri
