import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/components/pdf/utils/formatters";
import { computeSurchargeAmount, type OfferSurcharge, type SurchargeType } from "@/lib/offerSurcharges";

interface SurchargeEditorProps {
  surcharges: OfferSurcharge[];
  onChange: (surcharges: OfferSurcharge[]) => void;
  /** Items subtotal — percent surcharges are calculated on top of this. */
  itemsSubtotal: number;
  /** Job distance (for per_km). */
  distanceKm: number | null | undefined;
}

const TYPE_LABELS: Record<SurchargeType, string> = {
  percent: "Prozent (%)",
  fixed: "Fix (CHF)",
  per_km: "Pro km (CHF)",
};

const PRESETS: ReadonlyArray<{ label: string; type: SurchargeType; value: number }> = [
  { label: "Wochenende", type: "percent", value: 15 },
  { label: "Feiertag", type: "percent", value: 25 },
  { label: "Nachtzuschlag", type: "percent", value: 20 },
  { label: "Anfahrt", type: "fixed", value: 120 },
];

export function SurchargeEditor({ surcharges, onChange, itemsSubtotal, distanceKm }: SurchargeEditorProps) {
  const update = (index: number, patch: Partial<OfferSurcharge>) =>
    onChange(surcharges.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const remove = (index: number) => onChange(surcharges.filter((_, i) => i !== index));

  const add = (preset?: { label: string; type: SurchargeType; value: number }) =>
    onChange([
      ...surcharges,
      preset
        ? { ...preset, amount: 0 }
        : { label: "", type: "percent", value: 0, amount: 0 },
    ]);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Zuschläge</h4>

      {surcharges.length === 0 && (
        <p className="text-xs text-slate-400">Keine Zuschläge.</p>
      )}

      {surcharges.map((s, index) => {
        const amount = computeSurchargeAmount(s, itemsSubtotal, distanceKm);
        return (
          <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              value={s.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder="Bezeichnung"
              className="h-8 flex-1 min-w-[120px] text-sm"
            />
            <Select value={s.type} onValueChange={(v) => update(index, { type: v as SurchargeType })}>
              <SelectTrigger className="h-8 w-[130px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as SurchargeType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={s.value || ""}
              onChange={(e) => update(index, { value: parseFloat(e.target.value) || 0 })}
              placeholder="Wert"
              className="h-8 w-20 text-sm text-right"
            />
            <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
              {formatCurrency(amount)}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 text-slate-400 transition-colors hover:text-red-500"
              aria-label="Zuschlag entfernen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => add(p)}
          >
            + {p.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => add()}
        >
          <Plus className="h-3.5 w-3.5" /> Eigener
        </Button>
      </div>
    </div>
  );
}
