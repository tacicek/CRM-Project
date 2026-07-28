import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/i18n/translator";

type Nachtrag = Database["public"]["Tables"]["offer_amendments"]["Row"];
type Position = Database["public"]["Tables"]["offer_amendment_items"]["Row"];

const STATUS_LABEL: Record<string, MessageKey> = {
  draft: "nachtrag.status.draft",
  sent: "nachtrag.status.sent",
  viewed: "nachtrag.status.viewed",
  accepted: "nachtrag.status.accepted",
  rejected: "nachtrag.status.rejected",
};

/**
 * Ein Nachtrag zu einer angenommenen Offerte.
 *
 * Solange er Entwurf ist, lässt sich alles ändern. Mit dem Versand ist er
 * inhaltlich gesperrt — dieselbe Zusage wie bei der Offerte, und dieselbe
 * Sperre in der Datenbank (guard_amendment_after_send). Die Oberfläche erklärt
 * das nur; verlassen tut sie sich nicht darauf.
 */
export default function FirmaNachtrag() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();
  const { companyId } = useCachedCompany();

  const [nachtrag, setNachtrag] = useState<Nachtrag | null>(null);
  const [positionen, setPositionen] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [speichert, setSpeichert] = useState(false);
  const [sendeDialog, setSendeDialog] = useState(false);

  const [titel, setTitel] = useState("");
  const [grund, setGrund] = useState("");

  const gesperrt = nachtrag?.locked_at !== null && nachtrag?.locked_at !== undefined;

  const laden = useCallback(async () => {
    if (!id || !companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("offer_amendments")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !data) {
      toast({ title: t("nachtrag.notFound"), variant: "destructive" });
      navigate("/firma/offerten");
      return;
    }
    setNachtrag(data);
    setTitel(data.title);
    setGrund(data.reason ?? "");

    const { data: pos } = await supabase
      .from("offer_amendment_items")
      .select("*")
      .eq("amendment_id", id)
      .order("position");
    setPositionen(pos ?? []);
    setLoading(false);
  }, [id, companyId, navigate, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const zwischensumme = useMemo(
    () => positionen.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0),
    [positionen],
  );
  const mwst = useMemo(
    () => (zwischensumme * Number(nachtrag?.vat_rate ?? 8.1)) / 100,
    [zwischensumme, nachtrag],
  );

  /**
   * Kopf und Positionen zusammen speichern. Die Zwischensumme wird hier
   * gerechnet und mitgeschrieben — MwSt und Total leitet die Datenbank daraus
   * ab (generierte Spalten), damit Nachtrag und Offerte nicht auseinanderlaufen.
   */
  const speichern = async () => {
    if (!nachtrag) return;
    setSpeichert(true);

    await supabase.from("offer_amendment_items").delete().eq("amendment_id", nachtrag.id);
    if (positionen.length > 0) {
      await supabase.from("offer_amendment_items").insert(
        positionen.map((p, i) => ({
          amendment_id: nachtrag.id,
          position: i + 1,
          description: p.description,
          quantity: Number(p.quantity),
          unit: p.unit,
          unit_price: Number(p.unit_price),
        })),
      );
    }

    const { error } = await supabase
      .from("offer_amendments")
      .update({ title: titel.trim(), reason: grund.trim() || null, subtotal: zwischensumme })
      .eq("id", nachtrag.id);

    setSpeichert(false);
    if (error) {
      toast({
        title: t("common.error"),
        // Der DB-Guard meldet sich mit 42501, wenn der Nachtrag schon draussen ist.
        description: error.code === "42501" ? t("nachtrag.locked") : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("nachtrag.saved") });
    laden();
  };

  const senden = async () => {
    if (!nachtrag) return;
    await speichern();
    const { error } = await supabase
      .from("offer_amendments")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", nachtrag.id);
    setSendeDialog(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("nachtrag.sent") });
    laden();
  };

  if (loading || !nachtrag) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-folk-coral" />
      </div>
    );
  }

  const kundenLink = `${window.location.origin}/nachtrag/${nachtrag.access_token}`;

  return (
    <>
      <Helmet>
        <title>{t("nachtrag.pageTitle")}</title>
      </Helmet>

      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-folk-ink3"
            onClick={() => navigate(`/firma/offerten/${nachtrag.offer_id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <span className="text-3xl leading-none">➕</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-folk-ink">
              {t("nachtrag.title")} {nachtrag.amendment_number}
            </h1>
            <span className="text-[13px] text-folk-ink3">
              {t(STATUS_LABEL[nachtrag.status] ?? "nachtrag.status.draft")}
              {gesperrt ? ` · ${t("nachtrag.locked")}` : ""}
            </span>
          </div>
          {!gesperrt && (
            <Button
              onClick={() => setSendeDialog(true)}
              disabled={positionen.length === 0 || !titel.trim()}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
            >
              <Send className="h-3.5 w-3.5" />
              {t("nachtrag.send")}
            </Button>
          )}
        </header>

        {gesperrt && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-folk-line bg-folk-bg-warm p-3">
            <Label className="text-[13px] text-folk-ink2">{t("nachtrag.link")}</Label>
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-folk-ink3">
              {kundenLink}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(kundenLink);
                toast({ title: t("nachtrag.linkCopied") });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <section className="space-y-3 rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="nachtrag-titel">{t("nachtrag.field.title")}</Label>
            <Input
              id="nachtrag-titel"
              value={titel}
              disabled={gesperrt}
              placeholder={t("nachtrag.field.titlePlaceholder")}
              onChange={(e) => setTitel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nachtrag-grund">{t("nachtrag.field.reason")}</Label>
            <Textarea
              id="nachtrag-grund"
              value={grund}
              disabled={gesperrt}
              rows={2}
              placeholder={t("nachtrag.field.reasonPlaceholder")}
              onChange={(e) => setGrund(e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-folk-line bg-folk-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-folk-ink">
              {t("nachtrag.field.positions")}
            </h2>
            {!gesperrt && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() =>
                  setPositionen((p) => [
                    ...p,
                    {
                      id: `neu-${p.length}`,
                      amendment_id: nachtrag.id,
                      position: p.length + 1,
                      description: "",
                      quantity: 1,
                      unit: null,
                      unit_price: 0,
                      service_type: null,
                      created_at: new Date().toISOString(),
                    } as Position,
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("nachtrag.addPosition")}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {positionen.map((p, i) => (
              <div key={p.id} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-12 sm:col-span-5"
                  value={p.description}
                  disabled={gesperrt}
                  placeholder={t("nachtrag.field.description")}
                  onChange={(e) =>
                    setPositionen((alt) =>
                      alt.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  className="col-span-4 sm:col-span-2"
                  type="number"
                  value={p.quantity}
                  disabled={gesperrt}
                  onChange={(e) =>
                    setPositionen((alt) =>
                      alt.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)),
                    )
                  }
                />
                <Input
                  className="col-span-4 sm:col-span-2"
                  value={p.unit ?? ""}
                  disabled={gesperrt}
                  placeholder={t("nachtrag.field.unit")}
                  onChange={(e) =>
                    setPositionen((alt) =>
                      alt.map((x, j) => (j === i ? { ...x, unit: e.target.value || null } : x)),
                    )
                  }
                />
                <Input
                  className="col-span-3 sm:col-span-2"
                  type="number"
                  value={p.unit_price}
                  disabled={gesperrt}
                  onChange={(e) =>
                    setPositionen((alt) =>
                      alt.map((x, j) =>
                        j === i ? { ...x, unit_price: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                {!gesperrt && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("nachtrag.removePosition")}
                    className="col-span-1 h-9 w-9 text-folk-ink4 hover:text-folk-coral"
                    onClick={() => setPositionen((alt) => alt.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <dl className="mt-4 space-y-1 border-t border-folk-line pt-3 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-folk-ink3">{t("nachtrag.subtotal")}</dt>
              <dd className="font-mono text-folk-ink">{formatCurrency(zwischensumme, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-folk-ink3">
                {t("nachtrag.vat")} {Number(nachtrag.vat_rate)}%
              </dt>
              <dd className="font-mono text-folk-ink">{formatCurrency(mwst, locale)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt className="text-folk-ink">{t("nachtrag.total")}</dt>
              <dd className="font-mono text-folk-ink">
                {formatCurrency(zwischensumme + mwst, locale)}
              </dd>
            </div>
          </dl>

          {!gesperrt && (
            <Button className="mt-3" onClick={speichern} disabled={speichert}>
              {speichert && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("nachtrag.save")}
            </Button>
          )}
        </section>
      </div>

      <AlertDialog open={sendeDialog} onOpenChange={setSendeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("nachtrag.send")}</AlertDialogTitle>
            <AlertDialogDescription>{t("nachtrag.sendConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={senden}>{t("nachtrag.send")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
