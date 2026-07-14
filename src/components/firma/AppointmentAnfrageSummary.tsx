import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ArrowRight, Package } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import type { Translator } from "@/i18n/translator";
import { getServiceLabel } from "@/i18n/domain";

/**
 * Live, structured Anfrage summary for a calendar appointment (K-Anfrage-link, 2026-07).
 *
 * When an appointment carries a lead_id, this reads the Anfrage's structured fields
 * (addresses, floor/lift/rooms, Estrich/Keller, service type, description) and renders
 * them read-only. Single source: the Anfrage — so the firm no longer copies everything
 * into free-text `internal_notes` by hand (which drifts out of sync and can't be searched).
 *
 * No lead_id → renders nothing (manual/external appointments keep their own fields).
 *
 * This is dashboard chrome: it is rendered for the OPERATOR, so it follows the dashboard
 * locale. The lead's own `language` column (the customer's language) is not read here.
 */
interface LeadRow {
  service_type: string | null;
  description: string | null;
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_has_estrich: boolean | null;
  from_has_keller: boolean | null;
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  to_rooms: number | null;
}

const LEAD_FIELDS =
  "service_type, description, from_street, from_house_number, from_plz, from_city, from_floor, from_has_lift, from_rooms, from_has_estrich, from_has_keller, to_street, to_house_number, to_plz, to_city, to_floor, to_has_lift, to_rooms";

const line = (street?: string | null, nr?: string | null, plz?: string | null, city?: string | null) =>
  [[street, nr].filter(Boolean).join(" "), [plz, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

/**
 * Locale-aware counterpart of `formatFloorLabel` (src/lib/floorUtils.ts), which returns
 * German-only labels ("Erdgeschoss", "1. OG") and is shared with callers outside this
 * feature. 0 must NEVER render as "0. OG"; negatives are the basement.
 */
const floorLabel = (floor: number | null | undefined, t: Translator): string | null => {
  if (floor === null || floor === undefined || Number.isNaN(floor)) return null;
  if (floor < 0) return t("lead.floor.basement");
  if (floor === 0) return t("lead.floor.ground");
  return t("lead.floor.upper", { floor });
};

const meta = (
  t: Translator,
  floor: number | null,
  hasLift: boolean | null,
  rooms: number | null,
  estrich?: boolean | null,
  keller?: boolean | null,
) => {
  const parts: string[] = [];
  const f = floorLabel(floor, t);
  if (f) parts.push(f);
  if (hasLift === true) parts.push(t("lead.summary.lift"));
  else if (hasLift === false) parts.push(t("lead.summary.noLift"));
  if (typeof rooms === "number") parts.push(t("lead.summary.rooms", { count: rooms }));
  if (estrich === true) parts.push(t("lead.summary.estrich"));
  if (keller === true) parts.push(t("lead.summary.keller"));
  return parts.join(" · ");
};

export const AppointmentAnfrageSummary = ({ leadId }: { leadId: string | null }) => {
  const { t, locale } = useI18n();
  const [lead, setLead] = useState<LeadRow | null>(null);

  useEffect(() => {
    let active = true;
    if (!leadId) {
      setLead(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("leads").select(LEAD_FIELDS).eq("id", leadId).maybeSingle();
      if (active) setLead((data as LeadRow | null) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [leadId]);

  if (!leadId || !lead) return null;

  const from = line(lead.from_street, lead.from_house_number, lead.from_plz, lead.from_city);
  const to = line(lead.to_street, lead.to_house_number, lead.to_plz, lead.to_city);
  const fromMeta = meta(t, lead.from_floor, lead.from_has_lift, lead.from_rooms, lead.from_has_estrich, lead.from_has_keller);
  const toMeta = meta(t, lead.to_floor, lead.to_has_lift, lead.to_rooms);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("lead.summary.title")}
          {lead.service_type ? ` · ${getServiceLabel(lead.service_type, locale)}` : ""}
        </p>
      </div>

      {(from || to) && (
        <div className="space-y-2">
          {from && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("lead.summary.moveOut")}</p>
                <p className="text-sm text-slate-700">{from}</p>
                {fromMeta && <p className="text-xs text-slate-500">{fromMeta}</p>}
              </div>
            </div>
          )}
          {to && (
            <div className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("lead.summary.moveIn")}</p>
                <p className="text-sm text-slate-700">{to}</p>
                {toMeta && <p className="text-xs text-slate-500">{toMeta}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {lead.description && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("common.description")}</p>
          <p className="whitespace-pre-line text-sm text-slate-600">{lead.description}</p>
        </div>
      )}
    </div>
  );
};
