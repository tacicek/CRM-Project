import { describe, expect, it } from "vitest";

import { matchCompanyByRecipient } from "../alias.ts";

const HIRSCHEN = "company-hirschen";
const BERNOVA = "company-bernova";

describe("matchCompanyByRecipient", () => {
  it("matches an exact address", () => {
    expect(
      matchCompanyByRecipient(
        ["anfragen@iadoreaque.resend.app"],
        [{ company_id: HIRSCHEN, key_value: "anfragen@iadoreaque.resend.app" }],
      ),
    ).toBe(HIRSCHEN);
  });

  it("matches any local part when the alias is a whole domain", () => {
    // Resend delivers every local part of a receiving domain. A forwarding rule
    // that suddenly uses "kontakt@" instead of "anfragen@" must not silently
    // drop the customer's mail.
    const aliases = [{ company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" }];
    for (const local of ["anfragen", "info", "kontakt", "offerte"]) {
      expect(matchCompanyByRecipient([`${local}@iadoreaque.resend.app`], aliases)).toBe(HIRSCHEN);
    }
  });

  it("prefers the exact address over the domain", () => {
    // A whole domain belongs to one company, a single address on it to another —
    // exactly what the later multi-company setup needs.
    const companyId = matchCompanyByRecipient(
      ["bernova@iadoreaque.resend.app"],
      [
        { company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" },
        { company_id: BERNOVA, key_value: "bernova@iadoreaque.resend.app" },
      ],
    );
    expect(companyId).toBe(BERNOVA);
  });

  it("separates two companies on two receiving domains", () => {
    const aliases = [
      { company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" },
      { company_id: BERNOVA, key_value: "@somethingelse.resend.app" },
    ];
    expect(matchCompanyByRecipient(["x@iadoreaque.resend.app"], aliases)).toBe(HIRSCHEN);
    expect(matchCompanyByRecipient(["x@somethingelse.resend.app"], aliases)).toBe(BERNOVA);
  });

  it("ignores case and surrounding whitespace on both sides", () => {
    expect(
      matchCompanyByRecipient(
        ["  Anfragen@IAdoreAque.Resend.App  "],
        [{ company_id: HIRSCHEN, key_value: " @iadoreaque.resend.app " }],
      ),
    ).toBe(HIRSCHEN);
  });

  it("checks every recipient, not just the first", () => {
    expect(
      matchCompanyByRecipient(
        ["someone-else@example.com", "anfragen@iadoreaque.resend.app"],
        [{ company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" }],
      ),
    ).toBe(HIRSCHEN);
  });

  it("does not match a lookalike domain", () => {
    expect(
      matchCompanyByRecipient(
        ["anfragen@evil-iadoreaque.resend.app"],
        [{ company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" }],
      ),
    ).toBeNull();
  });

  it("does not match a subdomain of the alias domain", () => {
    expect(
      matchCompanyByRecipient(
        ["anfragen@sub.iadoreaque.resend.app"],
        [{ company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" }],
      ),
    ).toBeNull();
  });

  it("returns null without recipients or aliases", () => {
    expect(matchCompanyByRecipient([], [{ company_id: HIRSCHEN, key_value: "@x.app" }])).toBeNull();
    expect(matchCompanyByRecipient(["a@x.app"], [])).toBeNull();
  });

  it("survives empty and malformed alias rows", () => {
    expect(
      matchCompanyByRecipient(
        ["anfragen@iadoreaque.resend.app"],
        [
          { company_id: BERNOVA, key_value: "   " },
          { company_id: HIRSCHEN, key_value: "@iadoreaque.resend.app" },
        ],
      ),
    ).toBe(HIRSCHEN);
  });
});
