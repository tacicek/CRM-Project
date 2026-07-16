import { describe, it, expect } from "vitest";
import { maskEmail, maskPhone, sanitizeLogData } from "../logger";

describe("maskEmail", () => {
  it("keeps one local char and the full domain", () => {
    expect(maskEmail("john@example.com")).toBe("j***@example.com");
  });

  it("does not leak the local part of a single-char address", () => {
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("returns *** for a string without a usable local part", () => {
    expect(maskEmail("@example.com")).toBe("***");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("maskPhone", () => {
  it("keeps + prefix, first two and last three digits", () => {
    expect(maskPhone("+41791234567")).toBe("+41******567");
  });

  it("masks a formatted number the same way regardless of separators", () => {
    expect(maskPhone("+41 79 123 45 67")).toBe("+41******567");
  });

  it("does not reveal short numbers", () => {
    expect(maskPhone("12345")).toBe("***");
  });
});

describe("sanitizeLogData", () => {
  it("redacts secret-ish keys entirely", () => {
    const out = sanitizeLogData({
      authorization: "Bearer abc.def.ghi",
      access_token: "xyz",
      service_role_key: "sr-key",
      password: "hunter2",
      body: { anything: "raw payload" },
      recordId: "rec_1",
    }) as Record<string, unknown>;

    expect(out.authorization).toBe("[redacted]");
    expect(out.access_token).toBe("[redacted]");
    expect(out.service_role_key).toBe("[redacted]");
    expect(out.password).toBe("[redacted]");
    expect(out.body).toBe("[redacted]");
    // Non-secret operational metadata is preserved.
    expect(out.recordId).toBe("rec_1");
  });

  it("masks e-mail and phone by key hint", () => {
    const out = sanitizeLogData({
      customerEmail: "john@example.com",
      phone: "+41791234567",
    }) as Record<string, unknown>;

    expect(out.customerEmail).toBe("j***@example.com");
    expect(out.phone).toBe("+41******567");
  });

  it("masks e-mails embedded in free-text strings", () => {
    expect(sanitizeLogData("sent to john@example.com ok")).toBe(
      "sent to j***@example.com ok",
    );
  });

  it("serialises Error to name + message only (no stack)", () => {
    const err = new Error("boom");
    const out = sanitizeLogData(err) as Record<string, unknown>;
    expect(out).toEqual({ name: "Error", message: "boom" });
    expect(out).not.toHaveProperty("stack");
  });

  it("recurses into nested objects and arrays", () => {
    const out = sanitizeLogData({
      recipients: [{ email: "a@b.com" }, { email: "c@d.com" }],
      meta: { token: "secret", stage: "send" },
    }) as { recipients: Array<{ email: string }>; meta: Record<string, unknown> };

    expect(out.recipients[0].email).toBe("a***@b.com");
    expect(out.recipients[1].email).toBe("c***@d.com");
    expect(out.meta.token).toBe("[redacted]");
    expect(out.meta.stage).toBe("send");
  });

  it("passes through null/undefined and plain values", () => {
    expect(sanitizeLogData(null)).toBeNull();
    expect(sanitizeLogData(undefined)).toBeUndefined();
    expect(sanitizeLogData(42)).toBe(42);
    expect(sanitizeLogData("plain text")).toBe("plain text");
  });
});
