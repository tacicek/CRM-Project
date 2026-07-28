import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { KundeLink } from "@/components/firma/KundeLink";
import { useI18n, useT } from "@/i18n/useI18n";
import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/i18n/translator";

type Fall = Database["public"]["Tables"]["customer_cases"]["Row"];
type Filter = "offen" | "meine" | "geschlossen" | "alle";

const TYPEN = ["damage", "complaint", "recleaning", "service_change"] as const;
const ERGEBNISSE = [
  "repariert", "ersetzt", "gutschrift", "nachgeholt", "kulanz", "abgelehnt", "sonstiges",
] as const;
const PRIOS = ["low", "normal", "high", "urgent"] as const;

const TYP_STIL: Record<string, string> = {
  damage: "bg-folk-coral-bg text-folk-coral",
  complaint: "bg-folk-coral-bg text-folk-coral",
  recleaning: "bg-folk-bg-warm text-folk-ink3",
  service_change: "bg-folk-bg-warm text-folk-ink3",
};

/**
 * Fälle: Schaden, Reklamation, Nachreinigung, Serviceänderung.
 *
 * Eine Liste für vier Anlässe — sie unterscheiden sich im Auslöser, nicht im
 * Ablauf. Deshalb trägt auch die Datenbank eine Tabelle mit Typfeld und nicht
 * vier ähnliche (20260731110000).
 */
export default function FirmaFaelle() {
  const t = useT();
  const { dateLocale } = useI18n();
  const { user } = useAuth();
  const { companyId } = useCachedCompany();
  const { toast } = useToast();

  const [faelle, setFaelle] = useState<Fall[]>([]);
  const [auftraege, setAuftraege] = useState<{ id: string; label: string }[]>([]);
  const [filter, setFilter] = useState<Filter>("offen");
  const [loading, setLoading] = useState(true);

  const [neu, setNeu] = useState(false);
  const [form, setForm] = useState({
    case_type: "damage" as string,
    title: "",
    description: "",
    priority: "normal" as string,
    auftrag_id: "",
  });
  const [schliessen, setSchliessen] = useState<Fall | null>(null);
  const [ergebnis, setErgebnis] = useState<string>("repariert");
  const [abschlussNotiz, setAbschlussNotiz] = useState("");
  const [sendet, setSendet] = useState(false);

  const laden = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [f, a] = await Promise.all([
      supabase
        .from("customer_cases")
        .select("*")
        .eq("company_id", companyId)
        .order("reported_at", { ascending: false }),
      supabase
        .from("auftraege")
        .select("id, auftrag_nummer, customer_name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (f.error) {
      toast({ title: t("common.error"), description: f.error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setFaelle(f.data ?? []);
    setAuftraege(
      (a.data ?? []).map((x) => ({
        id: x.id,
        label: `${x.auftrag_nummer ?? ""} · ${x.customer_name ?? ""}`.trim(),
      })),
    );
    setLoading(false);
  }, [companyId, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const sichtbar = useMemo(() => {
    const geschlossen = (f: Fall) => f.status === "geloest" || f.status === "abgelehnt";
    if (filter === "offen") return faelle.filter((f) => !geschlossen(f));
    if (filter === "geschlossen") return faelle.filter(geschlossen);
    if (filter === "meine")
      return faelle.filter((f) => !geschlossen(f) && f.assigned_user_id === user?.id);
    return faelle;
  }, [faelle, filter, user?.id]);

  const offen = useMemo(
    () => faelle.filter((f) => f.status !== "geloest" && f.status !== "abgelehnt").length,
    [faelle],
  );

  const anlegen = async () => {
    if (!companyId || !form.title.trim()) return;
    setSendet(true);
    // customer_id kommt vom Auftrag: der Fall soll auf der Kundenkarte
    // erscheinen, auch wenn ihn niemand explizit zugeordnet hat.
    const kunde = form.auftrag_id
      ? (await supabase.from("auftraege").select("customer_id").eq("id", form.auftrag_id).single())
          .data?.customer_id ?? null
      : null;

    const { error } = await supabase.from("customer_cases").insert({
      company_id: companyId,
      customer_id: kunde,
      case_type: form.case_type,
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      auftrag_id: form.auftrag_id || null,
      created_by: user?.id ?? null,
    });
    setSendet(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("fall.new.saved") });
    setNeu(false);
    setForm({ case_type: "damage", title: "", description: "", priority: "normal", auftrag_id: "" });
    laden();
  };

  const uebernehmen = async (f: Fall) => {
    const { error } = await supabase
      .from("customer_cases")
      .update({ status: "in_arbeit", assigned_user_id: user?.id ?? null })
      .eq("id", f.id);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    laden();
  };

  const abschliessen = async () => {
    if (!schliessen) return;
    setSendet(true);
    // closed_at und resolution_type sind zusammen Pflicht (CHECK) — ein
    // Abschluss ohne Ergebnis wäre später nicht mehr nachvollziehbar.
    const { error } = await supabase
      .from("customer_cases")
      .update({
        status: ergebnis === "abgelehnt" ? "abgelehnt" : "geloest",
        resolution_type: ergebnis,
        resolution: abschlussNotiz || null,
        closed_at: new Date().toISOString(),
      })
      .eq("id", schliessen.id);
    setSendet(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("fall.closed") });
    setSchliessen(null);
    setAbschlussNotiz("");
    laden();
  };

  const zeit = (iso: string) =>
    formatDistanceToNow(new Date(iso), { addSuffix: true, locale: dateLocale });

  return (
    <>
      <Helmet>
        <title>{t("fall.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="text-4xl leading-none">🛠️</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">
              {t("fall.title")}
            </h1>
            <span className="text-[15px] text-folk-ink3">
              {t("fall.count", { count: offen })} · {t("fall.subtitle")}
            </span>
          </div>
          <Button onClick={() => setNeu(true)} className="bg-folk-ink text-folk-bg hover:bg-folk-ink2">
            {t("fall.new")}
          </Button>
        </header>

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="flex flex-wrap gap-1.5">
            {(["offen", "meine", "geschlossen", "alle"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                  filter === f
                    ? "border-folk-ink bg-folk-ink text-folk-bg"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
              >
                {t(`fall.filter.${f}` as MessageKey)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
            </div>
          ) : sichtbar.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-folk-ink">{t("fall.empty")}</p>
              <p className="mt-1 text-[14px] text-folk-ink3">{t("fall.emptyHint")}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {sichtbar.map((f) => {
                const zu = f.status === "geloest" || f.status === "abgelehnt";
                return (
                  <article
                    key={f.id}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[13px] text-folk-ink4">
                          {f.case_number}
                        </span>
                        <span
                          className={`text-[15px] font-semibold tracking-tight ${
                            zu ? "text-folk-ink4 line-through" : "text-folk-ink"
                          }`}
                        >
                          {f.title}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            TYP_STIL[f.case_type] ?? TYP_STIL.recleaning
                          }`}
                        >
                          {t(`fall.type.${f.case_type}` as MessageKey)}
                        </span>
                        <span className="rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink3">
                          {t(`fall.status.${f.status}` as MessageKey)}
                        </span>
                        {f.reported_by === "kunde" && (
                          <span className="text-[11px] text-folk-ink4">
                            {t("fall.reportedBy.kunde")}
                          </span>
                        )}
                      </div>
                      {f.description && (
                        <p className="mt-0.5 text-[13px] text-folk-ink3">{f.description}</p>
                      )}
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-folk-ink4">
                        <span>{zeit(f.reported_at)}</span>
                        <KundeLink customerId={f.customer_id} />
                        {f.resolution_type && (
                          <span>{t(`fall.resolution.${f.resolution_type}` as MessageKey)}</span>
                        )}
                      </p>
                    </div>

                    {!zu && (
                      <div className="flex shrink-0 gap-1">
                        {f.status === "offen" && (
                          <Button size="sm" variant="outline" className="h-8 text-[13px]"
                            onClick={() => uebernehmen(f)}>
                            {t("fall.takeOver")}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-[13px]"
                          onClick={() => setSchliessen(f)}>
                          {t("fall.close")}
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={neu} onOpenChange={setNeu}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fall.new.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fall.new.type")}</Label>
                <Select value={form.case_type} onValueChange={(v) => setForm({ ...form, case_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPEN.map((x) => (
                      <SelectItem key={x} value={x}>{t(`fall.type.${x}` as MessageKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("fall.new.priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIOS.map((x) => (
                      <SelectItem key={x} value={x}>{t(`fall.priority.${x}` as MessageKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fall-titel">{t("fall.new.titleField")}</Label>
              <Input id="fall-titel" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fall-text">{t("fall.new.description")}</Label>
              <Textarea id="fall-text" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fall.new.auftrag")}</Label>
              <Select
                value={form.auftrag_id || "none"}
                onValueChange={(v) => setForm({ ...form, auftrag_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("fall.new.noAuftrag")}</SelectItem>
                  {auftraege.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={anlegen} disabled={sendet || !form.title.trim()}>
              {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("fall.new.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={schliessen !== null} onOpenChange={(o) => !o && setSchliessen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fall.close.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("fall.close.result")}</Label>
              <Select value={ergebnis} onValueChange={setErgebnis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ERGEBNISSE.map((x) => (
                    <SelectItem key={x} value={x}>
                      {t(`fall.resolution.${x}` as MessageKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fall-abschluss">{t("fall.close.note")}</Label>
              <Textarea id="fall-abschluss" rows={3} value={abschlussNotiz}
                onChange={(e) => setAbschlussNotiz(e.target.value)} />
            </div>
            <p className="text-[12px] text-folk-ink4">{t("fall.close.hint")}</p>
          </div>
          <DialogFooter>
            <Button onClick={abschliessen} disabled={sendet}>
              {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("fall.close.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
