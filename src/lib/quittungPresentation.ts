import { LOCALE_TAGS, type Locale } from "@/i18n/locale";
import { formatCurrency, formatNumber } from "@/i18n/format";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { QuittungPosition } from "@/types/quittung.types";

export const RECEIPT_TIME_ZONE = "Europe/Zurich";

/** A receipt date is a calendar date, not midnight in the viewer's time zone. */
export const formatReceiptDate = (value: string, locale: Locale): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid receipt date");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Invalid receipt date");
  }
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(date);
};

/** The same signed receipt always prints the Swiss time, including its offset. */
export const formatReceiptTimestamp = (value: string, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: RECEIPT_TIME_ZONE, timeZoneName: "short",
  }).format(new Date(value));

/**
 * Keep ordinary rows indivisible. Exceptionally long text needs explicit continuation
 * rows: an unbreakable row taller than A4 cannot be paginated by the renderer.
 * The limits also bound rows containing many explicit newlines. No text is discarded.
 */
export const splitReceiptText = (text: string): string[] => {
  if (!text) return [""];
  const points = Array.from(text);
  const parts: string[] = [];
  let start = 0;
  while (start < points.length) {
    let end = Math.min(start + 320, points.length);
    let lines = 0;
    for (let index = start; index < end; index += 1) {
      if (points[index] === "\n") lines += 1;
      if (lines === 8) { end = index + 1; break; }
    }
    if (end < points.length && points[end - 1] !== "\n") {
      for (let index = end - 1; index > start + (end - start) / 2; index -= 1) {
        if (/\s/.test(points[index])) { end = index + 1; break; }
      }
    }
    parts.push(points.slice(start, end).join(""));
    start = end;
  }
  return parts;
};

export interface ReceiptPdfRow {
  key: string;
  number: number;
  description: string;
  rate: string;
  amount: number | null;
  continuation: boolean;
  checked: boolean;
}

export const buildReceiptPdfRows = (
  positions: readonly QuittungPosition[],
  worksheet = false,
  locale: Locale = "de",
): ReceiptPdfRow[] => positions
  .filter(position => worksheet || position.checked)
  .filter(position => !position.is_custom || position.beschreibung || position.betrag)
  .flatMap((position, index) => {
    const descriptions = splitReceiptText(position.beschreibung);
    const quantityRate = position.price_type === "inkl"
      ? documentI18nFor(locale).t("doc.receipt.included")
      : typeof position.menge === "number" && typeof position.einzelpreis === "number"
        ? `${formatNumber(position.menge, locale)}${position.einheit ? ` ${position.einheit}` : ""} × ${formatCurrency(position.einzelpreis, locale)}`
        : "";
    const rates = splitReceiptText([quantityRate, position.satz].filter(Boolean).join("\n"));
    return Array.from({ length: Math.max(descriptions.length, rates.length) }, (_, part) => ({
      key: `${position.id}-${part}`,
      number: index + 1,
      description: descriptions[part] ?? "",
      rate: rates[part] ?? "",
      amount: part === 0 && position.checked ? position.betrag : null,
      continuation: part > 0,
      checked: position.checked,
    }));
  });
