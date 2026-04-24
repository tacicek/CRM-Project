# ESLint Fix Plan

## Summary

**Total Issues: ~440**
- Errors: ~360
- Warnings: ~80

## Issues by Type

| Rule | Count | Priority | Auto-fixable |
|------|-------|----------|--------------|
| `@typescript-eslint/no-unused-vars` | 295 | High | Partial |
| `no-console` | 83 | Medium | No |
| `react-hooks/rules-of-hooks` | 21 | **Critical** | No |
| `react-hooks/exhaustive-deps` | 14 | Medium | No |
| `no-duplicate-imports` | 11 | Low | Yes |
| `no-useless-escape` | 7 | Low | Yes |
| `eqeqeq` | 4 | Low | Yes |
| `react-refresh/only-export-components` | 3 | Low | No |
| `no-control-regex` | 1 | Low | No |
| `@typescript-eslint/no-explicit-any` | 1 | Medium | No |

---

## Phase 1: Safe Auto-fixes (run lint:fix)

These can be safely auto-fixed:
- `no-duplicate-imports` - 11 occurrences
- `no-useless-escape` - 7 occurrences  
- `eqeqeq` - 4 occurrences (== → ===)
- Some `unused eslint-disable` warnings

**Command:**
```bash
npm run lint:fix
```

---

## Phase 2: Critical - React Hooks Violations ⚠️

**21 `react-hooks/rules-of-hooks` errors - MUST FIX MANUALLY**

These are actual bugs that can cause runtime errors.

### Most Problematic Files:

#### `src/pages/admin/SharedContent.tsx` (15 violations)
Hooks called inside callbacks - needs refactoring to separate components.
```
Lines: 349, 350, 353, 359, 366, 371, 384, 390, 397, 604, 605, 606, 609, 616, 627
```

#### `src/pages/LandingPage.tsx` (2 violations)
useMemo called after early return.
```
Lines: 449, 455
```

#### `src/components/offers/moving-calculator/MovingCalculator.tsx` (2 violations)
useMovingCalculator called conditionally.
```
Lines: 48, 49
```

#### `src/components/offers/moving-calculator/MovingCalculatorWithLead.tsx` (2 violations)
useMovingCalculator called conditionally.
```
Lines: 58, 59
```

**Strategy:** Extract hook logic to parent or use early-exit patterns properly.

---

## Phase 3: Unused Variables (295 occurrences)

### Categories:

1. **Unused imports** (~200)
   - Mostly unused lucide-react icons
   - Unused UI components
   - Strategy: Remove imports

2. **Unused function parameters** (~50)
   - Strategy: Prefix with `_` (e.g., `_unused`)

3. **Unused destructured values** (~30)
   - Strategy: Remove or prefix with `_`

4. **Unused local variables** (~15)
   - Strategy: Remove or comment out

### Top Offending Files:
- `src/components/offerte/ServiceDetailsSection.tsx` - 16 unused
- `src/pages/admin/ArchiveManagement.tsx` - 10 unused
- `src/pages/admin/Settings.tsx` - 10 unused
- `src/lib/validations/leadForm.ts` - 7 unused
- `src/components/NotificationDropdown.tsx` - 5 unused

---

## Phase 4: Console Statements (83 warnings)

### Categories:

1. **Debug logs** - Remove
2. **Error logging** - Convert to `console.error`
3. **Info logging** - Convert to `console.info`

### Top Files:
- `src/components/offers/moving-calculator/calculation-utils.ts` - 35 console.logs
- `src/components/admin/ResetPasswordDialog.tsx` - 6 console.logs
- `src/hooks/useRecaptcha.ts` - 5 console.logs

**Strategy:** 
- Replace `console.log` with `console.info` for important info
- Remove debug statements
- Use proper error logging

---

## Phase 5: React Hooks Dependencies (14 warnings)

These are warnings but should be reviewed:
- Missing dependencies in useEffect/useCallback
- May cause stale closure bugs

### Files:
- `src/pages/admin/LandingPageEditor.tsx` (2)
- `src/pages/admin/Statistics.tsx` (1)
- `src/pages/admin/ManualImportSubscriptions.tsx` (1)
- `src/components/firma/AuftragModal.tsx` (1)
- etc.

---

## Recommended Fix Order

1. ✅ **Run auto-fix** for safe fixes
2. 🔴 **Fix critical hooks violations** (SharedContent.tsx, LandingPage.tsx, MovingCalculator.tsx)
3. 🟡 **Remove unused imports** (bulk operation)
4. 🟡 **Prefix unused parameters** with `_`
5. 🟢 **Review console statements** (convert to proper logging)
6. 🟢 **Review exhaustive-deps warnings**

---

## Pre-commit Hook Setup (Optional)

After fixes are complete:

```bash
npm install -D husky lint-staged
npx husky init
```

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

---

## Notes

- `.eslintignore` is deprecated in ESLint 9, use `ignores` in config instead (already configured)
- Supabase Edge Functions are excluded (Deno runtime has different rules)
- Focus on fixing errors first, warnings can be addressed later
