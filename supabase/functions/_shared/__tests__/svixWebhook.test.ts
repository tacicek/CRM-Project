import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE_SECONDS,
  verifySvixSignature,
} from "../svixWebhook.ts";

/**
 * The webhook endpoint is reachable by anyone (verify_jwt = false, no auth
 * plugin on Kong). These tests cover the only thing standing between the
 * internet and the lead pipeline.
 */

const SECRET_BYTES = randomBytes(24);
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

const NOW_MS = Date.UTC(2026, 6, 25, 12, 0, 0);
const TIMESTAMP = String(Math.floor(NOW_MS / 1000));
const ID = "msg_2abc";
const PAYLOAD = JSON.stringify({ type: "email.received", data: { email_id: "e1" } });

const sign = (opts: {
  payload?: string;
  id?: string;
  timestamp?: string;
  secret?: Buffer;
}): string => {
  const content = `${opts.id ?? ID}.${opts.timestamp ?? TIMESTAMP}.${opts.payload ?? PAYLOAD}`;
  return createHmac("sha256", opts.secret ?? SECRET_BYTES).update(content).digest("base64");
};

const headers = (signature: string, overrides: Record<string, string | null> = {}) => ({
  id: ID,
  timestamp: TIMESTAMP,
  signature: `v1,${signature}`,
  ...overrides,
});

describe("verifySvixSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts a secret without the whsec_ prefix", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: SECRET_BYTES.toString("base64"),
      nowMs: NOW_MS,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a payload that changed by a single byte", async () => {
    const result = await verifySvixSignature({
      payload: `${PAYLOAD} `,
      headers: headers(sign({})),
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature made with a different secret", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({ secret: randomBytes(24) })),
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("fails closed when no secret is configured", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: undefined,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "missing_secret" });
  });

  it("rejects missing headers", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: { id: ID, timestamp: TIMESTAMP, signature: null },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("rejects a replayed capture outside the tolerance window", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: SECRET,
      nowMs: NOW_MS + (DEFAULT_TOLERANCE_SECONDS + 1) * 1000,
    });
    expect(result).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
  });

  it("rejects a timestamp from the future beyond the tolerance", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: SECRET,
      nowMs: NOW_MS - (DEFAULT_TOLERANCE_SECONDS + 1) * 1000,
    });
    expect(result).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
  });

  it("accepts a delivery just inside the tolerance window", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({})),
      secret: SECRET,
      nowMs: NOW_MS + (DEFAULT_TOLERANCE_SECONDS - 1) * 1000,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-numeric timestamp", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({}), { timestamp: "gestern" }),
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_timestamp" });
  });

  it("rejects a signature that is not v1", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: { id: ID, timestamp: TIMESTAMP, signature: `v2,${sign({})}` },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "no_v1_signature" });
  });

  it("accepts the matching signature during a secret rotation", async () => {
    const stale = sign({ secret: randomBytes(24) });
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: {
        id: ID,
        timestamp: TIMESTAMP,
        signature: `v1,${stale} v1,${sign({})}`,
      },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result.ok).toBe(true);
  });

  /**
   * The CRM serves two companies with two separate Resend accounts, each signing
   * with its own endpoint secret. Which account a delivery came from is unknown
   * until the signature holds, so every configured secret is tried.
   */
  describe("several configured secrets (one Resend account each)", () => {
    const SECOND_BYTES = randomBytes(24);
    const SECOND = `whsec_${SECOND_BYTES.toString("base64")}`;

    it("accepts a delivery signed with the first secret", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({})),
        secret: `${SECRET},${SECOND}`,
        nowMs: NOW_MS,
      });
      expect(result.ok).toBe(true);
    });

    it("accepts a delivery signed with the second secret", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({ secret: SECOND_BYTES })),
        secret: `${SECRET},${SECOND}`,
        nowMs: NOW_MS,
      });
      expect(result.ok).toBe(true);
    });

    it("accepts an array of secrets just as well", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({ secret: SECOND_BYTES })),
        secret: [SECRET, SECOND],
        nowMs: NOW_MS,
      });
      expect(result.ok).toBe(true);
    });

    it("still rejects a third, unknown secret", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({ secret: randomBytes(24) })),
        secret: `${SECRET},${SECOND}`,
        nowMs: NOW_MS,
      });
      expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
    });

    it("a malformed entry does not hide the valid one next to it", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({})),
        secret: `whsec_###not-base64###, ${SECRET}`,
        nowMs: NOW_MS,
      });
      expect(result.ok).toBe(true);
    });

    it("reports an unusable configuration instead of a mismatch", async () => {
      const result = await verifySvixSignature({
        payload: PAYLOAD,
        headers: headers(sign({})),
        secret: "whsec_###not-base64###",
        nowMs: NOW_MS,
      });
      expect(result).toEqual({ ok: false, reason: "invalid_secret" });
    });

    it("an empty or whitespace-only setting still fails closed", async () => {
      for (const secret of ["", "   ", ",,"]) {
        const result = await verifySvixSignature({
          payload: PAYLOAD,
          headers: headers(sign({})),
          secret,
          nowMs: NOW_MS,
        });
        expect(result).toEqual({ ok: false, reason: "missing_secret" });
      }
    });
  });

  it("rejects a signature bound to a different message id", async () => {
    const result = await verifySvixSignature({
      payload: PAYLOAD,
      headers: headers(sign({ id: "msg_other" })),
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });
});
