import { describe, expect, it } from "vitest";
import { assembleWorkItems, type LeadRow, type OfferRow } from "@/lib/uebersichtAssemble";

const NOW = new Date("2026-07-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const lead = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "l1",
  service_type: "privatumzug",
  from_city: "Umfang",
  to_city: "Biel",
  created_at: daysAgo(1),
  ...over,
});

const offerRow = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: "o1",
  lead_id: "l1",
  status: "sent",
  sent_at: daysAgo(1),
  accepted_at: null,
  rejected_at: null,
  valid_until: null,
  superseded_at: null,
  version_number: 1,
  total: 3850,
  ...over,
});

describe("assembleWorkItems", () => {
  it("produces one item per lead, never one per offer revision", () => {
    const offers = [
      offerRow({ id: "v1", superseded_at: daysAgo(2), version_number: 1 }),
      offerRow({ id: "v2", version_number: 2 }),
      offerRow({ id: "v3", superseded_at: daysAgo(1), version_number: 3 }),
    ];
    const items = assembleWorkItems([lead()], offers, [], NOW);
    expect(items).toHaveLength(1);
  });

  it("takes the amount from the current revision", () => {
    const offers = [
      offerRow({ id: "v1", superseded_at: daysAgo(2), version_number: 1, total: 1000 }),
      offerRow({ id: "v2", version_number: 2, total: 4200 }),
    ];
    expect(assembleWorkItems([lead()], offers, [], NOW)[0].amountChf).toBe(4200);
  });

  it("marks a lead without offers as neu and carries no amount", () => {
    const [item] = assembleWorkItems([lead()], [], [], NOW);
    expect(item.status).toBe("neu");
    expect(item.amountChf).toBeNull();
  });

  it("counts days open from sent_at", () => {
    const [item] = assembleWorkItems([lead()], [offerRow({ sent_at: daysAgo(5) })], [], NOW);
    expect(item.status).toBe("ueberfaellig");
    expect(item.daysOpen).toBe(5);
  });

  it("leaves daysOpen null when nothing was sent", () => {
    const [item] = assembleWorkItems([lead()], [], [], NOW);
    expect(item.daysOpen).toBeNull();
  });

  it("takes the job date from a matching Auftrag", () => {
    const offers = [offerRow({ accepted_at: daysAgo(1) })];
    const auftraege = [{ lead_id: "l1", offer_id: "o1", scheduled_date: "2026-08-04" }];
    const [item] = assembleWorkItems([lead()], offers, auftraege, NOW);
    expect(item.status).toBe("gewonnen");
    expect(item.jobDate).toBe("2026-08-04");
  });

  it("matches an Auftrag by offer_id when lead_id is missing", () => {
    const auftraege = [{ lead_id: null, offer_id: "o1", scheduled_date: "2026-08-09" }];
    const [item] = assembleWorkItems([lead()], [offerRow()], auftraege, NOW);
    expect(item.jobDate).toBe("2026-08-09");
  });

  it("ignores offers belonging to another lead", () => {
    const items = assembleWorkItems(
      [lead({ id: "l1" }), lead({ id: "l2" })],
      [offerRow({ lead_id: "l2", total: 999 })],
      [],
      NOW,
    );
    expect(items.find((i) => i.leadId === "l1")?.status).toBe("neu");
    expect(items.find((i) => i.leadId === "l2")?.amountChf).toBe(999);
  });

  it("keeps the lead order it was given", () => {
    const items = assembleWorkItems([lead({ id: "a" }), lead({ id: "b" })], [], [], NOW);
    expect(items.map((i) => i.leadId)).toEqual(["a", "b"]);
  });

  it("survives a lead without cities", () => {
    const [item] = assembleWorkItems([lead({ from_city: null, to_city: null })], [], [], NOW);
    expect(item.from).toBeNull();
    expect(item.to).toBeNull();
  });
});
