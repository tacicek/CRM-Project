/**
 * Pure decision logic for "is this container port published to loopback ONLY?".
 *
 * This models exactly ONE of the guard's questions: given the published host bindings of a
 * container port, are they all loopback on the expected port? It is used by the destructive
 * DB guard (`db-guard.ts`).
 *
 * The runtime counterpart in the shell, `loopback_verify_container`
 * (`scripts/docker-loopback.sh`), asks the same binding question and **several more that are
 * deliberately not modelled here**, because they need a live Docker inspect rather than pure
 * logic: the container's `.Name`, `.State.Running`, its `com.supabase.cli.project` label, its
 * network membership, and — across *every* published port, not just the one asked about —
 * that no binding is a wildcard. Do not read a pass from this module as "the container is
 * safe"; it means "these bindings are loopback-only".
 *
 * ── What was wrong before ──────────────────────────────────────────────────────────────
 *
 * The old model was a single `host` plus a single `actualPort`, and it accepted this set of
 * "local" hosts: 127.0.0.1, 0.0.0.0, ::1, localhost, ::
 *
 * Two of those entries are the opposite of local. `0.0.0.0` and `::` are wildcards: they mean
 * EVERY interface on the machine — Wi-Fi, VPN, everything. A disposable test stack whose
 * password is printed by `supabase start` was therefore reachable from the whole network, and
 * this file certified it as safe.
 *
 * The single-value shape was the second half of the problem. A container may publish the same
 * container port through SEVERAL host bindings. The shell read them with `docker port … |
 * head -1`, so a second binding on 0.0.0.0 hiding behind a first one on 127.0.0.1 was
 * invisible — and the type here could not even express it.
 *
 * ── The rule ───────────────────────────────────────────────────────────────────────────
 *
 * A verdict is positive only when the binding list is non-empty AND every entry binds exactly
 * 127.0.0.1 on exactly the expected port. There is no host allow-list to get wrong: there is
 * one accepted address.
 *
 * IPv6 loopback (`::1`) is deliberately NOT accepted yet. Accepting it without evidence from a
 * real run that the toolchain publishes and reaches it cleanly would be an assumption, and
 * assumptions are what produced the two holes above.
 */

/** One published host binding of a container port, as Docker reports it. */
export interface PublishedBinding {
  /** `HostIp` from `docker inspect` — "" and "0.0.0.0" both mean "every interface". */
  hostIp: string | undefined | null;
  /** `HostPort` from `docker inspect`, as a string. */
  hostPort: string | undefined | null;
}

export type PublishedBindingReason =
  /** No binding at all: the port is not published, so nothing can be proven about it. */
  | "no_published_binding"
  /** At least one binding is not exactly 127.0.0.1 (wildcard, IPv6, empty, remote…). */
  | "non_loopback_host"
  /** At least one binding sits on a port other than the expected one. */
  | "wrong_port";

export type PublishedBindingResult = { ok: true } | { ok: false; reason: PublishedBindingReason };

/** The only host address a published binding may carry. */
export const LOOPBACK_HOST_IP = "127.0.0.1";

/**
 * Decide whether every published binding of one container port is loopback-only on the
 * expected port. Refuses by default: an empty or missing list is a refusal, never a pass.
 */
export const evaluatePublishedBindings = (
  bindings: readonly PublishedBinding[] | undefined | null,
  expectedPort: string,
): PublishedBindingResult => {
  // "Not published" is a different state from "published safely" — it is never rounded up
  // to a pass. The same holds for an expectation we cannot compare against.
  if (!bindings || bindings.length === 0) return { ok: false, reason: "no_published_binding" };
  if (!expectedPort) return { ok: false, reason: "wrong_port" };

  // EVERY binding, not the first one. A single wildcard among otherwise loopback bindings
  // exposes the port just as completely as a wildcard on its own.
  for (const binding of bindings) {
    if (binding.hostIp !== LOOPBACK_HOST_IP) return { ok: false, reason: "non_loopback_host" };
    if (binding.hostPort !== expectedPort) return { ok: false, reason: "wrong_port" };
  }

  return { ok: true };
};
