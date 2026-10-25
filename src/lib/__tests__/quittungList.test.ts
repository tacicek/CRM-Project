import { describe, expect, it } from "vitest";
import { quittungPaymentAction, quittungSearchFilter } from "../quittungList";

describe("Quittung payment actions", () => {
  it("never offers a draft or fully paid document another payment", () => {
    expect(quittungPaymentAction({ issued_at: null, rechnung_id: null, payment_status: "open" })).toBeNull();
    expect(quittungPaymentAction({ issued_at: "now", rechnung_id: "invoice", payment_status: "paid" })).toBeNull();
  });
  it("routes an invoice-backed open or partial payment to the invoice, not a new receipt payment", () => {
    for (const payment_status of ["open", "partial"] as const) expect(quittungPaymentAction({ issued_at: "now", rechnung_id: "invoice", payment_status })).toBe("invoice");
    expect(quittungPaymentAction({ issued_at: "now", rechnung_id: null, payment_status: "open" })).toBe("record");
  });
  it("quotes customer search syntax instead of treating it as PostgREST operators", () => {
    expect(quittungSearchFilter('A,B ("x")')).toBe('quittung_nr.ilike."%A,B (\\"x\\")%",customer_name.ilike."%A,B (\\"x\\")%"');
    expect(quittungSearchFilter("100%_" )).toContain("100\\%\\_");
  });
});
