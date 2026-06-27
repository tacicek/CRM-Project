// Kanonik servis-tipi normalizasyonu — offer_items STAMPING için tek kaynak (referans §3).
//
// ⚠️ Lesson #1/#3: Bu fn STAMPING içindir (item hangi tek base'e ait). Mevcut
// `normalizeServiceTypeForAgb` (AGB lookup) ve `getServiceTypeCandidates` (katalog IN-lookup)
// FARKLI ihtiyaçlar (çoklu-aday) — onlara dokunulmadı, yerinde kalıyorlar. Üçüncü çelişen
// mapper DEĞİL; bu, o ikisinin çelişkilerini onaylanan kararlarla çözen kanonik olandır.
//
// Onaylanan taksonomi (D1-D6):
//   D1 transport_moebel / moebel_transport → transport
//   D2 klaviertransport / *klavier*        → transport
//   D3 moebellift / moebellift_*           → umzug
//   D4 malerarbeit / renovation            → null (katalogda base yok → Allgemein)
//   D5 lagerung_*                          → lagerung
//   D6 entrümpelung / entruempelung (ü+ue) → raeumung
//   raeumung ≠ entsorgung (ayrı — Lesson #3)

export type CatalogBase =
  | "umzug"
  | "reinigung"
  | "raeumung"
  | "entsorgung"
  | "transport"
  | "lagerung";

// Exact eşleşmeler (iki mevcut mapper'dan + onaylanan kararlar). null = bilinçli "base yok".
const EXACT = new Map<string, CatalogBase | null>([
  // umzug
  ["umzug", "umzug"],
  ["umzug_privat", "umzug"],
  ["umzug_firma", "umzug"],
  ["umzug_buero", "umzug"],
  ["umzug_international", "umzug"],
  ["privatumzug", "umzug"],
  ["firmenumzug", "umzug"],
  ["moebellift", "umzug"], // D3
  // reinigung
  ["reinigung", "reinigung"],
  ["endreinigung", "reinigung"],
  ["grundreinigung", "reinigung"],
  ["umzugsreinigung", "reinigung"],
  ["reinigung_umzug", "reinigung"],
  ["reinigung_bau", "reinigung"],
  ["reinigung_buero", "reinigung"],
  ["reinigung_end", "reinigung"],
  ["reinigung_grund", "reinigung"],
  ["reinigung_fenster", "reinigung"],
  ["fensterreinigung", "reinigung"],
  // raeumung (≠ entsorgung)
  ["raeumung", "raeumung"],
  ["raeumung_wohnung", "raeumung"],
  ["raeumung_keller", "raeumung"],
  ["raeumung_haus", "raeumung"],
  ["entrümpelung", "raeumung"], // D6 (ü)
  ["entruempelung", "raeumung"], // D6 (ue)
  // entsorgung
  ["entsorgung", "entsorgung"],
  ["entsorgung_moebel", "entsorgung"],
  ["entsorgung_sperrgut", "entsorgung"],
  // transport (D1 + D2)
  ["transport", "transport"],
  ["moebel_transport", "transport"], // D1
  ["transport_moebel", "transport"], // D1 (Mapper B'nin →umzug'u DEĞİL)
  ["usm_transport", "transport"],
  ["wasserbett_transport", "transport"],
  ["klaviertransport", "transport"], // D2
  ["transport_klavier", "transport"], // D2
  // lagerung
  ["lagerung", "lagerung"],
  // D4 — bilinçli null (katalogda base yok)
  ["malerarbeit", null],
  ["renovation", null],
]);

// Prefix kuralları (exact'ten sonra). moebellift_ önce — umzug_ ile çakışmaz ama niyet net.
const PREFIX: [string, CatalogBase][] = [
  ["moebellift_", "umzug"], // D3
  ["umzug_", "umzug"],
  ["reinigung_", "reinigung"],
  ["raeumung_", "raeumung"],
  ["entsorgung_", "entsorgung"],
  ["transport_", "transport"], // D1: transport_* → transport
  ["lagerung_", "lagerung"], // D5
];

/**
 * Bir lead/servis tipini 6 kanonik base'den birine indirger; katalogda karşılığı yoksa null.
 * exact → prefix → content → null sırası (referans §3).
 * DEFENSIVE: null/boş → null; trim + lowercase ile normalize.
 */
export const normalizeToCatalogBase = (t: string | null): CatalogBase | null => {
  if (!t) return null;
  const v = t.trim().toLowerCase();
  if (!v) return null;

  // 1) exact (null değer = bilinçli "base yok")
  if (EXACT.has(v)) return EXACT.get(v) ?? null;

  // 2) bilinçli null prefix'leri (D4) — content kuralından önce
  if (v.startsWith("malerarbeit") || v.startsWith("renovation")) return null;

  // 3) prefix
  for (const [p, base] of PREFIX) {
    if (v.startsWith(p)) return base;
  }

  // 4) content (D2: klavier herhangi bir yerde → transport)
  if (v.includes("klavier")) return "transport";

  // 5) tanınmayan → null (Allgemein grubuna düşer)
  return null;
};

// ---------------------------------------------------------------------------
// Grouping — render tüketicileri (PDF, firma detay, public OfferView) için TEK kaynak.
// ---------------------------------------------------------------------------

// Gruplar arası sıralama. Bu listede olmayan bilinen base'ler sonra, null (Allgemein) en sonda.
export const SERVICE_ORDER: CatalogBase[] = [
  "umzug",
  "reinigung",
  "raeumung",
  "entsorgung",
  "transport",
  "lagerung",
];

// Base → UI başlığı. SERVICE_ORDER dışı/tanınmayan base'ler raw (capitalize) görünür (Lesson #2).
export const LABEL_MAP: Record<string, string> = {
  umzug: "Umzug",
  reinigung: "Reinigung",
  raeumung: "Räumung",
  entsorgung: "Entsorgung",
  transport: "Transport",
  lagerung: "Lagerung",
};

// Per-item servis dropdown'ı için seçenekler (create + edit aynı kaynaktan — divergence önle).
// 'allgemein' = null sentinel (Radix Select string ister; yazarken null'a çevrilir).
export const SERVICE_OPTIONS: { value: string; label: string }[] = [
  ...SERVICE_ORDER.map((base) => ({ value: base as string, label: LABEL_MAP[base] })),
  { value: "allgemein", label: "Allgemein" },
];

export interface ServiceGroup<T> {
  serviceType: string | null; // stored key (trim+lowercase); null/boş → null (Allgemein)
  label: string;
  items: T[];
}

const capitalize = (s: string): string => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

const labelFor = (key: string | null): string => {
  if (key === null) return "Allgemein";
  return LABEL_MAP[key] ?? capitalize(key);
};

/**
 * Kalemleri stored service_type'a göre gruplar (referans §7).
 *
 * ⚠️ Lesson #2: normalizeToCatalogBase'i ÇAĞIRMAZ — sadece trim().toLowerCase() ile bucket'lar.
 * Normalize = stamping'in işi (Faz 2). Raw variant görünürse (ör. 'reinigung_end' ayrı grup)
 * bu bir STAMPING bug sinyalidir; grouper GİZLEMEZ.
 */
export function groupItemsByService<
  T extends { service_type?: string | null; position?: number },
>(items: T[]): ServiceGroup<T>[] {
  // 1) bucket — sadece trim+lowercase; ilk-görülme sırasını koru
  const buckets = new Map<string | null, T[]>();
  const firstSeen: (string | null)[] = [];
  for (const item of items) {
    const raw = (item.service_type ?? "").trim().toLowerCase();
    const key = raw === "" ? null : raw;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      firstSeen.push(key);
    }
    buckets.get(key)!.push(item);
  }

  // 3) gruplar arası sıra: SERVICE_ORDER → diğer bilinen (ilk-görülme) → null en son
  const rank = (key: string | null): number => {
    if (key === null) return Number.MAX_SAFE_INTEGER;
    const idx = SERVICE_ORDER.indexOf(key as CatalogBase);
    return idx === -1 ? SERVICE_ORDER.length + firstSeen.indexOf(key) : idx;
  };
  const sortedKeys = [...firstSeen].sort((a, b) => rank(a) - rank(b));

  // 2) grup içi: position'a göre (stable; position yoksa giriş sırası korunur)
  return sortedKeys.map((key) => {
    const groupItems = [...buckets.get(key)!].sort(
      (x, y) => (x.position ?? 0) - (y.position ?? 0),
    );
    return { serviceType: key, label: labelFor(key), items: groupItems };
  });
}
