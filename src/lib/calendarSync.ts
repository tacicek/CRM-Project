/**
 * Calendar Sync Utilities
 * Supports Google Calendar, Apple Calendar, Outlook, and ICS export
 */

export interface CalendarEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  allDay?: boolean;
}

/**
 * Generate Google Calendar URL for adding an event
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const formatDate = (date: Date, allDay?: boolean): string => {
    if (allDay) {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    }
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatDate(event.startDate, event.allDay)}/${formatDate(event.endDate, event.allDay)}`,
  });

  if (event.description) {
    params.set("details", event.description);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook.com Calendar URL for adding an event
 */
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: formatDate(event.startDate),
    enddt: formatDate(event.endDate),
  });

  if (event.description) {
    params.set("body", event.description);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  if (event.allDay) {
    params.set("allday", "true");
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Office 365 Calendar URL for adding an event
 */
export function generateOffice365CalendarUrl(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: formatDate(event.startDate),
    enddt: formatDate(event.endDate),
  });

  if (event.description) {
    params.set("body", event.description);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  if (event.allDay) {
    params.set("allday", "true");
  }

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Yahoo Calendar URL for adding an event
 */
export function generateYahooCalendarUrl(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  // Calculate duration in hours and minutes
  const durationMs = event.endDate.getTime() - event.startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const duration = `${String(durationHours).padStart(2, "0")}${String(durationMinutes).padStart(2, "0")}`;

  const params = new URLSearchParams({
    v: "60",
    title: event.title,
    st: formatDate(event.startDate),
    dur: duration,
  });

  if (event.description) {
    params.set("desc", event.description);
  }

  if (event.location) {
    params.set("in_loc", event.location);
  }

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generate ICS file content
 */
export function generateIcsContent(event: CalendarEvent): string {
  const formatIcsDate = (date: Date, allDay?: boolean): string => {
    if (allDay) {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    }
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@offerio.ch`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Offerio//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.startDate, true)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(event.endDate, true)}`);
  } else {
    lines.push(`DTSTART:${formatIcsDate(event.startDate)}`);
    lines.push(`DTEND:${formatIcsDate(event.endDate)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  // Add alarm 1 hour before
  lines.push("BEGIN:VALARM");
  lines.push("TRIGGER:-PT1H");
  lines.push("ACTION:DISPLAY");
  lines.push("DESCRIPTION:Termin-Erinnerung");
  lines.push("END:VALARM");

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Download ICS file
 */
export function downloadIcsFile(event: CalendarEvent, filename?: string): void {
  const icsContent = generateIcsContent(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `termin-${event.startDate.toISOString().split("T")[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open calendar URL in new tab
 */
export function openCalendarUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Detect user's calendar preference based on user agent
 */
export function detectPreferredCalendar(): "google" | "apple" | "outlook" | "other" {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod|macintosh/.test(userAgent)) {
    return "apple";
  }
  
  if (/windows/.test(userAgent)) {
    return "outlook";
  }
  
  // Android or other - default to Google
  return "google";
}

