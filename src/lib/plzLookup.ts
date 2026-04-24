/**
 * Swiss PLZ lookup — two-tier strategy:
 * 1. Local SWISS_PLZ cache (instant, ~2800 common entries)
 * 2. openplzapi.org free API fallback (complete 4200+ coverage)
 *
 * API docs: https://openplzapi.org
 */
import { SWISS_PLZ, type PlzEntry } from "@/data/swissPlz";

// In-memory API cache to avoid duplicate requests
const apiCache = new Map<string, PlzEntry[]>();

/**
 * Filter PLZ suggestions for autocomplete dropdown.
 * Checks local list first; if 4 digits entered and nothing found → queries API.
 */
export async function lookupPlz(prefix: string): Promise<PlzEntry[]> {
  const clean = prefix.trim();
  if (clean.length < 2) return [];

  // 1. Local lookup (instant)
  const local = SWISS_PLZ.filter(e => e.p.startsWith(clean)).slice(0, 10);
  if (local.length > 0) return local;

  // 2. API fallback — only when exactly 4 digits and not already cached
  if (clean.length === 4 && /^\d{4}$/.test(clean)) {
    if (apiCache.has(clean)) return apiCache.get(clean)!;

    try {
      const res = await fetch(
        `https://openplzapi.org/ch/Localities?postalCode=${clean}&page=1&pageSize=10`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) return [];

      const data: Array<{ postalCode: string; name: string; canton: { code: string } }> = await res.json();
      const entries: PlzEntry[] = data.map(d => ({
        p: d.postalCode,
        o: d.name,
        k: d.canton?.code ?? "CH",
      }));

      apiCache.set(clean, entries);
      return entries;
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Synchronous local-only filter (use when async is not possible).
 */
export function filterPlzLocal(prefix: string): PlzEntry[] {
  if (prefix.length < 2) return [];
  return SWISS_PLZ.filter(e => e.p.startsWith(prefix)).slice(0, 10);
}
