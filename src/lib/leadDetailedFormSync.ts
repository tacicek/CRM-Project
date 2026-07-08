/**
 * Keeps a lead's `detailed_form_data` snapshot consistent after top-level
 * column edits (Anfrage bearbeiten).
 *
 * Two snapshot shapes exist:
 * - Flat (manual import): `import-manual-lead` stores the column-named lead
 *   payload 1:1 (`from_street`, `from_has_lift`, …). Edited columns are
 *   mirrored back with a flat merge.
 * - Nested (web form, Umzug): sections like `auszug`/`einzug` hold
 *   `adresse`, `aufzug.vorhanden`, `stockwerk`. The offer calculator
 *   (useLeadDataMapper) prefers these nested values over the top-level
 *   columns, so edits MUST be written into the nested paths too — otherwise
 *   a corrected value (e.g. "Lift vorhanden") would never reach the Offerte.
 *
 * Nested snapshots of other services have no known write-back mapping and
 * are left untouched (top-level columns still carry the correction).
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Reverse of useLeadDataMapper's stockwerkToNumber. */
const floorToStockwerk = (floor: number): string => {
  if (floor <= -1) return "basement";
  if (floor === 0) return "ground_floor";
  if (floor >= 5) return "floor_5_plus";
  return `floor_${floor}`;
};

const NESTED_DIRECTIONS = [
  { section: "auszug", prefix: "from_" },
  { section: "einzug", prefix: "to_" },
] as const;

const ADDRESS_KEY_MAP: ReadonlyArray<readonly [columnSuffix: string, nestedKey: string]> = [
  ["street", "strasse"],
  ["house_number", "hausnummer"],
  ["plz", "plz"],
  ["city", "ort"],
];

export function syncLeadDetailedFormData(
  detailed: Record<string, unknown> | null | undefined,
  updates: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!isPlainObject(detailed)) return null;

  const hasNestedSections = Object.values(detailed).some(isPlainObject);
  if (!hasNestedSections) {
    return { ...detailed, ...updates };
  }

  const next: Record<string, unknown> = { ...detailed };
  for (const { section, prefix } of NESTED_DIRECTIONS) {
    if (!isPlainObject(next[section])) continue;
    const sec: Record<string, unknown> = { ...(next[section] as Record<string, unknown>) };

    const adresse: Record<string, unknown> = isPlainObject(sec.adresse) ? { ...sec.adresse } : {};
    let adresseTouched = false;
    for (const [columnSuffix, nestedKey] of ADDRESS_KEY_MAP) {
      const column = `${prefix}${columnSuffix}`;
      if (column in updates) {
        adresse[nestedKey] = updates[column];
        adresseTouched = true;
      }
    }
    if (adresseTouched) sec.adresse = adresse;

    const liftColumn = `${prefix}has_lift`;
    if (liftColumn in updates) {
      const aufzug: Record<string, unknown> = isPlainObject(sec.aufzug) ? { ...sec.aufzug } : {};
      aufzug.vorhanden = updates[liftColumn];
      sec.aufzug = aufzug;
    }

    const floorColumn = `${prefix}floor`;
    if (floorColumn in updates && typeof updates[floorColumn] === "number") {
      sec.stockwerk = floorToStockwerk(updates[floorColumn] as number);
    }

    next[section] = sec;
  }
  return next;
}
