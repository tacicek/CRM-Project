import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadIcsFile } from "@/lib/generateIcsFile";
import { documentI18nFor } from "@/i18n/documentLocale";
import { toLocale } from "@/i18n/locale";
import { getAppointmentTypeLabel } from "@/i18n/domain";
import {
  MAX_REASON_LENGTH,
  buildCancellationPayload,
  classifyCancellation,
  belongsToSession,
  classifyPreview,
  offersCalendarFile,
  openRouteSession,
  planUrlCleanup,
  routeSignature,
  showsTimeRange,
  viewForOutcome,
  viewForPreview,
  type PageView,
  type PreviewAppointment,
} from "./appointmentCancellationFlow";

/**
 * Oeffentliche Absage-Seite.
 *
 * Diese Datei ist nur noch Anbindung. Was aus einer Adresse eine Berechtigung
 * macht, wie eine Antwort einzuordnen ist und was die Seite daraufhin zeigt,
 * steht in ./appointmentCancellationFlow.ts — dort laesst es sich ohne Browser
 * ausfuehren und pruefen.
 *
 * Zwei Wege nach aussen, mehr nicht:
 *   * lesen  → RPC `get_appointment_by_action_token`
 *   * absagen → Edge Function `notify-appointment-cancelled`
 *
 * Die Seite liest keine Tabelle mehr direkt und schreibt in keine. Die alte
 * Fassung tat genau das — Termin- und Firmenzeile aus dem Browser holen, den
 * Status per Update setzen — und konnte gar nicht funktionieren: auf beiden
 * Tabellen liegt RLS ohne Policy fuer `anon`. (Die Aufrufe stehen hier
 * absichtlich nicht woertlich: ein Test durchsucht die Datei danach.)
 */
export default function AppointmentCancel() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const location = useLocation();

  /**
   * Die Berechtigung gehoert zum AUFTRITT der Route, nicht zum Einhaengen der
   * Komponente. Wechselt der Nutzer von Termin A zu Termin B, bleibt dieselbe
   * Komponente stehen — einmal beim Start ermittelt, behielte sie A's Token und
   * zeigte damit B.
   *
   * `location.key` allein reicht dafuer nicht: er benennt einen
   * VERLAUFSEINTRAG, und vor und zurueck bringt denselben Eintrag mit
   * demselben `key` wieder. Die Sitzung bekommt deshalb eine eigene, opake
   * Kennung je Auftritt; die Signatur sagt nur, DASS sich die Route geaendert
   * hat.
   */
  const schnappschuss = {
    appointmentId,
    key: location.key,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  };
  const signatur = routeSignature(schnappschuss);
  const verlaufsZustand = typeof window === "undefined" ? undefined : window.history.state;

  // Waehrend des Renderns nachgezogen statt zwischengespeichert: die Sitzung
  // ist Zustand. Ein Zwischenspeicher darf sein Ergebnis jederzeit wegwerfen —
  // dann entstuende ohne Navigation ein neuer Auftritt und die Seite finge
  // grundlos von vorn an. (Der Hakenname steht hier nicht, weil ein Test die
  // Datei danach durchsucht.)
  const [session, setSession] = useState(() => openRouteSession(schnappschuss, verlaufsZustand));
  if (session.signature !== signatur) {
    setSession(openRouteSession(schnappschuss, verlaufsZustand));
  }
  const capability = session.capability;

  // Jedes Ergebnis traegt die Sitzung, die es angefordert hat.
  const [ergebnis, setErgebnis] = useState<{
    routeId: string;
    view: PageView;
    appointment: PreviewAppointment | null;
  }>({ routeId: "", view: "loading", appointment: null });
  // Alles Weitere haengt ebenfalls am Auftritt. Ein globales Flag wanderte
  // sonst mit auf die naechste Route: A wartet noch auf seine Absage, B zeigt
  // schon das Formular — und dessen Knopf waere gesperrt, obwohl B nichts
  // abgeschickt hat.
  const [grund, setGrund] = useState<{ routeId: string; text: string }>({ routeId: "", text: "" });
  const [absendend, setAbsendend] = useState<string | null>(null);
  const [versuche, setVersuche] = useState<{ routeId: string; n: number }>({ routeId: "", n: 0 });

  const reason = grund.routeId === session.routeId ? grund.text : "";
  const submitting = absendend === session.routeId;
  const versuch = versuche.routeId === session.routeId ? versuche.n : 0;

  // Waehrend des Renderns aktuell gehalten: eine spaet eintreffende Antwort
  // fragt hier nach, ob ihre Route ueberhaupt noch angezeigt wird.
  const laufendeRoute = useRef(session.routeId);
  laufendeRoute.current = session.routeId;

  const aktuell = belongsToSession(session, ergebnis.routeId)
    ? ergebnis
    : { routeId: session.routeId, view: "loading" as PageView, appointment: null };
  const view = aktuell.view;
  const appointment = aktuell.appointment;

  /**
   * Dokumentsprache. Nach einer gueltigen Vorschau ausschliesslich
   * `appointment.language` — die Sprache, in der mit diesem Kunden von Anfang
   * an gesprochen wurde. Solange es keine Vorschau gibt, dient `?lang=` als
   * reine Darstellungshilfe fuer die Fehlerseite; ueber Zugriff oder Daten
   * entscheidet dieser Parameter nie.
   */
  const anzeigeSprache = appointment
    ? toLocale(appointment.language)
    : toLocale(new URLSearchParams(location.search).get("lang"));
  const { t, locale, dateLocale } = documentI18nFor(anzeigeSprache);

  // Token aus der Adresszeile entfernen, seine Bindung an DIESEN Termin aber im
  // History-State behalten, damit ein Neuladen weiterhin funktioniert.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const plan = planUrlCleanup(
      capability,
      { pathname: location.pathname, search: location.search, hash: location.hash },
      window.history.state,
    );
    if (plan) window.history.replaceState(plan.state, "", plan.url);
    // An der Sitzung haengend, nicht an der Berechtigung: aufgeraeumt wird auch
    // dann, wenn gar keine Berechtigung zustande kam — ein `?email=` oder ein
    // kaputtes Fragment soll ebenso verschwinden wie ein gueltiges Token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const meineRoute = session.routeId;
    let abgebrochen = false;

    const zeige = (naechste: PageView, termin: PreviewAppointment | null) => {
      if (abgebrochen || laufendeRoute.current !== meineRoute) return;
      setErgebnis({ routeId: meineRoute, view: naechste, appointment: termin });
    };

    const laden = async () => {
      if (!capability.ok) {
        zeige("invalid_link", null);
        return;
      }
      const antwort = await supabase.rpc("get_appointment_by_action_token", {
        p_appointment_id: capability.appointmentId,
        p_token: capability.token,
      });

      const vorschau = classifyPreview(antwort, capability.appointmentId);
      if (vorschau.kind === "ok") {
        zeige(viewForPreview(vorschau.appointment), vorschau.appointment);
        return;
      }
      zeige(vorschau.kind === "invalid" ? "invalid_link" : "service_error", null);
    };

    void laden();
    return () => {
      abgebrochen = true;
    };
  }, [session, capability, versuch]);

  const absagen = useCallback(async () => {
    if (!capability.ok) return;
    const meineRoute = session.routeId;

    const koerper = buildCancellationPayload(capability.appointmentId, capability.token, reason);
    if (!koerper.ok) {
      toast.error(t("public.cancel.reasonTooLong"));
      return;
    }

    setAbsendend(meineRoute);
    try {
      const { data, error } = await supabase.functions.invoke("notify-appointment-cancelled", {
        body: koerper.payload,
      });

      // Den Statuscode holt nur diese Stelle aus dem Fehlerobjekt; weiter
      // hinein wird es nicht gereicht. Es traegt die urspruengliche Antwort und
      // damit moeglicherweise Teile der Anfrage — darunter das Token.
      const status =
        error && typeof error === "object" && "context" in error
          ? ((error as { context?: { status?: number } }).context?.status ?? null)
          : null;

      const antwort = classifyCancellation({ data, error, status });
      // Die Route kann sich waehrend des Wartens geaendert haben. Dann gehoert
      // dieses Ergebnis nicht mehr auf den Bildschirm.
      if (laufendeRoute.current !== meineRoute) return;
      setErgebnis({ routeId: meineRoute, view: viewForOutcome(antwort), appointment });
      if (antwort.kind === "cancelled_now") toast.success(t("public.cancel.toastSuccess"));
      if (antwort.kind === "service_error") toast.error(t("public.cancel.toastFailed"));
    } finally {
      // Funktional zurueckgesetzt: haette B inzwischen abgeschickt, duerfte
      // A's Abschluss dessen Sperre nicht aufheben.
      setAbsendend((laufend) => (laufend === meineRoute ? null : laufend));
    }
  }, [capability, reason, t, session.routeId, appointment]);

  // "PPPP" = Langdatum mit Wochentag in der jeweiligen Sprache.
  const langesDatum = (wert: string) => format(new Date(wert), "PPPP", { locale: dateLocale });
  const uhrzeit = (wert: string) => wert.substring(0, 5);

  const kalenderDatei = () => {
    if (!appointment) return;
    downloadIcsFile({
      title: appointment.title,
      description: t("public.appointment.icsDescription", { company: appointment.company_name ?? "" }),
      date: appointment.appointment_date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      // Nur der Ort, nicht die vollstaendige Adresse: mehr gibt die Vorschau
      // nicht heraus, und mehr braucht ein Kalendereintrag auch nicht.
      location: appointment.location_city ?? undefined,
      organizerName: appointment.company_name ?? undefined,
      // Bewusst keine Organisator-Adresse: die Vorschau kennt keine, und eine
      // zu erfinden waere eine Falschangabe im Kalender des Kunden.
    });
  };

  const firma = appointment?.company_name ?? "";

  const Rahmen = ({ children }: { children: React.ReactNode }) => (
    <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">{children}</Card>
    </div>
  );

  const Meldung = ({
    icon,
    ton,
    titel,
    text,
    aktion,
  }: {
    icon: React.ReactNode;
    ton: string;
    titel: string;
    text: string;
    aktion?: React.ReactNode;
  }) => (
    <Rahmen>
      <CardHeader className="text-center">
        <div className={`mx-auto w-16 h-16 ${ton} rounded-full flex items-center justify-center mb-4`}>
          {icon}
        </div>
        <CardTitle>{titel}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {aktion && <CardContent>{aktion}</CardContent>}
      {appointment && (view === "done" || view === "already_cancelled") && (
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="font-medium">{appointment.title}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {langesDatum(appointment.appointment_date)}
            </div>
            {showsTimeRange(appointment) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t("doc.time.fromUntil", {
                  start: uhrzeit(appointment.start_time),
                  end: uhrzeit(appointment.end_time),
                })}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Rahmen>
  );

  if (view === "loading") {
    return (
      <Rahmen>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Rahmen>
    );
  }

  if (view === "invalid_link") {
    return (
      <Meldung
        icon={<XCircle className="h-8 w-8 text-destructive" />}
        ton="bg-destructive/10"
        titel={t("common.error")}
        text={t("public.invalidLink")}
      />
    );
  }

  if (view === "service_error") {
    return (
      <Meldung
        icon={<AlertTriangle className="h-8 w-8 text-amber-600" />}
        ton="bg-amber-100"
        titel={t("public.cancel.serviceUnavailableTitle")}
        text={t("public.cancel.serviceUnavailableBody")}
        // Der Knopf laedt AUSSCHLIESSLICH die Vorschau neu. Die Absage blind zu
        // wiederholen waere gefaehrlich: sie kann laengst festgeschrieben sein
        // und nur die Antwort verloren gegangen. Die Vorschau findet genau das
        // heraus — sie zeigt dann `cancelled` und die Seite meldet
        // "bereits abgesagt", ohne noch einmal etwas auszuloesen.
        aktion={
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setErgebnis({ routeId: session.routeId, view: "loading", appointment: null });
              setVersuche((v) => ({ routeId: session.routeId, n: v.routeId === session.routeId ? v.n + 1 : 1 }));
            }}
          >
            {t("public.cancel.retry")}
          </Button>
        }
      />
    );
  }

  if (view === "not_cancellable") {
    return (
      <Meldung
        icon={<XCircle className="h-8 w-8 text-muted-foreground" />}
        ton="bg-muted"
        titel={t("public.cancel.notCancellableTitle")}
        text={t("public.cancel.notCancellableBody", { company: firma })}
      />
    );
  }

  if (view === "already_cancelled") {
    return (
      <Meldung
        icon={<CheckCircle2 className="h-8 w-8 text-orange-600" />}
        ton="bg-orange-100"
        titel={t("public.cancel.alreadyCancelledTitle")}
        text={t("public.cancel.alreadyCancelledBody")}
      />
    );
  }

  if (view === "done") {
    return (
      <Meldung
        icon={<CheckCircle2 className="h-8 w-8 text-orange-600" />}
        ton="bg-orange-100"
        titel={t("public.cancel.doneTitle")}
        text={t("public.cancel.doneBody", { company: firma })}
      />
    );
  }

  if (!appointment) return null;

  return (
    <Rahmen>
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-orange-600" />
        </div>
        <CardTitle>{t("public.cancel.title")}</CardTitle>
        <CardDescription>{t("public.cancel.question")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="font-semibold text-lg">{appointment.title}</div>
          <div className="text-sm text-muted-foreground">
            {getAppointmentTypeLabel(appointment.appointment_type, locale)}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{langesDatum(appointment.appointment_date)}</span>
            </div>
            {showsTimeRange(appointment) && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t("doc.time.fromUntil", {
                    start: uhrzeit(appointment.start_time),
                    end: uhrzeit(appointment.end_time),
                  })}
                </span>
              </div>
            )}
            {appointment.location_city && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.location_city}</span>
              </div>
            )}
            {appointment.company_name && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.company_name}</span>
              </div>
            )}
            {appointment.company_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.company_phone}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t("public.cancel.reason")}</label>
          <Textarea
            placeholder={t("public.cancel.placeholder")}
            value={reason}
            onChange={(e) => setGrund({ routeId: session.routeId, text: e.target.value })}
            maxLength={MAX_REASON_LENGTH}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-3">
          {offersCalendarFile(appointment) && (
            <Button variant="outline" onClick={kalenderDatei} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {t("public.appointment.addToCalendar")}
            </Button>
          )}
          <Button variant="destructive" onClick={absagen} disabled={submitting} className="w-full">
            {submitting ? t("public.cancel.submitting") : t("public.cancel.submit")}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            {t("public.cancel.companyInformed", { company: firma })}
          </p>
        </div>
      </CardContent>
    </Rahmen>
  );
}
