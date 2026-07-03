import type { OfferData } from "../types/offer.types";
import { groupItemsByService } from "@/lib/offerServiceType";
import { isFreeItem } from "@/lib/offerPricing";

type Item = OfferData["items"][number];

/**
 * Split offer line items across PDF pages — GROUP-AWARE (P2b-i).
 *
 * Changes vs. the old flat slice:
 *  - Page budget counts only BILLABLE positions. Free (inkl/optional) items no longer render
 *    as rows (P2a), so they must not consume the budget or leave the page underfilled.
 *  - Whole service groups stay together in one chunk when they fit; a group is never split
 *    across chunks. A single group larger than a page gets its own chunk and react-pdf wraps
 *    its rows naturally (rare).
 *
 * firstPageMax/continuationMax keep their meaning: max billable positions on the first vs.
 * continuation pages. Free items still travel inside their group's chunk (needed for the
 * Leistungsumfang ✓-list).
 */
export function chunkOfferTableItems(
  items: Item[],
  firstPageMax: number,
  continuationMax: number
): Item[][] {
  if (items.length === 0) return [[]];

  const groups = groupItemsByService(
    items.map((it) => ({ ...it, service_type: it.serviceType ?? null }))
  );

  const chunks: Item[][] = [];
  let current: Item[] = [];
  let currentBillable = 0;

  for (const group of groups) {
    const billableCount = group.items.filter((it) => !isFreeItem(it.priceType)).length;
    const limit = chunks.length === 0 ? firstPageMax : continuationMax;

    // Flush the current chunk before adding a group that would overflow it (groups are kept
    // whole — never split across a page boundary).
    if (current.length > 0 && currentBillable + billableCount > limit) {
      chunks.push(current);
      current = [];
      currentBillable = 0;
    }

    current.push(...group.items);
    currentBillable += billableCount;
  }

  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [[]];
}
