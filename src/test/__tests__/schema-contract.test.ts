import { describe, expect, it } from "vitest";
import { Constants, type Database } from "@/integrations/supabase/types";
import { makeQuittung, makeRechnung, makeOfferItem, makeOffer } from "@/test/fixtures";

/**
 * Generated-types ↔ migration contract.
 *
 * This does NOT snapshot the whole 5,200-line types.ts (noisy, breaks on every
 * unrelated regen). It pins the handful of columns whose absence would silently
 * break a critical flow — the ones that moved in recent migrations. If a future
 * `gen types` run drops one, or a migration adds a column without a regen, THIS
 * FILE fails to compile under `tsc -p tsconfig.app.json` (the real gate), long
 * before it reaches production.
 *
 * The type-level `Assert`s are the real contract; the runtime `expect`s exist so
 * the file is also a live Vitest test and documents the same facts executably.
 */

type Assert<T extends true> = T;
type HasKey<Row, K extends PropertyKey> = K extends keyof Row ? true : false;

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// --- Rechnung/Quittung ↔ Auftrag linkage (20260705 auftrag_id migrations) -------
// quittungen.auftrag_id is the current linkage; older docs assumed offer_id only.
type _q1 = Assert<HasKey<Row<"quittungen">, "auftrag_id">>;
type _q2 = Assert<HasKey<Row<"quittungen">, "offer_id">>;
type _r1 = Assert<HasKey<Row<"rechnungen">, "auftrag_id">>;
type _r2 = Assert<HasKey<Row<"rechnungen">, "faellig_am">>;
// QR-Bill payment fields live on the Rechnung, not the Auftrag.
type _r3 = Assert<HasKey<Row<"rechnungen">, "qr_iban">>;
type _r4 = Assert<HasKey<Row<"rechnungen">, "qr_referenz">>;

// --- offer_items item-level pricing axis (20260708 amount_basis migrations) ------
type _oi1 = Assert<HasKey<Row<"offer_items">, "amount_basis">>;
type _oi2 = Assert<HasKey<Row<"offer_items">, "kostendach_max">>;
type _oi3 = Assert<HasKey<Row<"offer_items">, "service_type">>;

// --- Public offer token surface (offers.access_token drives every *_by_token RPC) -
type _o1 = Assert<HasKey<Row<"offers">, "access_token">>;
type _o2 = Assert<HasKey<Row<"offers">, "language">>;
type _o3 = Assert<HasKey<Row<"offers">, "status">>;

// --- Multilingual JSONB (20260714 de/fr/en migration) ---------------------------
type _m1 = Assert<HasKey<Row<"companies">, "translations">>;
type _m2 = Assert<HasKey<Row<"leads">, "language">>;

// --- auftrag_status is a real Postgres enum, not free text ----------------------
// A value outside the enum is a compile error here.
type AuftragStatus = Database["public"]["Enums"]["auftrag_status"];
type _e1 = Assert<"geplant" extends AuftragStatus ? true : false>;
type _e2 = Assert<"abgeschlossen" extends AuftragStatus ? true : false>;

// Reference the type aliases so `noUnusedLocals` (if ever enabled) stays happy and
// the asserts are unmistakably load-bearing.
type _ContractProof = [
  _q1, _q2, _r1, _r2, _r3, _r4, _oi1, _oi2, _oi3, _o1, _o2, _o3, _m1, _m2, _e1, _e2
];

describe("schema contract — generated types vs migrations", () => {
  it("exposes the auftrag_status enum with its five known states", () => {
    expect(Constants.public.Enums.auftrag_status).toEqual([
      "geplant",
      "bestaetigt",
      "in_bearbeitung",
      "abgeschlossen",
      "storniert",
    ]);
  });

  it("keeps the Rechnung/Quittung → Auftrag linkage columns present at runtime", () => {
    // Fixtures are typed Insert objects; if the column vanished they wouldn't compile.
    expect(makeRechnung()).toHaveProperty("auftrag_id");
    expect(makeQuittung()).toHaveProperty("auftrag_id");
  });

  it("keeps the item-level pricing axis (amount_basis) present", () => {
    expect(makeOfferItem()).toHaveProperty("amount_basis");
  });

  it("keeps the public token column present on offers", () => {
    expect(makeOffer()).toHaveProperty("access_token");
  });

  it("_ContractProof is a tuple of literal-true assertions", () => {
    // Purely to anchor the compile-time proof to a runtime assertion.
    const proof: _ContractProof = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
    expect(proof.every((x) => x === true)).toBe(true);
  });
});
