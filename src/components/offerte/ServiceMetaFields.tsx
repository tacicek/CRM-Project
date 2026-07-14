import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/useI18n";
import type { GroupMetaDraft, ServiceMetaKind } from "@/lib/offerItemMeta";

/**
 * Compact per-group service-meta inputs shown in the Offerte form group header.
 *
 * The set of fields is chosen by `kind` (effort/area/volume — see metaKindForService),
 * and each field maps 1:1 to what the PDF (ServiceTable) renders for that service. The
 * component is presentational: it emits a partial-draft patch upward; the page owns the
 * group-keyed state and the save wiring.
 */
interface ServiceMetaFieldsProps {
  kind: ServiceMetaKind;
  draft: GroupMetaDraft;
  onChange: (patch: Partial<GroupMetaDraft>) => void;
  idPrefix: string;
}

const fieldCls = "h-7 text-xs";
const labelCls = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

export const ServiceMetaFields = ({ kind, draft, onChange, idPrefix }: ServiceMetaFieldsProps) => {
  // Operator chrome — labels/placeholders only. The values typed here are free text and are
  // carried into the PDF unchanged.
  const t = useT();

  if (kind === "effort") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-crew`} className={labelCls}>{t("offer.form.meta.crew")}</Label>
          <Input
            id={`${idPrefix}-crew`}
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.crew}
            onChange={(e) => onChange({ crew: e.target.value })}
            className={cn(fieldCls, "w-20")}
            placeholder={t("offer.form.meta.crewPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-vehicles`} className={labelCls}>{t("offer.form.meta.vehicles")}</Label>
          <Input
            id={`${idPrefix}-vehicles`}
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.vehicles}
            onChange={(e) => onChange({ vehicles: e.target.value })}
            className={cn(fieldCls, "w-20")}
            placeholder={t("offer.form.meta.vehiclesPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-vtype`} className={labelCls}>{t("offer.form.meta.vehicleType")}</Label>
          <Input
            id={`${idPrefix}-vtype`}
            value={draft.vehicleType}
            onChange={(e) => onChange({ vehicleType: e.target.value })}
            className={cn(fieldCls, "w-28")}
            placeholder={t("offer.form.meta.vehicleTypePlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-hrate`} className={labelCls}>{t("offer.form.meta.hourlyRate")}</Label>
          <Input
            id={`${idPrefix}-hrate`}
            type="number"
            min={0}
            inputMode="decimal"
            value={draft.hourlyRate}
            onChange={(e) => onChange({ hourlyRate: e.target.value })}
            className={cn(fieldCls, "w-24")}
            placeholder={t("offer.form.meta.hourlyRatePlaceholder")}
          />
        </div>
      </div>
    );
  }

  if (kind === "area") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-obj`} className={labelCls}>{t("offer.form.meta.objectType")}</Label>
          <Input
            id={`${idPrefix}-obj`}
            value={draft.objectType}
            onChange={(e) => onChange({ objectType: e.target.value })}
            className={cn(fieldCls, "w-32")}
            placeholder={t("offer.form.meta.objectTypePlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-area`} className={labelCls}>{t("offer.form.meta.areaM2")}</Label>
          <Input
            id={`${idPrefix}-area`}
            type="number"
            min={0}
            inputMode="decimal"
            value={draft.areaM2}
            onChange={(e) => onChange({ areaM2: e.target.value })}
            className={cn(fieldCls, "w-24")}
            placeholder={t("offer.form.meta.areaM2Placeholder")}
          />
        </div>
        <div className="flex items-center gap-1.5 pb-1">
          <Switch
            id={`${idPrefix}-abn`}
            checked={draft.abnahmegarantie}
            onCheckedChange={(v) => onChange({ abnahmegarantie: v })}
          />
          <Label htmlFor={`${idPrefix}-abn`} className="text-xs font-normal">{t("offer.form.meta.abnahmegarantie")}</Label>
        </div>
      </div>
    );
  }

  // volume
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-vol`} className={labelCls}>{t("offer.form.meta.volumeM3")}</Label>
        <Input
          id={`${idPrefix}-vol`}
          type="number"
          min={0}
          inputMode="decimal"
          value={draft.volumeM3}
          onChange={(e) => onChange({ volumeM3: e.target.value })}
          className={cn(fieldCls, "w-24")}
          placeholder={t("offer.form.meta.volumeM3Placeholder")}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-rate`} className={labelCls}>{t("offer.form.meta.rate")}</Label>
        <Input
          id={`${idPrefix}-rate`}
          type="number"
          min={0}
          inputMode="decimal"
          value={draft.rate}
          onChange={(e) => onChange({ rate: e.target.value })}
          className={cn(fieldCls, "w-24")}
          placeholder={t("offer.form.meta.ratePlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label className={labelCls}>{t("common.unit")}</Label>
        <div className="flex h-7 items-center rounded-md border">
          <button
            type="button"
            onClick={() => onChange({ rateUnit: "once" })}
            className={cn(
              "h-full rounded-l-md px-2 text-xs",
              draft.rateUnit === "once" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t("domain.unit.perM3")}
          </button>
          <button
            type="button"
            onClick={() => onChange({ rateUnit: "monthly" })}
            className={cn(
              "h-full rounded-r-md px-2 text-xs",
              draft.rateUnit === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t("domain.unit.perMonth")}
          </button>
        </div>
      </div>
    </div>
  );
};
