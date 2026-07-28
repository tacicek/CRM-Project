import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useI18n, useT } from "@/i18n/useI18n";
import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/i18n/translator";

type Aufgabe = Database["public"]["Tables"]["crm_tasks"]["Row"];
type Filter = "open" | "overdue" | "done" | "all";

const FILTER: { wert: Filter; labelKey: MessageKey }[] = [
  { wert: "open", labelKey: "task.filter.open" },
  { wert: "overdue", labelKey: "task.filter.overdue" },
  { wert: "done", labelKey: "task.filter.done" },
  { wert: "all", labelKey: "task.filter.all" },
];

const TYP_LABEL: Record<string, MessageKey> = {
  follow_up: "task.type.follow_up",
  call: "task.type.call",
  offer: "task.type.offer",
  inspection: "task.type.inspection",
  admin: "task.type.admin",
  lost_reason: "task.type.lost_reason",
  cross_sell: "task.type.cross_sell",
};

const PRIO_STIL: Record<string, string> = {
  high: "bg-folk-coral-bg text-folk-coral",
  normal: "bg-folk-bg-warm text-folk-ink3",
  low: "bg-folk-bg-warm text-folk-ink4",
};

/**
 * Die Wiedervorlage: was als nächstes zu tun ist.
 *
 * Der grösste Teil entsteht nicht hier, sondern in `run_pipeline_automations()`
 * — eine Offerte, die fünf Tage ohne Antwort bleibt, erzeugt ihre Aufgabe
 * selbst. Diese Seite zeigt sie und lässt sie abhaken.
 */
export default function FirmaAufgaben() {
  const navigate = useNavigate();
  const t = useT();
  const { dateLocale } = useI18n();
  const { companyId } = useCachedCompany();
  const { toast } = useToast();

  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    let q = supabase
      .from("crm_tasks")
      .select("*")
      .eq("company_id", companyId)
      .order("due_at", { ascending: true, nullsFirst: false });

    if (filter === "open") q = q.eq("status", "open");
    if (filter === "done") q = q.eq("status", "done");
    if (filter === "overdue") q = q.eq("status", "open").lt("due_at", new Date().toISOString());

    const { data, error } = await q;
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setAufgaben(data ?? []);
    setLoading(false);
  }, [companyId, filter, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const offen = useMemo(() => aufgaben.filter((a) => a.status === "open").length, [aufgaben]);

  const umschalten = async (a: Aufgabe) => {
    const erledigt = a.status !== "done";
    const { error } = await supabase
      .from("crm_tasks")
      .update({
        status: erledigt ? "done" : "open",
        // done_at ist Pflicht, sobald der Status `done` ist (CHECK) — beim
        // Wiederöffnen muss er wieder weg.
        done_at: erledigt ? new Date().toISOString() : null,
      })
      .eq("id", a.id);

    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    if (erledigt) toast({ title: t("task.doneToast") });
    laden();
  };

  const frist = (a: Aufgabe) => {
    if (!a.due_at) return t("task.noDue");
    const d = new Date(a.due_at);
    const relativ = formatDistanceToNow(d, { addSuffix: true, locale: dateLocale });
    return d < new Date() && a.status === "open" ? `${t("task.overdue")} · ${relativ}` : relativ;
  };

  return (
    <>
      <Helmet>
        <title>{t("task.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">🔔</span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("task.title")}
            </h1>
            <span className="text-[15px] text-folk-ink3">{t("task.count", { count: offen })}</span>
          </div>
        </header>

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTER.map((f) => (
              <button
                key={f.wert}
                type="button"
                onClick={() => setFilter(f.wert)}
                className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                  filter === f.wert
                    ? "border-folk-ink bg-folk-ink text-folk-bg"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
            </div>
          ) : aufgaben.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">
                🔔
              </div>
              <p className="font-semibold text-folk-ink">{t("task.empty")}</p>
              <p className="mt-1 text-[14px] text-folk-ink3">{t("task.emptyHint")}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {aufgaben.map((a) => {
                const ueberfaellig =
                  a.status === "open" && a.due_at !== null && new Date(a.due_at) < new Date();
                return (
                  <article
                    key={a.id}
                    className="flex items-start gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5"
                  >
                    <button
                      type="button"
                      aria-label={a.status === "done" ? t("task.markOpen") : t("task.markDone")}
                      onClick={() => umschalten(a)}
                      className="mt-0.5 shrink-0 text-folk-ink4 transition-colors hover:text-folk-mint"
                    >
                      {a.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-folk-mint" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[15px] font-semibold tracking-tight ${
                            a.status === "done"
                              ? "text-folk-ink4 line-through"
                              : "text-folk-ink"
                          }`}
                        >
                          {a.title}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            PRIO_STIL[a.priority] ?? PRIO_STIL.normal
                          }`}
                        >
                          {t(TYP_LABEL[a.task_type] ?? "task.type.follow_up")}
                        </span>
                      </div>
                      {a.description && (
                        <p className="mt-0.5 text-[13px] text-folk-ink3">{a.description}</p>
                      )}
                      <p
                        className={`mt-0.5 text-[12.5px] ${
                          ueberfaellig ? "font-medium text-folk-coral" : "text-folk-ink4"
                        }`}
                      >
                        {frist(a)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      {a.lead_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[13px]"
                          onClick={() => navigate(`/firma/anfragen?lead=${a.lead_id}`)}
                        >
                          {t("task.open.lead")}
                        </Button>
                      )}
                      {a.offer_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[13px]"
                          onClick={() => navigate(`/firma/offerten/${a.offer_id}`)}
                        >
                          {t("task.open.offer")}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
