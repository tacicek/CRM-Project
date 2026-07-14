import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/components/pdf/utils/formatters";
import { computeSurchargeAmount, type OfferSurcharge, type SurchargeType } from "@/lib/offerSurcharges";
import { useI18n, useT } from "@/i18n/useI18n";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";

interface SurchargeEditorProps {
  surcharges: OfferSurcharge[];
  onChange: (surcharges: OfferSurcharge[]) => void;
  /** Items subtotal — percent surcharges are calculated on top of this. */
  itemsSubtotal: number;
  /** Job distance (for per_km). */
  distanceKm: number | null | undefined;
  /**
   * DOCUMENT locale of the offer (offers.language). A surcharge `label` is stored on the
   * offer and PRINTED ON THE CUSTOMER'S PDF, so the preset labels must be written in the
   * customer's language — not in the operator's dashboard language.
   */
  documentLocale: Locale;
}

const TYPE_LABEL_KEYS: Record<SurchargeType, MessageKey> = {
  percent: "offer.form.surcharge.type.percent",
  fixed: "offer.form.surcharge.type.fixed",
  per_km: "offer.form.surcharge.type.per_km",
};

/** `labelKey` is resolved in the CUSTOMER's language (see documentLocale above). */
const PRESETS: ReadonlyArray<{ labelKey: MessageKey; type: SurchargeType; value: number }> = [
  { labelKey: "offer.form.surcharge.preset.weekend", type: "percent", value: 15 },
  { labelKey: "offer.form.surcharge.preset.holiday", type: "percent", value: 25 },
  { labelKey: "offer.form.surcharge.preset.night", type: "percent", value: 20 },
  { labelKey: "offer.form.surcharge.preset.travel", type: "fixed", value: 120 },
];

export function SurchargeEditor({
  surcharges,
  onChange,
  itemsSubtotal,
  distanceKm,
  documentLocale,
}: SurchargeEditorProps) {
  // Operator chrome.
  const t = useT();
  const { locale } = useI18n();
  // Text that ends up INSIDE the offer → customer's language.
  const documentT = documentI18nFor(documentLocale).t;

  const update = (index: number, patch: Partial<OfferSurcharge>) =>
    onChange(surcharges.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const remove = (index: number) => onChange(surcharges.filter((_, i) => i !== index));

  const add = (preset?: { labelKey: MessageKey; type: SurchargeType; value: number }) =>
    onChange([
      ...surcharges,
      preset
        ? { label: documentT(preset.labelKey), type: preset.type, value: preset.value, amount: 0 }
        : { label: "", type: "percent", value: 0, amount: 0 },
    ]);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {t("offer.form.surcharge.title")}
      </h4>

      {surcharges.length === 0 && (
        <p className="text-xs text-slate-400">{t("offer.form.surcharge.empty")}</p>
      )}

      {surcharges.map((s, index) => {
        const amount = computeSurchargeAmount(s, itemsSubtotal, distanceKm);
        return (
          <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              value={s.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder={t("offer.form.surcharge.labelPlaceholder")}
              className="h-8 flex-1 min-w-[120px] text-sm"
            />
            <Select value={s.type} onValueChange={(v) => update(index, { type: v as SurchargeType })}>
              <SelectTrigger className="h-8 w-[130px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL_KEYS) as SurchargeType[]).map((type) => (
                  <SelectItem key={type} value={type}>{t(TYPE_LABEL_KEYS[type])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={s.value || ""}
              onChange={(e) => update(index, { value: parseFloat(e.target.value) || 0 })}
              placeholder={t("offer.form.surcharge.valuePlaceholder")}
              className="h-8 w-20 text-sm text-right"
            />
            <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
              {formatCurrency(amount, locale)}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 text-slate-400 transition-colors hover:text-red-500"
              aria-label={t("offer.form.surcharge.remove")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map((p) => (
          <Button
            key={p.labelKey}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => add(p)}
          >
            + {t(p.labelKey)}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => add()}
        >
          <Plus className="h-3.5 w-3.5" /> {t("offer.form.surcharge.custom")}
        </Button>
      </div>
    </div>
  );
}
