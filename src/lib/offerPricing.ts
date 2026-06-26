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

// Blind teklif uyarısı — PDF (BlindOfferteDisclaimer) + OfferView (DOM) aynı metni kullanır.
export const BLIND_DISCLAIMER_LABEL = "Wichtiger Hinweis";
export const BLIND_DISCLAIMER_TEXT =
  "Diese Offerte wurde ohne persönliche Besichtigung erstellt und basiert ausschliesslich auf den " +
  "Angaben des Kunden. Die aufgeführten Preise sind Schätzungen. Allfällige Anpassungen werden vor " +
  "Auftragserteilung in Absprache mit dem Kunden vorgenommen.";
