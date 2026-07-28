import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { documentI18nFor } from "@/i18n/documentLocale";
import { LOCALE_TAGS, toLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";

/**
 * Der Kundenbereich.
 *
 * ⚠️ Diese Seite spricht die Sprache des KUNDEN. Sie liest sie aus
 * `customers.language`, das die Portal-RPC mitliefert, und löst sie über
 * documentI18nFor auf — NIE über useT(). Ein useT() hier würde die
 * Dashboard-Sprache der Firma in die Kundenansicht durchreichen.
 *
 * ⚠️ Der Einmal-Link wird beim ersten Öffnen VERBRAUCHT. Deshalb wird die
 * daraus entstandene Sitzung sofort in sessionStorage abgelegt: ein Reload
 * würde sonst mit demselben, jetzt ungültigen Link kommen und den Kunden
 * aussperren. sessionStorage und nicht localStorage — der Zugang endet mit dem
 * Tab, nicht erst in 30 Tagen auf einem womöglich geteilten Rechner.
 */

const SPEICHER = "crm.portal.session";

type Uebersicht = {
  kunde: {
    anzeigename: string | null;
    vorname: string | null;
    nachname: string | null;
    firma: string | null;
    email: string | null;
    telefon: string | null;
    sprache: string | null;
  };
  firma: { name: string; email: string | null; telefon: string | null } | null;
  offerten: {
    id: string; nummer: string | null; titel: string | null; status: string;
    total: number | null; gueltig_bis: string | null; leistungsdatum: string | null;
    ueberholt: boolean; fassung: number | null; token: string | null;
  }[];
  nachtraege: {
    id: string; nummer: string | null; titel: string | null; status: string;
    total: number | null; token: string | null;
  }[];
  termine: {
    id: string; datum: string; start: string | null; ende: string | null;
    art: string | null; status: string; titel: string | null; ort: string | null;
  }[];
  auftraege: {
    id: string; nummer: string | null; titel: string | null; status: string;
    datum: string | null; total: number | null;
  }[];
  rechnungen: {
    id: string; nummer: string | null; datum: string; faellig: string | null;
    total: number; bezahlt: number; offen: number; status: string;
  }[];
  zahlungen: { datum: string; betrag: number; weg: string }[];
  offener_betrag: number;
};

const FELDER: { feld: string; labelKey: MessageKey; wert: keyof Uebersicht["kunde"] }[] = [
  { feld: "first_name", labelKey: "portal.data.firstName", wert: "vorname" },
  { feld: "last_name", labelKey: "portal.data.lastName", wert: "nachname" },
  { feld: "company_name", labelKey: "portal.data.companyName", wert: "firma" },
  { feld: "primary_email", labelKey: "portal.data.email", wert: "email" },
  { feld: "primary_phone", labelKey: "portal.data.phone", wert: "telefon" },
];

export default function Portal() {
  const { token } = useParams<{ token: string }>();
  const [daten, setDaten] = useState<Uebersicht | null>(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [aendern, setAendern] = useState<string | null>(null);
  const [neuerWert, setNeuerWert] = useState("");
  const [gemeldet, setGemeldet] = useState<string[]>([]);
  const [sendet, setSendet] = useState(false);

  const laden = useCallback(async (session: string) => {
    const { data, error } = await supabase.rpc("portal_overview", { p_session: session });
    if (error || !data) {
      sessionStorage.removeItem(SPEICHER);
      setFehler(true);
      setLoading(false);
      return;
    }
    setDaten(data as unknown as Uebersicht);
    setLoading(false);
  }, []);

  useEffect(() => {
    const start = async () => {
      const vorhanden = sessionStorage.getItem(SPEICHER);
      if (vorhanden) {
        await laden(vorhanden);
        return;
      }
      if (!token) {
        setFehler(true);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("portal_redeem_magic_link", {
        p_token: token,
      });
      const session = (data as { session?: string } | null)?.session;
      if (error || !session) {
        setFehler(true);
        setLoading(false);
        return;
      }
      // Zuerst ablegen, dann laden: der Link ist ab jetzt verbraucht.
      sessionStorage.setItem(SPEICHER, session);
      await laden(session);
    };
    start();
  }, [token, laden]);

  const melden = async (feld: string) => {
    const session = sessionStorage.getItem(SPEICHER);
    if (!session || !neuerWert.trim()) return;
    setSendet(true);
    const { error } = await supabase.rpc("portal_request_change", {
      p_session: session,
      p_feld: feld,
      p_neu_wert: neuerWert.trim(),
    });
    setSendet(false);
    if (error) return;
    setGemeldet((g) => [...g, feld]);
    setAendern(null);
    setNeuerWert("");
  };

  // Ohne Daten gibt es auch keine Kundensprache — Deutsch als Rückfall, wie in
  // NachtragView.
  const doc = documentI18nFor(toLocale(daten?.kunde.sprache ?? undefined));
  const t = doc.t;
  const tag = LOCALE_TAGS[doc.locale];
  const geld = (n: number | null) =>
    new Intl.NumberFormat(tag, { style: "currency", currency: "CHF" }).format(Number(n ?? 0));
  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(new Date(iso)) : "—";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fehler || !daten) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="font-medium">{t("portal.invalid")}</p>
        <p className="text-sm text-muted-foreground">{t("portal.invalidHint")}</p>
      </div>
    );
  }

  const abschnitt = (titelKey: MessageKey, leerKey: MessageKey, leer: boolean, inhalt: React.ReactNode) => (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-[15px] font-semibold">{t(titelKey)}</h2>
      {leer ? <p className="text-sm text-muted-foreground">{t(leerKey)}</p> : inhalt}
    </section>
  );

  return (
    <>
      <Helmet>
        <title>{`${t("portal.title")} · ${daten.firma?.name ?? ""}`}</title>
        {/* Ein Kundenbereich gehoert nicht in den Index einer Suchmaschine. */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">{daten.firma?.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("portal.greeting", { name: daten.kunde.anzeigename ?? "" })}
          </h1>
          <p className="text-sm">
            {t("portal.openAmount")}:{" "}
            <span className="font-mono font-semibold">
              {daten.offener_betrag > 0 ? geld(daten.offener_betrag) : t("portal.nothingOpen")}
            </span>
          </p>
        </header>

        {abschnitt("portal.section.offers", "portal.empty.offers", daten.offerten.length === 0,
          <ul className="space-y-2">
            {daten.offerten.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{o.nummer}</span> {o.titel}
                  {o.ueberholt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("portal.offer.superseded")}
                    </span>
                  )}
                  {o.gueltig_bis && !o.ueberholt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("portal.offer.validUntil", { date: datum(o.gueltig_bis) })}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono">{geld(o.total)}</span>
                  {o.token && (
                    <a className="text-primary underline" href={`/offerte/${o.token}`}>
                      {t("portal.offer.open")}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>,
        )}

        {abschnitt("portal.section.amendments", "portal.empty.amendments", daten.nachtraege.length === 0,
          <ul className="space-y-2">
            {daten.nachtraege.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{n.nummer}</span> {n.titel}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono">{geld(n.total)}</span>
                  {n.token && (
                    <a className="text-primary underline" href={`/nachtrag/${n.token}`}>
                      {t("portal.offer.open")}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>,
        )}

        {abschnitt("portal.section.appointments", "portal.empty.appointments", daten.termine.length === 0,
          <ul className="space-y-2">
            {daten.termine.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{datum(a.datum)}</span>
                {a.start && <span className="ml-2">{a.start.slice(0, 5)}</span>}
                {a.titel && <span className="ml-2">{a.titel}</span>}
                {a.ort && <span className="ml-2 text-muted-foreground">{a.ort}</span>}
              </li>
            ))}
          </ul>,
        )}

        {abschnitt("portal.section.orders", "portal.empty.orders", daten.auftraege.length === 0,
          <ul className="space-y-2">
            {daten.auftraege.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{g.nummer}</span> {g.titel}
                  <span className="ml-2 text-muted-foreground">{datum(g.datum)}</span>
                </span>
                <span className="font-mono">{geld(g.total)}</span>
              </li>
            ))}
          </ul>,
        )}

        {abschnitt("portal.section.invoices", "portal.empty.invoices", daten.rechnungen.length === 0,
          <ul className="space-y-2">
            {daten.rechnungen.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{r.nummer}</span>
                  <span className="ml-2 text-muted-foreground">
                    {r.offen > 0
                      ? t("portal.invoice.due", { date: datum(r.faellig) })
                      : t("portal.invoice.paid")}
                  </span>
                </span>
                <span className="font-mono">
                  {r.offen > 0
                    ? t("portal.invoice.openOf", { open: geld(r.offen), total: geld(r.total) })
                    : geld(r.total)}
                </span>
              </li>
            ))}
          </ul>,
        )}

        {abschnitt("portal.section.payments", "portal.empty.payments", daten.zahlungen.length === 0,
          <>
            <ul className="space-y-1">
              {daten.zahlungen.map((z, i) => (
                <li key={`${z.datum}-${i}`} className="flex justify-between text-sm">
                  <span>{datum(z.datum)}</span>
                  <span className="font-mono">{geld(z.betrag)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{t("portal.payment.hint")}</p>
          </>,
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-[15px] font-semibold">{t("portal.section.data")}</h2>
          <dl className="space-y-2 text-sm">
            {FELDER.map((f) => (
              <div key={f.feld} className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t(f.labelKey)}</dt>
                <dd className="flex items-center gap-3">
                  <span>{daten.kunde[f.wert] ?? "—"}</span>
                  {gemeldet.includes(f.feld) ? (
                    <span className="text-xs text-muted-foreground">
                      {t("portal.data.pending")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => {
                        setAendern(f.feld);
                        setNeuerWert(String(daten.kunde[f.wert] ?? ""));
                      }}
                    >
                      {t("portal.data.change")}
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {aendern && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <Label htmlFor="portal-neu">{t("portal.data.newValue")}</Label>
              <Input
                id="portal-neu"
                value={neuerWert}
                onChange={(e) => setNeuerWert(e.target.value)}
              />
              <Button size="sm" disabled={sendet || !neuerWert.trim()} onClick={() => melden(aendern)}>
                {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("portal.data.submit")}
              </Button>
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">{t("portal.data.hint")}</p>
        </section>
      </div>
    </>
  );
}
