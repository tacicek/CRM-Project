/**
 * Keyboard semantics for the search result list, as a pure function.
 *
 * Extracted from the component on purpose. The repo tests pure functions only
 * (CLAUDE.md §9) and Vitest runs in a `node` environment here, so this is the part of
 * the keyboard contract that *can* be proven automatically: wrapping, clamping, and
 * the empty-list case. The ARIA wiring around it is verified in the browser against
 * the checklist in docs/WIKI_MAINTENANCE.md.
 */

export type WikiSearchKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** No active row. Used before the first arrow key and whenever the list empties. */
export const NO_ACTIVE_INDEX = -1;

/**
 * The next active row index.
 *
 * Wraps at both ends, because a list of search results is short and cycling is faster
 * than reversing direction. An empty list always yields `NO_ACTIVE_INDEX`, so the
 * caller never has to guard before calling.
 */
export const nextActiveIndex = (
  current: number,
  key: WikiSearchKey,
  count: number,
): number => {
  if (count <= 0) return NO_ACTIVE_INDEX;

  switch (key) {
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "ArrowDown": {
      // From "nothing selected", the first ArrowDown lands on the first row.
      if (current < 0) return 0;
      return (current + 1) % count;
    }
    case "ArrowUp": {
      // From "nothing selected", the first ArrowUp lands on the last row.
      if (current < 0) return count - 1;
      return (current - 1 + count) % count;
    }
  }
};

/** Clamp a remembered index onto a result list that has since changed length. */
export const clampActiveIndex = (current: number, count: number): number => {
  if (count <= 0) return NO_ACTIVE_INDEX;
  if (current < 0) return NO_ACTIVE_INDEX;
  return Math.min(current, count - 1);
};
