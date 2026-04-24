import { PENDING_STATUSES, VERIFIED_STATUSES, MAX_CONCURRENT_REQUESTS, type Lead } from "./types";

/**
 * Maps a raw service_type string to a canonical category key.
 * Single source of truth — used by Leads.tsx, LeadDetailDialog.tsx, and any other component
 * that needs to branch on service category.
 */
export const getServiceCategory = (serviceType: string | null | undefined): string => {
  if (!serviceType) return "other";
  const t = serviceType.toLowerCase();
  if (t.startsWith("umzug_") || t === "umzug" || t === "privatumzug" || t === "firmenumzug" || t === "bueroumzug" || t === "seniorenumzug") return "umzug";
  if (t.startsWith("reinigung_") || t === "reinigung" || t === "endreinigung" || t === "grundreinigung" || t === "uebergabereinigung" || t === "unterhaltsreinigung" || t === "reinigung_unterhalts") return "reinigung";
  if (t.startsWith("raeumung") || t === "raeumung" || t === "kellerraeumung" || t === "wohnungsraeumung" || t === "hausraeumung" || t === "nachlassraeumung") return "raeumung";
  if (t.startsWith("entsorgung") || t === "entsorgung" || t === "moebelentsorgung" || t === "sperrmuell") return "entsorgung";
  if (t.startsWith("lagerung") || t === "lagerung" || t === "einlagerung" || t === "zwischenlagerung") return "lagerung";
  if (t === "klaviertransport" || t.startsWith("klaviertransport_") || t === "fluegeltransport") return "klaviertransport";
  if (t === "moebellift" || t.startsWith("moebellift_") || t === "moebelaufzug") return "moebellift";
  if (t === "spezialtransport") return "spezialtransport";
  if (t === "transport_moebel" || t === "moebeltransport") return "transport";
  if (t === "malerarbeit" || t === "malerarbeiten" || t === "renovation") return "other";
  return "other";
};

/**
 * Check if a lead status is pending verification
 */
export const isPendingStatus = (status: string | null): boolean => {
  return status !== null && (PENDING_STATUSES as readonly string[]).includes(status);
};

/**
 * Check if a lead status is verified
 */
export const isVerifiedStatus = (status: string | null): boolean => {
  return status !== null && (VERIFIED_STATUSES as readonly string[]).includes(status);
};

/**
 * Validate IPv4 or IPv6 address format
 */
export const isValidIpAddress = (ip: string): boolean => {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;

  if (ipv4Pattern.test(ip)) {
    const octets = ip.split(".").map(Number);
    return octets.every((o) => o >= 0 && o <= 255);
  }

  return ipv6Pattern.test(ip);
};

/**
 * Escape CSV value to prevent injection and formatting issues
 */
export const escapeCSV = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r") ||
    str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Get human-readable time ago string (German)
 */
export const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0 || isNaN(diffMs)) return "gerade eben";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "gerade eben";
  if (diffMins < 60) return `vor ${diffMins} Min`;
  if (diffHours < 24) return `vor ${diffHours} Std`;
  if (diffDays === 1) return "vor 1 Tag";
  return `vor ${diffDays} Tagen`;
};

export const getSpamRiskTooltip = (lead: Lead): string => {
  const parts: string[] = [];
  if (lead.ip_address) parts.push(`IP: ${lead.ip_address}`);
  if ((lead.spam_score || 0) >= 2) parts.push("Mögliche Duplikate erkannt");
  if (!lead.preferred_date) parts.push("Kein Datum angegeben");
  if (lead.description && lead.description.length < 10) parts.push("Kurze Beschreibung");
  return parts.length > 0 ? parts.join(" | ") : "Keine Auffälligkeiten";
};

/**
 * Format date to de-CH locale
 */
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

/**
 * Process items in batches with concurrency limit
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = MAX_CONCURRENT_REQUESTS
): Promise<{ successes: R[]; failures: Array<{ item: T; error: Error }> }> {
  const results: R[] = [];
  const failures: Array<{ item: T; error: Error }> = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));

    batchResults.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        failures.push({ item: batch[idx], error: result.reason });
      }
    });
  }

  return { successes: results, failures };
}

/**
 * Translate form field keys to German labels (used by LeadFormDataRenderer)
 */
export const translateKey = (key: string | number | symbol): string => {
  const keyStr = String(key);
  const translations: Record<string, string> = {
    // Customer info
    vorname: "Vorname", nachname: "Nachname", email: "E-Mail", telefon: "Telefon",
    tel: "Telefon", anrede: "Anrede", firma: "Firma", bemerkungen: "Bemerkungen",
    nachricht: "Nachricht", zeit: "Kontaktzeit",
    // Addresses
    str: "Strasse", nr: "Hausnummer", plz: "PLZ", ort: "Ort",
    von_plz: "Von PLZ", von_ort: "Von Ort", von_strasse: "Von Strasse", von_hausnummer: "Von Nr.",
    von_stockwerk: "Von Stockwerk", von_lift: "Lift (Von)", von_zimmer: "Zimmer (Von)",
    von_wohnflaeche: "Wohnfläche (Von)", vonstr: "Strasse (Von)", vonnr: "Nr. (Von)",
    vonplz: "PLZ (Von)", vonort: "Ort (Von)", vonstock: "Stockwerk (Von)", vonlift: "Lift (Von)",
    nach_plz: "Nach PLZ", nach_ort: "Nach Ort", nach_strasse: "Nach Strasse",
    nach_hausnummer: "Nach Nr.", nach_stockwerk: "Nach Stockwerk", nach_lift: "Lift (Nach)",
    nachstr: "Strasse (Nach)", nachnr: "Nr. (Nach)", nachplz: "PLZ (Nach)", nachort: "Ort (Nach)",
    nachstock: "Stockwerk (Nach)", nachlift: "Lift (Nach)",
    stock: "Stockwerk", lift: "Lift vorhanden",
    // Object
    unterkunft: "Unterkunft", m2: "Wohnfläche m²", zimmer: "Zimmeranzahl",
    bad: "Badezimmer", wc: "WC", rooms: "Räume",
    balkon: "Balkon", balkon_m2: "Balkonfläche m²",
    storen: "Storen", storen_count: "Anzahl Storen",
    fen_normal: "Normale Fenster", fen_gross: "Grosse Fenster", fen_tuer: "Fenstertüren",
    besonderheiten: "Besonderheiten",
    // Moving
    umzugsart: "Umzugsart", umzugsdatum: "Umzugsdatum", wunschtermin: "Wunschtermin",
    flexibel: "Flexibel", flex: "Flexibilität", date: "Datum",
    zeitfenster: "Zeitfenster", zimmeranzahl: "Zimmeranzahl", wohnflaeche: "Wohnfläche m²",
    stockwerk: "Stockwerk", offerten: "Offerten",
    sperrgut: "Sperrgut", sperrgut_items: "Sperrige Gegenstände",
    // Services
    verpackungsservice: "Verpackungsservice", endreinigung: "Endreinigung",
    einlagerung: "Einlagerung", montage_demontage: "Montage/Demontage",
    entsorgung: "Entsorgung", halteverbot: "Halteverbot",
    zusatzleistungen: "Zusatzleistungen", services: "Leistungen",
    // Cleaning
    reinigungsart: "Reinigungsart", flaeche: "Fläche m²", anzahl_zimmer: "Anzahl Zimmer",
    anzahl_badezimmer: "Anzahl Badezimmer", kuechentyp: "Küchentyp",
    reinigungsgarantie: "Reinigungsgarantie",
    // Räumung
    raeumungsart: "Räumungsart", raeumungstyp: "Räumungstyp", volumen: "Volumen",
    objekttyp: "Objekttyp", etage: "Etage", zugang: "Zugang",
    rart: "Räumungsart", vol: "Volumen", dring: "Dringlichkeit", schwer: "Schwere Gegenstände",
    svctype: "Serviceart",
    // Piano / Transport
    klaviertyp: "Klaviertyp", klaviermarke: "Klaviermarke",
    klaviergewicht: "Gewicht (kg)", klaviertransport: "Klaviertransport",
    dl: "Dienstleistung", inst: "Instrument",
    // Möbellift
    zweck: "Zweck", was: "Gegenstand", richtung: "Richtung", dauer: "Dauer",
    zugang_info: "Zugangsinformationen",
    // Lagerung
    lart: "Lagerart", grosse: "Grösse", abholung: "Abholung gewünscht",
    startmode: "Startmodus", startdate: "Startdatum", wastext: "Lagerinhalt",
    pstr: "Strasse", pnr: "Nr.", pplz: "PLZ", port: "Ort",
    // Spezialtransport
    kat: "Kategorie", detailanswer: "Details",
    // Other
    besondere_gegenstaende: "Besondere Gegenstände",
    sonstiges: "Sonstiges", kommentar: "Kommentar", notizen: "Notizen",
    service_type: "Serviceart", max_companies: "Max. Firmen",
    ausfuehrungsdatum: "Ausführungsdatum", dringlichkeit: "Dringlichkeit",
    auszugsadresse: "Auszugsadresse", einzugsadresse: "Einzugsadresse",
    kontaktdaten: "Kontaktdaten", umzugsdetails: "Umzugsdetails",
    inventar: "Inventar", termin: "Termin",
    von_country: "Land (Von)", nach_country: "Land (Nach)",
    // Boolean
    ja: "Ja", nein: "Nein", true: "Ja", false: "Nein",
  };

  const lower = keyStr.toLowerCase();
  if (translations[lower]) return translations[lower];

  return keyStr
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Translate form field values to German display text.
 * Accepts unknown because JSON form data may contain numbers, booleans, or nested objects.
 */
export const translateValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string" && o.name.length > 0) {
      const qty = o.anzahl ?? o.count;
      return qty !== undefined && qty !== null && qty !== ""
        ? `${String(qty)}× ${o.name}`
        : o.name;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value !== "string") return String(value);

  const translations: Record<string, string> = {
    // Time / Flex
    any: "Jederzeit", morning: "Morgens", afternoon: "Nachmittags", evening: "Abends",
    morgens: "Morgens", nachmittags: "Nachmittags", abends: "Abends",
    fix: "Festes Datum", flexibel: "Flexibel", flexible: "Flexibel",
    "pm_2": "±2 Tage", "pm_7": "±1 Woche", "pm_14": "±2 Wochen", "pm_30": "±1 Monat",
    // Anrede
    herr: "Herr", frau: "Frau",
    // Unterkunft
    wohnung: "Wohnung", haus: "Haus", "wg-zimmer": "WG-Zimmer", buero: "Büro",
    büro: "Büro", gewerbe: "Gewerbe", studio: "Studio", villa: "Villa",
    // Umzugsart
    privat: "Privat", firma: "Firma",
    // Rooms
    kueche: "Küche", küche: "Küche", wohnzimmer: "Wohnzimmer", schlafzimmer: "Schlafzimmer",
    kinderzimmer: "Kinderzimmer", badezimmer: "Badezimmer", arbeitszimmer: "Arbeitszimmer",
    keller: "Keller", estrich: "Estrich", dachboden: "Dachboden", garage: "Garage",
    balkon: "Balkon", terrasse: "Terrasse", garten: "Garten", abstellraum: "Abstellraum",
    waschkueche: "Waschküche", flur: "Flur/Korridor",
    // Räumung
    wohnung_raeumung: "Wohnungsräumung", haus_raeumung: "Hausräumung",
    keller_raeumung: "Kellerräumung", estrich_raeumung: "Estrichräumung",
    buero_raeumung: "Büroräumung", garten_raeumung: "Gartenräumung",
    komplett: "Komplett", teilweise: "Teilweise",
    klein: "Klein", mittel: "Mittel", gross: "Gross",
    normal: "Normal", dringend: "Dringend", sehr_dringend: "Sehr dringend",
    wenig: "Wenig", viel: "Viel", ja: "Ja", nein: "Nein",
    // Lagerung
    selfstorage: "Self-Storage", lagerraum: "Lagerraum", container: "Container",
    indoor: "Indoor-Lager", outdoor: "Outdoor-Lager",
    s: "Klein (S)", m: "Mittel (M)", l: "Gross (L)", xl: "Sehr gross (XL)",
    sofort: "Sofort", spaeter: "Später",
    // Möbellift
    umzug: "Umzug", lieferung: "Lieferung", entsorgung: "Entsorgung",
    moebel: "Möbel", "weisse-ware": "Weisse Ware", baumaterial: "Baumaterial", sonstiges: "Sonstiges",
    rauf: "Hinauf", runter: "Hinunter", beides: "Beides",
    // Klaviertransport
    transport: "Transport", stimmen: "Stimmen", "transport+stimmen": "Transport + Stimmen",
    fluegel: "Flügel", klavier: "Klavier", e_piano: "E-Piano", keyboard: "Keyboard", orgel: "Orgel",
    // Spezialtransport
    tresor: "Tresor", aquarium: "Aquarium", billardtisch: "Billardtisch",
    kunstwerk: "Kunstwerk", maschine: "Maschine", motorrad: "Motorrad",
    whirlpool: "Whirlpool", other: "Anderes",
    // Reinigung extras
    grundreinigung: "Grundreinigung", fensterreinigung: "Fensterreinigung",
    teppichreinigung: "Teppichreinigung", jalousien: "Jalousienreinigung",
    backofen: "Backofenreinigung", kuehlschrank: "Kühlschrankreinigung",
    // Besonderheiten
    haustiere: "Haustiere", raucher: "Raucherwohnung", altbau: "Altbau",
    neubau: "Neubau", minergie: "Minergie-Haus",
    // Service types
    reinigung: "Reinigung", reinigung_end: "Endreinigung", reinigung_grund: "Grundreinigung",
    reinigung_fenster: "Fensterreinigung", reinigung_bau: "Baureinigung",
    raeumung: "Räumung", klaviertransport: "Klaviertransport",
    moebellift: "Möbellift", lagerung: "Lagerung", spezialtransport: "Spezialtransport",
    umzug_privat: "Privatumzug", umzug_firma: "Firmenumzug", umzug_international: "Internationaler Umzug",
    // Boolean
    true: "Ja", false: "Nein",
  };

  const lower = value.toLowerCase().trim();
  if (translations[lower]) return translations[lower];

  return value;
};
