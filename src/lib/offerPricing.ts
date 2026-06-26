// Offer fiyat-modeli için paylaşılan saf yardımcılar.
// Tek kaynak: PDF (ServiceTable) + public OfferView aynı mantığı buradan alır — inline kopya yok.
//
// NOT: mapOfferData (maxHours guard) ve OfferteItemRow (min&&max guard) hâlâ kendi inline
// guard'larını kullanıyor; guard birleştirmesi = 3b kapsamı (CLAUDE.md kök-neden: yama değil,
// ayrı ve bilinçli bir adımda birleştirilecek).

export interface TimeEstimate {
  minHours: number;
  maxHours: number;
  hourlyRate: number;
}

/**
 * Blind/stundenbasiert kalemin fiyat aralığını döndürür.
 *
 * Guard ServiceTable (ItemRow) ile BİREBİR: `te` yoksa veya
 * `!(minHours > 0 && hourlyRate > 0)` ise null (PDF davranışı korunur).
 *
 * DEFENSIVE: DB jsonb beklenmedik şekil taşıyabilir ve çağıran taraf `as Offer`/`as OfferItem`
 * cast'i kullanıyor (TS uyarmaz). Bu yüzden TİPE değil DEĞERE güveniyoruz — alanlar gerçek
 * number değilse null döner, patlamaz.
 */
export const hourlyRange = (
  te: TimeEstimate | null | undefined,
): { min: number; max: number } | null => {
  if (
    !te ||
    typeof te.minHours !== "number" ||
    typeof te.maxHours !== "number" ||
    typeof te.hourlyRate !== "number"
  ) {
    return null;
  }
  if (!(te.minHours > 0 && te.hourlyRate > 0)) return null;
  return {
    min: te.minHours * te.hourlyRate,
    max: te.maxHours * te.hourlyRate,
  };
};

// ---------------------------------------------------------------------------
// Offer subtotal — TEK KAYNAK (create + edit aynı formülü buradan alır).
//
// Lesson #8 (referans): subtotal/VAT birden fazla yerde hesaplanırsa diverge eder.
// Önceki durum: create price_type'a göre (optional+inkl hariç), edit unit==="inkl."
// string'ine göre (optional'ı kaçırıyordu) → edit+save sonrası DB total kayıyordu.
// Çözüm: tek pure fn; hariç-tutma SEMANTİK price_type ile, unit string'iyle değil.
// ---------------------------------------------------------------------------

export interface SubtotalItem {
  priceType: string; // 'pauschale' | 'per_unit' | 'per_hour' | 'optional' | 'inkl'
  quantity: number;
  unitPrice: number;
  timeEstimate: TimeEstimate | null;
}

// subtotal'a girmeyen kalem tipleri (gösterilir ama toplanmaz): optional, inkl.
const EXCLUDED_FROM_SUBTOTAL = new Set(["optional", "inkl"]);

/**
 * Kalem listesinin subtotal'ını hesaplar (saf — parse etmez, number bekler).
 * - priceType ∈ {optional, inkl} → atlanır.
 * - timeEstimate geçerliyse (hourlyRange) → mode 'min' alt, 'max' üst sınır.
 * - aksi halde quantity * unitPrice.
 */
export const computeItemsSubtotal = (
  items: SubtotalItem[],
  mode: "min" | "max" = "min",
): number =>
  items.reduce((sum, item) => {
    if (EXCLUDED_FROM_SUBTOTAL.has(item.priceType)) return sum;
    const r = hourlyRange(item.timeEstimate);
    if (r) return sum + (mode === "min" ? r.min : r.max);
    return sum + item.quantity * item.unitPrice;
  }, 0);

/**
 * itemsSubtotal + (sabit) surcharge toplamı → taxableBase → VAT → total.
 * Blind aralığın ÜST sınırı için PDF (mapOfferData) ve OfferView aynı zinciri kullanır.
 * surchargesSum SABİT (kayıtlı tutarlar) — percent yeniden hesaplanmaz (offers.surcharges
 * zaten hesaplanmış amount taşır). min taraf DB'nin GENERATED değerlerinden gelir; bu fn
 * yalnız üst-sınır (max) için. vatRate 0 → vatAmount 0.
 */
export const computeTotalsFromSubtotal = (
  itemsSubtotal: number,
  surchargesSum: number,
  vatRate: number,
): { taxableBase: number; vatAmount: number; total: number } => {
  const taxableBase = itemsSubtotal + surchargesSum;
  const vatAmount = (taxableBase * (vatRate > 0 ? vatRate : 0)) / 100;
  return { taxableBase, vatAmount, total: taxableBase + vatAmount };
};

// Blind teklif uyarısı — PDF (BlindOfferteDisclaimer) + OfferView (DOM) aynı metni kullanır.
export const BLIND_DISCLAIMER_LABEL = "Wichtiger Hinweis";
export const BLIND_DISCLAIMER_TEXT =
  "Diese Offerte wurde ohne persönliche Besichtigung erstellt und basiert ausschliesslich auf den " +
  "Angaben des Kunden. Die aufgeführten Preise sind Schätzungen. Allfällige Anpassungen werden vor " +
  "Auftragserteilung in Absprache mit dem Kunden vorgenommen.";
