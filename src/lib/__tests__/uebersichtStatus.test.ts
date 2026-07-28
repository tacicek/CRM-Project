import { describe, expect, it } from "vitest";
import {
  deriveWorkItemStatus,
  OFFER_OVERDUE_DAYS,
  pickCurrentOffer,
} from "@/lib/uebersichtStatus";
import type { OfferForStatus } from "@/types/uebersicht";

const NOW = new Date("2026-07-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const offer = (over: Partial<OfferForStatus> = {}): OfferForStatus => ({
  id: "o1",
  status: "sent",
  sent_at: daysAgo(1),
  accepted_at: null,
  rejected_at: null,
  valid_until: null,
  superseded_at: null,
  version_number: 1,
  ...over,
});

describe("pickCurrentOffer", () => {
  it("returns null without offers", () => {
    expect(pickCurrentOffer([])).toBeNull();
  });

  it("ignores superseded revisions", () => {
    const old = offer({ id: "old", superseded_at: daysAgo(3), version_number: 1 });
    const current = offer({ id: "current", version_number: 2 });
    expect(pickCurrentOffer([old, current])?.id).toBe("current");
  });

  it("prefers the highest version when several are open", () => {
    expect(
      pickCurrentOffer([
        offer({ id: "a", version_number: 1 }),
        offer({ id: "b", version_number: 3 }),
      ])?.id,
    ).toBe("b");
  });

  it("returns null when every revision is superseded", () => {
    expect(pickCurrentOffer([offer({ superseded_at: daysAgo(1) })])).toBeNull();
  });

  it("treats a missing version_number as the lowest", () => {
    expect(
      pickCurrentOffer([
        offer({ id: "n", version_number: null }),
        offer({ id: "v", version_number: 1 }),
      ])?.id,
    ).toBe("v");
  });
});

describe("deriveWorkItemStatus", () => {
  it("is neu without an offer", () => {
    expect(deriveWorkItemStatus(null, false, NOW)).toBe("neu");
  });

  it("is neu when only a draft exists — a draft never reached the customer", () => {
    expect(deriveWorkItemStatus(offer({ status: "draft", sent_at: null }), false, NOW)).toBe("neu");
  });

  it("is gewonnen once accepted, even without an Auftrag", () => {
    expect(deriveWorkItemStatus(offer({ accepted_at: daysAgo(1) }), false, NOW)).toBe("gewonnen");
  });

  it("is abgelehnt when rejected", () => {
    expect(deriveWorkItemStatus(offer({ rejected_at: daysAgo(1) }), false, NOW)).toBe("abgelehnt");
  });

  it("is abgelehnt when the validity has passed", () => {
    expect(deriveWorkItemStatus(offer({ valid_until: daysAgo(1) }), false, NOW)).toBe("abgelehnt");
  });

  it("is offeriert inside the grace period", () => {
    expect(deriveWorkItemStatus(offer({ sent_at: daysAgo(OFFER_OVERDUE_DAYS) }), false, NOW)).toBe(
      "offeriert",
    );
  });

  it("is ueberfaellig past the grace period", () => {
    expect(
      deriveWorkItemStatus(offer({ sent_at: daysAgo(OFFER_OVERDUE_DAYS + 1) }), false, NOW),
    ).toBe("ueberfaellig");
  });

  it("counts from sent_at, not from creation", () => {
    expect(deriveWorkItemStatus(offer({ sent_at: daysAgo(0) }), false, NOW)).toBe("offeriert");
  });

  it("prefers acceptance over an expired validity", () => {
    expect(
      deriveWorkItemStatus(offer({ accepted_at: daysAgo(1), valid_until: daysAgo(1) }), true, NOW),
    ).toBe("gewonnen");
  });

  it("falls back to neu for a sent offer without sent_at", () => {
    expect(deriveWorkItemStatus(offer({ status: "sent", sent_at: null }), false, NOW)).toBe("neu");
  });

  it("is gewonnen when an Auftrag exists without any surviving offer", () => {
    expect(deriveWorkItemStatus(null, true, NOW)).toBe("gewonnen");
  });
});
