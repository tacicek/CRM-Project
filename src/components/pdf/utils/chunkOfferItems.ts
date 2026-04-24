import type { OfferData } from "../types/offer.types";

type Item = OfferData["items"][number];

/**
 * Split offer line items across PDF pages so each chunk can sit on its own page
 * with a repeated table header (standard layout).
 */
export function chunkOfferTableItems(
  items: Item[],
  firstPageMax: number,
  continuationMax: number
): Item[][] {
  if (items.length === 0) return [[]];
  const chunks: Item[][] = [];
  let i = 0;
  chunks.push(items.slice(i, i + firstPageMax));
  i += firstPageMax;
  while (i < items.length) {
    chunks.push(items.slice(i, i + continuationMax));
    i += continuationMax;
  }
  return chunks;
}
