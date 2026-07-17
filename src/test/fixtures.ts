/**
 * Deterministic, synthetic fixtures for integration tests.
 *
 * Every factory returns a fully-typed `Insert` object for its table (typed against
 * the generated Supabase `Database` types — no `as any`), so a fixture that drifts
 * from the schema is a COMPILE error, not a runtime surprise. Values are:
 *
 *  - Synthetic: nothing here may resemble a real customer. Emails end in `.test`
 *    (a reserved TLD that can never route), the phone is an all-zeros Swiss mobile,
 *    the address is `Teststrasse 1, 8000 Zürich`.
 *  - Deterministic: fixed UUIDs and fixed dates. No Date.now()/Math.random(), so a
 *    failing test reproduces byte-for-byte and parallel runs don't collide on ids.
 *
 * TWO tenants (A and B) are provided so the RLS tests can prove company isolation.
 */

import type { Database } from "@/integrations/supabase/types";

type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Reserved, non-routable synthetic contact data — never a real customer. */
export const SYNTHETIC = {
  emailDomain: "example.test",
  phone: "+41790000000",
  street: "Teststrasse 1",
  plz: "8000",
  city: "Zürich",
} as const;

/**
 * Build a fixed, valid-shaped UUID from a two-part seed. Deterministic by design —
 * `uuid("a", 1)` always yields the same id, so relations line up across factories
 * and reruns without any random source.
 */
const uuid = (prefix: string, seed: number): string => {
  const block = prefix.repeat(8).slice(0, 8);
  const tail = seed.toString(16).padStart(12, "0");
  return `${block}-0000-4000-8000-${tail}`;
};

/** Stable identifiers shared across the two-tenant fixture set. */
export const IDS = {
  companyA: uuid("a", 1),
  companyB: uuid("b", 2),
  userA: uuid("a", 11),
  userB: uuid("b", 12),
  leadA: uuid("1", 1),
  leadB: uuid("2", 2),
  offerA: uuid("3", 1),
  offerItemA: uuid("4", 1),
  auftragA: uuid("5", 1),
  rechnungA: uuid("6", 1),
  quittungA: uuid("7", 1),
  appointmentA: uuid("8", 1),
} as const;

const syntheticEmail = (local: string): string => `${local}@${SYNTHETIC.emailDomain}`;

export const makeCompany = (overrides: Partial<TableInsert<"companies">> = {}): TableInsert<"companies"> => ({
  id: IDS.companyA,
  company_name: "Test Umzug AG",
  email: syntheticEmail("firma-a"),
  city: SYNTHETIC.city,
  plz: SYNTHETIC.plz,
  ...overrides,
});

export const makeLead = (overrides: Partial<TableInsert<"leads">> = {}): TableInsert<"leads"> => ({
  id: IDS.leadA,
  company_id: IDS.companyA,
  customer_first_name: "Max",
  customer_last_name: "Mustermann",
  customer_email: syntheticEmail("kunde-a"),
  customer_phone: SYNTHETIC.phone,
  from_city: SYNTHETIC.city,
  from_plz: SYNTHETIC.plz,
  service_type: "umzug_privat",
  language: "de",
  ...overrides,
});

export const makeOffer = (overrides: Partial<TableInsert<"offers">> = {}): TableInsert<"offers"> => ({
  id: IDS.offerA,
  company_id: IDS.companyA,
  customer_first_name: "Max",
  customer_last_name: "Mustermann",
  customer_email: syntheticEmail("kunde-a"),
  title: "Offerte Privatumzug",
  access_token: "test-token-offer-a-0000000000000000",
  language: "de",
  status: "draft",
  ...overrides,
});

export const makeOfferItem = (
  overrides: Partial<TableInsert<"offer_items">> = {}
): TableInsert<"offer_items"> => ({
  id: IDS.offerItemA,
  offer_id: IDS.offerA,
  description: "Umzugsservice pauschal",
  amount_basis: "fixed",
  position: 1,
  ...overrides,
});

export const makeAuftrag = (overrides: Partial<TableInsert<"auftraege">> = {}): TableInsert<"auftraege"> => ({
  id: IDS.auftragA,
  company_id: IDS.companyA,
  offer_id: IDS.offerA,
  lead_id: IDS.leadA,
  auftrag_nummer: "A-2026-0001",
  customer_name: "Max Mustermann",
  title: "Auftrag Privatumzug",
  scheduled_date: "2026-02-01",
  ...overrides,
});

export const makeRechnung = (overrides: Partial<TableInsert<"rechnungen">> = {}): TableInsert<"rechnungen"> => ({
  id: IDS.rechnungA,
  company_id: IDS.companyA,
  auftrag_id: IDS.auftragA,
  offer_id: IDS.offerA,
  customer_name: "Max Mustermann",
  faellig_am: "2026-03-01",
  datum: "2026-02-01",
  language: "de",
  ...overrides,
});

export const makeQuittung = (overrides: Partial<TableInsert<"quittungen">> = {}): TableInsert<"quittungen"> => ({
  id: IDS.quittungA,
  company_id: IDS.companyA,
  auftrag_id: IDS.auftragA,
  offer_id: IDS.offerA,
  customer_name: "Max Mustermann",
  datum: "2026-02-01",
  language: "de",
  ...overrides,
});

export const makeAppointment = (
  overrides: Partial<TableInsert<"appointments">> = {}
): TableInsert<"appointments"> => ({
  id: IDS.appointmentA,
  company_id: IDS.companyA,
  // appointment_type is a Postgres enum: besichtigung|service|follow_up|meeting|blocked.
  appointment_type: "service",
  appointment_date: "2026-02-01",
  start_time: "08:00",
  end_time: "12:00",
  title: "Umzugstermin",
  ...overrides,
});

/** Second tenant — same shapes, company B ids, for RLS cross-tenant tests. */
export const TENANT_B = {
  company: (): TableInsert<"companies"> =>
    makeCompany({ id: IDS.companyB, company_name: "Test Reinigung GmbH", email: syntheticEmail("firma-b") }),
  lead: (): TableInsert<"leads"> =>
    makeLead({ id: IDS.leadB, company_id: IDS.companyB, customer_email: syntheticEmail("kunde-b") }),
} as const;
