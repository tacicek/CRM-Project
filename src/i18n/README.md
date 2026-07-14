# i18n — DE / FR / EN

## The one rule

There are **two independent language axes** and conflating them is the only way to
get this wrong:

| Axis | Source of truth | Scope | How you read it |
|---|---|---|---|
| **Dashboard locale** — the language the *operator* works in | `companies.default_language` (+ optional per-browser override) | everything under `/firma/*` | `useT()` / `useI18n()` from React context |
| **Document locale** — the language the *customer* is addressed in | `<row>.language`, frozen from `leads.language` | PDFs, e-mails, SMS, public token pages | passed **explicitly** as an argument |

A German-speaking operator sends a French offer to a French customer. Both axes are
live in the same browser tab at the same time. That is why **no customer-facing
renderer may read React context** — it would leak the operator's language into the
customer's document.

## Dashboard (React, inside `/firma/*`)

```tsx
import { useT } from "@/i18n/useI18n";

const MyPage = () => {
  const t = useT();
  return <h1>{t("nav.offerten")}</h1>;
};
```

With interpolation and plurals:

```tsx
t("offer.count", { count: 3 })          // picks the #one / #other variant per locale
t("public.offer.validUntil", { date })  // {date} placeholder
```

Dates in the dashboard:

```tsx
import { useI18n } from "@/i18n/useI18n";
const { dateLocale } = useI18n();
format(d, "dd.MM.yyyy", { locale: dateLocale });   // instead of { locale: de }
```

## Documents & e-mails (customer language)

```ts
import { createDocumentI18n, documentI18nFor } from "@/i18n/documentLocale";

// From a row that carries `language` (offer, rechnung, quittung, auftrag, appointment):
const { t, locale, dateLocale } = createDocumentI18n(offer, company);

// When the locale is already known (e.g. threaded into a PDF subtree as a prop):
const { t } = documentI18nFor(locale);
```

Formatting always takes the locale explicitly:

```ts
import { formatCurrency, formatDate, formatDateLong, formatAmount } from "@/i18n/format";

formatCurrency(1234.5, locale);  // CHF 1'234.50  ·  1 234.50 CHF  ·  CHF 1,234.50
formatDateLong(date, locale);    // 15. Januar 2026 · 15 janvier 2026 · 15 January 2026
```

Never call `toLocaleDateString("de-CH")` or `Intl.*` with a hardcoded locale in any
customer-facing path.

## Domain vocabulary

Service types, statuses, address labels — all locale-aware, all take the locale:

```ts
import {
  getServiceLabel, getAppointmentLabel, getAddressLabels,
  getOfferStatusLabel, getAuftragStatusLabel, getRechnungStatusLabel,
  getQuittungStatusLabel, getYesNo, getLetterSalutation,
} from "@/i18n/domain";

getServiceLabel("umzug_privat", locale);   // Privatumzug · Déménagement privé · Private removal
getAddressLabels("umzug", locale);         // { primary: "Auszugsadresse", secondary: "Einzugsadresse" }
```

These replace the German-only maps that used to be re-declared per file
(`SERVICE_LABELS`, `AUFTRAG_STATUS_LABELS`, the local `STATUS_META` objects, …).

## Adding a key

1. Add it to the German namespace file under `catalog/de/` — German is the **source
   of truth** for the key set.
2. Add the same key to `catalog/fr/` and `catalog/en/`. You cannot forget: the
   translations are typed `Record<keyof typeof de, string>`, so a missing key is a
   **compile error**.
3. Namespaces are split into separate files (`nav`, `offer`, `invoice`, `document`, …)
   so parallel work doesn't contend on one module.

Plurals use a `#one` / `#other` key suffix and are selected with `Intl.PluralRules`,
because French treats 0 as singular ("0 offre") while German and English do not.

## Verifying

`npm run type-check` is **vacuous** — the root tsconfig is solution-style (`files: []`)
and checks nothing. Use the real project config:

```
npx tsc --noEmit -p tsconfig.app.json
```

## DB-authored content

Catalog items, AGB sections, checklist templates and company text blocks carry a
`translations` JSONB column of the shape `{"fr": {"name": "…"}, "en": {…}}`. The
German base column stays the source of truth and the fallback (`i18n_text()` in SQL,
`localizedField()` in TS). Offer line items need no translation column: they are a
**snapshot** taken from the catalog at creation time, in the customer's language.
