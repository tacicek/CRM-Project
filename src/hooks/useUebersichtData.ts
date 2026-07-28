import { useCallback, useEffect, useState } from "react";
import { subDays, startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { assembleWorkItems, type AuftragRow, type LeadRow, type OfferRow } from "@/lib/uebersichtAssemble";
import { deltaPercent, groupPaymentsByWeek } from "@/lib/uebersichtKpi";
import type { ActivityEvent, Kpi, RevenueWeek, WorkItem } from "@/types/uebersicht";

/** Wieviele Wochen das Umsatzdiagramm zeigt. */
const REVENUE_WEEKS = 5;

/** Zahlungen für Diagramm und Vergleichszeitraum — 5 Wochen plus 30 Tage Vorlauf. */
const PAYMENT_WINDOW_DAYS = 65;

type PaymentRow = { payment_date: string; amount: number };

type FinanceOverview = { kassiert_30t?: number };

export type UebersichtData = {
  workItems: WorkItem[];
  activity: ActivityEvent[];
  kpis: Kpi[];
  revenueWeeks: RevenueWeek[];
  isLoading: boolean;
  reload: () => void;
};

const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * Die Daten der Übersicht.
 *
 * Das Zusammensetzen liegt bewusst nicht hier, sondern in den reinen
 * Funktionen unter `@/lib/uebersicht*` — dieser Hook holt nur und reicht
 * weiter. So bleibt die Regel prüfbar, ohne eine Datenbank zu brauchen.
 *
 * **Umsatz kommt aus `finance_overview`.** Die angezeigte Zahl ist
 * `kassiert_30t`, die einzige Umsatzquelle des Systems. Die Zahlungszeilen
 * werden zusätzlich geladen, aber nur für das Wochendiagramm und den
 * Vergleich mit den 30 Tagen davor — nicht, um die Kennzahl neu zu berechnen.
 */
export const useUebersichtData = (): UebersichtData => {
  const { companyId } = useCompanyContext();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [revenueWeeks, setRevenueWeeks] = useState<RevenueWeek[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      // Die Zeit des Abrufs entsteht hier, nicht draussen: ein von aussen
      // gereichtes Date-Objekt waere bei jedem Render neu und wuerde als
      // Abhaengigkeit eine Endlosschleife ausloesen. Die reinen Funktionen
      // nehmen `now` weiterhin als Argument — dort ist es fuer die Tests noetig.
      const now = new Date();
      try {
        const monthStart = isoDay(startOfMonth(now));
        const monthEnd = isoDay(endOfMonth(now));
        const prevMonthStart = isoDay(startOfMonth(subDays(startOfMonth(now), 1)));
        const prevMonthEnd = isoDay(endOfMonth(subDays(startOfMonth(now), 1)));
        const windowStart = isoDay(subDays(now, PAYMENT_WINDOW_DAYS));

        const [leadsResult, offersResult, auftraegeResult, paymentsResult, financeResult, verlaufResult] =
          await Promise.all([
            supabase
              .from("leads")
              .select("id, service_type, from_city, to_city, created_at")
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              // 200 statt 60: aus diesen Zeilen entstehen nicht nur die
              // angezeigten Vorgaenge, sondern auch die Zaehler im Kopf und im
              // KPI-Streifen. Bei 60 blieben aeltere offene Anfragen
              // unberuecksichtigt und die Zahl waere still zu klein. Die Menge
              // ist unkritisch — fuenf Spalten, im Einzelmandanten dreistellig.
              .limit(200),
            supabase
              .from("offers")
              .select(
                "id, lead_id, status, sent_at, accepted_at, rejected_at, valid_until, superseded_at, version_number, total",
              )
              .eq("company_id", companyId)
              .not("lead_id", "is", null),
            supabase
              .from("auftraege")
              .select("lead_id, offer_id, scheduled_date")
              .eq("company_id", companyId)
              .is("deleted_at", null),
            supabase
              .from("payments")
              .select("payment_date, amount")
              .eq("company_id", companyId)
              .gte("payment_date", windowStart),
            supabase.rpc("finance_overview", { p_company_id: companyId }),
            supabase
              .from("sales_stage_history")
              .select("id, lead_id, from_stage, to_stage, source, changed_at")
              .eq("company_id", companyId)
              .order("changed_at", { ascending: false })
              .limit(8),
          ]);

        if (cancelled) return;

        const leads = (leadsResult.data ?? []) as LeadRow[];
        const offers = (offersResult.data ?? []) as OfferRow[];
        const auftraege = (auftraegeResult.data ?? []) as AuftragRow[];
        const payments = (paymentsResult.data ?? []) as PaymentRow[];
        const finance = (financeResult.data ?? {}) as FinanceOverview;

        type VerlaufRow = {
          id: string; lead_id: string; from_stage: string | null;
          to_stage: string; source: string; changed_at: string;
        };
        setActivity(((verlaufResult.data ?? []) as VerlaufRow[]).map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          fromStage: row.from_stage,
          toStage: row.to_stage,
          automatisch: row.source === "trigger",
          at: row.changed_at,
        })));

        const items = assembleWorkItems(leads, offers, auftraege, now);
        setWorkItems(items);
        setRevenueWeeks(groupPaymentsByWeek(payments, REVENUE_WEEKS, now));

        // --- Kennzahlen -------------------------------------------------------
        const inMonth = (iso: string, from: string, to: string) =>
          iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;

        const neueDiesenMonat = leads.filter(
          (lead) => inMonth(lead.created_at, monthStart, monthEnd),
        ).length;
        const neueVormonat = leads.filter((lead) =>
          inMonth(lead.created_at, prevMonthStart, prevMonthEnd),
        ).length;

        const offeneOfferten = items.filter(
          (item) => item.status === "offeriert" || item.status === "ueberfaellig",
        ).length;

        const auftraegeDiesenMonat = auftraege.filter(
          (auftrag) =>
            auftrag.scheduled_date !== null &&
            inMonth(auftrag.scheduled_date, monthStart, monthEnd),
        ).length;
        const auftraegeVormonat = auftraege.filter(
          (auftrag) =>
            auftrag.scheduled_date !== null &&
            inMonth(auftrag.scheduled_date, prevMonthStart, prevMonthEnd),
        ).length;

        const sinceDays = (days: number) => isoDay(subDays(now, days));
        const sumBetween = (from: string, to: string) =>
          payments
            .filter((payment) => payment.payment_date >= from && payment.payment_date < to)
            .reduce((total, payment) => total + payment.amount, 0);

        const umsatz30 = finance.kassiert_30t ?? 0;
        const umsatzDavor = sumBetween(sinceDays(60), sinceDays(30));

        setKpis([
          {
            key: "anfragen",
            value: items.filter((item) => item.status === "neu").length,
            format: "count",
            deltaPct: deltaPercent(neueDiesenMonat, neueVormonat),
            // Unbeantwortete Anfragen, die sich stapeln, sind keine gute Nachricht.
            risingIsGood: false,
          },
          {
            key: "offerten",
            value: offeneOfferten,
            format: "count",
            // Ein Bestand hat keine Veraenderungsrate ohne historische
            // Momentaufnahmen — die gibt es nicht. Lieber kein Pfeil als ein
            // erfundener.
            deltaPct: null,
            risingIsGood: true,
          },
          {
            key: "auftraege",
            value: auftraegeDiesenMonat,
            format: "count",
            deltaPct: deltaPercent(auftraegeDiesenMonat, auftraegeVormonat),
            risingIsGood: true,
          },
          {
            key: "umsatz",
            value: umsatz30,
            format: "chf",
            deltaPct: deltaPercent(umsatz30, umsatzDavor),
            risingIsGood: true,
          },
        ]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, tick]);

  return { workItems, activity, kpis, revenueWeeks, isLoading, reload };
};
