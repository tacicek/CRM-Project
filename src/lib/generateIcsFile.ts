/**
 * Generate an ICS calendar file for an appointment
 */

interface AppointmentData {
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or HH:mm:ss
  endTime: string; // HH:mm or HH:mm:ss
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
}

function formatIcsDate(date: string, time: string): string {
  // Convert to ICS format: YYYYMMDDTHHMMSS
  const dateClean = date.replace(/-/g, "");
  const timeClean = time.substring(0, 5).replace(":", "") + "00";
  return `${dateClean}T${timeClean}`;
}

function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@crm.local`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcsContent(appointment: AppointmentData): string {
  const uid = generateUid();
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const dtstart = formatIcsDate(appointment.date, appointment.startTime);
  const dtend = formatIcsDate(appointment.date, appointment.endTime);
  
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Offerio//Termin//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcsText(appointment.title)}`,
  ];
  
  if (appointment.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(appointment.description)}`);
  }
  
  if (appointment.location) {
    lines.push(`LOCATION:${escapeIcsText(appointment.location)}`);
  }
  
  if (appointment.organizerName && appointment.organizerEmail) {
    lines.push(`ORGANIZER;CN=${escapeIcsText(appointment.organizerName)}:mailto:${appointment.organizerEmail}`);
  }
  
  lines.push("END:VEVENT", "END:VCALENDAR");
  
  return lines.join("\r\n");
}

export function downloadIcsFile(appointment: AppointmentData): void {
  const icsContent = generateIcsContent(appointment);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `termin-${appointment.date}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
