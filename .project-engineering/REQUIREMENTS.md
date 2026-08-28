# CRM Hardening — Requirements

- Scope version: `1`
- Last updated: `2026-08-28`

Derived from `CRM_SYSTEM_HARDENING_PROGRAM.md` §1 (definition of
"production-grade") and §14 (completion criteria).

## Functional Requirements

**REQ-F-001 — Tenant isolation.** A user in company A can never read, mutate,
send, print, export or schedule data under company B unless B is explicitly
authorized and is the selected active tenant.

**REQ-F-002 — Active tenant is the only source.** Under `/firma` no code
discovers the company from e-mail, membership order, recency, or the assumption
that there is only one.

**REQ-F-003 — Document locale carries through.** A German-speaking operator can
run a French- or English-speaking customer chain end to end without German
customer-facing text leaking in.

**REQ-F-004 — Missing mandatory translation blocks.** Preview may show marked
fallback; the first send must not.

**REQ-F-005 — Locale-aware spell check.** German rules apply only to `de`.
Never translate. An unsupported or missing locale is rejected, not assumed to be
German.

**REQ-F-006 — One tested authorization model per deployed edge function**,
checked inside the handler, recorded in the manifest, enforced by a gate.

**REQ-F-007 — Frozen customer documents.** A document sent for the first time
becomes an immutable snapshot; later template edits change neither the public
view nor the acceptance evidence of that version.

**REQ-F-008 — Monetary agreement.** Every displayed and printed amount is the
result of the one canonical computation. A control that reaches no computation
is removed or connected.

## Non-functional Requirements

**REQ-NF-001 — Evidence before assertion.** Nothing closes because the code
looks right. It closes at the final boundary: the persisted row, the generated
document, the outgoing message, or the authorization decision.

**REQ-NF-002 — Production boundary.** No production write without separate
authorization. Such work is prepared fully in source, proven on a disposable
environment, and packaged with rollout and rollback.

**REQ-NF-003 — No symptom suppression.** No silent `try/catch`, no success toast
over a failed side effect, no `as any`, no new `eslint-disable`, no production
`console.log`, no barrel export.

**REQ-NF-004 — Gate quality.** Touched files carry zero lint errors and the
repository total must not increase. `type-check` and the test suite stay green.

**REQ-NF-005 — Historical data untouched.** No repair, backfill or normalization
of existing `offers` / `offer_items`.

## Acceptance Scenarios

**REQ-F-001 / REQ-F-002.** Given a user who is a member of company A and company
B, and B was created most recently, when A is the selected active tenant, then
every `/firma` surface — invoice list and detail, receipt list and detail, offer
create/edit/detail, orders, settings, archive, imports, pricing, catalog,
checklist, team — loads A. Opening a B row under A context fails closed without
revealing that the row exists. A slow A response arriving after switching to B
cannot populate the B screen.

**REQ-F-003.** Given operator locale `de` and offer language `fr`, when the
offer is created from a lead, previewed, spell-checked, sent with PDF plus AGB
and checklist attachments, opened publicly, accepted, converted to an
appointment/order, invoiced and receipted, then every customer-facing string is
French and the operator chrome stays German. Repeat for `en`.

**REQ-F-004.** Given the same chain with exactly one mandatory French
translation missing, when the operator sends for the first time, then the send
is blocked and the response names the exact missing source.

**REQ-F-005.** Given fields in `fr`, when spell check runs, then German
orthographic rules are not applied and nothing is translated. Given a missing or
unsupported locale, then the request is rejected.

**REQ-F-006.** Given the newest production-truth generation, when the manifest
gate runs, then every deployed function carries exactly one known model, no
claimed deployment is absent from production, and no tombstone lacks source.

## Requirement Status

| ID | Status | Evidence |
| --- | --- | --- |
| REQ-F-001 | OPEN | 17 callers of the guessing helper (P0-S7) |
| REQ-F-002 | OPEN | same |
| REQ-F-003 | OPEN | P0-S8; program F-002, F-004 |
| REQ-F-004 | OPEN | program F-005 |
| REQ-F-005 | OPEN | P0-S8 |
| REQ-F-006 | MET (source), rollout pending | `docs/hardening/edge-auth-manifest.json` + gate; 10 drifted deployments `AWAITING_PRODUCTION_AUTH` |
| REQ-F-007 | OPEN | program F-006 |
| REQ-F-008 | OPEN | program P2.2 |
| REQ-NF-001 | ACTIVE | `.project-engineering/evidence/` |
| REQ-NF-002 | ACTIVE | two production writes parked, none performed |
| REQ-NF-003 | ACTIVE | H-004 open |
| REQ-NF-004 | ACTIVE | baseline 88 lint errors recorded |
| REQ-NF-005 | ACTIVE | no historical write performed |
