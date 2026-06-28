import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OfferItem } from "@/components/offerte/OfferteItemRow";

interface ItemChipProps {
  item: OfferItem;
  onRemove: () => void;
  onPromote: () => void;
}

/**
 * Ücretsiz kalem (priceType ∈ {inkl, optional} → isFreeItem) için kompakt çip görünümü.
 * Fiyat göstermez (ücretsiz). Grup başlığı servisi, section başlığı "Inklusive / auf Anfrage"
 * bağlamını verir — çip yalnız ✓ + ad + aksiyonları taşır.
 *
 * Bağlama (gerçek index, updateItem) parent'ta (create render) yapılır — bu component izole.
 */
export const ItemChip = ({ item, onRemove, onPromote }: ItemChipProps) => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30",
      "py-1 pl-2 pr-1 text-sm max-w-full",
    )}
  >
    <Check className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    <span className="truncate font-medium">{item.description || "Ohne Bezeichnung"}</span>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onPromote}
      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
    >
      <Plus className="w-3 h-3 mr-0.5" />
      Preis
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onRemove}
      aria-label="Entfernen"
      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
    >
      <X className="w-3.5 h-3.5" />
    </Button>
  </div>
);
