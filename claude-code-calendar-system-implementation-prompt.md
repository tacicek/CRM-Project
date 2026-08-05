# Claude Code prompt — Port the Calendar System into Offerio

You are a senior product engineer, database engineer, and UX implementer. Work directly in
the **Offerio** repository and complete this task end to end. Do not stop after producing a
plan. Implement the working calendar, the appointment lifecycle, the automation, and the
webcal/ICS subscription, then validate the result and leave the repository ready for review.

This document is **self-contained**. It is the complete specification of a calendar system
that runs in production in a sibling single-tenant CRM. You do not have access to that
repository — everything you need is either quoted verbatim below or specified precisely
enough to rebuild. Where a file is too large to embed (a 1,572-line page component), you get
its architecture, its layout, and every non-obvious code fragment that carries a decision.

---

## 0. Mission and boundaries

### Mission

Build an operator calendar for Offerio with five layers:

1. **Calendar screen** — month / week / day / agenda views, drag-and-drop rescheduling,
   filters, a detail side panel, a team-week resource view, and a mobile navigation bar.
2. **Appointment model** — one `appointments` table carrying the whole lifecycle, with
   resource-aware conflict detection and recurring series.
3. **Automation** — an appointment created automatically when an offer is accepted, plus
   `pg_cron`-driven reminder e-mails.
4. **Customer-facing actions** — capability-token pages for cancel and reschedule, with no
   personal data in the URL.
5. **Calendar subscription** — a `webcal://` / ICS feed so staff can subscribe to their CRM
   appointments from Apple Calendar, Google Calendar, or Outlook.

### Boundaries

- You are explicitly authorized to make the multi-file changes this requires. Do not pause
  merely because the change spans more than five files.
- **Do not commit, push, deploy, send real e-mails, or touch production data.** Migrations
  are written and applied against a local/staging database only.
- Follow Offerio's own conventions: its component library, its i18n system, its RLS helper
  functions, its naming. This document describes *what the system does and why*, not a
  license to import a foreign coding style.
- No `any`. No barrel exports. No silent `try/catch`. No service-role key in the frontend.
  No table without RLS.
- **Offerio is multi-tenant. The source system is single-tenant.** Section 10 lists every
  place that assumption is baked in and what the multi-tenant correction is. Read section 10
  *before* writing the migrations — three of the corrections change the SQL signature.
- Where this document quotes code with German comments, keep the meaning and re-comment in
  Offerio's comment language. The comments carry the reasoning; do not drop them.

### Source system stack (for translation, not imitation)

| Concern | Source system | What matters |
|---|---|---|
| Frontend | Vite + React 18 + strict TS | — |
| Calendar widget | `react-big-calendar@^1.8.5` + its `dragAndDrop` addon | The whole screen is built on this |
| Dates | `date-fns@^3.6.0` | `dateFnsLocalizer` |
| UI | Tailwind + shadcn/ui + Radix | `folk-*` design tokens (see §3.2) |
| Backend | Supabase (Postgres + Auth + Edge Functions, Deno) | RLS + `SECURITY DEFINER` RPCs |
| Mail | Resend, server-side only | — |

---

## 1. What you are porting — file inventory

Recreate this structure in Offerio's own layout. Line counts are the source system's, given
so you can judge the weight of each piece.

### Frontend

| File | Lines | Role |
|---|---|---|
| `pages/firma/Kalender.tsx` | 1,572 | The calendar page. Data loading, filters, DnD, detail card. §4 |
| `components/firma/AppointmentModal.tsx` | 1,122 | Create/edit dialog. Conflicts, lead linking, recurrence. §5 |
| `components/firma/TeamWeekView.tsx` | 570 | Team × weekday resource grid with availability editing. §4.7 |
| `components/firma/CalendarExportMenu.tsx` | 231 | Per-appointment "add to my calendar" menu + QR. §6.4 |
| `components/firma/MobileCalendarNav.tsx` | 186 | `md:hidden` date navigation bar. §3.5 |
| `components/firma/CalendarFeedSettings.tsx` | 309 | Subscription token management UI. §8.5 |
| `components/firma/AppointmentAnfrageSummary.tsx` | 150 | Live summary of the linked request inside the detail card |
| `lib/calendarSync.ts` | 241 | Google/Outlook/O365/Yahoo URL builders + client-side ICS. §6.4 |
| `lib/appointmentConflicts.ts` | 65 | **Pure**, unit-tested conflict detection. Embedded in §5.3 |
| `lib/calendarFeedUrl.ts` | 56 | **Pure** webcal URL builder. Embedded in §8.4 |
| `pages/public/AppointmentCancel.tsx` | — | Token-based customer cancellation. §7 |
| `pages/public/AppointmentReschedule.tsx` | — | Token-based customer reschedule. §7 |
| `index.css` (calendar block) | ~535 | Every `react-big-calendar` override. Embedded in §3.6 |
| `i18n/catalog/{de,fr,en}/calendar.ts` | ~450 each | Operator-facing calendar strings. §9 |

### Backend

| File | Role |
|---|---|
| `supabase/functions/calendar-feed/index.ts` | The ICS feed endpoint. **Embedded in §8.3** |
| `supabase/functions/calendar-feed/ics.ts` | Pure RFC 5545 serializer, 20 unit tests. **Embedded in §8.2** |
| `supabase/functions/send-appointment-confirmation/` | Confirmation mail on creation. §6.3 |
| `supabase/functions/notify-appointment-reminder/` | Cron-driven reminders. §6.2 |
| `supabase/functions/notify-appointment-cancelled/` | Cancellation mail |
| `supabase/functions/notify-appointment-reschedule/` | Reschedule proposal mail |
| Migration: `calendar_feed_tokens` | **Embedded in §8.1** |
| Migration: appointment reminder cron + `generate_recurring_appointments` | §5.4, §6.2 |
| Migration: auto-create appointment on offer accept | §6.1 |
| Migration: customer action token + cancel RPC | §7 |

---

## 2. Data model

### 2.1 `appointments` — the single lifecycle table

The source table has 48 columns. That is more than the calendar reads, and the difference
matters: an early version used `select("*")` and shipped 14 unused columns per row on every
page load. **Build the table with all 48 — the lifecycle needs them — but always select
explicitly.**

```sql
-- Enums (create these first)
CREATE TYPE public.appointment_type AS ENUM
  ('besichtigung', 'service', 'follow_up', 'meeting', 'blocked');

CREATE TYPE public.appointment_status AS ENUM
  ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show');
```

> **Naming note.** `besichtigung` = on-site survey / viewing appointment. If Offerio's domain
> vocabulary differs, rename the enum values — but rename them *everywhere*, including the
> feed type parameter in §8, and keep the set closed. See §10.9 on extending the enum.

Columns, grouped by what they are for:

**Identity and tenancy**
```
id                       uuid PK default gen_random_uuid()
company_id               uuid NOT NULL   -- tenant boundary; see §10.5
lead_id                  uuid NULL       -- the originating request
offer_id                 uuid NULL       -- the offer this job came from
customer_id              uuid NULL
location_id              uuid NULL
```

**When**
```
appointment_date         date NOT NULL
start_time               time NOT NULL   -- wall clock, no timezone
end_time                 time NOT NULL   -- wall clock, no timezone
duration_minutes         integer NULL
all_day                  boolean NULL default false
```

> **Timezone contract — read this twice.** `appointment_date` + `start_time`/`end_time` are
> *wall-clock local values with no timezone*. The source system fixes that zone to
> `Europe/Zurich` and converts at every boundary that leaves the app (ICS export, reminder
> "hours until"). This is the single most error-prone part of the system. §10.3 tells you
> how to make it a tenant setting instead of a constant.

**What**
```
appointment_type         appointment_type NOT NULL
status                   appointment_status NULL default 'pending'
title                    text NOT NULL
description              text NULL          -- customer-visible-ish
internal_notes           text NULL          -- NEVER leaves the dashboard
language                 text NOT NULL      -- DOCUMENT locale; see §9
```

**Where**
```
location_address         text NULL
location_plz             text NULL          -- postal code
location_city            text NULL
location_notes           text NULL          -- NEVER leaves the dashboard
```

**Who (customer snapshot — denormalized on purpose)**
```
customer_first_name      text NULL
customer_last_name       text NULL
customer_email           text NULL
customer_phone           text NULL
```

> Denormalized deliberately: a completed appointment must still render correctly after the
> lead is archived or the customer record is edited. The calendar never joins to `leads` to
> draw an event.

**Resources**
```
assigned_team_member_ids uuid[] NULL
required_vehicles        uuid[] NULL
required_equipment       uuid[] NULL
```

**Lifecycle bookkeeping**
```
confirmed_by_firma       boolean NULL
confirmed_by_customer    boolean NULL
confirmed_at             timestamptz NULL
completed_at             timestamptz NULL
completion_notes         text NULL
cancelled_at             timestamptz NULL
cancelled_by             text NULL          -- 'firma' | 'customer'
cancellation_reason      text NULL
rescheduled_from_id      uuid NULL
rescheduled_to_id        uuid NULL
```

**Reminders**
```
reminder_sent_firma      boolean NULL
reminder_sent_customer   boolean NULL
reminder_sent_team       boolean NULL
reminder_sent_at         timestamptz NULL
```

**Recurrence**
```
is_recurring             boolean NULL
parent_appointment_id    uuid NULL          -- children point at the series root
recurrence_pattern       text NULL          -- 'daily'|'weekly'|'biweekly'|'monthly'
recurrence_end_date      date NULL
```

**Audit**
```
created_at               timestamptz default now()
updated_at               timestamptz default now()
```

Plus the capability-token columns from §7 (`customer_action_token`,
`customer_action_token_expires_on`).

Indexes that carry real load:
```sql
CREATE INDEX ON public.appointments (company_id, appointment_date);
CREATE INDEX ON public.appointments (company_id, status);
CREATE INDEX ON public.appointments (parent_appointment_id) WHERE parent_appointment_id IS NOT NULL;
```

### 2.2 Supporting tables

| Table | Columns that matter | Used by |
|---|---|---|
| `team_members` | `id, company_id, first_name, last_name, role, color_code, is_active` | Event colour, avatars, filters |
| `team_availability` | `team_member_id, day_of_week, specific_date, start_time, end_time, is_available, notes` | Team week view. `day_of_week` = recurring pattern, `specific_date` = one-off exception |
| `firma_resources` | `id, company_id, name, resource_type ('vehicle'\|'equipment'), capacity_m3, is_available` | Vehicle/equipment pickers, conflict detection |
| `appointment_reminders` | `appointment_id, recipient_type, recipient_id, recipient_email, recipient_phone, reminder_type, sent_at, status, error_message` | Idempotency ledger for the reminder cron |
| `appointment_history` | change log written by a trigger | Audit. **See the §7 hardening — it must not log capability tokens** |
| `calendar_feed_tokens` | see §8.1 | ICS subscription |

### 2.3 RLS pattern

Every table above has RLS enabled. The source system's policy shape:

```sql
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_member_all ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
```

`is_company_member(uuid)` is a `SECURITY DEFINER` helper resolving `auth.uid()` against the
membership table. **Offerio already has an equivalent — use Offerio's, do not add a second
one.** If Offerio's helper has a different name, substitute it consistently in every policy
and RPC in this document.

`anon` gets **no** policy on `appointments`. Every public path (customer cancel, reschedule,
ICS feed) goes through a `SECURITY DEFINER` function or a service-role edge function that
carries its own explicit tenant filter. That is not an accident, it is the design: §7 exists
because an earlier version had the public cancel page read `appointments` directly from the
browser, which could not work under RLS and leaked the customer's e-mail address into the
URL, the browser history, the `Referer` header, and the server logs.

---

## 3. Layout and visual system

### 3.1 Page skeleton

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  📅  Kalender                                                   [ + New appt ]  │
│      Monday, 05 August 2026 · 3 today · 7 open · 12 this week                   │
│      One-line subtitle explaining what this screen is for                       │
├────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────────────────────┐ ┌────────┐  ┌────┐ ┌────┐    │
│ │ Cal │ Team   │ │ Month │ Week │ Day │ Agenda  │ │ Filter①│  │chip│ │chip│    │
│ └──────────────┘ └──────────────────────────────┘ └────────┘  └────┘ └────┘    │
├────────────────────────────────────────────────────────────────────────────────┤
│  [MobileCalendarNav — md:hidden]                                                │
├──────────────────────────────────────────────────┬─────────────────────────────┤
│                                                  │                             │
│   ┌──────────────────────────────────────────┐   │   Detail side panel         │
│   │  ◀  Today  ▶            August 2026      │   │   (only when a day or an    │
│   │ ──────────────────────────────────────── │   │    event is selected)       │
│   │  MON  TUE  WED  THU  FRI  SAT  SUN       │   │                             │
│   │   28   29   30   31    1    2    3       │   │   ┌──┐ Besichtigung    [×]  │
│   │   ▌evt ▌evt                              │   │   └──┘                      │
│   │    4    5    6    7    8    9   10       │   │   Title of the appointment  │
│   │       ▌evt                               │   │   ● pending                 │
│   │       ▌evt                               │   │   ─────────────────────     │
│   │       +2 more                            │   │   🕐 Wed, 06.08.2026        │
│   │   ...                                    │   │      09:00 – 11:00          │
│   └──────────────────────────────────────────┘   │   📍 Address / PLZ City     │
│                                                  │   👤 Customer · tel · mail  │
│              lg:col-span-3                       │   👥 Team chips             │
│                                                  │   Description               │
│                                                  │   Live request summary      │
│                                                  │   🔒 Internal notes         │
│                                                  │   [ Add to my calendar ▾ ]  │
│                                                  │   [ ✓ Confirm            ]  │
│                                                  │   [ Edit ] [ Cancel      ]  │
│                                                  │        lg:col-span-1        │
└──────────────────────────────────────────────────┴─────────────────────────────┘
```

**Grid behaviour — this is the layout's one real trick.** The side panel is not a permanent
column. The container switches between two grids:

```tsx
const calendarSidePanelOpen = Boolean(selectedEvent || selectedDate);

<div className={cn(
  "flex flex-col gap-4 md:gap-6 lg:items-stretch",
  calendarSidePanelOpen ? "lg:grid lg:grid-cols-4" : "lg:grid lg:grid-cols-1"
)}>
  <div className="col-span-full order-1">{/* MobileCalendarNav */}</div>

  <div className={cn(
    "order-2 lg:order-1 min-w-0",
    calendarSidePanelOpen ? "lg:col-span-3" : "col-span-full"
  )}>
    {/* calendar card */}
  </div>

  {calendarSidePanelOpen && (
    <div className="lg:col-span-1 order-1 lg:order-2 lg:h-full min-w-0">
      {/* detail card or day list */}
    </div>
  )}
</div>
```

Nothing collapses the panel with `hidden` — it is unmounted, so the calendar reflows to full
width and `react-big-calendar` recomputes its own column widths. `min-w-0` on both children
is load-bearing: without it the grid children refuse to shrink below their content width and
the month view overflows horizontally.

The calendar viewport is a fixed-height box, not a page-height box:

```tsx
<div className="h-[580px] sm:h-[680px] md:h-[780px] lg:h-[min(820px,calc(100vh-14rem))]
                calendar-mobile calendar-modern">
```

`min(820px, calc(100vh - 14rem))` caps the desktop height so the calendar never grows taller
than the viewport minus the header, while staying at a comfortable 820px on tall screens.

### 3.2 Design tokens

The source system uses a neutral, paper-like palette exposed as CSS custom properties and
mapped into Tailwind with `<alpha-value>` so opacity modifiers keep working:

```ts
// tailwind.config.ts
folk: {
  bg:        "rgb(var(--folk-bg) / <alpha-value>)",
  "bg-warm": "rgb(var(--folk-bg-warm) / <alpha-value>)",
  sidebar:   "rgb(var(--folk-sidebar) / <alpha-value>)",
  card:      "rgb(var(--folk-card) / <alpha-value>)",
  ink:       "rgb(var(--folk-ink) / <alpha-value>)",     // primary text
  ink2:      "rgb(var(--folk-ink2) / <alpha-value>)",    // secondary
  ink3:      "rgb(var(--folk-ink3) / <alpha-value>)",    // muted
  ink4:      "rgb(var(--folk-ink4) / <alpha-value>)",    // faint
  line:      "rgb(var(--folk-line) / <alpha-value>)",    // borders
  "line-hard": "…", coral: "…", violet: "…", mint: "…", lemon: "…", sky: "…", rose: "…",
}
```

**Map these onto Offerio's existing tokens.** Do not introduce a parallel palette. The
mapping you need: `folk-ink` → primary text, `folk-ink3` → muted text, `folk-line` → border,
`folk-card` → card surface, `folk-bg-warm` → subtle inset surface, `folk-coral` →
destructive, `folk-mint` → success.

### 3.3 Appointment type colours — the one palette you must copy

These are **not** Tailwind classes. They are CSS variables holding raw RGB triplets, because
`react-big-calendar` receives them as inline styles from `eventPropGetter`, and Tailwind
classes cannot reach there.

```css
/* index.css, inside :root */
--cal-besichtigung: 124 58 237;   /* #7C3AED  violet   */
--cal-service:        4 120 87;   /* #047857  emerald  */
--cal-follow-up:    180 83   9;   /* #B45309  amber    */
--cal-meeting:       37 99 235;   /* #2563EB  blue     */
--cal-blocked:       75 85 99;    /* #4B5563  slate    */
--cal-cancelled:    220 38 38;    /* #DC2626  red      */
--cal-completed:    100 116 139;  /* #64748B  slate    */
```

They live in one place *with their contrast rationale*, and they are duplicated as hex
literals in exactly one other place — the ICS feed's `TYPE_META` (§8.3), which cannot import
frontend modules. **When you change a colour, change both.** The edge function carries a
comment pointing here; add the reverse pointer in your CSS.

```ts
const typeColors: Record<string, { bg: string; border: string; icon: LucideIcon }> = {
  besichtigung: { bg: "rgb(var(--cal-besichtigung))", border: "rgb(var(--cal-besichtigung) / 0.7)", icon: Eye },
  service:      { bg: "rgb(var(--cal-service))",      border: "rgb(var(--cal-service) / 0.7)",      icon: Truck },
  follow_up:    { bg: "rgb(var(--cal-follow-up))",    border: "rgb(var(--cal-follow-up) / 0.7)",    icon: Clock },
  meeting:      { bg: "rgb(var(--cal-meeting))",      border: "rgb(var(--cal-meeting) / 0.7)",      icon: Users },
  blocked:      { bg: "rgb(var(--cal-blocked))",      border: "rgb(var(--cal-blocked) / 0.7)",      icon: XCircle },
};
```

### 3.4 Event appearance rules

```ts
const eventStyleGetter = useCallback((event: CalendarEvent) => {
  const { type, status, teamMembers: eventTeam } = event.resource;
  const colors = typeColors[type] || typeColors.meeting;

  // A team member's own colour wins over the type colour. Operators recognise
  // people faster than categories.
  let backgroundColor = eventTeam.length > 0 ? eventTeam[0].color_code : colors.bg;
  let borderColor     = eventTeam.length > 0 ? eventTeam[0].color_code : colors.border;

  // 'pending' used to be shown with transparency (hex + "CC"). That costs contrast:
  // the fill blends with the light surface and white text drops to 3.7:1.
  // The state now lives in the border style, not in the opacity — legibility holds.
  const dashed = status === "pending";

  if (status === "cancelled") {
    backgroundColor = "rgb(var(--cal-cancelled))";
    borderColor     = "rgb(var(--cal-cancelled) / 0.7)";
  } else if (status === "completed") {
    backgroundColor = "rgb(var(--cal-completed))";
    borderColor     = "rgb(var(--cal-completed) / 0.7)";
  }

  return {
    style: {
      backgroundColor,
      borderLeft: `4px ${dashed ? "dashed" : "solid"} ${borderColor}`,
      borderRadius: "6px",
      opacity: status === "cancelled" ? 0.6 : 1,
      color: "#fff",
      fontSize: "12px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
  };
}, []);
```

Read the priority order carefully: **type colour < team member colour < terminal status
colour.** Cancelled and completed override the person, because "this is off" outranks "this
is Yusuf's job".

The event body itself is a custom component: up to two team-member initial avatars in a
`-space-x-1.5` stack, a `+N` chip beyond that, then the truncated title.

```tsx
const EventComponent = ({ event }: { event: CalendarEvent }) => {
  const { teamMembers: eventTeam } = event.resource;
  return (
    <div className="flex items-center gap-1.5 overflow-hidden min-h-0 px-1.5 py-0.5">
      {eventTeam.length > 0 && (
        <div className="flex -space-x-1.5 shrink-0">
          {eventTeam.slice(0, 2).map((tm) => (
            <div key={tm.id}
                 className="w-5 h-5 rounded-full border-2 border-white/50 flex items-center
                            justify-center text-[9px] font-bold text-white shadow-sm"
                 style={{ backgroundColor: tm.color_code }}
                 title={`${tm.first_name ?? ""} ${tm.last_name ?? ""}`.trim()}>
              {(tm.first_name || "?")[0]}
            </div>
          ))}
          {eventTeam.length > 2 && (
            <div className="w-5 h-5 rounded-full bg-slate-600 border-2 border-white/50 flex
                            items-center justify-center text-[9px] font-bold text-white shadow-sm">
              +{eventTeam.length - 2}
            </div>
          )}
        </div>
      )}
      <span className="truncate text-xs font-medium">{event.title}</span>
    </div>
  );
};
```

### 3.5 Mobile

`MobileCalendarNav` is a separate `md:hidden` component, not a responsive variant of the
desktop toolbar. It renders:

- a compact `◀ [Today] [Aug 2026 ▾] ▶` bar; the middle button opens a bottom `Sheet` with a
  month picker (`react-day-picker` via shadcn `Calendar`);
- days that have appointments are marked with `modifiers`/`modifiersStyles` (bold +
  underline) — the parent passes `appointmentDates: string[]` in `yyyy-MM-dd`;
- in **week** view, a horizontally scrolling 7-day strip with `min-w-[44px]` tap targets
  showing weekday, day number, and a dot when the day has appointments;
- in **day** view, a large centred date header.

`navigateDate` is view-aware: `±1 day` in day view, `±1 week` in week view, `±1 month`
otherwise.

### 3.6 `react-big-calendar` CSS overrides — copy verbatim, then re-token

This is the entire visual layer of the calendar. Copy it, then replace `hsl(var(--border))`,
`hsl(var(--muted))`, `hsl(var(--card))`, `hsl(var(--foreground))`,
`hsl(var(--muted-foreground))`, `hsl(var(--primary))` and `hsl(var(--secondary))` with
Offerio's equivalents. **The `!important` markers and the two comments explaining why they
are or are not there are load-bearing — keep them.**

```css
/* ── Modern Calendar Styles ─────────────────────────────────────────────── */
.rbc-calendar {
  font-family: 'Inter', system-ui, sans-serif;
  background: transparent;
  border-radius: 1rem;
  overflow: visible;
}

.calendar-modern .rbc-calendar {
  --calendar-accent: 99 102 241;
  --calendar-accent-light: 224 231 255;
}

/* Month view overflow is handled by react-big-calendar's popup ("+X more" → click →
   overlay). An earlier showAllEvents + scrollable-row hack was removed: it clipped
   badges below the cell. Give each week row breathing room so 3–4 events fit before
   the "+X more" chip appears. */
.calendar-modern .rbc-month-row { min-height: 5.5rem; }

.rbc-header {
  padding: 14px 10px;
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  background: linear-gradient(to bottom, hsl(var(--muted) / 0.3), hsl(var(--muted) / 0.1));
  border-bottom: 1px solid hsl(var(--border)) !important;
}
.rbc-header + .rbc-header { border-left: 1px solid hsl(var(--border) / 0.5) !important; }

.rbc-month-view {
  border: 1px solid hsl(var(--border) / 0.8);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,.05), 0 2px 4px -2px rgba(0,0,0,.05);
}
.rbc-month-row { border-bottom: 1px solid hsl(var(--border) / 0.6) !important; }
.rbc-month-row:last-child { border-bottom: none !important; }

.rbc-day-bg { transition: all 0.2s ease; }
.rbc-day-bg:hover { background-color: hsl(var(--primary) / 0.04); }
.rbc-day-bg + .rbc-day-bg { border-left: 1px solid hsl(var(--border) / 0.5) !important; }

/* !important like its neighbours: react-big-calendar's own stylesheet is imported from
   the page component and therefore lands in a LATER chunk. Without precedence its
   #e6e6e6 wins and out-of-month days glow light grey in dark mode. */
.rbc-off-range-bg {
  background: linear-gradient(135deg, hsl(var(--muted) / 0.15), hsl(var(--muted) / 0.08)) !important;
}

.rbc-today {
  background: linear-gradient(135deg, rgb(var(--calendar-accent) / 0.08), rgb(var(--calendar-accent) / 0.04)) !important;
  position: relative;
}
.rbc-today::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, rgb(var(--calendar-accent)), rgb(168 85 247));
}

.rbc-date-cell {
  padding: 8px 10px; font-size: 0.875rem; text-align: right; color: hsl(var(--foreground));
}
.rbc-date-cell.rbc-now { font-weight: 700; }
.rbc-date-cell.rbc-now a {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, rgb(99 102 241), rgb(168 85 247));
  color: white !important; font-weight: 600;
}

.rbc-event {
  border-radius: 6px; padding: 3px 8px; font-size: 0.75rem; font-weight: 500;
  /* WITHOUT !important: the inline style from eventPropGetter sets a 4px coloured left
     stripe carrying the appointment type. With !important this rule won, the stripe was
     never visible, and the intent in the code ran into nothing. `none` stays as the
     starting value so react-big-calendar's default border is gone. */
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.rbc-event:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 16px rgba(0,0,0,.12), 0 3px 6px rgba(0,0,0,.08);
  z-index: 10;
}
.rbc-event.rbc-selected { box-shadow: 0 0 0 2px white, 0 0 0 4px rgb(99 102 241); transform: scale(1.02); }
.rbc-event-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rbc-row-segment { padding: 0 2px 2px 2px; }

.rbc-show-more {
  color: rgb(99 102 241); font-weight: 600; font-size: 0.7rem; padding: 3px 8px;
  background: linear-gradient(135deg, rgb(224 231 255), rgb(243 232 255));
  border-radius: 6px; cursor: pointer; transition: all 0.2s ease; margin: 2px;
}
.rbc-show-more:hover {
  background: linear-gradient(135deg, rgb(199 210 254), rgb(233 213 255));
  transform: translateY(-1px);
}

/* ── Week and Day view ──────────────────────────────────────────────────── */
.rbc-time-view {
  border: 1px solid hsl(var(--border) / 0.8); border-radius: 1rem; overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,.05), 0 2px 4px -2px rgba(0,0,0,.05);
  display: flex; flex-direction: column;
}
.rbc-time-header {
  border-bottom: 1px solid hsl(var(--border)) !important;
  background: linear-gradient(to bottom, hsl(var(--muted) / 0.3), hsl(var(--muted) / 0.1));
  flex-shrink: 0; overflow: visible !important;
}
.rbc-time-header-content { border-left: 1px solid hsl(var(--border) / 0.5); }
.rbc-time-header-cell { padding: 12px 8px; min-width: 100px; }
.rbc-time-header-cell .rbc-header {
  font-weight: 600; font-size: 0.85rem; color: hsl(var(--foreground));
  text-align: center; border: none !important; padding: 8px 4px;
}
.rbc-time-header-gutter { width: 70px !important; min-width: 70px !important; flex-shrink: 0; }

/* The all-day row is hidden. See §12 "Known gaps" — all_day is stored and exported but
   has no all-day lane in week/day view. */
.rbc-allday-cell { display: none; }

.rbc-time-content { border-top: none !important; flex: 1; overflow-y: auto; }
.rbc-time-content > * + * > * { border-left: 1px solid hsl(var(--border) / 0.4) !important; }
.rbc-day-slot { min-width: 100px; }
.rbc-timeslot-group { border-bottom: 1px solid hsl(var(--border) / 0.3) !important; min-height: 50px; }
.rbc-time-slot {
  font-size: 0.75rem; color: hsl(var(--muted-foreground)); font-weight: 500;
  display: flex; align-items: flex-start; padding-top: 4px;
}
.rbc-time-gutter {
  background: hsl(var(--muted) / 0.1); width: 70px !important; min-width: 70px !important; flex-shrink: 0;
}
.rbc-time-gutter .rbc-timeslot-group { border-bottom: none !important; }
.rbc-time-gutter .rbc-time-slot { padding-right: 12px; justify-content: flex-end; }

.rbc-day-slot .rbc-event {
  border-radius: 6px !important; border-left-width: 4px !important;
  min-height: 24px; font-size: 0.75rem;
}
.rbc-day-slot .rbc-events-container { margin-right: 4px; }

.rbc-current-time-indicator {
  background: linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113));
  height: 2px; z-index: 3;
}
.rbc-current-time-indicator::before {
  content: ''; position: absolute; left: -6px; top: -5px; width: 12px; height: 12px;
  border-radius: 50%; background: linear-gradient(135deg, rgb(239 68 68), rgb(220 38 38));
  box-shadow: 0 2px 4px rgba(239,68,68,.4); animation: pulse-dot 2s infinite;
}
.rbc-time-header-cell.rbc-today {
  background: linear-gradient(to bottom, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
}
.rbc-day-slot.rbc-today { background: hsl(var(--primary) / 0.03); }

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.2); opacity: 0.8; }
}

/* ── Agenda view ────────────────────────────────────────────────────────── */
.rbc-agenda-view {
  border: 1px solid hsl(var(--border) / 0.8); border-radius: 1rem; overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,.05), 0 2px 4px -2px rgba(0,0,0,.05);
}
.rbc-agenda-view table { border-collapse: collapse; }
.rbc-agenda-view table thead th {
  background: linear-gradient(to bottom, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.2));
  font-weight: 600; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;
  color: hsl(var(--muted-foreground)); padding: 14px 16px; text-align: left;
  border-bottom: 1px solid hsl(var(--border));
}
.rbc-agenda-view table tbody tr {
  border-bottom: 1px solid hsl(var(--border) / 0.5); transition: background-color 0.15s ease;
}
.rbc-agenda-view table tbody tr:hover { background-color: hsl(var(--muted) / 0.3); }
.rbc-agenda-view table tbody tr:last-child { border-bottom: none; }
.rbc-agenda-view table tbody td { padding: 14px 16px; vertical-align: middle; }
.rbc-agenda-date-cell {
  font-size: 0.875rem; font-weight: 600; color: hsl(var(--foreground)); white-space: nowrap;
}
.rbc-agenda-time-cell {
  font-size: 0.8rem;
  /* Inherit #fff from the row (eventPropGetter); muted-foreground was unreadable
     on coloured rows. */
  color: inherit;
  font-weight: 600; white-space: nowrap;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}
.rbc-agenda-event-cell { font-weight: 500; font-size: 0.875rem; }

/* ── Built-in toolbar buttons (only used if you keep rbc's own toolbar) ──── */
.rbc-btn-group { display: flex; gap: 4px; }
.rbc-btn-group button {
  padding: 8px 14px; font-size: 0.8rem; font-weight: 500;
  border: 1px solid hsl(var(--border)); background: hsl(var(--card));
  color: hsl(var(--foreground)); border-radius: 8px; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rbc-btn-group button:hover {
  background: hsl(var(--muted)); border-color: hsl(var(--border)); transform: translateY(-1px);
}
.rbc-btn-group button.rbc-active {
  background: linear-gradient(135deg, rgb(99 102 241), rgb(139 92 246));
  color: white; border-color: transparent; box-shadow: 0 4px 12px rgba(99,102,241,.3);
}

/* ── "+N more" overlay ──────────────────────────────────────────────────── */
.rbc-overlay {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px;
  box-shadow: 0 20px 40px -10px rgba(0,0,0,.15), 0 10px 20px -5px rgba(0,0,0,.1);
  padding: 12px; min-width: 220px; animation: overlay-appear 0.2s ease-out;
}
@keyframes overlay-appear {
  from { opacity: 0; transform: translateY(-10px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.rbc-overlay-header {
  font-weight: 700; font-size: 0.875rem;
  border-bottom: 2px solid hsl(var(--border));
  background: linear-gradient(135deg, rgb(99 102 241 / .1), rgb(168 85 247 / .1));
  margin: -12px -12px 12px -12px; padding: 12px 16px; border-radius: 11px 11px 0 0;
}
.rbc-overlay .rbc-event { margin-bottom: 4px; }

/* ── Mobile (≤640px) ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .calendar-mobile .rbc-calendar     { font-size: 0.75rem; }
  .calendar-mobile .rbc-header       { padding: 4px 2px; font-size: 0.65rem; }
  .calendar-mobile .rbc-date-cell    { padding: 2px; font-size: 0.7rem; }
  .calendar-mobile .rbc-event        { padding: 1px 3px; font-size: 0.65rem; min-height: 16px; }
  .calendar-mobile .rbc-event-content{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .calendar-mobile .rbc-show-more    { font-size: 0.6rem; padding: 1px; }
  .calendar-mobile .rbc-toolbar      { flex-wrap: wrap; gap: 4px; }
  .calendar-mobile .rbc-btn-group button { padding: 4px 8px; font-size: 0.75rem; }
  .calendar-mobile .rbc-row-segment  { padding: 0 1px; }
  .calendar-mobile .rbc-today        { background-color: hsl(var(--secondary) / 0.15); }
  .calendar-mobile .rbc-month-row    { min-height: 60px; }

  .calendar-mobile .rbc-time-view .rbc-time-header-cell   { min-width: 60px; padding: 8px 4px; }
  .calendar-mobile .rbc-time-view .rbc-time-gutter        { width: 50px !important; min-width: 50px !important; font-size: 0.65rem; }
  .calendar-mobile .rbc-time-view .rbc-time-header-gutter { width: 50px !important; min-width: 50px !important; }
  .calendar-mobile .rbc-time-header-cell .rbc-header      { font-size: 0.7rem; padding: 4px 2px; }
  .calendar-mobile .rbc-time-slot     { min-height: 20px; font-size: 0.6rem; }
  .calendar-mobile .rbc-day-slot      { min-width: 60px; }
  .calendar-mobile .rbc-timeslot-group{ min-height: 40px; }
  .calendar-mobile .rbc-day-slot .rbc-event { font-size: 0.65rem; padding: 2px 4px; }

  .calendar-mobile .rbc-agenda-view table { font-size: 0.75rem; }
  .calendar-mobile .rbc-agenda-date-cell,
  .calendar-mobile .rbc-agenda-time-cell  { font-size: 0.7rem; padding: 4px; }
}
```

---

## 4. Calendar page architecture

### 4.1 Localizer and drag-and-drop setup

```tsx
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { de, fr, enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

// react-big-calendar resolves its date-fns locale through `culture`, so every dashboard
// locale must be registered here — the `culture` prop follows the operator's locale.
const locales = { "de-CH": de, "fr-CH": fr, "en-GB": enGB };

const localizer = dateFnsLocalizer({
  format, parse,
  // Monday start in all locales: Swiss/EU business convention, also correct for en-GB.
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);
```

Register **exactly** the locale tags Offerio ships, and pass `culture={LOCALE_TAGS[locale]}`
so the widget's own labels follow the operator's dashboard language. See §10.11 on the
hardcoded Monday.

### 4.2 The sliding load window — the core data decision

An earlier version fetched *every* appointment for the company with no time bound. Only one
month is ever visible, and what grows is the past: at 40 appointments a month, after two
years that is ~1,000 rows shipped on every calendar open with nothing more to see.

```tsx
/** How many months before and after the displayed month are loaded. Two months of margin
 *  is generous enough that paging by one month never refetches — and that the month grid
 *  always already has its spill-over days from the previous and next month. */
const FENSTER_MONATE = 2;

/** How far the displayed month may drift before the window re-centres. Smaller than
 *  FENSTER_MONATE, so the displayed month always stays inside the loaded range, even
 *  while a refetch is in flight. Paging further triggers a new query only after the
 *  second month. */
const FENSTER_NACHZIEHEN_AB = 1;

const [fensterMitte, setFensterMitte] = useState(() => startOfMonth(new Date()));

useEffect(() => {
  if (Math.abs(differenceInCalendarMonths(currentDate, fensterMitte)) > FENSTER_NACHZIEHEN_AB) {
    setFensterMitte(startOfMonth(currentDate));
  }
}, [currentDate, fensterMitte]);

const fensterVon = format(startOfMonth(subMonths(fensterMitte, FENSTER_MONATE)), "yyyy-MM-dd");
const fensterBis = format(endOfMonth(addMonths(fensterMitte, FENSTER_MONATE)), "yyyy-MM-dd");
```

Rename the identifiers to Offerio's language (`windowCentre`, `WINDOW_MONTHS`,
`WINDOW_RECENTRE_AT`), keep the numbers and the reasoning.

### 4.3 The stale-response guard — do not skip this

Once the window moves, successive queries are **not** interchangeable; each belongs to a
different time range. They do not return in the order they were issued. In the source system
this was measured: four queries fired within one second while paging fast, and the *second*
one answered last. Without a sequence number the last-arrived response wins over the
last-requested one, and the calendar shows one month populated with another month's
appointments.

While the window was fixed this was invisible, because every response carried the same data.

```tsx
const abfrageNummer = useRef(0);   // → `queryCounter`

const fetchAppointments = useCallback(async () => {
  if (!companyId) return;
  const mine = ++abfrageNummer.current;
  const isStale = () => mine !== abfrageNummer.current;

  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)      // explicit list, never "*"
      .eq("company_id", companyId)
      .gte("appointment_date", fensterVon)
      .lte("appointment_date", fensterBis)
      .order("appointment_date", { ascending: true });

    if (error) throw error;
    if (isStale()) return;
    setAppointments((data as Appointment[]) ?? []);
  } catch (e) {
    // The error of an overtaken query does not belong on screen either: it describes
    // a range nobody is looking at any more.
    if (isStale()) return;
    toast.error(t("calendar.toast.loadFailed"));
  } finally {
    // `loading` belongs to the newest query. Otherwise an overtaken one clears the
    // loading state while the current one is still in flight.
    if (!isStale()) setLoading(false);
  }
}, [companyId, t, fensterVon, fensterBis]);
```

The explicit column list is one string literal so the typed client checks the names at
compile time:

```ts
// prettier-ignore
const APPOINTMENT_COLUMNS = "id, company_id, lead_id, offer_id, appointment_type, status, appointment_date, start_time, end_time, duration_minutes, all_day, location_address, location_plz, location_city, location_notes, customer_first_name, customer_last_name, customer_email, customer_phone, title, description, internal_notes, assigned_team_member_ids, required_vehicles, required_equipment, reminder_sent_firma, reminder_sent_customer, confirmed_by_firma, confirmed_by_customer, created_at, is_recurring, parent_appointment_id, recurrence_pattern";
```

33 of 48 columns. The 15 left out (cancellation/reschedule notes, reminder timestamps,
recurrence end, location reference) never appear in the calendar.

### 4.4 Header KPIs are their own queries

The three numbers in the header (`today`, `open`, `this week`) must **not** be derived from
the loaded list, because the list only knows the window. Someone paging into next year would
read "0 today" — today is outside the window — and "open" counts across all time anyway.

```tsx
const [kennzahlen, setKennzahlen] = useState({ heute: 0, offen: 0, dieseWoche: 0 });

const fetchKennzahlen = useCallback(async () => {
  if (!companyId) return;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr   = format(addDays(weekStart, 6), "yyyy-MM-dd");

  // head: true → count only, no rows transferred. These queries stay the same size
  // no matter how many appointments accumulate.
  const [todayRes, openRes, weekRes] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId).eq("appointment_date", today),
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "pending"),
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("appointment_date", weekStartStr).lte("appointment_date", weekEndStr),
  ]);

  setKennzahlen({
    heute: todayRes.count ?? 0,
    offen: openRes.count ?? 0,
    dieseWoche: weekRes.count ?? 0,
  });
}, [companyId]);
```

Note the week bounds are compared **as strings**. `appointment_date` is a `yyyy-MM-dd` value,
and `new Date("2026-08-09")` parses as *UTC midnight* — 02:00 local in CEST — which pushed
Sunday past the local weekend in an earlier version.

The KPIs live in their own effect keyed on `companyId`, not on the window, so paging through
months does not re-count three times. A single `reload()` callback runs both fetches after
any mutation — refreshing only one leaves a counter that no longer matches the view.

### 4.5 Events, filters, and the filter chip row

```tsx
const [filters, setFilters] = useState({
  types: ["besichtigung", "service", "follow_up", "meeting", "blocked"],
  statuses: ["pending", "confirmed"],       // NOTE: not all six by default
  teamMemberIds: [] as string[],
});
```

The default hides `completed`, `cancelled`, `rescheduled`, and `no_show`. The calendar's job
is the work ahead; history is one checkbox away.

```tsx
const events: CalendarEvent[] = useMemo(() =>
  appointments
    .filter((apt) => {
      const typeMatch   = filters.types.includes(apt.appointment_type);
      const statusMatch = filters.statuses.includes(apt.status);
      const teamMatch   = filters.teamMemberIds.length === 0 ||
        (apt.assigned_team_member_ids?.some((id) => filters.teamMemberIds.includes(id)) ?? false);
      return typeMatch && statusMatch && teamMatch;
    })
    .map((apt) => ({
      id: apt.id,
      title: apt.title,
      start: new Date(`${apt.appointment_date}T${apt.start_time}`),
      end:   new Date(`${apt.appointment_date}T${apt.end_time}`),
      resource: {
        appointment: apt,
        type: apt.appointment_type,
        status: apt.status,
        teamMembers: teamMembers.filter((tm) => apt.assigned_team_member_ids?.includes(tm.id)),
      },
    })),
[appointments, filters, teamMembers]);
```

`new Date("2026-08-09T09:00:00")` (no `Z`) parses as **local** time — that is exactly what is
wanted here, and exactly what must *not* be assumed on the server (§8.2).

The filter button shows a count badge of how many filters deviate from the default:

```tsx
{(filters.types.length < 5 || filters.statuses.length < 6 || filters.teamMemberIds.length > 0) && (
  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-folk-coral
                   text-[9px] font-bold text-white">
    {5 - filters.types.length + 6 - filters.statuses.length + filters.teamMemberIds.length}
  </span>
)}
```

The `5` and `6` are the type and status cardinalities. **If you change the enums, change
these.** Better: derive them from `Object.keys(typeColors).length` and
`Object.keys(statusConfig).length` — the source system left them literal and that is a latent
bug, not a model to copy.

Below the toolbar, active type and team filters render as removable chips. Status filters
deliberately do not get chips (the default already excludes four statuses, so they would
always be on screen).

### 4.6 Interactions

**Drag and drop / resize — optimistic with rollback.** Both handlers are identical apart from
the toast:

```tsx
const handleEventDrop = useCallback(async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
  const appointment = event.resource.appointment;
  const { appointment_date: origDate, start_time: origStart, end_time: origEnd } = appointment;

  const newDate      = format(start as Date, "yyyy-MM-dd");
  const newStartTime = format(start as Date, "HH:mm:ss");
  const newEndTime   = format(end   as Date, "HH:mm:ss");

  setAppointments((prev) => prev.map((apt) =>
    apt.id === appointment.id
      ? { ...apt, appointment_date: newDate, start_time: newStartTime, end_time: newEndTime }
      : apt));

  try {
    const { error } = await supabase.from("appointments")
      .update({ appointment_date: newDate, start_time: newStartTime, end_time: newEndTime })
      .eq("id", appointment.id);
    if (error) throw error;
    toast.success(t("calendar.toast.moved"));
  } catch {
    setAppointments((prev) => prev.map((apt) =>
      apt.id === appointment.id
        ? { ...apt, appointment_date: origDate, start_time: origStart, end_time: origEnd }
        : apt));
    toast.error(t("calendar.toast.moveFailed"));
  }
}, [t]);
```

Resize writes `appointment_date` too, because dragging the bottom edge across midnight in
week view changes the date.

> **Deliberate gap:** drag-and-drop does **not** re-run conflict detection and does **not**
> notify the customer. It is an operator convenience for shuffling their own grid. Decide
> explicitly whether Offerio wants that — if you add a customer notification here, it must go
> through the same reschedule flow as §7, not a second ad-hoc mail.

**Slot selection.** Left click on a day sets `selectedDate` and clears `selectedEvent`,
opening the day list in the side panel. Clicking an event sets `selectedEvent`, opening the
detail card.

**Right-click context menu.** `react-big-calendar` has no context-menu hook, so the wrapper
`div` carries `onContextMenu` and resolves the date from the DOM:

```tsx
onContextMenu={(e) => {
  const target = e.target as HTMLElement;
  const dateCell = target.closest('[role="cell"]') || target.closest('.rbc-day-bg');
  if (dateCell) {
    const dateAttr = dateCell.getAttribute('data-date');
    if (dateAttr) handleSlotContextMenu(new Date(dateAttr), e);
    else          handleSlotContextMenu(selectedDate || currentDate, e);   // fallback
  }
}}
```

The menu is positioned with `Math.min(x, window.innerWidth - 190)` / `Math.min(y,
window.innerHeight - 90)` so it never leaves the viewport, and a document-level `click`
listener closes it. This is the fragile part of the page — it depends on
`react-big-calendar`'s internal DOM. If Offerio's version differs, verify `data-date` still
exists before shipping.

**Custom toolbar.** The built-in toolbar is replaced via `components.toolbar` with a
view-aware one: `◀ [Today] ▶` on the left, a formatted header on the right. Navigation steps
by day / week / month depending on the active view (the default `PREV`/`NEXT` always steps by
the view's own unit, which is right — but the custom one also fixes the header format per
view: `EEEE, d. MMMM yyyy` for day, `KW w · MMMM yyyy` for week, `MMMM yyyy` for month).

Other props worth copying:

```tsx
selectable
resizable
draggableAccessor={() => true}
popup                                    // "+N more" → overlay, not an expanded row
scrollToTime={(() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })()}
messages={messages}                      // every rbc label from the i18n catalog
culture={LOCALE_TAGS[locale]}
```

`scrollToTime` at 07:00 puts the working day at the top of week/day view instead of midnight.

### 4.7 Team week view

A second tab (`Cal | Team`) replacing the calendar with a resource grid: team members down
the side, the seven days of the current week across the top. Each cell shows that person's
appointments for that day plus their availability band from `team_availability`. Clicking a
cell opens an inline availability editor (`start_time`, `end_time`, `is_available`, `notes`);
clicking an appointment switches back to the calendar tab with that event selected.

`team_availability` carries two shapes in one table: `day_of_week` (0–6) for the recurring
weekly pattern, `specific_date` for a one-off exception. The specific date wins when both
match.

### 4.8 Detail card

Rendered in the side panel when an event is selected. Structure, top to bottom:

1. **Header band** (`bg-folk-bg-warm`) — type icon in a coloured `8×8` rounded square, type
   label, close button; then the title (`break-words`, not `truncate` — a long title must
   wrap, not vanish), then a status pill.
2. **Date and time tile** — `Clock` icon in an indigo circle, weekday + date, time range.
3. **Location tile** — only when `location_address` is set. `MapPin` in emerald.
4. **Customer block** — name, `tel:` link, `mailto:` link.
5. **Team chips** — initial avatar in the member's colour + first name.
6. **Description**.
7. **Live request summary** — `<AppointmentAnfrageSummary leadId={appointment.lead_id} />`
   fetches the linked lead and renders its key facts. Single source of truth; nothing is
   copied into the appointment at creation time beyond the customer snapshot.
8. **Internal notes** — amber card with a lock glyph. Never rendered on any customer surface.
9. **`CalendarExportMenu`** — §6.4.
10. **Actions** — `Confirm` when `pending`, `Complete` when `confirmed`, then `Edit` and
    `Cancel` side by side. `Cancel` is hidden once the appointment is `cancelled` or
    `completed`.

**Series cancellation.** If the appointment is a series member (`is_recurring ||
parent_appointment_id`), `Cancel` opens an `AlertDialog` offering *only this one* vs *the
whole series*:

```tsx
const handleCancelAppointment = async (id: string, scope: "single" | "series" = "single") => {
  const patch = { status: "cancelled", cancelled_by: "firma", cancelled_at: new Date().toISOString() };
  const appt = appointments.find((a) => a.id === id);
  const isSeries = scope === "series" && !!appt && (appt.is_recurring || !!appt.parent_appointment_id);

  let query = supabase.from("appointments").update(patch);
  if (isSeries) {
    // Cancel the whole series: the root (parent or self) + all its children.
    const rootId = appt!.parent_appointment_id ?? appt!.id;
    query = query.or(`id.eq.${rootId},parent_appointment_id.eq.${rootId}`);
  } else {
    query = query.eq("id", id);
  }
  const { error } = await query;
  // …toast + reload()
};
```

The root resolution (`parent_appointment_id ?? id`) is what makes cancelling from *any*
member of the series work, not just from the first one.

---

## 5. Appointment lifecycle

### 5.1 The modal

One dialog for create and edit (`max-w-2xl max-h-[90vh] overflow-y-auto`). Sections:

1. **Type picker** — five buttons in a `grid-cols-2 sm:grid-cols-5`, each an icon over a
   label. Selecting `blocked` reveals a hint explaining it blocks time without a customer.
2. **Title** (required) **and status**.
3. **Date, start, end** in a `grid-cols-3`. All-day and recurring checkboxes below.
4. **Request (lead) picker** — a `Select` listing the 50 most recent leads plus a "manual
   entry" option. Choosing one prefills customer, address, date, and title; choosing manual
   clears them.
5. **Customer fields**, **address** (with Google Places autocomplete), **notes**.
6. **Team members**, **vehicles**, **equipment** — checkbox lists from `team_members` and
   `firma_resources`.
7. **Conflict warning** — see §5.3.
8. **Recurrence** — pattern select + end date, shown only when recurring is checked.

Validation before save: title non-empty; if not all-day, `start_time < end_time`, duration
between **15 and 720 minutes**.

### 5.2 Document language is frozen at creation

```tsx
// DOCUMENT locale — inherited from the linked lead, else the company default.
// Written at CREATION only: the update path must not silently flip the language of an
// existing appointment whose confirmation mail already went out.
const { data: inserted, error } = await supabase
  .from("appointments")
  .insert([{ ...payload, language: leadLanguage ?? companyLanguage }])
  .select("id")
  .single();
```

The update path builds the same `payload` **without** `language`. See §9 for why this axis
exists at all.

### 5.3 Conflict detection — pure, tested, resource-aware

Two appointments only truly conflict when they overlap in time **and** share a resource. Two
independent crews on different jobs at the same hour is not a conflict. An earlier "any time
overlap" check flagged those as false positives, which trained operators to ignore the
warning and then miss the real double-bookings.

Copy this file as-is:

```ts
// Pure conflict detection for appointments. Tested; the modal feeds live rows in.
//
// Fallback: when the candidate has NO resources assigned yet, resource matching is
// impossible, so we fall back to plain time-overlap (informational).

export interface ConflictCandidate {
  id?: string | null;
  start_time: string;              // "HH:MM" or "HH:MM:SS"
  end_time: string;
  assigned_team_member_ids?: string[] | null;
  required_vehicles?: string[] | null;
}

export interface ConflictResult<T> {
  appointment: T;
  /** Which resource classes overlap. Empty => time-only (candidate had no resources). */
  sharedTeam: boolean;
  sharedVehicles: boolean;
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart < bEnd && aEnd > bStart;

const intersects = (a: string[] | null | undefined, b: string[] | null | undefined): boolean => {
  if (!a || !b || a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((x) => set.has(x));
};

/**
 * Returns the existing appointments that genuinely conflict with the candidate.
 * The caller is expected to have already narrowed `existing` to the same day/company
 * and excluded cancelled + the candidate itself (kept flexible here for testability).
 */
export function detectConflicts<T extends ConflictCandidate>(
  candidate: ConflictCandidate,
  existing: T[],
): ConflictResult<T>[] {
  const hasResources =
    (candidate.assigned_team_member_ids?.length ?? 0) > 0 ||
    (candidate.required_vehicles?.length ?? 0) > 0;

  const out: ConflictResult<T>[] = [];
  for (const apt of existing) {
    if (apt.id && candidate.id && apt.id === candidate.id) continue;
    if (!overlaps(candidate.start_time, candidate.end_time, apt.start_time, apt.end_time)) continue;

    if (!hasResources) {
      // No resources on the candidate → can't match; surface time overlap only.
      out.push({ appointment: apt, sharedTeam: false, sharedVehicles: false });
      continue;
    }
    const sharedTeam     = intersects(candidate.assigned_team_member_ids, apt.assigned_team_member_ids);
    const sharedVehicles = intersects(candidate.required_vehicles, apt.required_vehicles);
    if (sharedTeam || sharedVehicles) {
      out.push({ appointment: apt, sharedTeam, sharedVehicles });
    }
  }
  return out;
}
```

Note `overlaps` compares `"HH:MM"` strings lexicographically. That is correct for
zero-padded 24-hour times and avoids constructing `Date` objects — but it means the caller
must never pass a non-padded time. Add a test for `"9:00"` if Offerio's inputs can produce it.

Wiring in the modal — debounced, with its own stale-response guard:

```tsx
const conflictRequestIdRef = useRef(0);

useEffect(() => {
  if (!companyId || !formData.appointment_date) { setConflicts([]); return; }

  const timeoutId = setTimeout(async () => {
    const requestId = ++conflictRequestIdRef.current;

    const { data } = await supabase
      .from("appointments")
      .select("…explicit columns…")
      .eq("company_id", companyId)
      .eq("appointment_date", formData.appointment_date)
      .neq("status", "cancelled")
      .neq("id", appointment?.id ?? "00000000-0000-0000-0000-000000000000");

    if (requestId !== conflictRequestIdRef.current) return;

    setConflicts(detectConflicts({
      id: appointment?.id ?? null,
      start_time: formData.start_time,
      end_time: formData.end_time,
      assigned_team_member_ids: formData.assigned_team_member_ids,
      required_vehicles: formData.required_vehicles,
    }, (data ?? []) as Appointment[]));
  }, 300);

  return () => clearTimeout(timeoutId);
}, [formData.appointment_date, formData.start_time, formData.end_time,
    formData.assigned_team_member_ids, formData.required_vehicles, companyId, appointment]);
```

Conflicts are a **warning**, never a block. Operators sometimes need to double-book
knowingly. The alert names the conflicting appointment and says *which* resource class
collides (team, vehicle, or time-only).

### 5.4 Recurring series

After inserting a recurring parent, the modal calls an RPC:

```sql
CREATE OR REPLACE FUNCTION public.generate_recurring_appointments(
  p_parent_id uuid,
  p_end_date  date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_parent    record;
  v_next_date date;
  v_count     integer := 0;
  v_end_date  date;
  v_interval  interval;
BEGIN
  SELECT * INTO v_parent
  FROM public.appointments
  WHERE id = p_parent_id AND is_recurring = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent appointment not found or not recurring';
  END IF;

  -- Hard ceiling: never generate more than a year ahead.
  v_end_date := COALESCE(p_end_date, v_parent.recurrence_end_date,
                         v_parent.appointment_date + INTERVAL '1 year');

  v_interval := CASE v_parent.recurrence_pattern
    WHEN 'daily'    THEN INTERVAL '1 day'
    WHEN 'weekly'   THEN INTERVAL '1 week'
    WHEN 'biweekly' THEN INTERVAL '2 weeks'
    WHEN 'monthly'  THEN INTERVAL '1 month'
    ELSE INTERVAL '1 week'
  END;

  v_next_date := v_parent.appointment_date + v_interval;

  WHILE v_next_date <= v_end_date LOOP
    INSERT INTO public.appointments (
      company_id, lead_id, offer_id, appointment_type, status,
      appointment_date, start_time, end_time, duration_minutes, all_day,
      location_address, location_plz, location_city, location_notes,
      customer_first_name, customer_last_name, customer_email, customer_phone,
      title, description, internal_notes,
      assigned_team_member_ids, required_vehicles, required_equipment,
      language, parent_appointment_id, is_recurring
    )
    SELECT
      v_parent.company_id, v_parent.lead_id, v_parent.offer_id,
      v_parent.appointment_type, 'pending'::public.appointment_status,
      v_next_date, v_parent.start_time, v_parent.end_time,
      v_parent.duration_minutes, v_parent.all_day,
      v_parent.location_address, v_parent.location_plz, v_parent.location_city,
      v_parent.location_notes,
      v_parent.customer_first_name, v_parent.customer_last_name,
      v_parent.customer_email, v_parent.customer_phone,
      v_parent.title, v_parent.description, v_parent.internal_notes,
      v_parent.assigned_team_member_ids, v_parent.required_vehicles,
      v_parent.required_equipment,
      v_parent.language, v_parent.id, false;

    v_count := v_count + 1;
    v_next_date := v_next_date + v_interval;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_appointments(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_recurring_appointments(uuid, date) TO authenticated;
```

**Two things to fix while porting.** ① `SECURITY DEFINER` with no membership check means any
authenticated user who knows a parent UUID can generate rows in another tenant. In
single-tenant that was harmless; in Offerio it is a tenant-isolation hole. Add
`IF NOT public.is_company_member(v_parent.company_id) THEN RAISE EXCEPTION …` right after the
`SELECT INTO`. ② Children get `is_recurring = false` and `parent_appointment_id = parent.id`,
which is what makes the series-cancel `or()` filter in §4.8 work — keep that shape.

The frontend call in the source system is written as `(supabase as any).rpc(...)` with an
eslint-disable. **Do not copy that.** Regenerate Offerio's Supabase types after the migration
so the RPC is typed.

### 5.5 Confirmation mail on creation

After a successful insert, and only when the type is neither `blocked` nor `meeting` (those
have no customer), the modal invokes the confirmation edge function. Note the explicit
session handling — this pattern exists because an expired token silently produced a
"created, no mail" outcome:

```tsx
const { data: { session: initial }, error: sessionError } = await supabase.auth.getSession();
if (sessionError) throw sessionError;

let activeSession = initial;
if (!activeSession?.access_token) {
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  activeSession = refreshed.session;
}
if (!activeSession?.access_token) throw new Error(t("calendar.modal.error.noSession"));

const { data: emailData, error: emailErr } = await supabase.functions.invoke(
  "send-appointment-confirmation",
  { body: { appointmentId: inserted.id },
    headers: { Authorization: `Bearer ${activeSession.access_token}` } },
);
```

Three distinct outcomes get three distinct toasts: sent, `emailData.skipped` (with the
reason), and failed. If `customer_email` is empty, a warning toast fires and the function is
never called. **Never** let a mail failure roll back the appointment — the row is saved
either way, and the operator is told what did not happen.

---

## 6. Automation

### 6.1 Auto-create an appointment when an offer is accepted

The public token RPC that records a customer's offer acceptance also inserts a `service`
appointment. Two properties matter:

**Idempotent** — a `NOT EXISTS` guard means a double-click on "accept" cannot create two jobs:

```sql
WHERE o.access_token = offer_access_token
  AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.offer_id = o.id AND a.appointment_type = 'service'
  );
```

**Time derivation with a documented fallback ladder** — `CROSS JOIN LATERAL` stages so each
step can reference the previous one:

```sql
-- start: explicit offer time → lead's preferred slot → 09:00
COALESCE(
  o.service_start_time::time,
  CASE
    WHEN l.preferred_time_slot = 'morning'   THEN '08:00:00'::time
    WHEN l.preferred_time_slot = 'afternoon' THEN '13:00:00'::time
    WHEN COALESCE(l.preferred_time_slot, '') ~ '^\d{1,2}:\d{2}' THEN
      substring(l.preferred_time_slot from '(\d{1,2}:\d{2})')::time
    ELSE '09:00:00'::time
  END
) AS start_time

-- end: explicit offer time → start + 2h
COALESCE(o.service_end_time::time, (start_calc.start_time + interval '2 hour')::time) AS end_time

-- duration: at least 15 minutes; 120 if end <= start (bad data)
CASE WHEN end_calc.end_time > start_calc.start_time
     THEN GREATEST(15, (extract(epoch from (end_calc.end_time - start_calc.start_time)) / 60)::int)
     ELSE 120 END AS duration_minutes
```

The row is created with `status = 'pending'`, `confirmed_by_customer = true` (they *did*
accept), and `internal_notes = 'Created automatically from accepted offer.'` so the operator
knows where it came from. `appointment_date` falls back
`offer.service_date → lead.preferred_date → CURRENT_DATE`.

**Port note:** copy the `language` column through from the offer (`o.language`) — the source
migration predates the language axis and omits it, which means auto-created appointments fall
back to the column default. Fix that while porting.

### 6.2 Reminder cron

A `pg_cron` job every 15 minutes calls a `SECURITY DEFINER` function that `net.http_post`s
the reminder edge function:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_appointment_reminder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  request_id  bigint;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'service_role_key missing from vault';
  END IF;

  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/notify-appointment-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || service_key),
    body    := '{}'::jsonb
  ) INTO request_id;
END;
$$;

SELECT cron.schedule('appointment-reminder-check', '*/15 * * * *',
                     $$SELECT public.invoke_appointment_reminder()$$);
```

> ⚠️ **The source version of this function is wrong and you must not copy it.** It hardcodes
> the project URL *and* falls back to a hardcoded service-role JWT literal in the migration
> file when the vault lookup fails. A service-role key in a checked-in migration is a
> credential in version control. The version above fails loudly instead. Use Offerio's own
> convention for reaching the function URL and the key (a `current_setting`, a vault entry, a
> `cron` secret — whatever Offerio already does), and make the missing-secret case an
> exception, never a fallback.

The edge function itself, per run:

1. Runs two queries, both filtered `status IN ('pending','confirmed')`:
   - **today's** appointments, all types → drives the hour-band reminders below;
   - **tomorrow's** `besichtigung` appointments → the day-before reminder.
2. Computes `hoursUntil` by converting the wall-clock date+time to UTC in the app timezone.
   **This conversion is the whole point** — `new Date("2026-07-03T14:00:00")` in a UTC
   container reads as 14:00 UTC and overstates "hours until" by the offset.
3. Two reminder bands:
   - `0.5 < hoursUntil <= 1.5` → the **1-hour** reminder, which includes the customer cancel
     action link (§7).
   - `1.5 < hoursUntil <= 2.5` and `NOT reminder_sent_firma` → the **2-hour** reminder.
4. Every send is recorded in `appointment_reminders` (`appointment_id`, `recipient_type`,
   `reminder_type`, `status`, `error_message`). That table — not a boolean on the appointment
   — is what makes the 15-minute cadence idempotent across overlapping bands.
5. Recipient languages are resolved **separately**: the firm reads its own dashboard
   language, the customer reads `appointments.language`. Two `t()` instances, one per
   recipient. See §9.
6. Logs mask PII: `maskEmail` keeps the first two characters, `maskPhone` the first four.

The cron endpoint authenticates via a shared-secret check (`isCronRequest`), not via JWT.

### 6.3 Other notification functions

| Function | Trigger | Notes |
|---|---|---|
| `send-appointment-confirmation` | Modal, on create | Authenticates the caller's JWT, loads the appointment + company, picks the sending identity (tenant's own Resend key vs. system key) but **never** lets that choice affect the language. Logs to `email_logs`. |
| `notify-appointment-cancelled` | Cancellation, either side | |
| `notify-appointment-reschedule` | Reschedule proposal | Sends the customer a token link to accept or decline |

All three share `_shared/` helpers for the e-mail layout, HTML escaping, i18n, and company
secrets. **Port the secret handling as Offerio does it** — the source system moved tenant
Resend keys out of the `companies` table into a separate `company_secrets` table precisely so
a `companies` read cannot leak them.

### 6.4 Per-appointment "add to my calendar"

`CalendarExportMenu` is a dropdown offering Google, Apple (ICS download), Outlook.com,
Office 365, Yahoo, a plain `.ics` download, and a QR code of the event. `lib/calendarSync.ts`
holds the pure builders:

```ts
export interface CalendarEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  allDay?: boolean;
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string
export function generateOutlookCalendarUrl(event: CalendarEvent): string
export function generateOffice365CalendarUrl(event: CalendarEvent): string
export function generateYahooCalendarUrl(event: CalendarEvent): string
export function generateIcsContent(event: CalendarEvent): string
export function downloadIcsFile(event: CalendarEvent, filename?: string): void
export function openCalendarUrl(url: string): void
export function detectPreferredCalendar(): "google" | "apple" | "outlook" | "other"
```

This is a **one-shot copy** of a single event and is entirely separate from the subscription
feed in §8. Both exist because they answer different questions: "put this one job in my
phone" vs. "keep my phone in sync with the CRM". Do not merge them.

The detail card builds the event from the appointment:

```tsx
const calendarEvent: ICSCalendarEvent = {
  title: appointment.title,
  description: appointment.description || undefined,
  startDate: new Date(`${appointment.appointment_date}T${appointment.start_time}`),
  endDate:   new Date(`${appointment.appointment_date}T${appointment.end_time}`),
  location: [appointment.location_address, appointment.location_plz, appointment.location_city]
    .filter(Boolean).join(", ") || undefined,
  allDay: appointment.all_day,
};
```

Note `internal_notes` is **not** included. Neither is `location_notes`. Same rule as the feed.

---

## 7. Customer-facing actions — capability tokens

### The problem this solves

The first version of the public cancel page read `appointments` and `companies` directly from
the browser and wrote the status back the same way. That cannot work: RLS is on and the only
policies are for members. And the link carried the customer's **e-mail address in the query
string** — personal data in browser history, in the `Referer` header, and in every access log
on the path.

### The design

**A random capability token per appointment**, plus two `SECURITY DEFINER` functions that
expose exactly the fields the public page needs. RLS and table grants stay untouched; the
public path goes *only* through the functions.

```sql
ALTER TABLE public.appointments
  ADD COLUMN customer_action_token            text,
  ADD COLUMN customer_action_token_expires_on date;

CREATE UNIQUE INDEX appointments_customer_action_token_uniq
  ON public.appointments (customer_action_token)
  WHERE customer_action_token IS NOT NULL;
```

- `get_appointment_by_action_token(p_id uuid, p_token text)` — read path. Returns title,
  date, time, address, company name. **Never** `internal_notes`, `location_notes`, or
  `description`.
- `cancel_appointment_by_action_token(p_id uuid, p_company uuid, p_token text)` — write path.
  Sets `status='cancelled'`, `cancelled_by='customer'`, `cancelled_at=now()`.

Both are `EXECUTE`-granted narrowly. Routes: `/termin/:appointmentId/absagen`,
`/termin/:appointmentId/verschieben`, `/termin/:appointmentId/antwort` (rename to Offerio's
URL vocabulary).

### The trigger hardening — do not skip this

The change log trigger (`log_appointment_changes()`) writes `old_data`/`new_data` JSON into
`appointment_history`. Left alone, it would write **the capability token in plaintext** into
the audit table on every appointment change. The migration therefore does three things in one
transaction:

1. Strips capability fields from what the trigger writes going forward.
2. Removes them from the `old_data`/`new_data` already stored.
3. Covers not only the new column but also the older `reschedule_token` /
   `reschedule_token_expires_at` pair, which the old logger had been writing all along — the
   hardening closes a leak that is older than the migration that motivated it.

**The rollback for this migration is deliberately asymmetric:** it drops the columns, the
index, and the preview function, but leaves the trigger hardening in place and does *not*
restore the scrubbed history fields. Otherwise a rollback would start writing the still-
present `reschedule_*` values back into history in plaintext on the next change. Write the
same asymmetry into Offerio's rollback, and write the reason at the top of the file.

**Sequencing rule:** the token column and the trigger that would log it must never go live
separately. One migration, one transaction.

---

## 8. Calendar subscription (webcal / ICS)

Staff subscribe to their CRM appointments from Apple Calendar, Google Calendar, or Outlook.

**The constraint that shapes everything:** a calendar client cannot send an `Authorization`
header or an `apikey`. The token in the URL is the *only* access control. Therefore:

- only the SHA-256 hash is stored; the plaintext exists exactly once, in the RPC's return
  value, and after that only with the user;
- every error response is a bare `404 text/plain` — no JSON, no reason, no echo of the token.
  A feed client can do nothing with a reason, and neither can an attacker;
- logs carry at most the first 8 characters of a token;
- the feed runs under `service_role`, so **RLS carries nothing there** — the explicit
  `company_id` filter from the token row *is* the tenant boundary. Every query in the handler
  must carry it.

### 8.1 Migration — token table and generator

Copy this, then apply the §10.1 correction to `create_calendar_feed_token`.

```sql
-- Calendar subscription (webcal/ICS): feed tokens.
--
-- ── What this is ──────────────────────────────────────────────────────────
-- Staff subscribe to their CRM appointments in Apple/Google/Outlook. A calendar
-- client cannot send an Authorization header, so the subscription URL carries a
-- secret: a 32-byte token. This table stores ONLY its SHA-256 hex hash — the
-- plaintext exists exactly once, in the return value of
-- create_calendar_feed_token(), and after that only with the user. A dump of
-- this table opens not a single feed.
--
-- The read path (edge function `calendar-feed`) runs under service_role and
-- ALWAYS filters explicitly on the token row's company_id — RLS carries nothing
-- there; the row itself is the tenant boundary.
--
-- ── Why generation is a SECURITY DEFINER function ─────────────────────────
-- company_id must never come from the client. The function derives it from the
-- membership of auth.uid(). Direct client INSERTs stay confined to the caller's
-- own company by RLS, but only the function guarantees plaintext-once +
-- hash-in-the-database.
--
-- No anon access: no policy, no GRANT, no EXECUTE. The verification block at the
-- bottom insists on it.

BEGIN;

-- ── 1. Table ───────────────────────────────────────────────────────────────

CREATE TABLE public.calendar_feed_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256 of the plaintext token, hex, lowercase. NEVER the plaintext.
  token_hash   text NOT NULL UNIQUE,
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Advanced by the edge function at most every 15 minutes — a "last used"
  -- display, not an audit log.
  last_used_at timestamptz,
  -- Revocation is an UPDATE, not a DELETE: the row stays as evidence, and the
  -- feed answers 404 from that moment on.
  revoked_at   timestamptz
);

COMMENT ON TABLE public.calendar_feed_tokens IS
  'Tokens for the webcal/ICS appointment subscription. Contains SHA-256 hashes only; '
  'the plaintext is returned exactly once by create_calendar_feed_token().';

-- The UNIQUE constraint on token_hash provides the feed's lookup index.
-- One more for the token list in settings:
CREATE INDEX idx_calendar_feed_tokens_company
  ON public.calendar_feed_tokens (company_id);

-- ── 2. Privileges and RLS ──────────────────────────────────────────────────
-- Take everything away first, then grant deliberately, so an earlier run or
-- DEFAULT PRIVILEGES cannot leave something else behind.

REVOKE ALL ON TABLE public.calendar_feed_tokens
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.calendar_feed_tokens TO authenticated;
GRANT ALL ON TABLE public.calendar_feed_tokens TO service_role;

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

-- No DELETE: revocation sets revoked_at. No anon: a feed client knows only the
-- token, never this table.
CREATE POLICY calendar_feed_tokens_select ON public.calendar_feed_tokens
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY calendar_feed_tokens_insert ON public.calendar_feed_tokens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY calendar_feed_tokens_update ON public.calendar_feed_tokens
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- ── 3. Token generation ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_calendar_feed_token(p_label text DEFAULT NULL)
RETURNS TABLE (id uuid, token text, label text, created_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  k_max_label constant integer := 80;
  v_company   uuid;
  v_count     integer;
  v_label     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Company FROM the membership, never from the caller.
  -- ⚠️ SINGLE-TENANT ASSUMPTION — see §10.1 before porting.
  SELECT count(*) INTO v_count
  FROM public.company_members cm
  WHERE cm.user_id = auth.uid();

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one company membership, found %', v_count;
  END IF;

  SELECT cm.company_id INTO v_company
  FROM public.company_members cm
  WHERE cm.user_id = auth.uid();

  v_label := nullif(btrim(coalesce(p_label, '')), '');
  IF length(v_label) > k_max_label THEN
    RAISE EXCEPTION 'label is longer than % characters', k_max_label;
  END IF;

  -- 32 random bytes, hex → 64 characters. Only the hash lands in the database;
  -- the plaintext leaves the function exactly once, via the RETURNS column.
  token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.calendar_feed_tokens (company_id, user_id, token_hash, label)
  VALUES (v_company, auth.uid(),
          encode(extensions.digest(token, 'sha256'), 'hex'),
          v_label)
  RETURNING calendar_feed_tokens.id, calendar_feed_tokens.created_at
  INTO id, created_at;

  label := v_label;
  RETURN NEXT;
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.create_calendar_feed_token(text) IS
  'Creates a calendar feed token for the signed-in user''s company. Returns the '
  'plaintext exactly once; only the SHA-256 hash is stored. authenticated only — '
  'anon and service_role have no EXECUTE.';

REVOKE ALL ON FUNCTION public.create_calendar_feed_token(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_calendar_feed_token(text) TO authenticated;

-- ── 4. Verification, fail-closed ───────────────────────────────────────────
-- The catalog is measured, not the intention. If a check fails, the exception
-- takes the whole transaction with it.
DO $$
DECLARE v_count integer;
BEGIN
  -- 1. RLS really is on.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'calendar_feed_tokens' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Check 1: RLS is not active on calendar_feed_tokens';
  END IF;

  -- 2. Exactly three policies, all for authenticated only.
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'calendar_feed_tokens';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Check 2: expected exactly 3 policies, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'calendar_feed_tokens'
    AND roles <> ARRAY['authenticated']::name[];
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Check 2: % policy/policies are not exclusively for authenticated', v_count;
  END IF;

  -- 3. anon can reach nothing.
  IF has_table_privilege('anon', 'public.calendar_feed_tokens', 'SELECT')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'INSERT')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'UPDATE')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'DELETE') THEN
    RAISE EXCEPTION 'Check 3: anon has table privileges on calendar_feed_tokens';
  END IF;
  IF has_function_privilege('anon', 'public.create_calendar_feed_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check 3: anon can execute create_calendar_feed_token';
  END IF;

  -- 4. authenticated can do exactly what is intended.
  IF NOT has_function_privilege('authenticated', 'public.create_calendar_feed_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check 4: authenticated CANNOT execute create_calendar_feed_token';
  END IF;
  IF has_table_privilege('authenticated', 'public.calendar_feed_tokens', 'DELETE') THEN
    RAISE EXCEPTION 'Check 4: authenticated may DELETE — revocation is meant to be an UPDATE';
  END IF;
END;
$$;

COMMIT;
```

**Adopt the fail-closed verification block as a habit, not just here.** It measures
`pg_class`, `pg_policies`, `has_table_privilege`, and `has_function_privilege` — the catalog,
not the intention — and takes the transaction down if reality disagrees with the comment.
Extend the policy-count assertion if Offerio's RLS shape needs a fourth policy.

Rollback:

```sql
-- Rollback for the calendar feed token migration.
--
-- Removes token generation and the token table completely. Consequence: EVERY
-- existing calendar subscription answers 404 from that moment on — the feeds are
-- dead, not paused. The `calendar-feed` edge function itself stays deployed and
-- is harmless without the table (every lookup fails).

BEGIN;
DROP FUNCTION IF EXISTS public.create_calendar_feed_token(text);
DROP TABLE IF EXISTS public.calendar_feed_tokens;
COMMIT;
```

### 8.2 `ics.ts` — the pure RFC 5545 serializer

Deliberately free of Deno APIs and remote imports so a normal test runner can cover it. 20
unit tests in the source system. Copy verbatim; change only `Europe/Zurich` per §10.3.

```ts
// Pure ICS (RFC 5545) serializer for the calendar-feed edge function.
//
// Times: `appointments` stores wall-clock Europe/Zurich values (appointment_date DATE +
// start_time/end_time TIME, no timezone). The feed emits UTC (`...Z`) and no VTIMEZONE,
// so the DST offset must be computed per date — a fixed +1/+2 would silently shift half
// the year.

export interface IcsEvent {
  uid: string;
  /** Wall-clock local date, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock local times, `HH:MM` or `HH:MM:SS`. */
  startTime: string;
  endTime: string;
  summary: string;
  location: string;
  description: string;
  /** VEVENT STATUS: TENTATIVE | CONFIRMED | CANCELLED. */
  status: string;
  /** ISO timestamp the row last changed — drives DTSTAMP/LAST-MODIFIED/SEQUENCE. */
  updatedAt: string;
}

export interface IcsCalendar {
  calendarName: string;
  /** Hex colour, e.g. "#7C3AED" — the calendar UI colour of the appointment type. */
  color: string;
  prodId: string;
  events: IcsEvent[];
}

const encoder = new TextEncoder();

/** Escape a TEXT value per RFC 5545 §3.3.11: backslash, semicolon, comma, newline. */
export const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1). Continuations carry a leading space
 * that counts toward their 75-octet budget. Folding is grapheme-blind but code-point-aware:
 * a multi-byte UTF-8 character is never split in the middle.
 */
export const foldIcsLine = (line: string): string => {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let used = 0;
  for (const ch of line) {
    const width = encoder.encode(ch).length;
    if (used + width > 75) {
      parts.push(current);
      current = "";
      used = 1; // the continuation's leading space
    }
    current += ch;
    used += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

/**
 * Minute offset of the app timezone at a given UTC instant, via Intl — the only DST
 * source available without a timezone-database dependency.
 */
const zoneOffsetMs = (utcTs: number): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",            // ← §10.3: make this a parameter
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcTs))) parts[p.type] = p.value;
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24,   // some engines emit "24" for midnight
    Number(parts.minute), Number(parts.second),
  );
  return wallAsUtc - utcTs;
};

/**
 * Convert a local wall-clock date+time to a UTC instant. Two iterations converge on the
 * correct offset across DST transitions: the first guess treats the wall time as UTC, the
 * second corrects with the offset valid at the (nearly right) instant.
 */
export const wallToUtc = (date: string, time: string): Date => {
  const t = time.length === 5 ? `${time}:00` : time;
  let ts = Date.parse(`${date}T${t}Z`);
  ts = Date.parse(`${date}T${t}Z`) - zoneOffsetMs(ts);
  ts = Date.parse(`${date}T${t}Z`) - zoneOffsetMs(ts);
  return new Date(ts);
};

/** UTC basic format: YYYYMMDDTHHMMSSZ. */
export const toIcsUtc = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const contentLine = (name: string, value: string): string => foldIcsLine(`${name}:${value}`);

/**
 * Serialize one calendar. Every emitted timestamp derives from stored data (never "now"),
 * so the same DB state always yields byte-identical output — that determinism is what
 * makes the ETag/304 handling real.
 */
export const buildIcsCalendar = (cal: IcsCalendar): string => {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    contentLine("PRODID", cal.prodId),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "X-WR-TIMEZONE:Europe/Zurich",
    contentLine("X-WR-CALNAME", escapeIcsText(cal.calendarName)),
    contentLine("X-APPLE-CALENDAR-COLOR", cal.color),
  ];

  for (const ev of cal.events) {
    const start = wallToUtc(ev.date, ev.startTime);
    let end = wallToUtc(ev.date, ev.endTime);
    // end_time <= start_time can only mean the appointment crosses midnight (both columns
    // are TIME on one date row); read it as ending the next day.
    if (end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const changed = new Date(ev.updatedAt);
    const changedValid = !Number.isNaN(changed.getTime()) ? changed : start;

    lines.push(
      "BEGIN:VEVENT",
      contentLine("UID", ev.uid),
      contentLine("DTSTAMP", toIcsUtc(changedValid)),
      contentLine("DTSTART", toIcsUtc(start)),
      contentLine("DTEND", toIcsUtc(end)),
      contentLine("SUMMARY", escapeIcsText(ev.summary)),
      contentLine("LOCATION", escapeIcsText(ev.location)),
      contentLine("DESCRIPTION", escapeIcsText(ev.description)),
      contentLine("STATUS", ev.status),
      contentLine("LAST-MODIFIED", toIcsUtc(changedValid)),
      // SEQUENCE must grow with every change; epoch seconds of updated_at do that
      // without storing a counter.
      contentLine("SEQUENCE", String(Math.floor(changedValid.getTime() / 1000))),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
};
```

Four decisions worth understanding before you touch this:

1. **No `VTIMEZONE`, everything in UTC.** Simpler and universally supported — at the cost of
   needing a correct per-date DST offset, which `zoneOffsetMs` provides via `Intl`.
2. **Two-iteration convergence** in `wallToUtc`. One pass is wrong within an hour of a DST
   transition; two passes converge.
3. **`SEQUENCE` from `updated_at` epoch seconds.** RFC requires it to increase on every
   change. Deriving it from the timestamp avoids a counter column.
4. **Nothing depends on "now".** That is what makes the ETag a real ETag (§8.3).

### 8.3 `calendar-feed/index.ts` — the endpoint

```ts
/**
 * webcal/ICS subscription for CRM appointments.
 *
 *   GET /functions/v1/calendar-feed?token=<64-hex>&typ=<type>
 *
 * Calendar clients (Apple/Google/Outlook) can send neither an Authorization header nor an
 * apikey — the token in the URL is the ONLY access control. Therefore:
 *
 * - Only the SHA-256 hash is compared against `calendar_feed_tokens.token_hash`; the
 *   plaintext exists nowhere in the database.
 * - Every error response is a bare 404 in text/plain. No JSON, no reason, no echo of the
 *   token — a feed client can do nothing with that, and neither can an attacker.
 * - Logs carry at most the first 8 characters of a token.
 *
 * The function runs under service_role: RLS carries NOTHING here. The tenant boundary is
 * the explicit `company_id` filter from the token row — every query below must carry it.
 *
 * Feed split: one subscription per appointment type, plus `typ=other` as a catch-all for
 * anything that is not one of the known types (structurally empty today, because
 * appointment_type is a NOT NULL enum — if the enum grows, `other` catches the new values
 * until the feed knows them). The feeds are pairwise disjoint and their union is the whole
 * set.
 *
 * Never in the feed: internal_notes, description, completion_notes, cancellation_reason,
 * location_notes — only title, customer, address, phone.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildIcsCalendar, IcsEvent } from "./ics.ts";

const KNOWN_TYPES = ["besichtigung", "service", "follow_up", "meeting", "blocked"] as const;
type KnownType = (typeof KNOWN_TYPES)[number];
type FeedTyp = KnownType | "other";

// Colours = the --cal-* values from index.css (calendar UI); plurals = the German catalog
// labels. Hardcoded on purpose: the edge function must not pull frontend modules, and these
// values change together with the calendar UI — when index.css changes, follow up here.
// ⚠️ See §10.4: in a multi-tenant, multi-locale system these must not stay German literals.
const TYPE_META: Record<FeedTyp, { color: string; plural: string; label: string }> = {
  besichtigung: { color: "#7C3AED", plural: "Besichtigungen",    label: "Besichtigung" },
  service:      { color: "#047857", plural: "Dienstleistungen",  label: "Dienstleistung" },
  follow_up:    { color: "#B45309", plural: "Nachfassen",        label: "Nachfassen" },
  meeting:      { color: "#2563EB", plural: "Besprechungen",     label: "Besprechung" },
  blocked:      { color: "#4B5563", plural: "Blockierte Zeiten", label: "Blockiert" },
  other:        { color: "#6B7280", plural: "Weitere Termine",   label: "Termin" },
};

// VEVENT STATUS knows only three values. `rescheduled` is CANCELLED because the row was
// replaced by a successor; `no_show` and `completed` did take place and stay CONFIRMED.
const STATUS_MAP: Record<string, string> = {
  pending:     "TENTATIVE",
  confirmed:   "CONFIRMED",
  completed:   "CONFIRMED",
  cancelled:   "CANCELLED",
  rescheduled: "CANCELLED",
  no_show:     "CONFIRMED",
};

const LAST_USED_THROTTLE_MS = 15 * 60 * 1000;

const notFound = (): Response =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const typ = url.searchParams.get("typ") ?? "";

    // 64 hex characters, otherwise do not even hash. An unknown `typ` is the same bare 404
    // as a wrong token — the response does not reveal which part of the URL was wrong.
    if (!/^[0-9a-f]{64}$/.test(token)) return notFound();
    if (!(KNOWN_TYPES as readonly string[]).includes(typ) && typ !== "other") return notFound();
    const feedTyp = typ as FeedTyp;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("calendar_feed_tokens")
      .select("id, company_id, last_used_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenError) {
      console.error("[calendar-feed] token lookup failed:", tokenError.message);
      return notFound();
    }
    if (!tokenRow) {
      console.warn(`[calendar-feed] unknown or revoked token ${token.slice(0, 8)}…`);
      return notFound();
    }

    const { data: company, error: companyError } = await supabase
      .from("companies").select("company_name")
      .eq("id", tokenRow.company_id).maybeSingle();

    if (companyError || !company) {
      console.error(`[calendar-feed] company ${tokenRow.company_id} not found`);
      return notFound();
    }

    // Window: today-30 days to today+365 days, on appointment_date (DATE).
    const now = new Date();
    const windowFrom = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const windowTo   = isoDate(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));

    let query = supabase
      .from("appointments")
      .select(
        "id, appointment_type, appointment_date, start_time, end_time, title, status, " +
        "customer_first_name, customer_last_name, customer_phone, " +
        "location_address, location_plz, location_city, updated_at, created_at",
      )
      // service_role sees EVERYTHING — this filter is the tenant boundary.
      .eq("company_id", tokenRow.company_id)
      .gte("appointment_date", windowFrom)
      .lte("appointment_date", windowTo)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(5000);

    // Disjoint split: known types exactly, `other` is the complement of the same list
    // (plus a NULL safeguard). An appointment can never appear in two feeds and none
    // falls through.
    if (feedTyp === "other") {
      query = query.or(`appointment_type.is.null,appointment_type.not.in.(${KNOWN_TYPES.join(",")})`);
    } else {
      query = query.eq("appointment_type", feedTyp);
    }

    const { data: appointments, error: apptError } = await query;
    if (apptError) {
      console.error("[calendar-feed] appointments query failed:", apptError.message);
      return new Response("Internal error", {
        status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // `last_used_at` at most every 15 minutes — display purpose, not an audit.
    const lastUsed = tokenRow.last_used_at ? Date.parse(tokenRow.last_used_at) : 0;
    if (now.getTime() - lastUsed > LAST_USED_THROTTLE_MS) {
      const { error: touchError } = await supabase
        .from("calendar_feed_tokens")
        .update({ last_used_at: now.toISOString() })
        .eq("id", tokenRow.id);
      if (touchError) console.warn("[calendar-feed] last_used_at update failed:", touchError.message);
    }

    // UID domain: MUST be the public one. SUPABASE_URL inside the container is the
    // docker-internal address (http://supabase-kong:8000) — that would yield "supabase-kong"
    // as the UID host and flood every subscriber's calendar with duplicates on any
    // infrastructure change. UIDs are forever.
    const host = new URL(
      Deno.env.get("SUPABASE_PUBLIC_URL") ?? Deno.env.get("SUPABASE_URL")!,
    ).hostname;
    const meta = TYPE_META[feedTyp];

    const events: IcsEvent[] = (appointments ?? []).map((a) => {
      const customer = [a.customer_first_name, a.customer_last_name].filter(Boolean).join(" ").trim();
      const cityLine = [a.location_plz, a.location_city].filter(Boolean).join(" ");
      const rowTyp = (a.appointment_type ?? "") as string;
      const label = (KNOWN_TYPES as readonly string[]).includes(rowTyp)
        ? TYPE_META[rowTyp as KnownType].label
        : TYPE_META.other.label;
      return {
        uid: `auftrag-${a.id}@${host}`,
        date: a.appointment_date,
        startTime: a.start_time,
        endTime: a.end_time,
        summary: customer ? `${label} – ${customer}` : `${label} – ${a.title ?? ""}`,
        location: [a.location_address, cityLine].filter(Boolean).join(", "),
        description: a.customer_phone ? `Telefon: ${a.customer_phone}` : "",
        status: STATUS_MAP[a.status ?? ""] ?? "CONFIRMED",
        updatedAt: a.updated_at ?? a.created_at ?? "",
      };
    });

    const body = buildIcsCalendar({
      calendarName: `${company.company_name} – ${meta.plural}`,
      color: meta.color,
      prodId: "-//CRM//calendar-feed//DE",
      events,
    });

    // The body depends only on the DB state (no "now" in the content), so the hash is a
    // real ETag and 304 actually works.
    const etag = `"${await sha256Hex(body)}"`;
    const baseHeaders: Record<string, string> = {
      ETag: etag,
      "Cache-Control": "private, max-age=900",
    };

    const ifNoneMatch = req.headers.get("If-None-Match") ?? "";
    if (ifNoneMatch.includes(etag)) {
      return new Response(null, { status: 304, headers: baseHeaders });
    }

    return new Response(req.method === "HEAD" ? null : body, {
      status: 200,
      headers: { ...baseHeaders, "Content-Type": "text/calendar; charset=utf-8" },
    });
  } catch (error) {
    console.error("[calendar-feed] unexpected error:",
      error instanceof Error ? error.message : String(error));
    return new Response("Internal error", {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
```

Deployment requirements:

- `verify_jwt = false` for this function. It has no JWT to verify — the token is the auth.
  Verify how Offerio's platform actually applies that setting; in some self-hosted setups
  the per-function config is ignored and a global env var governs.
- `SUPABASE_PUBLIC_URL` **must** be set in the function's environment. Without it the UID
  host falls back to the internal address. Getting this wrong is not a cosmetic bug: UIDs are
  permanent, and changing them duplicates every event in every subscriber's calendar.
- `SUPABASE_SERVICE_ROLE_KEY` in the function environment, never in the frontend.

### 8.4 `calendarFeedUrl.ts` — the URL builder

```ts
/**
 * The subscription addresses of the calendar feed (webcal/ICS).
 *
 * The address is not a setting but a derivation from the Supabase base address and the
 * fixed edge-function name — computed, never stored.
 *
 * `webcal://` instead of `https://`: that scheme tells Apple Calendar and Outlook
 * "subscribe, don't download". The clients replace it with http(s) themselves on fetch.
 */

/** The edge function's name. Fixed, not a configuration value. */
export const CALENDAR_FEED_FUNCTION = "calendar-feed";

/**
 * One feed per appointment type plus `other` as a catch-all for future types the feed does
 * not know yet. Must match KNOWN_TYPES in supabase/functions/calendar-feed/index.ts.
 */
export const CALENDAR_FEED_TYPES = [
  "besichtigung", "service", "follow_up", "meeting", "blocked", "other",
] as const;

export type CalendarFeedType = (typeof CALENDAR_FEED_TYPES)[number];

/**
 * Builds the webcal subscription address for a token and an appointment type.
 *
 * Returns `null` when base or token is missing — a half-guessed address would otherwise
 * land in a calendar client and silently 404 there.
 */
export const buildCalendarFeedUrl = (
  base: string | undefined | null,
  token: string,
  typ: CalendarFeedType,
): string | null => {
  const raw = (base ?? "").trim();
  if (!raw || !token) return null;

  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const path = url.pathname.replace(/\/+$/, "");
  return `webcal://${url.host}${path}/functions/v1/${CALENDAR_FEED_FUNCTION}?token=${token}&typ=${typ}`;
};
```

`CALENDAR_FEED_TYPES` and `KNOWN_TYPES` in the edge function are two copies of one list on
two sides of a network boundary. Add a test that asserts they match, or generate both from a
shared constant if Offerio's build allows sharing between `src/` and `supabase/functions/`.

### 8.5 Settings UI

A tab in company settings (`<TabsTrigger value="calendar">`) rendering
`<CalendarFeedSettings companyId={company.id} />`. Behaviour:

- **Security notice banner** (amber) at the top: anyone with the link sees the appointments.
- **Create**: an optional label input (max 80 chars) + a button calling the RPC.
- **On success**: the plaintext token appears **once**, expanded into six copyable
  `webcal://` links — one per type. This block lives in React state only and is gone when the
  tab unmounts. The token list below deliberately shows **no** links, only metadata.
- **Token list**: label (or "unnamed"), created, last used (or "never used"), and a Revoke
  button. Filtered to `revoked_at IS NULL`.
- **Revoke**: an `AlertDialog` confirmation, then an `UPDATE` setting `revoked_at`. It also
  clears any freshly displayed plaintext — a revoked token must not stay sitting there,
  copyable.

```tsx
const handleCreate = async () => {
  const trimmed = labelDraft.trim();
  const { data, error } = await supabase.rpc("create_calendar_feed_token", {
    ...(trimmed ? { p_label: trimmed } : {}),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("empty rpc result");
  setFreshToken({ token: row.token, label: row.label ?? null });
  setLabelDraft("");
  await loadTokens();
};
```

The base URL comes from `import.meta.env.VITE_SUPABASE_URL`. That is a **build-time** value —
if it is wrong in the deployed bundle, every generated link is wrong, and the failure is
silent (the client just gets 404s). Add a smoke check.

---

## 9. The i18n contract

The source system has **two independent language axes**, and confusing them is the single way
to break this feature.

| Axis | Source | Scope | How it is read |
|---|---|---|---|
| **Dashboard language** — the language the *firm* works in | `companies.default_language` (+ browser override) | `/firma/*` | `useT()` — React context |
| **Document language** — the language the *customer* is addressed in | `<row>.language`, frozen from `leads.language` | PDFs, e-mail, SMS, public token pages | passed **as an argument** |

A German-speaking operator sends a French customer a French offer. Both axes are live in the
same tab at the same time. **Therefore no renderer that produces customer-facing output may
read the language from React context** — if it does, the operator's language leaks into the
customer's document.

For the calendar specifically:

- `appointments.language` is written **at creation only** (§5.2) and carried through the
  chain `leads.language → offers.language → appointments.language`.
- The reminder cron has no caller to pass a language, so it **must** read it from the row.
  That is the reason the column exists at all.
- The reminder e-mail resolves two languages per run: the firm's for the firm's copy, the
  customer's for the customer's copy.
- Operator UI keys (`calendar.*`) come from the catalog via `useT()`.
- The subscription feed is operator-facing infrastructure, so its labels follow the *firm's*
  language — see §10.4, where the source system hardcoded German instead.

Catalog key groups to create (source system has ~450 keys per language):

```
calendar.title / .subtitle / .pageTitle / .today / .tomorrow / .newAppointment
calendar.stats.{today,open,thisWeek}
calendar.view.{calendar,team,month,week,day,agenda,ariaLabel}
calendar.filter.{type,status,team}
calendar.rbc.{today,previous,next,month,week,day,agenda,date,time,event,noEventsInRange,showMore}
calendar.toolbar.{weekHeader,prevAria,nextAria}
calendar.hint.selectDay
calendar.day.noAppointments
calendar.detail.{timeRange,customer,team,description,internalNotes,mail,confirm,complete,cancel}
calendar.contextMenu.showDay
calendar.recurring.{title,description,onlyThis,wholeSeries}
calendar.toast.{loadFailed,moved,moveFailed,durationChanged,durationFailed,
                confirmed,confirmFailed,cancelled,seriesCancelled,cancelFailed,
                completed,completeFailed}
calendar.modal.*        (~40 keys: labels, type descriptions, errors, warnings, saved states)
calendar.export.*       (menu entries + QR)
calendar.mobile.{week,selectDate}
calendar.appointmentTitle.besichtigung
calendar.event.teamFallback

settings.calfeed.{title,description,securityNotice,createTitle,createButton,created,
                  createFailed,labelPlaceholder,linksTitle,copy,copied,copyFailed,
                  urlMissing,tokensTitle,noTokens,unnamed,colLabel,colCreated,colLastUsed,
                  neverUsed,revoke,revoked,revokeFailed,revokeConfirm,revokeConfirmTitle,
                  revokeConfirmBody,revokeCancel,loadFailed}
settings.calfeed.typ.{besichtigung,service,follow_up,meeting,blocked,other}
```

In the source system the German key set is the single source of truth and the other catalogs
are typed `Record<keyof typeof de, string>` — a missing key is a **compile error**, not a
silently German string. Adopt whatever equivalent guarantee Offerio has.

Type and status labels do **not** live in the calendar catalog. They come from shared helpers
(`getAppointmentTypeLabel(value, locale)`, `getAppointmentStatusLabel(value, locale)`) so the
calendar filters, the modal picker, and the detail card all read the same vocabulary in every
language.

---

## 10. Multi-tenant adaptation checklist

Offerio is multi-tenant; the source system is a single-tenant fork. Every item below is a
place where that assumption is baked in. **Work through this list before writing the
migrations — items 1, 3, and 9 change SQL signatures.**

### 10.1 `create_calendar_feed_token()` assumes exactly one membership — **breaks hard**

```sql
IF v_count <> 1 THEN
  RAISE EXCEPTION 'expected exactly one company membership, found %', v_count;
END IF;
```

In the source system every user belongs to exactly one company, and an exception was judged
more honest than an arbitrary "first" company. In Offerio a user can belong to several, so
this raises for any such user and token creation fails outright.

**Correction:** take the company explicitly and verify membership.

```sql
CREATE OR REPLACE FUNCTION public.create_calendar_feed_token(
  p_company_id uuid,
  p_label      text DEFAULT NULL
)
RETURNS TABLE (id uuid, token text, label text, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  k_max_label constant integer := 80;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- The caller may name the company, but only one they belong to. SECURITY DEFINER
  -- bypasses RLS, so this check IS the tenant boundary.
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'not a member of company %', p_company_id;
  END IF;

  v_label := nullif(btrim(coalesce(p_label, '')), '');
  IF length(v_label) > k_max_label THEN
    RAISE EXCEPTION 'label is longer than % characters', k_max_label;
  END IF;

  token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.calendar_feed_tokens (company_id, user_id, token_hash, label)
  VALUES (p_company_id, auth.uid(),
          encode(extensions.digest(token, 'sha256'), 'hex'), v_label)
  RETURNING calendar_feed_tokens.id, calendar_feed_tokens.created_at INTO id, created_at;

  label := v_label;
  RETURN NEXT;
  RETURN;
END;
$function$;
```

Update the frontend call to pass `p_company_id`, and update the `REVOKE`/`GRANT` and the
verification block to the new signature — `has_function_privilege` takes the full signature
string, so `create_calendar_feed_token(text)` becomes
`create_calendar_feed_token(uuid, text)`.

### 10.2 The active-company hook

The calendar reads `const { companyId } = useCachedCompany()`, a hook whose whole design
assumes one company per user. Offerio has an active-tenant context; use it. **Every** query
in §4, §5, §8.5 must key off it, and every one of them must re-fetch when the active tenant
changes — including the header KPIs and the token list.

### 10.3 `Europe/Zurich` is hardcoded in two places — **silent data corruption if ignored**

- `ics.ts` → `zoneOffsetMs`, `X-WR-TIMEZONE`
- `notify-appointment-reminder` → `APP_TIME_ZONE`, used for "hours until"

A tenant in another zone gets appointments shifted by the offset difference in their
subscribed calendar, and reminders at the wrong hour. Neither failure raises an error.

**Correction:** add `companies.timezone text NOT NULL DEFAULT 'Europe/Zurich'` (IANA name),
thread it into `IcsCalendar` and `IcsEvent` handling, and make `zoneOffsetMs` /
`wallToUtc` take a `timeZone` parameter. `Intl.DateTimeFormat` accepts any IANA zone, so no
new dependency is needed. Add a test for a non-European zone and one straddling a DST
transition.

### 10.4 Feed labels and colours are hardcoded German literals

`TYPE_META` in the edge function carries `"Besichtigungen"`, `"Dienstleistungen"`, etc., and
the calendar name is built as `${company_name} – ${meta.plural}`. A French tenant subscribes
to a calendar named in German.

**Correction:** read `companies.default_language` next to `company_name` (one query, one more
column) and select the plural/label set from a small per-locale map in the function. Do not
try to import the frontend catalog — the edge function must stay dependency-free. Keep the
colours as they are, but add the reverse pointer comment to `index.css` so the duplication is
visible from both ends.

Also: `prodId: "-//CRM//calendar-feed//DE"` should become Offerio's product identifier, and
its trailing language segment should follow the tenant locale.

### 10.5 The feed's tenant boundary is one `.eq()` call

`calendar-feed` runs under `service_role`. RLS does nothing. `eq("company_id",
tokenRow.company_id)` is the *only* thing keeping tenant A's appointments out of tenant B's
calendar. In a single-tenant system a missing filter is invisible; in Offerio it is a data
breach.

**Correction:** keep the filter, and add a test that seeds two companies, requests the feed
with company A's token, and asserts company B's appointment does not appear. Make that test
part of the merge gate, not an afterthought.

### 10.6 `is_company_member()` must be Offerio's

Every policy and RPC here calls `public.is_company_member(uuid)`. Offerio has its own
membership helper with its own semantics (roles, invitation states, soft-deleted
memberships). Use Offerio's throughout. Do not add a second helper — two membership
predicates that can disagree is worse than either one alone.

### 10.7 `generate_recurring_appointments` has no membership check

Covered in §5.4. `SECURITY DEFINER` + a caller-supplied UUID + no check = cross-tenant write.
Add the check.

### 10.8 Company-level e-mail identity

The confirmation and reminder functions choose between the tenant's own Resend key and a
system key. In the source system that selection reads a separate `company_secrets` table so
that a plain `companies` read cannot leak keys. Offerio must have an equivalent; use it, and
keep the rule that **the sending identity never influences the language**.

### 10.9 The appointment type enum is closed at five values

Offerio's domain may need more. The feed's `other` catch-all is designed exactly for that: it
is the complement of `KNOWN_TYPES`, so a new enum value lands there until the feed learns it.
When you add a type you must update, in one commit: the enum, `typeColors`, `--cal-*`,
`statusConfig` if relevant, `KNOWN_TYPES`, `TYPE_META`, `CALENDAR_FEED_TYPES`, the filter
badge cardinality (§4.5), and the `settings.calfeed.typ.*` keys in all catalogs.

### 10.10 Swiss address shape

`location_plz` (postal code) and the `from_street` / `from_house_number` split come from a
Swiss address model. If Offerio serves other countries, normalize the address fields — but do
it once, in the appointment model, not per surface.

### 10.11 Monday-start week is hardcoded

`weekStartsOn: 1` appears in the localizer, in `MobileCalendarNav`, and in the header KPI week
calculation. Correct for CH/EU, wrong for a US tenant. If Offerio ships outside Europe, derive
it from the tenant locale and change all three call sites together.

### 10.12 Feed base URL is a build-time env var

`VITE_SUPABASE_URL` is baked into the bundle. In a multi-region or per-tenant-domain setup,
subscription links generated from it may point at the wrong host. Verify before shipping.

---

## 11. Acceptance criteria

Implement all of these, then verify each one and report the actual output.

### Build gates

- [ ] `type-check` passes with zero errors.
- [ ] Lint: zero errors **in the files you touched**, and the project total does not increase.
- [ ] All tests pass.

### Unit tests (pure functions — these are the only things worth unit-testing here)

- [ ] `detectConflicts`: no overlap → empty; overlap without shared resources → empty;
      overlap with shared team member → `sharedTeam: true`; overlap with shared vehicle →
      `sharedVehicles: true`; candidate with no resources → time-only result; candidate
      excludes itself by `id`.
- [ ] `escapeIcsText`: backslash, semicolon, comma, `\n`, `\r\n`, and a combination.
- [ ] `foldIcsLine`: exactly 75 octets unfolded; 76 folded; a multi-byte character never
      split; the continuation's leading space counted.
- [ ] `wallToUtc`: winter date, summer date, **the DST transition day in both directions**,
      `HH:MM` and `HH:MM:SS` inputs.
- [ ] `buildIcsCalendar`: byte-identical output for identical input (this is what the ETag
      rests on); midnight-crossing event gets `DTEND` on the next day; `SEQUENCE` grows with
      `updatedAt`; an invalid `updatedAt` falls back to the start instant.
- [ ] `buildCalendarFeedUrl`: valid https base; base with a trailing slash; base with a path;
      empty base → `null`; empty token → `null`; a non-http protocol → `null`.
- [ ] `CALENDAR_FEED_TYPES` and the edge function's `KNOWN_TYPES ∪ {"other"}` are equal.

### Migration gates

- [ ] The `calendar_feed_tokens` migration's fail-closed verification block passes on a clean
      database, and **fails** if you deliberately remove one `GRANT` (prove the check works).
- [ ] The rollback runs cleanly, and its asymmetry is documented in the file header.
- [ ] `anon` has no privilege on `appointments`, `calendar_feed_tokens`, or any calendar RPC.

### Manual verification (do this in a browser, not from reading the code)

- [ ] Month, week, day, and agenda views render in all shipped languages; weekday names,
      month names, and the "+N more" label follow the dashboard language.
- [ ] Drag an event to another day → it moves, a success toast appears, and a reload shows
      the new date. Then simulate a failed update → the event snaps back and an error toast
      appears.
- [ ] Page forward six months quickly, then back to today. The events shown always match the
      month in the header. **This is the stale-response guard (§4.3) — verify it explicitly.**
- [ ] Header KPIs stay correct while paging through months (they must not change).
- [ ] Filters: unchecking a type removes those events and adds a chip; the badge count is
      right; team filter shows only that member's jobs.
- [ ] Detail panel opens on event click and on day click, and the calendar reflows to full
      width when it closes.
- [ ] Cancel a series member → the dialog offers "only this" vs "whole series", and "whole
      series" cancels root plus all children, from *any* member of the series.
- [ ] Create an appointment with a team member already booked at that hour → the conflict
      warning names the conflict and identifies the shared resource. Saving anyway works.
- [ ] Create an appointment linked to a request in a different language than the operator's →
      `appointments.language` holds the *customer's* language, and the confirmation e-mail
      arrives in it. Then edit the appointment → the language does **not** change.
- [ ] Accept an offer → exactly one `service` appointment appears. Accept again → still one.
- [ ] Mobile (≤640px): the mobile nav bar appears, the desktop toolbar is usable, day cells
      are tappable, and the month grid does not scroll horizontally.
- [ ] The page does not scroll horizontally at 320px, 768px, 1024px, or 1440px.

### Feed verification (the subscription is the easiest part to ship broken)

- [ ] Generate a token → six `webcal://` links appear, each with a different `typ`.
- [ ] `curl` the https equivalent of one link → `200 text/calendar`, and the body starts with
      `BEGIN:VCALENDAR` and ends with `END:VCALENDAR\r\n`.
- [ ] Repeat with `If-None-Match: <etag>` → `304` with an empty body.
- [ ] `curl` with a wrong token, a malformed token, and an unknown `typ` → all three return
      **the same** bare `404 text/plain`.
- [ ] `POST` → `405`.
- [ ] Revoke the token → the same URL now returns `404`.
- [ ] The union of all six feeds equals the full appointment set for the window, and no
      appointment appears in two feeds.
- [ ] `internal_notes`, `location_notes`, `description`, `completion_notes`, and
      `cancellation_reason` appear **nowhere** in any feed body. Grep the response.
- [ ] Every `UID` ends in the **public** hostname, not an internal container name.
- [ ] Two companies, one token → only that company's appointments appear (§10.5).
- [ ] Subscribe from a real client (Apple Calendar or Google Calendar "from URL") and confirm
      events land at the right wall-clock time — check one summer and one winter date.
- [ ] Cancel an appointment → on the next refresh the client shows it as cancelled, not
      duplicated.

---

## 12. Known traps and gaps

Things the source system paid for. Read this section before debugging anything.

**CSS**

1. `react-big-calendar`'s stylesheet is imported from the page component, so it lands in a
   *later* chunk than `index.css`. Overrides need `!important` — except `.rbc-event`'s
   `border`, which must **not** have it, or the inline left stripe from `eventPropGetter`
   never renders.
2. `.rbc-agenda-time-cell` must be `color: inherit`. With `muted-foreground` it is unreadable
   on the coloured rows the event styler produces.
3. `.rbc-off-range-bg` needs `!important` specifically for dark mode; without it
   `react-big-calendar`'s `#e6e6e6` makes out-of-month days glow.

**Dates**

4. `new Date("2026-08-09")` is **UTC** midnight; `new Date("2026-08-09T09:00:00")` is
   **local**. Mixing these pushed Sunday out of the local week in the KPI query. Compare
   `yyyy-MM-dd` values as strings where you can.
5. A container runs in UTC. Any "hours until" computed with a naive `new Date(dateStr +
   timeStr)` is off by the tenant's offset. Convert explicitly (§8.2, §6.2).
6. A fixed `+1`/`+2` DST offset is wrong half the year. Compute per date.

**Data loading**

7. Overlapping queries against a moving window return out of order. Without a sequence guard
   the calendar shows the wrong month's data (§4.3).
8. Header counts derived from a windowed list read `0` outside the window (§4.4).
9. `select("*")` on a 48-column table ships 15 unused columns per row.

**Feed**

10. `SUPABASE_URL` inside the container is the docker-internal address. Using it for the UID
    host permanently duplicates every event for every subscriber. Use `SUPABASE_PUBLIC_URL`.
11. Any "now" in the ICS body destroys the ETag: every request produces a new hash, `304`
    never fires, and clients re-download the whole calendar hourly.
12. A verbose error response tells an attacker whether the token or the type was wrong. Every
    failure is the same bare 404.
13. Colours and labels are duplicated between `index.css` and the edge function's
    `TYPE_META`. There is no mechanism keeping them in sync — only a comment. Consider a test
    that reads both.

**Known gaps in the source system — decide deliberately, do not inherit by accident**

14. **`.rbc-allday-cell { display: none; }`.** The `all_day` column is stored and exported to
    ICS, but week and day view have no all-day lane, so an all-day appointment renders in its
    time slot instead. Either give it a lane or drop the column; do not ship both.
15. **Drag-and-drop skips conflict detection and customer notification** (§4.6).
16. **The filter badge cardinalities `5` and `6` are literals** (§4.5). Derive them.
17. **`generate_recurring_appointments` has no membership check** (§5.4, §10.7).
18. **The reminder cron migration hardcodes a service-role JWT as a fallback** (§6.2). Do not
    copy it; fail loudly instead.
19. **The recurring-RPC frontend call is `(supabase as any).rpc(...)` with an eslint-disable.**
    Regenerate types instead.
20. **The auto-create-on-offer-accept RPC does not carry `language` through** (§6.1).
21. **Selecting by UTC date while evaluating in local wall-clock.** The reminder function
    computed `now.toISOString().split("T")[0]` and queried
    `.eq("appointment_date", todayStr)`, while the *same* loop converted each row correctly
    with a Zurich wall-clock helper. Selection and evaluation lived in different worlds.
    Zurich is UTC+1/+2, so between local midnight and 01:00/02:00 the UTC date is still
    yesterday — and an appointment at 01:00 is 0.5–2.5 hours away exactly while the query is
    still looking at the previous day. Appointments starting before ~02:30 lost **both**
    reminder bands entirely.

    Fixed in the source repo: the two translation directions now live together in one pure,
    tested module — `zonedWallClockToUtc(date, time)` (row → instant) and
    `zonedDateString(instant)` (instant → local calendar day). **Never derive a date for
    comparison against `appointment_date` from `toISOString()`.**

    Contrast worth copying: the sibling `notify-team-reminder` gets the same boundary right
    by a different route — its 11–13 h lookahead window queries `.in("appointment_date",
    [...])` with *both* UTC dates the window spans, so at least one cron run catches every
    appointment. Either approach works; the single-`.eq()`-on-a-UTC-date approach does not.

22. **Single-iteration wall-clock conversion is wrong near a DST transition.** The reminder
    function's copy of the wall-clock converter measured the offset at the naive time *read
    as UTC*, not at the resulting instant. For 2026-03-29 01:30 Zurich (still CET, +1) the
    probe landed at 01:30 UTC — already past the transition — and returned +2: one hour off
    and one calendar day back. `ics.ts` (§8.2) had always converged in two passes; this copy
    never learned it. Now fixed the same way.

    Both defects came from the same habit: **a timezone helper that was copy-pasted between
    edge functions instead of shared and tested.** Put the conversions in one pure module
    from the start, and test the DST transition days in both directions.

---

## 13. Suggested implementation order

Each step ends in a state you can verify, so a failure is localized.

1. **Schema** — enums, `appointments`, supporting tables, RLS, indexes. Verify: an
   authenticated member can select their own company's rows and nothing else; `anon` gets
   nothing.
2. **Read-only calendar** — page shell, localizer, the sliding window with the stale guard,
   the KPI queries, event mapping, `eventPropGetter`, custom toolbar and event component, the
   CSS block. Verify: appointments seeded by hand render correctly in all four views and all
   languages.
3. **Filters and the detail panel** — including the grid switch and the day list. Verify the
   reflow.
4. **The modal** — create, edit, lead linking, language freeze, validation. Verify a
   round-trip.
5. **Conflict detection** — pure function + tests first, then wire it in.
6. **Recurrence** — RPC with the membership check, then the UI, then series cancellation.
7. **Automation** — the offer-accept trigger, then the reminder cron and its edge function.
   Verify with a seeded appointment two hours out and a fake mail transport.
8. **Customer-facing** — capability token migration *including* the trigger hardening in one
   transaction, then the public pages.
9. **Subscription feed** — `ics.ts` + tests, then the token migration with the correction from
   §10.1, then the edge function, then the settings tab. Verify with `curl` before touching a
   real calendar client.
10. **Team week view** — last, because nothing else depends on it.

Report at the end: what you built, what you verified and how, what you deliberately changed
from this specification and why, and anything from §10 or §12 you left open.
