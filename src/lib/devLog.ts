/**
 * Development-only console logging.
 *
 * Production builds must stay quiet (CLAUDE.md §2: no `console.log` in production).
 * Genuine errors still use `console.error` or a `sonner` toast directly — this helper
 * is only for diagnostic noise that should never reach a production bundle.
 *
 * `import.meta.env.DEV` is a static boolean that Vite inlines at build time, so these
 * calls are dead-code-eliminated from production output entirely — no runtime branch,
 * no leaked strings. Centralised here so individual files don't scatter their own
 * `if (import.meta.env.DEV)` guards.
 */
export const devLog = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const devWarn = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};
