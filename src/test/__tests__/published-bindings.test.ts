import { describe, it, expect } from "vitest";
import { evaluatePublishedBindings, LOOPBACK_HOST_IP } from "@/test/published-bindings";

const PORT = "54342";

describe("evaluatePublishedBindings", () => {
  it("accepts a single loopback binding on the expected port", () => {
    expect(evaluatePublishedBindings([{ hostIp: "127.0.0.1", hostPort: PORT }], PORT)).toEqual({ ok: true });
  });

  it("accepts several bindings when every one of them is loopback on the expected port", () => {
    expect(evaluatePublishedBindings(
      [{ hostIp: "127.0.0.1", hostPort: PORT }, { hostIp: "127.0.0.1", hostPort: PORT }],
      PORT,
    )).toEqual({ ok: true });
  });

  // The wildcards. These were in the old "local hosts" allow-list, which is what made the
  // whole guard decorative: 0.0.0.0 means every interface on the machine.
  it("refuses 0.0.0.0 — it is the opposite of loopback", () => {
    expect(evaluatePublishedBindings([{ hostIp: "0.0.0.0", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses :: (the IPv6 wildcard)", () => {
    expect(evaluatePublishedBindings([{ hostIp: "::", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses an empty HostIp — Docker writes '' for a wildcard binding", () => {
    expect(evaluatePublishedBindings([{ hostIp: "", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses a missing HostIp", () => {
    expect(evaluatePublishedBindings([{ hostIp: null, hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
    expect(evaluatePublishedBindings([{ hostIp: undefined, hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses 'localhost' — a name is not an address, and it resolves per machine", () => {
    expect(evaluatePublishedBindings([{ hostIp: "localhost", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses ::1 for now — IPv6 loopback is not accepted without evidence from a real run", () => {
    expect(evaluatePublishedBindings([{ hostIp: "::1", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses a routable address", () => {
    expect(evaluatePublishedBindings([{ hostIp: "192.168.1.20", hostPort: PORT }], PORT))
      .toEqual({ ok: false, reason: "non_loopback_host" });
  });

  // The reason the shape is a list at all: `docker port … | head -1` showed only the first
  // binding, so a wildcard behind a loopback entry was invisible.
  it("refuses loopback + wildcard, in either order", () => {
    expect(evaluatePublishedBindings(
      [{ hostIp: "127.0.0.1", hostPort: PORT }, { hostIp: "0.0.0.0", hostPort: PORT }], PORT,
    )).toEqual({ ok: false, reason: "non_loopback_host" });
    expect(evaluatePublishedBindings(
      [{ hostIp: "0.0.0.0", hostPort: PORT }, { hostIp: "127.0.0.1", hostPort: PORT }], PORT,
    )).toEqual({ ok: false, reason: "non_loopback_host" });
  });

  it("refuses a second binding that is loopback but on the wrong port", () => {
    expect(evaluatePublishedBindings(
      [{ hostIp: "127.0.0.1", hostPort: PORT }, { hostIp: "127.0.0.1", hostPort: "54322" }], PORT,
    )).toEqual({ ok: false, reason: "wrong_port" });
  });

  it("refuses the wrong port (e.g. the 54322 Supabase default)", () => {
    expect(evaluatePublishedBindings([{ hostIp: "127.0.0.1", hostPort: "54322" }], PORT))
      .toEqual({ ok: false, reason: "wrong_port" });
  });

  it("refuses a missing or empty host port instead of falling back to a default", () => {
    expect(evaluatePublishedBindings([{ hostIp: "127.0.0.1", hostPort: "" }], PORT))
      .toEqual({ ok: false, reason: "wrong_port" });
    expect(evaluatePublishedBindings([{ hostIp: "127.0.0.1", hostPort: null }], PORT))
      .toEqual({ ok: false, reason: "wrong_port" });
  });

  // "Not published" is a different state from "published safely", and it is never rounded up.
  it("refuses an empty binding list", () => {
    expect(evaluatePublishedBindings([], PORT)).toEqual({ ok: false, reason: "no_published_binding" });
  });

  it("refuses a missing binding list", () => {
    expect(evaluatePublishedBindings(null, PORT)).toEqual({ ok: false, reason: "no_published_binding" });
    expect(evaluatePublishedBindings(undefined, PORT)).toEqual({ ok: false, reason: "no_published_binding" });
  });

  it("refuses when there is no expected port to compare against", () => {
    expect(evaluatePublishedBindings([{ hostIp: "127.0.0.1", hostPort: PORT }], ""))
      .toEqual({ ok: false, reason: "wrong_port" });
  });

  it("pins the one accepted address, so widening it needs a deliberate edit here", () => {
    expect(LOOPBACK_HOST_IP).toBe("127.0.0.1");
  });
});
