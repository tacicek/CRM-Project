import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { documentI18nFor } from "@/i18n/documentLocale";
import { LOCALE_TAGS, toLocale } from "@/i18n/locale";
import type { Database } from "@/integrations/supabase/types";

type Nachtrag = Database["public"]["Functions"]["get_amendment_by_token"]["Returns"][number];
type Position = {
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
};

/**
 * Der Nachtrag, wie der Kunde ihn sieht.
 *
 * ⚠️ Diese Seite spricht die Sprache des KUNDEN, nicht die des Bedieners. Sie
 * liest sie aus `nachtrag.language` (bei der Erstellung aus der Offerte
 * eingefroren) und löst sie über documentI18nFor auf — NICHT über useT().
 * Ein `useT()` hier würde die Dashboard-Sprache der Firma in das Dokument des
 * Kunden durchreichen; genau die Trennung, die src/i18n/README.md beschreibt.
 */
export default function NachtragView() {
  const { token } = useParams<{ token: string }>();
  const [nachtrag, setNachtrag] = useState<Nachtrag | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc("get_amendment_by_token", { p_token: token });
    const zeile = (data ?? [])[0] as Nachtrag | undefined;
    setNachtrag(zeile ?? null);
    setLoading(false);

    // Das blosse Öffnen festhalten — für die Firma ist es die Information, dass
    // der Kunde den Nachtrag gesehen hat.
    if (zeile && zeile.status === "sent") {
      await supabase.rpc("update_amendment_by_token", {
        p_token: token,
        p_new_status: "viewed",
      });
    }
  }, [token]);

  useEffect(() => {
    laden();
  }, [laden]);

  const antworten = async (status: "accepted" | "rejected") => {
    if (!token) return;
    setSendet(true);
    const { data, error } = await supabase.rpc("update_amendment_by_token", {
      p_token: token,
      p_new_status: status,
    });
    setSendet(false);
    if (error || data !== true) {
      setFehler("error");
      return;
    }
    laden();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!nachtrag) {
    // Ohne Datensatz gibt es auch keine Kundensprache — Deutsch als Rückfall.
    const tDe = documentI18nFor("de");
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">{tDe.t("nachtrag.notFound")}</p>
      </div>
    );
  }

  // Die Sprache steht auf dem Nachtrag selbst — beim Anlegen aus der Offerte
  // eingefroren. Kein Griff in den React-Context.
  const doc = documentI18nFor(toLocale(nachtrag.language));
  const t = doc.t;
  const localeTag = LOCALE_TAGS[doc.locale];
  const positionen = (nachtrag.positionen ?? []) as unknown as Position[];
  const geld = (n: number) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency: "CHF" }).format(n);
  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(localeTag, { dateStyle: "long" }).format(new Date(iso)) : "";

  const offen = nachtrag.status === "sent" || nachtrag.status === "viewed";

  return (
    <>
      <Helmet>
        <title>{`${t("nachtrag.title")} ${nachtrag.amendment_number} · ${nachtrag.company_name}`}</title>
      </Helmet>

      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">{nachtrag.company_name}</p>
            <CardTitle className="text-xl">
              {t("nachtrag.title")} {nachtrag.amendment_number} — {nachtrag.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("nachtrag.public.intro")} {nachtrag.offer_number}
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {nachtrag.reason && <p className="text-sm">{nachtrag.reason}</p>}

            <div className="space-y-2">
              {positionen.map((p) => (
                <div key={p.position} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {p.description}
                    <span className="ml-2 text-muted-foreground">
                      {p.quantity} {p.unit ?? ""}
                    </span>
                  </span>
                  <span className="font-mono">{geld(p.quantity * p.unit_price)}</span>
                </div>
              ))}
            </div>

            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("nachtrag.subtotal")}</dt>
                <dd className="font-mono">{geld(Number(nachtrag.subtotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {t("nachtrag.vat")} {Number(nachtrag.vat_rate)}%
                </dt>
                <dd className="font-mono">{geld(Number(nachtrag.vat_amount))}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>{t("nachtrag.total")}</dt>
                <dd className="font-mono">{geld(Number(nachtrag.total))}</dd>
              </div>
            </dl>

            {nachtrag.status === "accepted" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span>{t("nachtrag.public.accepted", { date: datum(nachtrag.accepted_at) })}</span>
              </div>
            )}
            {nachtrag.status === "rejected" && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-red-700">
                <XCircle className="h-5 w-5" />
                <span>{t("nachtrag.public.rejected", { date: datum(nachtrag.rejected_at) })}</span>
              </div>
            )}

            {fehler && <p className="text-sm text-red-600">{t("nachtrag.public.error")}</p>}

            {offen && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" disabled={sendet} onClick={() => antworten("accepted")}>
                  {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("nachtrag.public.accept")}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={sendet}
                  onClick={() => antworten("rejected")}
                >
                  {t("nachtrag.public.reject")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
