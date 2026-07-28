import { describe, expect, it } from "vitest";
import {
  clampActiveIndex,
  NO_ACTIVE_INDEX,
  nextActiveIndex,
} from "@/features/wiki/wikiSearchKeyboard";

/**
 * The part of the keyboard contract that can be proven without a DOM.
 *
 * CLAUDE.md §9 keeps this repo on pure-function tests, and Vitest runs in a `node`
 * environment here, so the ARIA wiring around these numbers is verified by hand against
 * the checklist in docs/WIKI_MAINTENANCE.md. What IS provable — wrapping, clamping and
 * the empty-list case — is exactly where off-by-one bugs live, so it is worth pinning.
 */
describe("nextActiveIndex", () => {
  it("returns nothing selected when the list is empty", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"] as const) {
      expect(nextActiveIndex(NO_ACTIVE_INDEX, key, 0), key).toBe(NO_ACTIVE_INDEX);
      expect(nextActiveIndex(3, key, 0), key).toBe(NO_ACTIVE_INDEX);
    }
  });

  it("moves to the first row on the first ArrowDown", () => {
    expect(nextActiveIndex(NO_ACTIVE_INDEX, "ArrowDown", 5)).toBe(0);
  });

  it("moves to the last row on the first ArrowUp", () => {
    // Reaching the bottom of a short list should not require five key presses.
    expect(nextActiveIndex(NO_ACTIVE_INDEX, "ArrowUp", 5)).toBe(4);
  });

  it("advances and wraps at the end", () => {
    expect(nextActiveIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextActiveIndex(1, "ArrowDown", 3)).toBe(2);
    expect(nextActiveIndex(2, "ArrowDown", 3)).toBe(0);
  });

  it("goes back and wraps at the start", () => {
    expect(nextActiveIndex(2, "ArrowUp", 3)).toBe(1);
    expect(nextActiveIndex(1, "ArrowUp", 3)).toBe(0);
    expect(nextActiveIndex(0, "ArrowUp", 3)).toBe(2);
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextActiveIndex(2, "Home", 5)).toBe(0);
    expect(nextActiveIndex(2, "End", 5)).toBe(4);
    expect(nextActiveIndex(NO_ACTIVE_INDEX, "Home", 5)).toBe(0);
    expect(nextActiveIndex(NO_ACTIVE_INDEX, "End", 5)).toBe(4);
  });

  it("handles a single-row list without moving anywhere", () => {
    expect(nextActiveIndex(0, "ArrowDown", 1)).toBe(0);
    expect(nextActiveIndex(0, "ArrowUp", 1)).toBe(0);
  });
});

describe("clampActiveIndex", () => {
  it("drops the selection when the list empties", () => {
    // Typing another letter can shrink the results to nothing while a row was highlighted.
    expect(clampActiveIndex(2, 0)).toBe(NO_ACTIVE_INDEX);
  });

  it("pulls a stale index back onto the last row", () => {
    expect(clampActiveIndex(7, 3)).toBe(2);
  });

  it("leaves a valid index alone", () => {
    expect(clampActiveIndex(1, 3)).toBe(1);
  });

  it("keeps nothing-selected as nothing-selected", () => {
    expect(clampActiveIndex(NO_ACTIVE_INDEX, 3)).toBe(NO_ACTIVE_INDEX);
  });
});
