# Code Review: Offerten (Teklif) Sistemi

**Tarih:** 2026-01-25
**Incelenen Dosyalar:**
- `src/pages/firma/Offerten.tsx`
- `src/pages/firma/OfferteErstellen.tsx`
- `supabase/functions/send-offer/index.ts`

---

## 🔴 KRITIK SORUNLAR

### 1. **Session Token Logging - Guevenlik Acigi**

```typescript
// Offerten.tsx:172-173
console.log('Token being sent (first 50 chars):', fallbackSession.access_token.substring(0, 50));
console.log('Offer ID:', offerId);

// Offerten.tsx:205-206
console.log('Token being sent (first 50 chars):', session.access_token.substring(0, 50));
```

**Sorun:**
- Token'larin ilk 50 karakteri loglara yaziliyor
- Production'da bu log'lar toplaniyor olabilir
- JWT token yapisi tahmin edilebilir hale geliyor
- **GDPR/guevenlik ihlali potansiyeli**

**Coezuem:**
```typescript
// Token'i ASLA loglama
console.log('Sending offer with valid session', { 
  offerId,
  hasToken: !!session?.access_token 
});
```

---

### 2. **Duplicate Code - DRY Ihlali**

```typescript
// Offerten.tsx:144-247 - handleResendOffer
// Iki ayri yerde (refreshed ve fallback) ayni kod tekrarlaniyor
```

**Sorun:**
- ~100 satir kod iki kez yazilmis
- Bir yerde duezeltme yapilirsa digeri unutulabilir
- Bakim zorlugu

**Coezuem:**
```typescript
const handleResendOffer = async (offerId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setIsResending(offerId);
  
  try {
    const session = await getValidSession(); // Helper function
    if (!session) {
      toast({ title: "Sitzung abgelaufen", variant: "destructive" });
      return;
    }
    
    const { data, error } = await supabase.functions.invoke("send-offer", {
      body: { offerId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    
    if (error || data?.error) throw new Error(data?.error || error.message);
    
    toast({ title: "E-Mail gesendet" });
    await refreshOffer(offerId);
  } catch (error) {
    toast({ title: "Fehler", variant: "destructive" });
  } finally {
    setIsResending(null);
  }
};
```

---

### 3. **Race Condition - Offer Save + Send**

```typescript
// OfferteErstellen.tsx:806-807
status: sendAfterSave ? "sent" : "draft",
sent_at: sendAfterSave ? new Date().toISOString() : null,
```

**Sorun:**
- Offer "sent" olarak kaydediliyor
- Sonra send-offer cagriliyor
- **Eger send-offer basarisiz olursa, offer "sent" olarak kaliyor ama email goenderilmemis**

**Patlama Senaryosu:**
```
1. Offer kaydedildi (status: "sent", sent_at: now)
2. send-offer cagrildi → Resend API hatasi
3. Toast: "Email goenderilemedi"
4. Ama offer hala "sent" durumunda! 💥
5. Muesteri email bekliyor ama almadi
```

**Coezuem:**
```typescript
// Ilk oence draft olarak kaydet
const coreOfferData = {
  ...
  status: "draft", // Her zaman draft olarak basla
  sent_at: null,
};

// Kaydet
const offer = await saveOffer(coreOfferData);

// Sonra email goender
if (sendAfterSave) {
  const { error } = await sendOfferEmail(offer.id);
  
  if (!error) {
    // Sadece basarili olursa guencelle
    await supabase
      .from("offers")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", offer.id);
  }
}
```

---

### 4. **Error Recovery Eksik - Partial Save**

```typescript
// OfferteErstellen.tsx:875-879
const { error: itemsError } = await supabase
  .from("offer_items")
  .insert(itemsToInsert);

if (itemsError) throw itemsError;
```

**Sorun:**
- Offer kaydedildi ama items kaydedilemedi
- Error throw edildi
- **Orphan offer kaldi (items olmadan)**

**Patlama Senaryosu:**
```
1. Offer INSERT → Basarili (id: 123)
2. offer_items INSERT → Hata (network timeout)
3. throw error → Catch block'a git
4. Toast: "Fehler"
5. Ama offers tablosunda id: 123 var! (itemsiz) 💥
```

**Coezuem:**
```typescript
// Transaction kullan
const { data: offer, error: offerError } = await supabase.rpc('create_offer_with_items', {
  offer_data: coreOfferData,
  items_data: itemsToInsert,
});

// VEYA cleanup ekle
try {
  const { data: offer } = await supabase.from("offers").insert(...).select().single();
  
  try {
    await supabase.from("offer_items").insert(itemsToInsert);
  } catch (itemsError) {
    // Rollback: offer'i sil
    await supabase.from("offers").delete().eq("id", offer.id);
    throw itemsError;
  }
} catch (error) {
  // Handle
}
```

---

## 🟠 YUeKSEK OeNCELIKLI SORUNLAR

### 5. **VAT Hesaplama Mantik Hatasi**

```typescript
// OfferteErstellen.tsx:732-741
const calculateVat = () => {
  if (!mwstEnabled) return 0;
  const taxableTotal = items.reduce((sum, item) => {
    if (item.mwstIncluded && item.priceType !== "inkl") {
      const itemTotal = item.priceType === "per_unit" 
        ? item.quantity * item.unit_price 
        : item.unit_price;  // ← "pauschale" icin quantity yok sayiliyor!
      return sum + itemTotal;
    }
    return sum;
  }, 0);
  return taxableTotal * (vatRate / 100);
};
```

**Sorun:**
- `priceType === "pauschale"` icin `quantity * unit_price` olmali
- Su an sadece `unit_price` aliniyor

**Example:**
```
Item: 3x Karton kutu @ CHF 10 (pauschale)
Beklenen: 3 * 10 = CHF 30
Gercek: 10 (sadece unit_price)
```

**Coezuem:**
```typescript
const calculateVat = () => {
  if (!mwstEnabled) return 0;
  const taxableTotal = items.reduce((sum, item) => {
    if (item.mwstIncluded && item.priceType !== "inkl" && item.priceType !== "optional") {
      return sum + (item.quantity * item.unit_price);
    }
    return sum;
  }, 0);
  return taxableTotal * (vatRate / 100);
};
```

---

### 6. **State Sync Problemi - Concurrent Updates**

```typescript
// Offerten.tsx:199
setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));
```

**Sorun:**
- Multiple concurrent updates olabilir
- State closure eski degerleri tutabilir
- Optimistic update yok

**Patlama Senaryosu:**
```
User: Offer 1'e "Resend" tikladi
User: Hemen Offer 2'ye de "Resend" tikladi
→ Her iki request ayni anda gidiyor
→ State update'ler cakisabilir
```

**Coezuem:**
```typescript
// Optimistic update + error rollback
const handleResendOffer = async (offerId: string) => {
  const originalOffers = [...offers];
  
  // Optimistic: loading state goester
  setOffers(prev => prev.map(o => 
    o.id === offerId ? { ...o, _sending: true } : o
  ));
  
  try {
    await sendOffer(offerId);
    // Refresh from server
    const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
    setOffers(prev => prev.map(o => o.id === offerId ? data : o));
  } catch {
    // Rollback
    setOffers(originalOffers);
  }
};
```

---

### 7. **Type Safety Eksik - Any Types**

```typescript
// OfferteErstellen.tsx:673
const updateItem = useCallback((index: number, field: keyof OfferItem, value: unknown) => {
  //                                                                    ↑ unknown tip
```

**Sorun:**
- `value` tipi `unknown` - runtime hatasi riski
- Field ile value arasinda type baglantisi yok

**Coezuem:**
```typescript
type OfferItemUpdater<K extends keyof OfferItem> = {
  field: K;
  value: OfferItem[K];
};

const updateItem = useCallback(<K extends keyof OfferItem>(
  index: number, 
  field: K, 
  value: OfferItem[K]
) => {
  setItems((prev) => {
    const newItems = [...prev];
    newItems[index] = { ...newItems[index], [field]: value };
    return newItems;
  });
}, []);
```

---

### 8. **N+1 Query Problem**

```typescript
// Offerten.tsx:300-316
const leadIds = (offersData || []).map((o: Offer) => o.lead_id).filter(Boolean);
if (leadIds.length > 0) {
  const { data: leadsData } = await supabase
    .from("leads")
    .select("...")
    .in("id", leadIds);
```

**Sorun:**
- Oence offers cekiliyor
- Sonra leads ayri query ile cekiliyor
- Sonra email_logs ayri query ile cekiliyor
- **4 ayri query** (offers, leads, email_logs, checklist_templates)

**Coezuem:**
```typescript
// Tek query ile join
const { data: offersData } = await supabase
  .from("offers")
  .select(`
    *,
    lead:leads!inner(id, service_type, from_city, from_plz, to_city, to_plz, ...),
    email_logs(metadata)
  `)
  .eq("company_id", company.id)
  .order("created_at", { ascending: false });
```

---

## 🟡 ORTA OeNCELIKLI SORUNLAR

### 9. **Pagination Yok**

```typescript
// Offerten.tsx:263-267
const { data: offersData } = await supabase
  .from("offers")
  .select("*")
  .eq("company_id", company.id)
  .order("created_at", { ascending: false });
```

**Sorun:**
- Tuem offers cekiliyor
- 1000+ offer olursa performans sorunu
- Memory problemi

**Coezuem:**
```typescript
const PAGE_SIZE = 20;
const [page, setPage] = useState(0);

const { data, count } = await supabase
  .from("offers")
  .select("*", { count: "exact" })
  .eq("company_id", company.id)
  .order("created_at", { ascending: false })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

---

### 10. **Input Validation Eksik**

```typescript
// OfferteErstellen.tsx:757-783
const handleSave = async () => {
  if (!title.trim()) { ... }
  if (items.length === 0) { ... }
  if (items.some((item) => !item.description.trim())) { ... }
```

**Eksik Validasyonlar:**
- Email format kontrolue yok
- Negatif fiyat kontrolue yok
- Maximum length kontrolue yok
- XSS sanitization yok

**Coezuem:**
```typescript
const validateOffer = (): string | null => {
  if (!title.trim() || title.length > 200) return "Titel ungueltig";
  if (!lead.customer_email?.match(EMAIL_REGEX)) return "Email ungueltig";
  if (items.length === 0) return "Keine Positionen";
  if (items.some(i => i.unit_price < 0)) return "Negative Preise";
  if (calculateTotal() > 1000000) return "Betrag zu hoch";
  return null;
};
```

---

### 11. **Memory Leak - useEffect Cleanup**

```typescript
// Offerten.tsx:249-351
useEffect(() => {
  const fetchOffers = async () => {
    // ...async operations
    setOffers(offersData || []);
  };
  fetchOffers();
}, [user]);
```

**Sorun:**
- Component unmount olursa async operation devam eder
- `setOffers` cagrilir ama component yok
- Memory leak

**Coezuem:**
```typescript
useEffect(() => {
  let isCancelled = false;
  
  const fetchOffers = async () => {
    const data = await fetch...;
    if (!isCancelled) {
      setOffers(data);
    }
  };
  
  fetchOffers();
  
  return () => {
    isCancelled = true;
  };
}, [user]);

// VEYA AbortController kullan
useEffect(() => {
  const controller = new AbortController();
  
  supabase.from("offers")
    .select("*")
    .abortSignal(controller.signal)
    .then(({ data }) => setOffers(data));
  
  return () => controller.abort();
}, [user]);
```

---

### 12. **Error Boundary Eksik**

**Sorun:**
- Component icinde hata olursa tuem sayfa coeker
- User hicbir sey yapamaz

**Coezuem:**
```typescript
// OfferteErrorBoundary.tsx
class OfferteErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2>Etwas ist schief gelaufen</h2>
          <Button onClick={() => window.location.reload()}>
            Seite neu laden
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 🟢 DUeSUeK OeNCELIKLI SORUNLAR

### 13. **Magic Numbers**

```typescript
// OfferteErstellen.tsx:329-331
const validDate = new Date();
validDate.setDate(validDate.getDate() + 30); // ← 30 guen magic number
```

**Coezuem:**
```typescript
const DEFAULT_OFFER_VALIDITY_DAYS = 30;
// veya company settings'den al
```

---

### 14. **Hardcoded Strings**

```typescript
// OfferteErstellen.tsx:191
const [paymentTerms, setPaymentTerms] = useState("Barzahlung nach der Ausfuehrung");
```

**Coezuem:**
- i18n kullan veya constants dosyasina tasi

---

### 15. **Console.log Statements**

```typescript
// OfferteErstellen.tsx:839
console.log("Enhanced offer columns not available, using core fields only");
```

**Coezuem:**
- Production'da console.log'lari kaldir veya logging service kullan

---

## 📊 OeZET

| Sorun | Oencelik | Risk | Coezuem Zorlugu |
|-------|---------|------|---------------|
| Token Logging | 🔴 Kritik | Guevenlik | Kolay |
| Duplicate Code | 🔴 Kritik | Bakim | Orta |
| Race Condition (Save+Send) | 🔴 Kritik | Veri buetuenluegue | Orta |
| Partial Save Rollback | 🔴 Kritik | Veri buetuenluegue | Zor |
| VAT Hesaplama Hatasi | 🟠 Yueksek | Finansal | Kolay |
| State Sync | 🟠 Yueksek | UX | Orta |
| Type Safety | 🟠 Yueksek | Runtime hata | Orta |
| N+1 Query | 🟠 Yueksek | Performans | Kolay |
| Pagination | 🟡 Orta | Performans | Orta |
| Input Validation | 🟡 Orta | Guevenlik | Orta |
| Memory Leak | 🟡 Orta | Performans | Kolay |
| Error Boundary | 🟡 Orta | UX | Kolay |

---

## 🎯 OeNCELIKLI DUeZELTMELER

### Hemen Yapilmali (1-2 saat):
1. ✅ Token logging'i kaldir
2. ✅ VAT hesaplama hatasini duezelt
3. ✅ Duplicate code'u refactor et

### Bu Hafta:
4. Race condition (save + send) duezelt
5. Partial save rollback ekle
6. Memory leak'leri duezelt

### Gelecek Sprint:
7. N+1 query optimize et
8. Pagination ekle
9. Error boundary ekle
10. Type safety iyilestir
