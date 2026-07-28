import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useI18n, useT } from "@/i18n/useI18n";

type Wunsch = {
  id: string;
  feld: string;
  alt_wert: string | null;
  neu_wert: string;
  bemerkung: string | null;
  created_at: string;
};

/**
 * Portalzugang und Änderungswünsche eines Kunden — die BEDIENER-Seite.
 *
 * Hier ist `useT()` richtig: dieser Block steht im Dashboard. Die Kundenseite
 * (src/pages/public/Portal.tsx) löst dieselben Kataloge über
 * documentI18nFor(kunde.sprache) auf.
 *
 * Der erzeugte Link wird bewusst NICHT gespeichert und nicht erneut angezeigt.
 * Die Datenbank kennt nur seinen Abdruck; wer ihn verliert, erzeugt einen neuen.
 */
export const PortalZugangPanel = ({
  customerId,
  companyId,
}: {
  customerId: string;
  companyId: string | undefined;
}) => {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();

  const [link, setLink] = useState<{ url: string; bis: string } | null>(null);
  const [aktivSeit, setAktivSeit] = useState<string | null>(null);
  const [wuensche, setWuensche] = useState<Wunsch[]>([]);
  const [laedt, setLaedt] = useState(false);

  const datum = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));

  const laden = useCallback(async () => {
    if (!companyId) return;
    const [s, w] = await Promise.all([
      supabase
        .from("portal_sessions")
        .select("created_at")
        .eq("customer_id", customerId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("customer_change_requests")
        .select("id, feld, alt_wert, neu_wert, bemerkung, created_at")
        .eq("customer_id", customerId)
        .eq("status", "offen")
        .order("created_at", { ascending: false }),
    ]);
    setAktivSeit(s.data?.[0]?.created_at ?? null);
    setWuensche(w.data ?? []);
  }, [customerId, companyId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const erstellen = async () => {
    setLaedt(true);
    const { data, error } = await supabase.rpc("portal_create_magic_link", {
      p_customer_id: customerId,
    });
    setLaedt(false);
    if (error || !data) {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
      return;
    }
    const antwort = data as unknown as { token: string; expires_at: string };
    setLink({
      url: `${window.location.origin}/portal/${antwort.token}`,
      bis: antwort.expires_at,
    });
  };

  const widerrufen = async () => {
    const { data, error } = await supabase.rpc("portal_revoke_access", {
      p_customer_id: customerId,
    });
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    const antwort = data as unknown as { sitzungen: number };
    setLink(null);
    toast({ title: t("portal.admin.revoked", { count: antwort?.sitzungen ?? 0 }) });
    laden();
  };

  const entscheiden = async (id: string, annehmen: boolean) => {
    const { error } = await supabase.rpc("decide_change_request", {
      p_id: id,
      p_annehmen: annehmen,
    });
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("portal.admin.decided") });
    laden();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-semibold text-folk-ink">{t("portal.admin.title")}</h2>

      <p className="text-[13px] text-folk-ink3">
        {aktivSeit ? t("portal.admin.active", { date: datum(aktivSeit) }) : t("portal.admin.none")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={laedt} onClick={erstellen}>
          {laedt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("portal.admin.create")}
        </Button>
        {(aktivSeit || link) && (
          <Button size="sm" variant="ghost" onClick={widerrufen}>
            {t("portal.admin.revoke")}
          </Button>
        )}
      </div>

      {link && (
        <div className="space-y-2 rounded-lg border border-folk-line bg-folk-bg-warm p-3">
          <p className="text-[13px] font-medium text-folk-ink">
            {t("portal.admin.linkReady", { date: datum(link.bis) })}
          </p>
          <code className="block break-all rounded bg-folk-card px-2 py-1.5 text-[12px] text-folk-ink2">
            {link.url}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(link.url);
              toast({ title: t("portal.admin.copied") });
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {t("portal.admin.copy")}
          </Button>
          <p className="text-[12px] text-folk-ink4">{t("portal.admin.onceOnly")}</p>
          <p className="text-[12px] text-folk-ink4">{t("portal.admin.sendHint")}</p>
        </div>
      )}

      {wuensche.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[14px] font-semibold text-folk-ink">
            {t("portal.admin.requests")}
          </h3>
          {wuensche.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-folk-line p-2.5"
            >
              <span className="flex-1 text-[13px] text-folk-ink2">
                <span className="font-medium">{w.feld}</span>: {w.alt_wert ?? "—"} →{" "}
                <span className="font-medium">{w.neu_wert}</span>
                {w.bemerkung && (
                  <span className="ml-2 text-folk-ink4">{w.bemerkung}</span>
                )}
              </span>
              <Button size="sm" variant="outline" className="h-7 text-[12px]"
                onClick={() => entscheiden(w.id, true)}>
                {t("portal.admin.accept")}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[12px]"
                onClick={() => entscheiden(w.id, false)}>
                {t("portal.admin.reject")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
