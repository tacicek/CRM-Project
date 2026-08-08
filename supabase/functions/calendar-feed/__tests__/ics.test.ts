import { describe, expect, it } from "vitest";

import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  toIcsUtc,
  zurichWallToUtc,
  IcsEvent,
} from "../ics.ts";

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** Reverse RFC-5545 folding: CRLF + single space joins back to one line. */
const unfold = (s: string): string => s.replace(/\r\n /g, "");

const baseEvent: IcsEvent = {
  uid: "auftrag-11111111-2222-3333-4444-555555555555@crm.example",
  date: "2026-08-10",
  startTime: "09:00:00",
  endTime: "11:30:00",
  summary: "Dienstleistung – Max Muster",
  location: "Bahnhofstrasse 12, 8001 Zürich",
  description: "Telefon: +41 79 123 45 67",
  status: "CONFIRMED",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("leaves plain text untouched", () => {
    expect(escapeIcsText("Bahnhofstrasse 12")).toBe("Bahnhofstrasse 12");
  });
});

describe("foldIcsLine", () => {
  it("keeps short lines unfolded", () => {
    expect(foldIcsLine("SUMMARY:kurz")).toBe("SUMMARY:kurz");
  });

  it("folds long lines so no physical line exceeds 75 octets", () => {
    const line = "DESCRIPTION:" + "x".repeat(300);
    const folded = foldIcsLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(byteLength(physical)).toBeLessThanOrEqual(75);
    }
    expect(folded.split("\r\n").length).toBeGreaterThan(1);
  });

  it("continuation lines start with a space and unfolding restores the input", () => {
    const line = "LOCATION:" + "Musterweg 1, 8000 Zürich – ".repeat(10);
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    for (const cont of physical.slice(1)) {
      expect(cont.startsWith(" ")).toBe(true);
    }
    expect(unfold(folded)).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    // 'ü' is 2 octets in UTF-8; a wall of them forces every fold decision
    // onto a multi-byte boundary.
    const line = "SUMMARY:" + "ü".repeat(200);
    const folded = foldIcsLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(byteLength(physical)).toBeLessThanOrEqual(75);
      // If a character had been split, the string would contain replacement
      // garbage and unfolding could not restore the original.
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe("zurichWallToUtc", () => {
  it("applies the winter offset (+01:00)", () => {
    expect(toIcsUtc(zurichWallToUtc("2026-01-15", "09:00:00"))).toBe("20260115T080000Z");
  });

  it("applies the summer offset (+02:00)", () => {
    expect(toIcsUtc(zurichWallToUtc("2026-07-15", "09:00:00"))).toBe("20260715T070000Z");
  });

  it("handles the spring DST transition day (29 March 2026)", () => {
    // 08:00 wall clock on the morning after the 02:00→03:00 jump is CEST.
    expect(toIcsUtc(zurichWallToUtc("2026-03-29", "08:00:00"))).toBe("20260329T060000Z");
    // The evening before the jump is still CET.
    expect(toIcsUtc(zurichWallToUtc("2026-03-28", "20:00:00"))).toBe("20260328T190000Z");
  });

  it("accepts HH:MM without seconds", () => {
    expect(toIcsUtc(zurichWallToUtc("2026-01-15", "09:00"))).toBe("20260115T080000Z");
  });
});

describe("buildIcsCalendar", () => {
  const build = (events: IcsEvent[] = [baseEvent]) =>
    buildIcsCalendar({
      calendarName: "Hirschen Umzug – Dienstleistungen",
      color: "#047857",
      prodId: "-//CRM//calendar-feed//DE",
      events,
    });

  it("uses CRLF line endings exclusively and ends with CRLF", () => {
    const ics = build();
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes the comma in an address inside LOCATION", () => {
    const ics = unfold(build());
    expect(ics).toContain("LOCATION:Bahnhofstrasse 12\\, 8001 Zürich");
    // The raw, unescaped form must not appear anywhere.
    expect(ics).not.toContain("LOCATION:Bahnhofstrasse 12, 8001");
  });

  it("emits all required calendar headers", () => {
    const ics = unfold(build());
    for (const line of [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CRM//calendar-feed//DE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
      "X-WR-TIMEZONE:Europe/Zurich",
      "X-WR-CALNAME:Hirschen Umzug – Dienstleistungen",
      "X-APPLE-CALENDAR-COLOR:#047857",
      "END:VCALENDAR",
    ]) {
      expect(ics).toContain(line);
    }
  });

  it("emits the required VEVENT fields with UTC times", () => {
    const ics = unfold(build());
    expect(ics).toContain(`UID:${baseEvent.uid}`);
    expect(ics).toContain("DTSTART:20260810T070000Z"); // 09:00 CEST → 07:00Z
    expect(ics).toContain("DTEND:20260810T093000Z");
    expect(ics).toContain("DTSTAMP:20260801T100000Z");
    expect(ics).toContain("LAST-MODIFIED:20260801T100000Z");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SUMMARY:Dienstleistung – Max Muster");
    expect(ics).toContain("DESCRIPTION:Telefon: +41 79 123 45 67");
    expect(ics).toContain(`SEQUENCE:${Math.floor(Date.parse(baseEvent.updatedAt) / 1000)}`);
  });

  it("is deterministic: same input, byte-identical output", () => {
    expect(build()).toBe(build());
  });

  it("reads end_time <= start_time as crossing midnight", () => {
    const ics = unfold(
      build([{ ...baseEvent, startTime: "23:00:00", endTime: "01:00:00" }])
    );
    expect(ics).toContain("DTSTART:20260810T210000Z");
    expect(ics).toContain("DTEND:20260810T230000Z"); // 01:00 next day CEST
  });
});
