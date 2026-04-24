# Code Review: Anfrage Import (Manual Lead Import) Module

**Review Date:** 2026-01-15  
**Files Reviewed:**
- `src/pages/firma/ManualImport.tsx`
- `src/pages/admin/ManualImportSubscriptions.tsx`
- `supabase/functions/extract-anfrage-ai/index.ts`
- `supabase/functions/import-manual-lead/index.ts`

---

## Critical Issues (Must Fix)

### 1. RPC Increment Syntax Error
**File:** `import-manual-lead/index.ts` (lines 228-232)  
**Issue:** Invalid RPC usage in update statement - this won't work.

```typescript
// WRONG - This doesn't work!
await supabase
  .from("manual_import_subscriptions")
  .update({ total_imports_count: supabase.rpc("increment") })
  .eq("company_id", company_id)
  .eq("status", "active");
```

**Risk:** Import count is never updated, billing/tracking is broken.

**Fix:** Use a proper RPC or raw SQL:
```typescript
// Option 1: Use SQL function
await supabase.rpc('increment_import_count', { p_company_id: company_id });

// Option 2: Fetch, increment, update
const { data: sub } = await supabase
  .from("manual_import_subscriptions")
  .select("total_imports_count")
  .eq("company_id", company_id)
  .eq("status", "active")
  .single();

if (sub) {
  await supabase
    .from("manual_import_subscriptions")
    .update({ total_imports_count: (sub.total_imports_count || 0) + 1 })
    .eq("company_id", company_id)
    .eq("status", "active");
}
```

---

### 2. No Rate Limiting on AI Extraction
**File:** `extract-anfrage-ai/index.ts`  
**Issue:** No rate limiting on the Claude API call.

**Risk:** 
- Malicious user could exhaust Anthropic API budget
- DDoS potential
- Company could spam extract requests without limit

**Fix:** Add rate limiting:
```typescript
// Add rate limit check at the start
const RATE_LIMIT = 10; // per minute per company
const rateLimitKey = `extract_ai:${company_id}`;

const { count } = await supabase
  .from("rate_limits")
  .select("count")
  .eq("key", rateLimitKey)
  .gte("created_at", new Date(Date.now() - 60000).toISOString())
  .single();

if (count && count >= RATE_LIMIT) {
  return new Response(
    JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie eine Minute." }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

### 3. Memory Leak - Missing useEffect Cleanup
**File:** `ManualImport.tsx` (lines 178-203)  
**Issue:** No cleanup for async operation in useEffect.

```typescript
useEffect(() => {
  const fetchCompany = async () => {
    // async operation with no cleanup
  };
  fetchCompany();
}, [user]);
```

**Risk:** Memory leak if component unmounts during fetch.

**Fix:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const fetchCompany = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const companyData = await fetchSingleCompanyForUser<Company>({...});
      if (isMounted && companyData) {
        setCompany(companyData);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      if (isMounted) setIsLoading(false);
    }
  };

  fetchCompany();
  return () => { isMounted = false; };
}, [user]);
```

---

### 4. Missing Input Validation
**File:** `ManualImport.tsx`  
**Issue:** No validation before saving:
- Email format not validated
- Phone format not validated
- Swiss PLZ should be 4 digits

**Risk:** Invalid data saved to database, bad customer experience.

**Fix:** Add validation in `saveAndCreateOfferte`:
```typescript
const saveAndCreateOfferte = async () => {
  if (!extractedData || !company || !user) return;

  // Validate email
  if (extractedData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedData.email)) {
    toast({ title: "Fehler", description: "Ungueltige E-Mail-Addressse", variant: "destructive" });
    return;
  }

  // Validate Swiss PLZ (4 digits)
  const plzFields = ['from_plz', 'to_plz', 'address_plz', 'pickup_plz'];
  for (const field of plzFields) {
    const value = extractedData[field as keyof ExtractedData];
    if (value && typeof value === 'string' && !/^\d{4}$/.test(value)) {
      toast({ title: "Fehler", description: `Ungueltige PLZ: ${value}`, variant: "destructive" });
      return;
    }
  }

  // Continue with save...
};
```

---

### 5. AI Prompt Injection Risk
**File:** `extract-anfrage-ai/index.ts` (line 205)  
**Issue:** Raw user text is passed directly to Claude without sanitization.

```typescript
const prompt = createExtractLeadPrompt(raw_text);
```

**Risk:** User could inject malicious prompts to manipulate AI output.

**Mitigation:**
1. Add input sanitization
2. Limit input length
3. Add system prompt to ignore instruction-like content

```typescript
// Add at the start of handler
if (raw_text.length > 10000) {
  return new Response(
    JSON.stringify({ error: "Text zu lang (max. 10000 Zeichen)" }),
    { status: 400, headers: {...} }
  );
}

// Sanitize the text
const sanitizedText = raw_text
  .replace(/\[INST\]/gi, '')
  .replace(/\[\/INST\]/gi, '')
  .replace(/<\|.*?\|>/g, '');
```

---

## High Priority Issues

### 6. Double Submit Vulnerability
**File:** `ManualImport.tsx`  
**Issue:** User can click "Generieren" or "Speichern" multiple times.

```typescript
<Button
  onClick={processWithAI}
  disabled={!rawText.trim() || isProcessing}
>
```

The button IS disabled during processing, which is good. But there's no debounce for rapid clicks before state updates.

**Recommendation:** Add debounce or use a ref to track pending state:
```typescript
const isPendingRef = useRef(false);

const processWithAI = async () => {
  if (isPendingRef.current) return;
  isPendingRef.current = true;
  setIsProcessing(true);
  try {
    // ... processing
  } finally {
    setIsProcessing(false);
    isPendingRef.current = false;
  }
};
```

---

### 7. Missing fetchCompanies in Dependency Array
**File:** `ManualImportSubscriptions.tsx` (lines 169-171)  
**Issue:** `fetchCompanies` is defined with useCallback implicitly but called without ESLint warning suppression.

```typescript
useEffect(() => {
  fetchCompanies();
}, []); // fetchCompanies not in dependency array
```

**Risk:** Stale closures, potential bugs.

**Fix:** Use useCallback and add to dependency array:
```typescript
const fetchCompanies = useCallback(async () => {
  // ... fetch logic
}, [toast]); // Only toast is a stable dependency

useEffect(() => {
  fetchCompanies();
}, [fetchCompanies]);
```

---

### 8. Error Not Shown for Low Confidence
**File:** `ManualImport.tsx` (lines 1669-1676)  
**Issue:** Warning is shown but user can still proceed with low confidence data.

```typescript
{extractedData.confidence_score < 80 && (
  <Alert className="mt-4 bg-amber-50 border-amber-200">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <AlertDescription className="text-amber-800">
      Bitte ueberpruefen Sie die extrahierten Daten sorgfältig.
    </AlertDescription>
  </Alert>
)}
```

**Recommendation:** For very low confidence (< 50%), require explicit confirmation:
```typescript
const [confirmLowConfidence, setConfirmLowConfidence] = useState(false);

// In saveAndCreateOfferte:
if (extractedData.confidence_score < 50 && !confirmLowConfidence) {
  toast({
    title: "Niedrige Konfidenz",
    description: "Die AI ist sich nicht sicher. Bitte bestätigen Sie, dass Sie fortfahren moechten.",
    variant: "destructive"
  });
  setConfirmLowConfidence(true);
  return;
}
```

---

### 9. Console Logs in Production
**Files:** All reviewed files  
**Issue:** Multiple `console.log` and `console.error` statements.

```typescript
console.log("Function response:", response);
console.error("Error processing with AI:", error);
```

**Risk:** Information leakage, performance impact.

---

## Medium Priority Issues

### 10. Duplicate Interface Definitions
**Files:** `ManualImport.tsx` and `extract-anfrage-ai/index.ts`  
**Issue:** `ExtractedData` interface is duplicated with slight differences.

**Risk:** Type mismatches, maintenance burden.

**Fix:** Create shared types file:
```typescript
// supabase/functions/_shared/types.ts
export interface BaseExtractedData {
  detected_service_type: string;
  first_name: string | null;
  // ...
}
```

---

### 11. Magic Numbers
**Files:** Multiple  
**Issue:** Default monthly fee (20 tokens) hardcoded in multiple places.

```typescript
// ManualImportSubscriptions.tsx
<p className="text-muted-foreground">
  Premium-Funktion fuer Firmen (20 Tokens/Monat)
</p>

// ManualImport.tsx
<p className="text-4xl font-bold text-amber-600">{company?.manual_import_monthly_fee || 20}</p>
```

**Fix:** Use constants:
```typescript
const DEFAULT_MONTHLY_FEE = 20;
```

---

### 12. No Pagination in Admin View
**File:** `ManualImportSubscriptions.tsx`  
**Issue:** All companies fetched without pagination.

**Risk:** Performance issues with many companies.

---

### 13. Type Coercion
**File:** `ManualImportSubscriptions.tsx` (line 406)  
**Issue:** Using `Number()` suggests type uncertainty.

```typescript
{Number(company.token_balance).toLocaleString("de-CH")}
```

**Risk:** NaN display if token_balance is invalid.

**Fix:** Add proper type handling:
```typescript
{(company.token_balance ?? 0).toLocaleString("de-CH")}
```

---

### 14. Fallback Email Address
**File:** `import-manual-lead/index.ts` (line 58)  
**Issue:** Hardcoded fallback email.

```typescript
customer_email: lead_data.customer_email || "import@offerio.ch",
```

**Risk:** 
- Leads with no email use same address
- Could send emails to wrong place
- Data quality issue

**Fix:** Make email required or use null:
```typescript
customer_email: lead_data.customer_email || null,
```

---

### 15. Accessibility Issues
**File:** `ManualImport.tsx`  
**Issues:**
- Textarea has no aria-label
- Progress bar lacks aria-valuenow
- Form lacks proper form element wrapper

---

## Edge Function Specific Issues

### 16. No Input Length Limit
**File:** `extract-anfrage-ai/index.ts`  
**Issue:** No limit on raw_text length.

**Risk:** 
- Large texts could timeout
- Expensive API calls
- Memory issues

**Fix:**
```typescript
if (raw_text.length > 15000) {
  return new Response(
    JSON.stringify({ error: "Text zu lang (max. 15000 Zeichen)" }),
    { status: 400, headers: {...} }
  );
}
```

---

### 17. Claude Model Hardcoded
**File:** `extract-anfrage-ai/index.ts` (line 216)  
**Issue:** Model version hardcoded.

```typescript
model: "claude-3-haiku-20240307",
```

**Recommendation:** Use environment variable:
```typescript
model: Deno.env.get("CLAUDE_MODEL") || "claude-3-haiku-20240307",
```

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| Critical | 5 | Needs immediate fix |
| High | 4 | Should fix soon |
| Medium | 8 | Can address in next sprint |

### Recommended Fix Order:
1. **RPC Increment Bug** (Critical - broken feature)
2. **Rate Limiting** (Critical - cost/security)
3. **Memory Leak** (Critical - stability)
4. **Input Validation** (Critical - data integrity)
5. **AI Prompt Injection** (Critical - security)
6. **Double Submit** (High - UX)

### Positive Observations:
- Good separation of concerns (AI extraction vs import)
- Company permission check before processing
- Comprehensive service type handling
- Clean UI with progress indicators
- Email logging in import function
- Admin subscription management well designed
