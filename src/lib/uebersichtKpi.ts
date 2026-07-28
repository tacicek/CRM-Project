import { getISOWeek, startOfISOWeek, subWeeks } from "date-fns";
import type { RevenueWeek } from "@/types/uebersicht";

/**
 * Veränderung gegenüber der Vorperiode in ganzen Prozent.
 *
 * `null` bedeutet: keine Vergleichsbasis. Ein Sprung von 0 auf 5 ist kein
 * „+500 %", und Unendlich lässt sich nicht anzeigen — die Darstellung
 * unterdrückt den Pfeil dann ganz, statt eine erfundene Zahl zu behaupten.
 */
export const deltaPercent = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Die letzten `weeks` ISO-Wochen, aufsteigend, die laufende zuletzt.
 *
 * Summiert schlicht `amount`. Stornos sind in dieser Datenbank negativ
 * (`payments_negative_only_reversal`: „Nur ein Storno darf negativ sein") und
 * heben sich dadurch selbst auf. Eine eigene Storno-Behandlung wäre eine
 * zweite Wahrheit neben der Datenbank-Regel — genau der Fehler, den das
 * Zahlungsbuch beseitigt hat.
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
