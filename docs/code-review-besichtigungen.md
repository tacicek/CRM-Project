# Code Review: Besichtigungen (Site Visits) Module

**Review Date:** 2026-01-15  
**Files Reviewed:**
- `src/pages/firma/Besichtigungen.tsx`
- `src/components/firma/AcceptBesichtigungDialog.tsx`
- `src/pages/public/BesichtigungProposalResponse.tsx`
- `supabase/functions/confirm-besichtigung/index.ts`
- `supabase/functions/handle-proposal-response/index.ts`

---

## Critical Issues (Must Fix)

### 1. Type Mismatch - editingAppointment State
**File:** `Besichtigungen.tsx` (lines 630-638)  
**Issue:** When clicking "Termin bearbeiten" for a pending request, a `BesichtigungRequest` is passed to `setEditingAppointment`, but the state expects `ConfirmedBesichtigung`.

```typescript
// WRONG - Type mismatch!
<Button 
  onClick={() => {
    setEditingAppointment(request);  // BesichtigungRequest
    setIsEditModalOpen(true);
  }}
>
```

**Risk:** Runtime crash when AppointmentModal tries to access properties that don't exist on `BesichtigungRequest`.

**Fix:** Create a transformation function or separate state for pending request edits:
```typescript
const handleEditPendingRequest = (request: BesichtigungRequest) => {
  // Transform to ConfirmedBesichtigung format
  const transformed: ConfirmedBesichtigung = {
    id: request.offer_id,
    appointment_date: request.besichtigung_date,
    start_time: request.besichtigung_time || "09:00",
    end_time: "10:00",
    title: request.title,
    status: "pending",
    customer_first_name: request.customer_name.split(" ")[0] || "",
    customer_last_name: request.customer_name.split(" ").slice(1).join(" ") || "",
    customer_email: request.customer_email,
    customer_phone: request.customer_phone,
    // ... other fields
  };
  setEditingAppointment(transformed);
  setIsEditModalOpen(true);
};
```

---

### 2. Duplicate Appointment Creation
**Files:** `AcceptBesichtigungDialog.tsx` (line 226) & `confirm-besichtigung/index.ts` (line 223)  
**Issue:** Both create appointments - the dialog creates an appointment AND calls the Edge Function which also creates one.

```typescript
// AcceptBesichtigungDialog.tsx - creates appointment
const { error: aptError } = await supabase.from("appointments").insert({...});

// Then calls Edge Function
const { error: emailError } = await supabase.functions.invoke("confirm-besichtigung", {...});

// confirm-besichtigung/index.ts - ALSO creates appointment!
const { error: appointmentError } = await supabase
  .from("appointments")
  .insert({...});
```

**Risk:** Duplicate appointments in the calendar.

**Fix:** Either:
- Remove appointment creation from `AcceptBesichtigungDialog.tsx` and let Edge Function handle it, OR
- Add a flag to Edge Function to skip appointment creation when called from dialog

---

### 3. Race Condition - Conflict Check vs Submit
**File:** `AcceptBesichtigungDialog.tsx` (lines 123-159, 214-269)  
**Issue:** Conflict checking has a 300ms debounce, but user can click "Termin bestätigen" before debounce completes.

```typescript
// Conflict check uses debounce
useEffect(() => {
  const debounceTimer = setTimeout(checkConflicts, 300);
  return () => clearTimeout(debounceTimer);
}, [...]);

// Submit doesn't wait for conflict check!
const handleAccept = async () => {
  if (conflicts.length > 0) {...} // May be stale!
```

**Risk:** User could create overlapping appointments if they click quickly.

**Fix:**
```typescript
const handleAccept = async () => {
  // Force immediate conflict check
  setCheckingConflicts(true);
  const hasConflicts = await checkConflictsImmediate();
  if (hasConflicts) {
    toast.error("Es gibt Terminkonflikte");
    return;
  }
  // proceed with booking...
};
```

---

### 4. Memory Leak - useCallback fetchData
**File:** `Besichtigungen.tsx` (lines 124-212, 214-216)  
**Issue:** No cleanup for async operations in useEffect.

```typescript
const fetchData = useCallback(async () => {
  // async operations without cleanup
}, [companyId]);

useEffect(() => {
  fetchData();  // No cleanup!
}, [fetchData]);
```

**Risk:** Memory leak if component unmounts during fetch.

**Fix:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // ... fetch logic
      if (isMounted) {
        setPendingRequests(pendingFromNotifications);
        // ... other state updates
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  };
  
  loadData();
  return () => { isMounted = false; };
}, [companyId]);
```

---

### 5. Token Security - Public Page
**File:** `BesichtigungProposalResponse.tsx` (lines 44-82)  
**Issue:** Token is parsed from URL but all validation happens on submit. Malicious user could modify URL params.

```typescript
const parseProposalData = () => {
  // Just parses - no server-side validation
  const proposalsParam = searchParams.get("proposals");
  const proposals = JSON.parse(decodeURIComponent(proposalsParam));
  // ... no token validation until submit
};
```

**Risk:** 
- Modified `proposals` array could allow booking at unauthorized times
- XSS via malicious `customerName` or `address` params

**Mitigation in Edge Function:** The `handle-proposal-response` function DOES validate the token (line 98), which is good. But client-side could still be exploited for display purposes.

**Recommendation:** Add sanitization for displayed values:
```typescript
import DOMPurify from 'dompurify';
// ...
companyName: DOMPurify.sanitize(decodeURIComponent(companyName)),
```

---

## High Priority Issues

### 6. Missing Time Validation
**File:** `AcceptBesichtigungDialog.tsx`  
**Issue:** No validation that `acceptEndTime` is after `acceptStartTime`.

```typescript
// No validation
setAcceptEndTime(e.target.value);
```

**Risk:** Invalid appointments (e.g., 15:00 - 10:00).

**Fix:**
```typescript
const validateTimes = () => {
  if (acceptStartTime >= acceptEndTime) {
    toast.error("Endzeit muss nach Startzeit liegen");
    return false;
  }
  return true;
};

const handleAccept = async () => {
  if (!validateTimes()) return;
  // ...
};
```

---

### 7. No Search Debounce
**File:** `Besichtigungen.tsx` (lines 473-478)  
**Issue:** Search triggers on every keystroke.

```typescript
<Input
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)} // No debounce
/>
```

**Risk:** Excessive re-renders with large lists.

**Fix:** Use debounced search with `useDeferredValue` or custom debounce.

---

### 8. Edge Functions - No Rate Limiting
**Files:** `confirm-besichtigung/index.ts`, `handle-proposal-response/index.ts`  
**Issue:** No protection against abuse.

**Risk:** 
- Email spam if someone repeatedly triggers
- Resource exhaustion

**Fix:** Add rate limiting similar to other Edge Functions.

---

### 9. Duplicate Code - getDialogRequest
**File:** `Besichtigungen.tsx` (lines 218-231, 234-245)  
**Issue:** `handleAcceptClick` and `getDialogRequest` duplicate the same transformation logic.

```typescript
const handleAcceptClick = (request: BesichtigungRequest) => {
  const dialogRequest = { // Transformation here
    id: request.offer_id,
    // ... duplicate logic
  };
  // ...
};

const getDialogRequest = (request: BesichtigungRequest | null) => {
  // SAME transformation logic duplicated!
  return {
    id: request.offer_id,
    // ...
  };
};
```

**Fix:** Use single transformation function:
```typescript
const transformToBesichtigungDialogRequest = (request: BesichtigungRequest) => ({
  id: request.offer_id,
  title: request.title,
  // ...
});
```

---

### 10. JSON.parse Without Try-Catch in URL Parsing
**File:** `BesichtigungProposalResponse.tsx` (line 66)  
**Issue:** `JSON.parse` can throw if proposals param is malformed.

```typescript
const proposals = JSON.parse(decodeURIComponent(proposalsParam)); // Can throw!
```

Already in try-catch at higher level, but error message is generic.

**Fix:** More specific error handling:
```typescript
let proposals;
try {
  proposals = JSON.parse(decodeURIComponent(proposalsParam));
} catch (parseError) {
  setError("Die Terminvorschläge konnten nicht geladen werden. Bitte verwenden Sie den Link erneut.");
  setLoading(false);
  return;
}
```

---

## Medium Priority Issues

### 11. No Pagination
**File:** `Besichtigungen.tsx`  
**Issue:** All appointments fetched without pagination.

**Risk:** Performance issues with many appointments.

---

### 12. Console Logs in Production
**Files:** All reviewed files  
**Issue:** Multiple `console.log` and `console.error` statements.

---

### 13. Magic Strings
**File:** Multiple files  
**Issues:**
- `"besichtigung"` repeated as appointment type
- Status strings like `"confirmed"`, `"pending"`, `"cancelled"`

**Fix:** Create constants:
```typescript
export const APPOINTMENT_TYPES = {
  BESICHTIGUNG: "besichtigung",
  UMZUG: "umzug",
  // ...
} as const;
```

---

### 14. Customer Name Parsing is Fragile
**Files:** `AcceptBesichtigungDialog.tsx`, `Besichtigungen.tsx`, `handle-proposal-response/index.ts`  
**Issue:** Name splitting by space is unreliable for complex names.

```typescript
customer_first_name: request.customer_name.split(" ")[0] || "",
customer_last_name: request.customer_name.split(" ").slice(1).join(" ") || "",
```

**Risk:** Names like "Hans Peter Mueller" → first: "Hans", last: "Peter Mueller" (may not be correct)

**Recommendation:** Store `customer_first_name` and `customer_last_name` separately from the source.

---

### 15. Accessibility Issues
**File:** `Besichtigungen.tsx`  
**Issues:**
- Clickable stat cards (lines 429-463) lack keyboard accessibility
- Missing `aria-label` on icon-only buttons
- Missing `role="button"` on clickable divs

**Fix:**
```tsx
<div 
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && setActiveTab('pending')}
  onClick={() => setActiveTab('pending')}
  aria-label={`Anfragen Tab, ${totalPending} Einträge`}
>
```

---

### 16. URL Encoding Edge Cases
**File:** `confirm-besichtigung/index.ts` (lines 294-302)  
**Issue:** Company name is double-encoded.

```typescript
const responseParams = new URLSearchParams({
  companyName: encodeURIComponent(company.company_name), // Already encoded!
  // URLSearchParams also encodes!
});
```

**Risk:** Double-encoding causes incorrect display (e.g., "M%C3%BCller" instead of "Mueller").

**Fix:** Don't pre-encode:
```typescript
const responseParams = new URLSearchParams({
  companyName: company.company_name, // Let URLSearchParams handle encoding
});
```

---

## Edge Function Specific Issues

### 17. Email Sent Before Database Operations
**File:** `confirm-besichtigung/index.ts` (lines 164-252)  
**Issue:** Email is sent BEFORE appointment is created in database.

```typescript
// Email sent first (line 164)
const { data: emailData, error: emailError } = await resend.emails.send({...});

// Then appointment created (line 223)
const { error: appointmentError } = await supabase.from("appointments").insert({...});
```

**Risk:** If appointment creation fails, customer already received confirmation email for non-existent appointment.

**Fix:** Create appointment first, then send email:
```typescript
// 1. Create appointment
const { data: appointment, error: appointmentError } = await supabase
  .from("appointments")
  .insert({...})
  .select()
  .single();

if (appointmentError) throw appointmentError;

// 2. Only then send email
const { error: emailError } = await resend.emails.send({...});
```

---

### 18. No Transaction for Multiple DB Operations
**File:** `handle-proposal-response/index.ts` (lines 141-284)  
**Issue:** Multiple database operations (insert appointment, update distribution, create notification, insert email logs) are not atomic.

**Risk:** Partial success - e.g., appointment created but notification not.

**Recommendation:** Consider using Postgres transaction or at least proper error handling for rollback.

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| Critical | 5 | Needs immediate fix |
| High | 5 | Should fix soon |
| Medium | 7 | Can address in next sprint |

### Recommended Fix Order:
1. **Type Mismatch** (Critical - causes crashes)
2. **Duplicate Appointment Creation** (Critical - data integrity)
3. **Race Condition in Conflict Check** (Critical - UX)
4. **Email Before DB** in Edge Function (High - data consistency)
5. **Time Validation** (High - data integrity)
6. **Memory Leak** (High - stability)

### Positive Observations:
- Good use of `Zod` validation in `handle-proposal-response`
- Token validation in Edge Function
- Email logging for auditing
- Nice UI with status indicators and badges
- Responsive design considerations
