// Pure ICS (RFC 5545) serializer for the calendar-feed edge function.
//
// Deliberately free of Deno APIs and remote imports so vitest can cover it
// like any other unit (see vitest.config.ts include pattern for
// supabase/functions/**/__tests__).
//
// Times: `appointments` stores wall-clock Europe/Zurich values
// (appointment_date DATE + start_time/end_time TIME, no timezone). The feed
// emits UTC (`...Z`) and no VTIMEZONE, so the DST offset must be computed per
// date — a fixed +1/+2 would silently shift half the year.

export interface IcsEvent {
  uid: string;
  /** Wall-clock Zurich date, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock Zurich times, `HH:MM` or `HH:MM:SS`. */
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
  /** Hex colour, e.g. "#7C3AED" — the CRM calendar UI colour of the job type. */
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
 * Fold a content line at 75 octets (RFC 5545 §3.1). Continuations carry a
 * leading space that counts toward their 75-octet budget. Folding is
 * grapheme-blind but code-point-aware: a multi-byte UTF-8 character is never
 * split in the middle.
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
 * Minute offset of Europe/Zurich at a given UTC instant, via Intl — the only
 * DST source available without a timezone database dependency.
 */
const zurichOffsetMs = (utcTs: number): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcTs))) parts[p.type] = p.value;
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24, // some engines emit "24" for midnight
    Number(parts.minute),
    Number(parts.second)
  );
  return wallAsUtc - utcTs;
};

/**
 * Convert a Zurich wall-clock date+time to a UTC instant. Two iterations
 * converge on the correct offset across DST transitions: the first guess
 * treats the wall time as UTC, the second corrects with the offset valid at
 * the (nearly right) instant.
 */
export const zurichWallToUtc = (date: string, time: string): Date => {
  const t = time.length === 5 ? `${time}:00` : time;
  let ts = Date.parse(`${date}T${t}Z`);
  ts = Date.parse(`${date}T${t}Z`) - zurichOffsetMs(ts);
  ts = Date.parse(`${date}T${t}Z`) - zurichOffsetMs(ts);
  return new Date(ts);
};

/** UTC basic format: YYYYMMDDTHHMMSSZ. */
export const toIcsUtc = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const contentLine = (name: string, value: string): string =>
  foldIcsLine(`${name}:${value}`);

/**
 * Serialize one calendar. Every emitted timestamp derives from stored data
 * (never "now"), so the same DB state always yields byte-identical output —
 * that determinism is what makes the ETag/304 handling in index.ts real.
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
    const start = zurichWallToUtc(ev.date, ev.startTime);
    let end = zurichWallToUtc(ev.date, ev.endTime);
    // end_time <= start_time can only mean the appointment crosses midnight
    // (both columns are TIME on one date row); read it as ending the next day.
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
      // SEQUENCE must grow with every change; epoch seconds of updated_at do
      // that without storing a counter.
      contentLine("SEQUENCE", String(Math.floor(changedValid.getTime() / 1000))),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
};
