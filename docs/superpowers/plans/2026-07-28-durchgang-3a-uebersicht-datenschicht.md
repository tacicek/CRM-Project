# Durchgang 3a — Übersicht, Datenschicht: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Ansichtsmodell der Übersicht und die Regeln dahinter — Statusableitung, Delta-Rechnung, Wochenreihe — als reine, getestete Funktionen. Noch keine Darstellung.

**Architecture:** Die Übersicht soll nicht an der Tabellenform hängen. Ein Ansichtsmodell (`WorkItem`, `Kpi`, `RevenueWeek`) trennt Anzeige von Schema; die Regeln dazwischen sind reine Funktionen und damit nach Projektregel testbar. Die Darstellung folgt in 3b.

**Tech Stack:** TypeScript strict, `date-fns` (vorhanden), Vitest.

## Global Constraints

Wie Durchgang 1–2, insbesondere: Gate aus `npm run type-check` + `npm test` + null neue eslint-Fehler (Basis bleibt **88 / 2**). Kein `any`. Keine hartkodierten Texte. `text-white`/`text-black` nie auf kippenden Tokens (`themeGuard`).

---

## Verifizierte Grundlagen

Alles hier ist gegen Schema und Bestandscode geprüft, nicht geschätzt.

**`offers.status`** — im Code tatsächlich benutzt: `draft`, `sent`, `viewed`,
`accepted`, `rejected`, `expired`. Bestehende Abfragen filtern mit
`.in("status", ["sent", "viewed"])` und `.in("status", ["sent","accepted","rejected","expired"])`.

**`offers` ist versioniert** — `superseded_at`, `supersedes_offer_id`,
`version_number`, `offer_series_id`. Eine naive Verknüpfung `leads ⋈ offers` erzeugt
deshalb einen Vorgang **je Revision** statt je Anfrage.

**Umsatz hat genau eine Quelle.** `finance_overview` liefert `kassiert_total` als
`SUM(amount) FROM payments`. Die Migration begründet es:
`CONSTRAINT payments_negative_only_reversal CHECK (amount > 0 OR reverses_payment_id IS NOT NULL)`
— nur ein Storno darf negativ sein, und der RPC-Kommentar hält fest:
*„Stornos sind negativ und rechnen sich von selbst heraus."*

**Folge für die Wochenreihe:** sie ist `SUM(amount)` gruppiert nach Woche — **keine**
Sonderbehandlung für Stornos. Eine eigene Storno-Logik zu schreiben wäre eine zweite
Wahrheit neben der Datenbank-Regel.

**`auftraege`** trägt `offer_id` und `lead_id`; die Kette lead → offer → auftrag ist
vollständig abbildbar.

---

## File Structure

| Datei | Zuständigkeit |
|---|---|
| `src/types/uebersicht.ts` | **Neu.** Ansichtsmodell. Nur Typen. |
| `src/lib/uebersichtStatus.ts` | **Neu.** Aktuelle Offerte wählen, Status ableiten. Rein. |
| `src/lib/__tests__/uebersichtStatus.test.ts` | **Neu.** |
| `src/lib/uebersichtKpi.ts` | **Neu.** Delta-Rechnung, Wochenreihe. Rein. |
| `src/lib/__tests__/uebersichtKpi.test.ts` | **Neu.** |

---

## Task 1: Ansichtsmodell

**Files:**
- Create: `src/types/uebersicht.ts`

**Interfaces:**
- Produces: `WorkItemStatus`, `WorkItem`, `KpiKey`, `Kpi`, `RevenueWeek`, `OfferForStatus`

- [ ] **Step 1: Typen schreiben**

```ts
/**
 * Das Ansichtsmodell der Übersicht.
 *
 * Bewusst getrennt von den Tabellenformen aus `integrations/supabase/types.ts`:
 * die Darstellung soll nicht brechen, wenn eine Spalte umbenannt wird, und die
 * Regeln dazwischen bleiben ohne Datenbank testbar.
 */

export type WorkItemStatus =
  | "neu"
  | "offeriert"
  | "ueberfaellig"
  | "abgelehnt"
  | "gewonnen";

/** Die Felder einer Offerte, die für die Statusableitung nötig sind. */
export type OfferForStatus = {
  id: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  valid_until: string | null;
  superseded_at: string | null;
  version_number: number | null;
};

export type WorkItem = {
  id: string;
  leadId: string;
  serviceType: string | null;
  title: string;
  from: string | null;
  to: string | null;
  status: WorkItemStatus;
  amountChf: number | null;
  daysOpen: number | null;
  jobDate: string | null;
  createdAt: string;
};

export type KpiKey = "anfragen" | "offerten" | "auftraege" | "umsatz";

export type Kpi = {
  key: KpiKey;
  value: number;
  format: "count" | "chf";
  /** `null`, wenn es keine Vergleichsbasis gibt — nicht 0 und nicht 100. */
  deltaPct: number | null;
  /** Ob ein Anstieg eine gute Nachricht ist. Unbeantwortete Anfragen: nein. */
  risingIsGood: boolean;
};

export type RevenueWeek = {
  /** ISO-Woche als Kürzel, z. B. "KW31". */
  label: string;
  amountChf: number;
  current: boolean;
};
```

- [ ] **Step 2: Gate und Commit**

```bash
npm run type-check && npx eslint src/types/uebersicht.ts
git add src/types/uebersicht.ts
git commit -m "feat(uebersicht): Ansichtsmodell"
```

---

## Task 2: Statusableitung

**Files:**
- Create: `src/lib/uebersichtStatus.ts`
- Test: `src/lib/__tests__/uebersichtStatus.test.ts`

**Interfaces:**
- Consumes: `OfferForStatus`, `WorkItemStatus`.
- Produces:
  - `pickCurrentOffer(offers: readonly OfferForStatus[]): OfferForStatus | null`
  - `deriveWorkItemStatus(offer: OfferForStatus | null, hasAuftrag: boolean, now: Date): WorkItemStatus`
  - `const OFFER_OVERDUE_DAYS = 2`

**Regeln, verbindlich:**

| Zustand | Bedingung |
|---|---|
| `neu` | keine Offerte, oder nur Entwürfe |
| `gewonnen` | `accepted_at` gesetzt — **auch ohne Auftrag** |
| `abgelehnt` | `rejected_at` gesetzt, oder `valid_until` verstrichen |
| `offeriert` | `sent`/`viewed`, `sent_at` ≤ 2 Tage |
| `ueberfaellig` | `sent`/`viewed`, `sent_at` > 2 Tage |

Die Frist rechnet ab **`sent_at`**, nicht ab `created_at`: ein Entwurf, der drei Tage
liegt, war nie beim Kunden.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { deriveWorkItemStatus, OFFER_OVERDUE_DAYS, pickCurrentOffer } from "@/lib/uebersichtStatus";
import type { OfferForStatus } from "@/types/uebersicht";

const NOW = new Date("2026-07-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const offer = (over: Partial<OfferForStatus> = {}): OfferForStatus => ({
  id: "o1",
  status: "sent",
  sent_at: daysAgo(1),
  accepted_at: null,
  rejected_at: null,
  valid_until: null,
  superseded_at: null,
  version_number: 1,
  ...over,
});

describe("pickCurrentOffer", () => {
  it("returns null without offers", () => {
    expect(pickCurrentOffer([])).toBeNull();
  });

  it("ignores superseded revisions", () => {
    const old = offer({ id: "old", superseded_at: daysAgo(3), version_number: 1 });
    const current = offer({ id: "current", version_number: 2 });
    expect(pickCurrentOffer([old, current])?.id).toBe("current");
  });

  it("prefers the highest version when several are open", () => {
    expect(
      pickCurrentOffer([offer({ id: "a", version_number: 1 }), offer({ id: "b", version_number: 3 })])?.id,
    ).toBe("b");
  });

  it("returns null when every revision is superseded", () => {
    expect(pickCurrentOffer([offer({ superseded_at: daysAgo(1) })])).toBeNull();
  });

  it("treats a missing version_number as the lowest", () => {
    expect(
      pickCurrentOffer([offer({ id: "n", version_number: null }), offer({ id: "v", version_number: 1 })])?.id,
    ).toBe("v");
  });
});

describe("deriveWorkItemStatus", () => {
  it("is neu without an offer", () => {
    expect(deriveWorkItemStatus(null, false, NOW)).toBe("neu");
  });

  it("is neu when only a draft exists — a draft never reached the customer", () => {
    expect(deriveWorkItemStatus(offer({ status: "draft", sent_at: null }), false, NOW)).toBe("neu");
  });

  it("is gewonnen once accepted, even without an Auftrag", () => {
    expect(deriveWorkItemStatus(offer({ accepted_at: daysAgo(1) }), false, NOW)).toBe("gewonnen");
  });

  it("is abgelehnt when rejected", () => {
    expect(deriveWorkItemStatus(offer({ rejected_at: daysAgo(1) }), false, NOW)).toBe("abgelehnt");
  });

  it("is abgelehnt when the validity has passed", () => {
    expect(deriveWorkItemStatus(offer({ valid_until: daysAgo(1) }), false, NOW)).toBe("abgelehnt");
  });

  it("is offeriert inside the grace period", () => {
    expect(deriveWorkItemStatus(offer({ sent_at: daysAgo(OFFER_OVERDUE_DAYS) }), false, NOW)).toBe(
      "offeriert",
    );
  });

  it("is ueberfaellig past the grace period", () => {
    expect(
      deriveWorkItemStatus(offer({ sent_at: daysAgo(OFFER_OVERDUE_DAYS + 1) }), false, NOW),
    ).toBe("ueberfaellig");
  });

  it("counts from sent_at, not from creation", () => {
    // Erst heute versandt: nicht ueberfaellig, egal wie alt der Entwurf war.
    expect(deriveWorkItemStatus(offer({ sent_at: daysAgo(0) }), false, NOW)).toBe("offeriert");
  });

  it("prefers acceptance over an expired validity", () => {
    expect(
      deriveWorkItemStatus(offer({ accepted_at: daysAgo(1), valid_until: daysAgo(1) }), true, NOW),
    ).toBe("gewonnen");
  });

  it("falls back to neu for a sent offer without sent_at", () => {
    // Datenfehler statt Absturz: ohne Versanddatum ist keine Frist berechenbar.
    expect(deriveWorkItemStatus(offer({ status: "sent", sent_at: null }), false, NOW)).toBe("neu");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/uebersichtStatus.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/uebersichtStatus"`.

- [ ] **Step 3: Implementierung**

```ts
import type { OfferForStatus, WorkItemStatus } from "@/types/uebersicht";

/** Nach so vielen Tagen ohne Antwort gilt eine Offerte als überfällig. */
export const OFFER_OVERDUE_DAYS = 2;

const MS_PER_DAY = 86_400_000;

/**
 * Die eine gültige Offerte einer Anfrage.
 *
 * `offers` ist versioniert: eine Revision setzt `superseded_at` auf ihre
 * Vorgängerin. Ohne diesen Filter erschiene jede Anfrage so oft in der
 * Übersicht, wie ihre Offerte überarbeitet wurde.
 */
export const pickCurrentOffer = (
  offers: readonly OfferForStatus[],
): OfferForStatus | null => {
  const open = offers.filter((offer) => offer.superseded_at === null);
  if (open.length === 0) return null;
  return open.reduce((best, offer) =>
    (offer.version_number ?? 0) > (best.version_number ?? 0) ? offer : best,
  );
};

const daysBetween = (from: string, now: Date): number =>
  (now.getTime() - new Date(from).getTime()) / MS_PER_DAY;

/**
 * Der Zustand eines Vorgangs.
 *
 * Reihenfolge der Prüfungen ist bedeutungstragend: eine angenommene Offerte
 * bleibt gewonnen, auch wenn ihre Gültigkeit inzwischen abgelaufen ist.
 *
 * `hasAuftrag` geht bewusst NICHT in `gewonnen` ein — das Anlegen des Auftrags
 * ist der nächste Arbeitsschritt, nicht die Bedingung für den Abschluss.
 */
export const deriveWorkItemStatus = (
  offer: OfferForStatus | null,
  hasAuftrag: boolean,
  now: Date,
): WorkItemStatus => {
  if (offer === null) return hasAuftrag ? "gewonnen" : "neu";
  if (offer.accepted_at !== null) return "gewonnen";
  if (offer.rejected_at !== null) return "abgelehnt";
  if (offer.valid_until !== null && new Date(offer.valid_until).getTime() < now.getTime()) {
    return "abgelehnt";
  }
  // Ein Entwurf war nie beim Kunden; ohne Versanddatum ist keine Frist berechenbar.
  if (offer.status === "draft" || offer.sent_at === null) return "neu";
  return daysBetween(offer.sent_at, now) > OFFER_OVERDUE_DAYS ? "ueberfaellig" : "offeriert";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/uebersichtStatus.test.ts`
Expected: PASS — 16 Tests.

- [ ] **Step 5: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/lib/uebersichtStatus.ts src/lib/__tests__/uebersichtStatus.test.ts
npx eslint . 2>&1 | grep problems
git add src/lib/uebersichtStatus.ts src/lib/__tests__/uebersichtStatus.test.ts
git commit -m "feat(uebersicht): Statusableitung mit Versionierung"
```

---

## Task 3: Kennzahlen und Wochenreihe

**Files:**
- Create: `src/lib/uebersichtKpi.ts`
- Test: `src/lib/__tests__/uebersichtKpi.test.ts`

**Interfaces:**
- Consumes: `RevenueWeek`.
- Produces:
  - `deltaPercent(current: number, previous: number): number | null`
  - `groupPaymentsByWeek(payments: readonly { payment_date: string; amount: number }[], weeks: number, now: Date): RevenueWeek[]`

**`deltaPercent` gibt `null` statt einer Zahl, wenn die Vorperiode 0 war.** Ein
Sprung von 0 auf 5 ist kein „+500 %", sondern ein Start ohne Vergleichsbasis. Die
Darstellung zeigt dann keinen Pfeil.

**`groupPaymentsByWeek` summiert schlicht `amount`.** Stornos sind laut
Datenbank-Regel negativ und heben sich dabei selbst auf; eine eigene Storno-Logik
wäre eine zweite Wahrheit neben `payments_negative_only_reversal`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { deltaPercent, groupPaymentsByWeek } from "@/lib/uebersichtKpi";

describe("deltaPercent", () => {
  it("computes a rise", () => {
    expect(deltaPercent(125, 100)).toBe(25);
  });

  it("computes a fall", () => {
    expect(deltaPercent(80, 100)).toBe(-20);
  });

  it("is 0 when nothing moved", () => {
    expect(deltaPercent(100, 100)).toBe(0);
  });

  it("returns null without a comparison base — not 100, not Infinity", () => {
    expect(deltaPercent(5, 0)).toBeNull();
  });

  it("returns null when both are zero", () => {
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it("rounds to whole percent", () => {
    expect(deltaPercent(101, 99)).toBe(2);
  });
});

describe("groupPaymentsByWeek", () => {
  const now = new Date("2026-07-28T12:00:00Z"); // Dienstag

  it("returns exactly the requested number of weeks", () => {
    expect(groupPaymentsByWeek([], 5, now)).toHaveLength(5);
  });

  it("marks only the last bucket as current", () => {
    const weeks = groupPaymentsByWeek([], 5, now);
    expect(weeks.filter((w) => w.current)).toHaveLength(1);
    expect(weeks[weeks.length - 1].current).toBe(true);
  });

  it("sums payments into their week", () => {
    const weeks = groupPaymentsByWeek(
      [
        { payment_date: "2026-07-28", amount: 1000 },
        { payment_date: "2026-07-27", amount: 500 },
      ],
      5,
      now,
    );
    expect(weeks[weeks.length - 1].amountChf).toBe(1500);
  });

  it("nets a reversal out, because a reversal is negative", () => {
    const weeks = groupPaymentsByWeek(
      [
        { payment_date: "2026-07-28", amount: 1000 },
        { payment_date: "2026-07-28", amount: -400 },
      ],
      5,
      now,
    );
    expect(weeks[weeks.length - 1].amountChf).toBe(600);
  });

  it("ignores payments outside the window", () => {
    const weeks = groupPaymentsByWeek([{ payment_date: "2020-01-01", amount: 999 }], 5, now);
    expect(weeks.every((w) => w.amountChf === 0)).toBe(true);
  });

  it("labels the weeks in ascending order", () => {
    const labels = groupPaymentsByWeek([], 5, now).map((w) => w.label);
    expect(labels).toHaveLength(5);
    expect(new Set(labels).size).toBe(5);
    expect(labels[labels.length - 1]).toBe("KW31");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/uebersichtKpi.test.ts`
Expected: FAIL — Import nicht auflösbar.

- [ ] **Step 3: Implementierung**

```ts
import { getISOWeek, startOfISOWeek, subWeeks } from "date-fns";
import type { RevenueWeek } from "@/types/uebersicht";

/**
 * Veränderung gegenüber der Vorperiode in ganzen Prozent.
 *
 * `null` bedeutet: keine Vergleichsbasis. Ein Sprung von 0 auf 5 ist kein
 * „+500 %", und Unendlich lässt sich nicht anzeigen — die Darstellung
 * unterdrückt den Pfeil dann ganz.
 */
export const deltaPercent = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Die letzten `weeks` ISO-Wochen, aufsteigend, die laufende zuletzt.
 *
 * Summiert schlicht `amount`. Stornos sind in dieser Datenbank negativ
 * (`payments_negative_only_reversal`) und heben sich dadurch selbst auf — eine
 * eigene Storno-Behandlung wäre eine zweite Wahrheit neben der Regel.
 */
export const groupPaymentsByWeek = (
  payments: readonly { payment_date: string; amount: number }[],
  weeks: number,
  now: Date,
): RevenueWeek[] => {
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const start = startOfISOWeek(subWeeks(now, weeks - 1 - index));
    return {
      start: start.getTime(),
      label: `KW${getISOWeek(start)}`,
      amountChf: 0,
      current: index === weeks - 1,
    };
  });

  for (const payment of payments) {
    const weekStart = startOfISOWeek(new Date(payment.payment_date)).getTime();
    const bucket = buckets.find((candidate) => candidate.start === weekStart);
    if (bucket) bucket.amountChf += payment.amount;
  }

  return buckets.map(({ label, amountChf, current }) => ({ label, amountChf, current }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/uebersichtKpi.test.ts`
Expected: PASS — 13 Tests.

- [ ] **Step 5: Gate und Commit**

```bash
npm run type-check && npm test && npx eslint src/lib/uebersichtKpi.ts src/lib/__tests__/uebersichtKpi.test.ts
npx eslint . 2>&1 | grep problems
git add src/lib/uebersichtKpi.ts src/lib/__tests__/uebersichtKpi.test.ts
git commit -m "feat(uebersicht): Delta-Rechnung und Wochenreihe"
```

---

## Nicht in diesem Plan — Durchgang 3b

Die Abfragen und die Darstellung. Erst mit ihnen wird die Seite sichtbar anders,
und erst dann lohnt der Blick in den Browser:

- `useUebersichtData` — die Abfragen, inklusive `finance_overview` und der
  Vorperioden-Zählung für die Deltas.
- `PageHeader`, `KpiStrip`/`KpiScroller`, `ActionBanner`, `SegmentedFilter`/`FilterChips`
- `WorkItems` mit `variant` (Theme) × `density` (Breakpoint) und den vier Renderpfaden
- `ActivityPanel`, `TodayPanel`, `RevenueBars`
- Die drei bestehenden Bereiche, die **nicht verschwinden dürfen** (Spec §5.0):
  Besichtigungsanfragen, Umzugsboxen-Lage, heutige Termine.
