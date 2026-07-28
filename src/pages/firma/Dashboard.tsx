import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calendar,
  Phone,
  CalendarCheck,
  ChevronRight,
  Package,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { AcceptBesichtigungDialog } from "@/components/firma/AcceptBesichtigungDialog";
import { useI18n, useT } from "@/i18n/useI18n";
import { LOCALE_TAGS, type Locale } from "@/i18n/locale";
import { formatDate, formatDateTime } from "@/i18n/format";
import { getAppointmentTypeLabel } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/translator";
import { useTheme } from "@/hooks/useTheme";
import { useUebersichtData } from "@/hooks/useUebersichtData";
import { KpiStrip } from "@/components/firma/uebersicht/KpiStrip";
import { WorkItems } from "@/components/firma/uebersicht/WorkItems";
import type { WorkItemStatus } from "@/types/uebersicht";

/**
 * Die Filterstufen der Vorgangsliste.
 *
 * `ueberfaellig` hat bewusst keinen eigenen Knopf: fuer den Benutzer ist eine
 * ueberfaellige Offerte immer noch eine offerierte, nur eine draengende. Ein
 * eigener Filter wuerde sie aus 'Offeriert' verschwinden lassen.
 */
const VORGANG_FILTER = ["alle", "neu", "offeriert", "gewonnen"] as const;
type VorgangFilter = (typeof VORGANG_FILTER)[number];

const MATCHES: Record<VorgangFilter, (status: WorkItemStatus) => boolean> = {
  alle: () => true,
  neu: (status) => status === "neu",
  offeriert: (status) => status === "offeriert" || status === "ueberfaellig",
  gewonnen: (status) => status === "gewonnen",
};

interface DashboardStats {
  tokenBalance: number;
  pendingLeads: number;
  openOffers: number;
  jobsThisMonth: number;
  besichtigungCount: number;
}

interface BoxStats {
  total_active: number;
  overdue: number;
  urgent: number;
  pickup_today: number;
}


interface TodayAppointment {
  id: string;
  title: string;
  appointment_date: string;
  appointment_type: string;
}

interface BesichtigungRequest {
  id: string;
  notification_id: string;
  offer_id: string;
  title: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  besichtigung_date: string;
  besichtigung_time: string | null;
  customer_note: string | null;
  created_at: string;
}

/** Weekday + day + month in the operator's language ("Montag, 14. Juli" · "lundi 14 juillet"). */
const formatWeekdayLong = (date: Date, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);

const formatClockTime = (date: Date, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const FirmaDashboard = () => {
  const { user } = useAuth();
  const t = useT();
  const { locale } = useI18n();
  const [stats, setStats] = useState<DashboardStats>({
    tokenBalance: 0,
    pendingLeads: 0,
    openOffers: 0,
    jobsThisMonth: 0,
    besichtigungCount: 0,
  });
  const [besichtigungRequests, setBesichtigungRequests] = useState<BesichtigungRequest[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedBesichtigung, setSelectedBesichtigung] = useState<BesichtigungRequest | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [boxStats, setBoxStats] = useState<BoxStats | null>(null);
  const { resolvedTheme } = useTheme();
  const { workItems, kpis } = useUebersichtData();
  const [vorgangFilter, setVorgangFilter] = useState<VorgangFilter>("alle");

  // Nur clientseitig gefiltert — die Kennzahlen oben bleiben davon unberuehrt,
  // sonst widerspraeche der Streifen der Liste darunter.
  const sichtbareVorgaenge = workItems.filter((item) => MATCHES[vorgangFilter](item.status));

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const company = await fetchSingleCompanyForUser<{ id: string }>({
          userId: user.id,
          userEmail: user.email,
          select: "id",
        });

        if (!company) return;
        setCompanyId(company.id);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);

        const [
          { data: alleLeads },
          { data: offertenLeadIds },
          { count: openOffersCount },
          { count: jobsThisMonthCount },
          { data: besichtigungNotifications },
          { data: appointmentsForOffers },
          { data: todayAppts },
          boxStatsResult,
        ] = await Promise.all([
          // "Offene Anfragen" = Anfragen, zu denen es noch keine Offerte gibt.
          // Bis 2026-07-28 zaehlte hier lead_distributions — eine Tabelle aus dem
          // Marktplatz-Fork, die im Einzelmandanten 0 Zeilen hat. Die Kachel stand
          // deshalb strukturell auf null.
          supabase.from("leads").select("id").eq("company_id", company.id),

          supabase
            .from("offers")
            .select("lead_id")
            .eq("company_id", company.id)
            .not("lead_id", "is", null),

          supabase
            .from("offers")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .in("status", ["sent", "viewed"]),

          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .eq("appointment_type", "service")
            // appointment_date is a DATE column — compare with local yyyy-MM-dd strings.
            // toISOString() shifts local midnight to the previous UTC day in CET/CEST,
            // which pulled in the wrong calendar days.
            .gte("appointment_date", format(monthStart, "yyyy-MM-dd"))
            .lte("appointment_date", format(monthEnd, "yyyy-MM-dd"))
            .neq("status", "cancelled"),


          supabase
            .from("notifications")
            .select("id, type, title, body, metadata, created_at, read")
            .eq("company_id", company.id)
            .eq("type", "besichtigung_request")
            .order("created_at", { ascending: false })
            .limit(5),

          supabase
            .from("appointments")
            .select("offer_id")
            .eq("company_id", company.id)
            .eq("appointment_type", "besichtigung")
            .neq("status", "cancelled"),

          supabase
            .from("appointments")
            .select("id, title, appointment_date, appointment_type")
            .eq("company_id", company.id)
            .gte("appointment_date", format(todayStart, "yyyy-MM-dd"))
            .lte("appointment_date", format(todayEnd, "yyyy-MM-dd"))
            .neq("status", "cancelled")
            .order("appointment_date", { ascending: true })
            .limit(8),

          // Promise.resolve adopts the Supabase thenable into a real Promise so
          // .catch is available (PostgrestBuilder.then returns a PromiseLike). Behaviour
          // is unchanged: the query still runs in this Promise.all and errors still map
          // to { data: null, error } instead of rejecting the whole batch.
          Promise.resolve(
            supabase.rpc("get_box_rental_stats", { p_company_id: company.id })
          )
            .then(({ data, error }) => ({ data, error }))
            .catch((error) => ({ data: null, error })),
        ]);

        // Anfragen, zu denen bereits eine Offerte existiert — dieselbe Zuordnung,
        // die Anfragen.tsx fuer seine Gruppierung benutzt.
        const mitOfferte = new Set(
          (offertenLeadIds ?? []).map((o: { lead_id: string | null }) => o.lead_id).filter(Boolean),
        );


        const confirmedOfferIds = new Set(
          appointmentsForOffers?.map(a => a.offer_id).filter(Boolean) || []
        );

        const pendingBesichtigungen = (besichtigungNotifications || [])
          .filter(n => {
            const metadata = n.metadata as Record<string, unknown> | null;
            const offerId = metadata?.offer_id as string;
            return !confirmedOfferIds.has(offerId);
          })
          .map(n => {
            const metadata = n.metadata as Record<string, unknown> | null;
            return {
              id: metadata?.offer_id as string || n.id,
              notification_id: n.id,
              offer_id: metadata?.offer_id as string || "",
              // Empty when the notification carries no offer title — the fallback label is
              // resolved at render time so the effect stays independent of the locale.
              title: metadata?.offer_title as string || "",
              customer_name: metadata?.customer_name as string || "",
              customer_email: metadata?.customer_email as string || "",
              customer_phone: metadata?.customer_phone as string || null,
              besichtigung_date: metadata?.besichtigung_date as string || "",
              besichtigung_time: metadata?.besichtigung_time as string || null,
              customer_note: metadata?.customer_note as string || null,
              created_at: n.created_at || "",
            };
          });

        setBesichtigungRequests(pendingBesichtigungen);

        if (todayAppts) {
          setTodayAppointments(todayAppts as TodayAppointment[]);
        }

        if (boxStatsResult.data && boxStatsResult.data.length > 0) {
          setBoxStats(boxStatsResult.data[0] as BoxStats);
        }

        setStats({
          tokenBalance: 0,
          pendingLeads: (alleLeads ?? []).filter(
            (l: { id: string }) => !mitOfferte.has(l.id),
          ).length,
          openOffers: openOffersCount || 0,
          jobsThisMonth: jobsThisMonthCount || 0,
          besichtigungCount: pendingBesichtigungen.length,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, [user]);

  const formatTimestamp = (dateString: string) =>
    dateString ? formatDateTime(dateString, locale) : "";

  // Folk-style status chip

  const handleOpenAcceptDialog = (request: BesichtigungRequest) => {
    setSelectedBesichtigung(request);
    setIsAcceptDialogOpen(true);
  };

  /** The requested-visit sentence the operator reads in the accept dialog. */
  const buildRequestNote = (request: BesichtigungRequest) => {
    const date = request.besichtigung_date
      ? formatDate(request.besichtigung_date, locale)
      : "";
    const sentence = request.besichtigung_time
      ? t("dashboard.besichtigung.requestedOnAt", { date, time: request.besichtigung_time })
      : t("dashboard.besichtigung.requestedOn", { date });
    return request.customer_note ? `${sentence}. ${request.customer_note}` : sentence;
  };

  const getDialogRequest = (request: BesichtigungRequest | null) => {
    if (!request) return null;
    return {
      id: request.offer_id,
      title: request.title,
      customer_first_name: request.customer_name.split(" ")[0] || "",
      customer_last_name: request.customer_name.split(" ").slice(1).join(" ") || "",
      customer_email: request.customer_email,
      customer_phone: request.customer_phone,
      customer_response_note: buildRequestNote(request),
      // Structured slot — the dialog must not regex it back out of the sentence above,
      // which is written in the company's language (see AcceptBesichtigungDialog).
      besichtigung_requested_date: request.besichtigung_date,
      besichtigung_requested_time: request.besichtigung_time,
    };
  };

  const handleBesichtigungSuccess = () => {
    if (user) {
      window.location.reload();
    }
  };

  const today = formatWeekdayLong(new Date(), locale);
  const totalOpen = stats.pendingLeads + stats.openOffers + stats.besichtigungCount;

  // Folk-style KPI tiles — emoji-led, flat color, single coral accent on the highlight

  return (
    <>
      <Helmet>
        <title>{t("dashboard.pageTitle")}</title>
      </Helmet>

      <div className="space-y-6 md:space-y-8">
        {/* Seitenkopf.
         *
         * Auf dem Telefon war er vorher fast die halbe Bildschirmhöhe:
         * ein 4xl-Emoji, Titel, zweizeiliger Untertitel und zwei Knöpfe —
         * rund 470px, bevor die erste Kennzahl kam. Jetzt eine Zeile, der
         * Untertitel erst ab Tablet.
         *
         * Das Emoji ist ersatzlos weg: in dieser Oberfläche tragen Icons die
         * Bedeutung, nie Emoji (siehe Kopfkommentar in config/firmaNav.ts).
         * Der Bereich steht ausserdem schon in der Kopfleiste und in der
         * Tab-Leiste — ein drittes Mal braucht es ihn nicht.
         */}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-2">
          <h1 className="text-[22px] font-bold tracking-tight text-folk-ink shell-tablet:text-2xl">
            {t("dashboard.title")}
          </h1>
          <span className="text-[12px] text-folk-ink4 shell-tablet:text-[15px] shell-tablet:text-folk-ink3">
            {today} · <span className="font-mono">{totalOpen}</span> {t("dashboard.open")}
          </span>
          <div className="ml-auto flex shrink-0 gap-2">
            <Link to="/firma/anfragen">
              <Button className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[13.5px] font-semibold text-folk-bg hover:bg-folk-ink2 shell-tablet:text-[15px]">
                <span className="text-[14px] leading-none">+</span> {t("dashboard.action.newLead")}
              </Button>
            </Link>
            <Link to="/firma/offerten" className="hidden shell-tablet:block">
              <Button variant="outline" className="h-9 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm">
                {t("nav.offerten")}
              </Button>
            </Link>
          </div>
          <p className="hidden w-full text-[15px] text-folk-ink2 shell-tablet:block">
            {t("dashboard.subtitle")}
          </p>
        </div>

        {/* Kennzahlen — ein umrandeter Streifen ab 820px, darunter
            scrollende Kacheln. Werte aus useUebersichtData; Umsatz stammt aus
            finance_overview, nicht aus einer zweiten Rechnung. */}
        <KpiStrip kpis={kpis} />

        {/* Heute — soft mint accent */}
        {todayAppointments.length > 0 && (
          <section className="rounded-xl border border-folk-line bg-folk-card p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-2xl leading-none">📅</span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-folk-ink">{t("dashboard.today.title")}</h2>
                <p className="text-[11.5px] text-folk-ink3">
                  <span className="font-mono">{todayAppointments.length}</span>{" "}
                  {t("dashboard.today.scheduled", { count: todayAppointments.length })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {todayAppointments.map((appt) => {
                const apptTime = appt.appointment_date
                  ? formatClockTime(new Date(appt.appointment_date), locale)
                  : "";
                const typeEmoji: Record<string, string> = {
                  service: "🚚",
                  besichtigung: "🔎",
                  follow_up: "📞",
                };
                return (
                  <Link
                    key={appt.id}
                    to="/firma/kalender"
                    className="group flex items-center gap-3 rounded-lg border border-folk-line bg-folk-bg-warm p-3 transition-colors hover:border-folk-ink5 hover:bg-folk-bg"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-folk-card text-[16px]">
                      {typeEmoji[appt.appointment_type] ?? "🗓️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-folk-ink">{appt.title}</p>
                      <p className="mt-0.5 text-[13px] text-folk-ink3">
                        <span className="font-mono">{apptTime}</span>
                        {apptTime && " · "}
                        {getAppointmentTypeLabel(appt.appointment_type, locale)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-folk-ink4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Besichtigungsanfragen */}
        {besichtigungRequests.length > 0 && (
          <section className="rounded-xl border border-folk-line bg-folk-card p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-2xl leading-none">🔎</span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-folk-ink">{t("dashboard.besichtigung.title")}</h2>
                <p className="text-[11.5px] text-folk-ink3">{t("dashboard.besichtigung.subtitle")}</p>
              </div>
            </div>

            <div className="space-y-3">
              {besichtigungRequests.map((request) => (
                  <div
                    key={request.notification_id}
                    className="flex flex-col gap-4 rounded-lg border border-folk-line bg-folk-bg-warm p-4 lg:flex-row lg:items-center"
                  >
                    <div className="flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-folk-sky-bg px-2 py-0.5 text-[13px] font-semibold text-folk-sky">
                          🔎 {t("domain.appointmentType.besichtigung")}
                        </span>
                        <span className="font-mono text-[10.5px] text-folk-ink4">{formatTimestamp(request.created_at)}</span>
                      </div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-folk-ink">
                        {request.title || t("domain.appointmentType.besichtigung")}
                      </h3>
                      <p className="mt-0.5 text-[14px] text-folk-ink3">{request.customer_name}</p>
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-folk-line bg-folk-card px-2.5 py-2 text-[14px] text-folk-ink2">
                        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-folk-sky" />
                        <span>{buildRequestNote(request)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg bg-folk-ink px-3 text-[14px] font-semibold text-folk-bg hover:bg-folk-ink2"
                        onClick={() => handleOpenAcceptDialog(request)}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" />
                        {t("common.confirm")}
                      </Button>
                      {request.customer_phone && (
                        <a href={`tel:${request.customer_phone}`}>
                          <Button variant="outline" size="sm" className="h-8 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm">
                            <Phone className="mr-1.5 h-3.5 w-3.5" />
                            {t("misc.contact.call")}
                          </Button>
                        </a>
                      )}
                      {request.offer_id && (
                        <Link to={`/firma/offerten/${request.offer_id}`}>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm">
                            {t("dashboard.besichtigung.openOffer")}
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          </section>
        )}

        {/* Letzte Anfragen + Right Rail */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          {/* Aktive Vorgaenge — je Anfrage genau einer, mit den Werten der
              aktuellen Offerten-Revision. Das Theme entscheidet ueber Raster
              oder Liste, der Breakpoint ueber die Dichte (CSS, nicht JS). */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-tight text-folk-ink">
                {t("uebersicht.section.aktiveVorgaenge")}
              </h2>
              <Link
                to="/firma/anfragen"
                className="shrink-0 text-[12px] font-semibold text-folk-mint"
              >
                {t("uebersicht.section.alleAnzeigen", { count: String(workItems.length) })}
              </Link>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {VORGANG_FILTER.map((option) => {
                const active = option === vorgangFilter;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVorgangFilter(option)}
                    aria-pressed={active}
                    className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[12px] transition-colors ${
                      active
                        ? "bg-folk-ink font-semibold text-folk-bg"
                        : "border border-folk-line bg-folk-card text-folk-ink3"
                    }`}
                  >
                    {t(`uebersicht.filter.${option}` as MessageKey)}
                  </button>
                );
              })}
            </div>

            {sichtbareVorgaenge.length > 0 ? (
              <WorkItems
                items={sichtbareVorgaenge}
                variant={resolvedTheme === "dark" ? "list" : "grid"}
              />
            ) : (
              <div className="rounded-2xl border border-folk-line bg-folk-card p-8 text-center">
                <p className="text-[15px] font-semibold text-folk-ink">
                  {t("uebersicht.empty.title")}
                </p>
                <p className="mt-1 text-[12.5px] text-folk-ink3">{t("uebersicht.empty.body")}</p>
              </div>
            )}
          </section>

          {/* Right rail */}
          <aside className="space-y-4">
            {boxStats && (boxStats.total_active > 0 || boxStats.overdue > 0) && (
              <section className="rounded-xl border border-folk-line bg-folk-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">📦</span>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-folk-ink">{t("nav.umzugsboxen")}</h3>
                      <p className="text-[10.5px] text-folk-ink4">{t("dashboard.boxes.subtitle")}</p>
                    </div>
                  </div>
                  {boxStats.overdue > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-folk-coral-bg px-2 py-0.5 text-[10.5px] font-semibold text-folk-coral">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-mono">{boxStats.overdue}</span> {t("boxes.stats.overdue")}
                    </span>
                  )}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-folk-line bg-folk-bg-warm p-3">
                    <p className="text-[10.5px] uppercase tracking-wider text-folk-ink3">{t("boxes.kpi.active")}</p>
                    <p className="mt-1 font-sans text-xl font-bold tracking-tight text-folk-ink">{boxStats.total_active}</p>
                  </div>
                  <div className="rounded-lg border border-folk-line bg-folk-bg-warm p-3">
                    <p className="text-[10.5px] uppercase tracking-wider text-folk-ink3">{t("boxes.kpi.pickupToday")}</p>
                    <p className="mt-1 font-sans text-xl font-bold tracking-tight text-folk-coral">{boxStats.pickup_today}</p>
                  </div>
                </div>

                <Link to="/firma/umzugsboxen" className="block">
                  <Button variant="outline" className="group h-9 w-full rounded-lg border-folk-line bg-folk-card text-[14px] font-medium text-folk-ink2 hover:bg-folk-bg-warm">
                    <Package className="mr-2 h-3.5 w-3.5 text-folk-ink3" />
                    {t("dashboard.boxes.manage")}
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-folk-ink4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </section>
            )}

            {stats.pendingLeads > 0 && (
              <Link to="/firma/anfragen" className="block">
                <section className="group rounded-xl border border-folk-coral/30 bg-folk-coral-bg p-5 ring-1 ring-folk-coral/20 transition-all hover:ring-folk-coral/40">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-folk-card text-[20px] shadow-[0_1px_2px_rgba(24,24,26,0.04)] transition-transform group-hover:scale-105">
                      📥
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-bold tracking-tight text-folk-ink">
                        <span className="font-mono">{stats.pendingLeads}</span>{" "}
                        {t("dashboard.pendingLeads", { count: stats.pendingLeads })}
                      </p>
                      <p className="mt-0.5 text-[13px] text-folk-ink2">{t("dashboard.pendingLeads.hint")}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-folk-coral transition-transform group-hover:translate-x-1" />
                  </div>
                </section>
              </Link>
            )}

            {/* Empty-state filler when right rail is otherwise empty */}
            {!(boxStats && (boxStats.total_active > 0 || boxStats.overdue > 0)) && stats.pendingLeads === 0 && (
              <section className="rounded-xl border border-folk-line bg-folk-card p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">✨</span>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-folk-ink">{t("dashboard.allClear.title")}</h3>
                    <p className="text-[13px] text-folk-ink3">{t("dashboard.allClear.description")}</p>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-folk-line bg-folk-card p-5">
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{t("dashboard.quickAccess")}</h3>
              <div className="space-y-1">
                <Link to="/firma/offerten" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm">
                  <span>📄</span><span className="flex-1">{t("nav.offerten")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-folk-ink4" />
                </Link>
                <Link to="/firma/kalender" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm">
                  <span>📅</span><span className="flex-1">{t("nav.kalender")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-folk-ink4" />
                </Link>
                <Link to="/firma/team" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm">
                  <span>👥</span><span className="flex-1">{t("nav.team")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-folk-ink4" />
                </Link>
                <Link to="/firma/einstellungen" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm">
                  <span>⚙️</span><span className="flex-1">{t("nav.einstellungen")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-folk-ink4" />
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AcceptBesichtigungDialog
        isOpen={isAcceptDialogOpen}
        onClose={() => setIsAcceptDialogOpen(false)}
        request={getDialogRequest(selectedBesichtigung)}
        companyId={companyId}
        onSuccess={handleBesichtigungSuccess}
      />
    </>
  );
};

export default FirmaDashboard;
