export const formatCurrency = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatted = safeAmount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `CHF ${formatted}`;
};

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * Format a date as written Swiss German: "14. April 2026"
 * Required by SN 010 130 (Briefversand).
 */
export const formatDateLong = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const month = MONTHS_DE[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
};

export const formatTime = (minutes: number | undefined): string | undefined => {
  if (!minutes && minutes !== 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} Std ${mins} Min`;
};
