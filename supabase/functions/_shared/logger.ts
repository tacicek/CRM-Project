/**
 * Shared logger utility for edge functions
 */

export function createLogger(prefix: string) {
  return {
    logStep(step: string, details?: unknown) {
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.log(`[${prefix}] ${step}${detailsStr}`);
    },
    warn(step: string, details?: unknown) {
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.warn(`[${prefix}] ${step}${detailsStr}`);
    },
    error(step: string, details?: unknown) {
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.error(`[${prefix}] ${step}${detailsStr}`);
    },
  };
}
