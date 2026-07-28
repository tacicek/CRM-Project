import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { KundeLink } from "@/components/firma/KundeLink";
import { useI18n, useT } from "@/i18n/useI18n";
import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/i18n/translator";

type Faden = Database["public"]["Tables"]["communication_threads"]["Row"];
type Nachricht = Database["public"]["Tables"]["communication_messages"]["Row"];
type Filter = "offen" | "unbeantwortet" | "erledigt" | "alle";

/**
 * Posteingang: ein- und ausgehende Kommunikation in einem Faden.
 *
 * Zeigt Vorschautexte, nie Volltexte — die Datenbank speichert bewusst keine
 * (20260801100000, in Fortsetzung der Entscheidung des Inbound-Ablaufs).
 * Was hier fehlt, fehlt mit Absicht; deshalb steht der Hinweis auch auf der
 * Seite und nicht nur im Migrationskopf.
 */
export default function FirmaPosteingang() {
  const t = useT();
  const { locale } = useI18n();
  const { companyId } = useCachedCompany();
  const { toast } = useToast();

  const [faeden, setFaeden] = useState<Faden[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [filter, setFilter] = useState<Filter>("offen");
  const [loading, setLoading] = useState(true);
  const [ladeFaden, setLadeFaden] = useState(false);

  const laden = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("communication_threads")
      .select("*")
      .eq("company_id", companyId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setFaeden(data ?? []);
    setLoading(false);
  }, [companyId, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const oeffnen = async (f: Faden) => {
    if (offen === f.id) {
      setOffen(null);
      return;
    }
    setOffen(f.id);
    setLadeFaden(true);
    const { data } = await supabase
      .from("communication_messages")
      .select("*")
      .eq("thread_id", f.id)
      .order("occurred_at", { ascending: true });
    setNachrichten(data ?? []);
    setLadeFaden(false);
  };

  const erledigen = async (f: Faden) => {
    const neu = f.status === "erledigt" ? "offen" : "erledigt";
    const { error } = await supabase
      .from("communication_threads")
      .update({ status: neu })
      .eq("id", f.id);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    laden();
  };

  const sichtbar = useMemo(() => {
    if (filter === "offen") return faeden.filter((f) => f.status !== "erledigt");
    if (filter === "unbeantwortet") return faeden.filter((f) => f.first_unanswered_at !== null);
    if (filter === "erledigt") return faeden.filter((f) => f.status === "erledigt");
    return faeden;
  }, [faeden, filter]);

  const anzahlOffen = useMemo(
    () => faeden.filter((f) => f.status !== "erledigt").length,
    [faeden],
  );

  const datum = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(iso),
        )
      : "—";

  const wartetTage = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0;

  return (
    <>
      <Helmet>
        <title>{t("inbox.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">📬</span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("inbox.title")}
            </h1>
            <span className="text-[15px] text-folk-ink3">
              {t("inbox.count", { count: anzahlOffen })} · {t("inbox.subtitle")}
            </span>
          </div>
        </header>

        <p className="rounded-lg border border-folk-line bg-folk-bg-warm px-3 py-2 text-[13px] text-folk-ink3">
          {t("inbox.hint")}
        </p>

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {(["offen", "unbeantwortet", "erledigt", "alle"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                  filter === f
                    ? "border-folk-ink bg-folk-ink text-white"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
              >
                {t(`inbox.filter.${f}` as MessageKey)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
            </div>
          ) : sichtbar.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-folk-ink">{t("inbox.empty")}</p>
              <p className="mt-1 text-[14px] text-folk-ink3">{t("inbox.emptyHint")}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {sichtbar.map((f) => (
                <article key={f.id} className="rounded-xl border border-folk-line bg-folk-card">
                  <div className="flex flex-wrap items-start gap-3 p-3.5">
                    <button
                      type="button"
                      onClick={() => oeffnen(f)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-semibold tracking-tight text-folk-ink">
                          {f.subject || "—"}
                        </span>
                        {f.last_direction === "inbound" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-folk-coral" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-folk-ink4" />
                        )}
                        {f.first_unanswered_at && (
                          <span className="rounded bg-folk-coral-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-coral">
                            {t("inbox.waiting", { days: wartetTage(f.first_unanswered_at) })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-folk-ink4">
                        <span>{datum(f.last_message_at)}</span>
                        <span>
                          {f.last_direction === "inbound"
                            ? t("inbox.lastInbound")
                            : t("inbox.lastOutbound")}
                        </span>
                        <KundeLink customerId={f.customer_id} />
                      </p>
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 text-[13px]"
                      onClick={() => erledigen(f)}
                    >
                      {f.status === "erledigt" ? t("inbox.reopen") : t("inbox.markDone")}
                    </Button>
                  </div>

                  {offen === f.id && (
                    <div className="border-t border-folk-line p-3.5">
                      {ladeFaden ? (
                        <Loader2 className="h-5 w-5 animate-spin text-folk-ink4" />
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[12px] text-folk-ink4">
                            {t("inbox.messages", { count: nachrichten.length })}
                          </p>
                          {nachrichten.map((n) => (
                            <div
                              key={n.id}
                              className={`rounded-lg p-2.5 text-[13px] ${
                                n.direction === "inbound"
                                  ? "bg-folk-bg-warm"
                                  : "bg-folk-card border border-folk-line"
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2 text-[12px] text-folk-ink4">
                                <span>{datum(n.occurred_at)}</span>
                                <span>
                                  {n.direction === "inbound" ? n.from_address : n.to_address}
                                </span>
                              </div>
                              {n.subject && (
                                <p className="font-medium text-folk-ink2">{n.subject}</p>
                              )}
                              <p className="text-folk-ink3">
                                {n.preview || (
                                  <span className="italic text-folk-ink4">
                                    {n.direction === "inbound"
                                      ? t("inbox.previewDropped")
                                      : t("inbox.noPreview")}
                                  </span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
