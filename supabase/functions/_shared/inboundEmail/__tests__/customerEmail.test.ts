import { describe, expect, it } from "vitest";

import {
  addressFromHeader,
  buildCompanyAddressSet,
  isUsableCustomerAddress,
  pickCustomerEmail,
} from "../customerEmail.ts";

const COMPANY = buildCompanyAddressSet([
  "info@hirschenumzug.ch",
  "Info@Hirschenumzug.ch",
  null,
  "",
]);

describe("pickCustomerEmail", () => {
  it("takes what the model found in the text first", () => {
    expect(
      pickCustomerEmail({
        extracted: "kunde@example.com",
        replyTo: "reply@example.com",
        fromEmail: "sender@example.com",
        companyAddresses: COMPANY,
      }),
    ).toBe("kunde@example.com");
  });

  /**
   * The case observed in production: info@hirschenumzug.ch forwards to the
   * receiving address, and the forwarder replaces the sender with itself.
   */
  it("never uses the company's own address as the customer", () => {
    expect(
      pickCustomerEmail({
        extracted: null,
        replyTo: null,
        fromEmail: "info@hirschenumzug.ch",
        companyAddresses: COMPANY,
      }),
    ).toBeNull();
  });

  it("falls back to Reply-To when the sender is the forwarding mailbox", () => {
    // Forwarders set Reply-To to the original sender for exactly this reason.
    expect(
      pickCustomerEmail({
        extracted: null,
        replyTo: "kunde@example.com",
        fromEmail: "info@hirschenumzug.ch",
        companyAddresses: COMPANY,
      }),
    ).toBe("kunde@example.com");
  });

  it("uses the sender when it is a real outside address", () => {
    expect(
      pickCustomerEmail({
        extracted: null,
        replyTo: null,
        fromEmail: "Kunde@Example.com",
        companyAddresses: COMPANY,
      }),
    ).toBe("kunde@example.com");
  });

  it("ignores a Reply-To that points back at the company", () => {
    expect(
      pickCustomerEmail({
        extracted: null,
        replyTo: "info@hirschenumzug.ch",
        fromEmail: "info@hirschenumzug.ch",
        companyAddresses: COMPANY,
      }),
    ).toBeNull();
  });

  it("rejects system senders even when nothing else is available", () => {
    for (const sender of ["noreply@example.com", "mailer-daemon@example.com", "bounces+x@example.com"]) {
      expect(
        pickCustomerEmail({ extracted: null, fromEmail: sender, companyAddresses: COMPANY }),
      ).toBeNull();
    }
  });

  it("prefers an empty value over a wrong one", () => {
    // An empty address is filled in during review; a wrong one goes unnoticed
    // and the offer is mailed to the company itself.
    expect(
      pickCustomerEmail({
        extracted: "nicht-mal-eine-adresse",
        replyTo: "auch keine",
        fromEmail: "info@hirschenumzug.ch",
        companyAddresses: COMPANY,
      }),
    ).toBeNull();
  });
});

describe("isUsableCustomerAddress", () => {
  it.each([
    ["kunde@example.com", true],
    ["info@kundenfirma.ch", true],
    ["info@hirschenumzug.ch", false],
    ["INFO@HIRSCHENUMZUG.CH", false],
    ["noreply@example.com", false],
    ["ohne-at", false],
    ["", false],
  ])("%s → %s", (address, expected) => {
    expect(isUsableCustomerAddress(address, COMPANY)).toBe(expected);
  });
});

describe("addressFromHeader", () => {
  it("pulls the address out of a display-name header", () => {
    expect(addressFromHeader('"Max Müller" <Max@Example.com>')).toBe("max@example.com");
  });

  it("accepts a bare address", () => {
    expect(addressFromHeader(" kunde@example.com ")).toBe("kunde@example.com");
  });

  it("returns null for junk", () => {
    expect(addressFromHeader("kein header")).toBeNull();
    expect(addressFromHeader(null)).toBeNull();
  });
});
