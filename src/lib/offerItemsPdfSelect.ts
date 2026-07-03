/**
 * Shared PostgREST select for the offer_items query that feeds the Offerte PDF.
 *
 * Embeds the Katman 1-4 related tables so a single query carries everything the PDF
 * needs (no N+1). Verified against the live schema:
 *   - effort/volume/area_meta → PK is offer_item_id ⇒ PostgREST to-one embed
 *     (object, or `null` when absent).
 *   - breakdown/leistung      → own `id` PK ⇒ to-many embed (array, `[]` when absent).
 *
 * Single source so the two PDF query points (OfferteDetail + buildOfferEmailAttachments)
 * can't drift. NOT used by the public OfferView RPC path (get_offer_by_token) — that
 * channel is a separate DB-function update.
 */
export const OFFER_ITEMS_PDF_SELECT = `*,
  effort_meta:offer_item_effort_meta(*),
  volume_meta:offer_item_volume_meta(*),
  area_meta:offer_item_area_meta(*),
  breakdown:offer_item_breakdown(*),
  leistung:offer_item_leistung(*)`;
