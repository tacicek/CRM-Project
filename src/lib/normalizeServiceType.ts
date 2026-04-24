/**
 * Normalizes service type for AGB lookup.
 * Maps specific sub-types to their base category so AGB stored
 * under the base key are found regardless of the lead's exact variant.
 *
 * IMPORTANT: raeumung and entsorgung are separate service types with
 * independent AGB sections — they must NOT be merged.
 */
export const normalizeServiceTypeForAgb = (serviceType: string): string => {
  const mappings: Record<string, string> = {
    // Umzug variants → umzug
    'umzug_privat': 'umzug',
    'umzug_firma': 'umzug',
    'umzug_buero': 'umzug',
    'umzug_international': 'umzug',
    'privatumzug': 'umzug',
    'firmenumzug': 'umzug',

    // Reinigung variants → reinigung
    'endreinigung': 'reinigung',
    'grundreinigung': 'reinigung',
    'umzugsreinigung': 'reinigung',
    'reinigung_umzug': 'reinigung',
    'reinigung_bau': 'reinigung',
    'reinigung_buero': 'reinigung',

    // Räumung variants → raeumung (NOT entsorgung)
    'raeumung_wohnung': 'raeumung',
    'raeumung_keller': 'raeumung',
    'raeumung_haus': 'raeumung',
    'entrümpelung': 'raeumung',

    // Entsorgung variants → entsorgung
    'entsorgung_moebel': 'entsorgung',
    'entsorgung_sperrgut': 'entsorgung',

    // Transport variants → transport
    'moebel_transport': 'transport',
    'usm_transport': 'transport',
    'wasserbett_transport': 'transport',
  };

  return mappings[serviceType.toLowerCase()] || serviceType;
};
