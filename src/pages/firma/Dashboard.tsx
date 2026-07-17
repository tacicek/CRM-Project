import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calendar,
  Phone,
  CalendarCheck,
  MapPin,
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
import { formatDate, formatDateTime, formatNumber } from "@/i18n/format";
import { getAppointmentTypeLabel, getServiceLabel } from "@/i18n/domain";

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
  pickup_today: number;
}

interface RecentLead {
  id: string;
  service_type: string;
  from_city: string;
  to_city: string | null;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  created_at: string;
  status: string;
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
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [besichtigungRequests, setBesichtigungRequests] = useState<BesichtigungRequest[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBesichtigung, setSelectedBesichtigung] = useState<BesichtigungRequest | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [boxStats, setBoxStats] = useState<BoxStats | null>(null);

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
          { count: pendingCount },
          { count: openOffersCount },
          { count: jobsThisMonthCount },
          { data: distributions },
          { data: besichtigungNotifications },
          { data: appointmentsForOffers },
          { data: todayAppts },
          boxStatsResult,
        ] = await Promise.all([
          supabase
            .from("lead_distributions")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .eq("status", "sent")
            .gt("expires_at", new Date().toISOString()),

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
            .from("lead_distributions")
            .select(`
              id,
              status,
              sent_at,
              lead_id,
              leads:lead_id (
                id,
                service_type,
                from_city,
                to_city,
                distance_km,
                estimated_duration_minutes,
                created_at
              )
            `)
            .eq("company_id", company.id)
            .order("sent_at", { ascending: false })
            .limit(5),

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

        if (distributions && distributions.length > 0) {
          const recentWithDetails = distributions.map((d: { id: string; status: string; sent_at: string; leads: { service_type?: string; from_city?: string; to_city?: string; distance_km?: number; estimated_duration_minutes?: number; created_at?: string } | null }) => {
            const lead = d.leads;
            return {
              id: d.id,
              // Raw DB value — the label is resolved per render via getServiceLabel(…, locale).
              service_type: lead?.service_type || "",
              from_city: lead?.from_city || "",
              to_city: lead?.to_city || null,
              distance_km: lead?.distance_km ? Number(lead.distance_km) : null,
              estimated_duration_minutes: lead?.estimated_duration_minutes || null,
              created_at: d.sent_at || "",
              status: d.status || "pending",
            };
          });
          setRecentLeads(recentWithDetails);
        }

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
          pendingLeads: pendingCount || 0,
          openOffers: openOffersCount || 0,
          jobsThisMonth: jobsThisMonthCount || 0,
          besichtigungCount: pendingBesichtigungen.length,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const formatTimestamp = (dateString: string) =>
    dateString ? formatDateTime(dateString, locale) : "";

  // Folk-style status chip
  const getStatusChip = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-folk-coral-bg px-2 py-0.5 text-[13px] font-semibold text-folk-coral">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-folk-coral" />
            {t("dashboard.leadStatus.sent")}
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-folk-mint-bg px-2 py-0.5 text-[13px] font-semibold text-folk-mint">
            ✓ {t("dashboard.leadStatus.accepted")}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-md bg-folk-bg-warm px-2 py-0.5 text-[13px] font-medium text-folk-ink3">
            {t("dashboard.leadStatus.rejected")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-folk-line bg-folk-card px-2 py-0.5 text-[13px] text-folk-ink2">
            {status}
          </span>
        );
    }
  };

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
  const statsConfig = [
    {
      emoji: "📥",
      title: t("dashboard.kpi.newLeads"),
      value: stats.pendingLeads,
      link: "/firma/anfragen",
      highlight: stats.pendingLeads > 0,
      hint: t("dashboard.kpi.newLeadsHint"),
    },
    {
      emoji: "📄",
      title: t("dashboard.kpi.openOffers"),
      value: stats.openOffers,
      link: "/firma/offerten",
      hint: t("dashboard.kpi.openOffersHint"),
    },
    {
      emoji: "🚚",
      title: t("dashboard.kpi.jobsThisMonth"),
      value: stats.jobsThisMonth,
      link: "/firma/kalender",
      hint: t("dashboard.kpi.jobsThisMonthHint"),
    },
    {
      emoji: "🔎",
      title: t("dashboard.kpi.besichtigungen"),
      value: stats.besichtigungCount,
      hint: t("dashboard.kpi.besichtigungenHint"),
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t("dashboard.pageTitle")}</title>
      </Helmet>

      <div className="space-y-6 md:space-y-8">
        {/* Page header — Folk style */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">🏠</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">{t("dashboard.title")}</h1>
              <span className="text-[15px] text-folk-ink3">
                {today} · <span className="font-mono">{totalOpen}</span> {t("dashboard.open")}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/firma/anfragen">
              <Button className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2">
                <span className="text-[14px] leading-none">+</span> {t("dashboard.action.newLead")}
              </Button>
            </Link>
            <Link to="/firma/offerten">
              <Button variant="outline" className="h-9 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm">
                {t("nav.offerten")}
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Grid — Folk style: flat white cards with single accent */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {statsConfig.map((stat) => {
            const content = (
              <div
                className={`group relative h-full overflow-hidden rounded-xl border bg-folk-card p-4 transition-all duration-200 md:p-5 ${
                  stat.highlight ? "border-folk-coral/30 ring-1 ring-folk-coral/20" : "border-folk-line"
                } hover:border-folk-ink5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{stat.title}</span>
                  <span className="text-xl leading-none">{stat.emoji}</span>
                </div>
                <div className="mt-3 font-sans text-3xl font-bold tracking-tight text-folk-ink">
                  {isLoading ? (
                    <div className="h-8 w-12 animate-pulse rounded bg-folk-bg-warm" />
                  ) : (
                    formatNumber(stat.value, locale)
                  )}
                </div>
                {stat.hint && (
                  <p className="mt-1 text-[13px] text-folk-ink4">{stat.hint}</p>
                )}
                {stat.link && (
                  <div className="mt-2 flex items-center gap-1 text-[13px] text-folk-ink4 transition-colors group-hover:text-folk-coral">
                    <span>{t("common.details")}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            );

            return stat.link ? (
              <Link key={stat.title} to={stat.link} className="block">
                {content}
              </Link>
            ) : (
              <div key={stat.title}>{content}</div>
            );
          })}
        </div>

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
                        className="h-8 gap-1.5 rounded-lg bg-folk-ink px-3 text-[14px] font-semibold text-white hover:bg-folk-ink2"
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
          {/* Letzte Anfragen */}
          <section className="rounded-xl border border-folk-line bg-folk-card p-5 md:p-6 lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">⚡</span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-folk-ink">{t("dashboard.recentLeads.title")}</h2>
                  <p className="text-[11.5px] text-folk-ink3">{t("dashboard.recentLeads.subtitle")}</p>
                </div>
              </div>
              <Link to="/firma/anfragen">
                <Button variant="outline" size="sm" className="group h-8 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm">
                  {t("dashboard.recentLeads.showAll")}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>

            {recentLeads.length > 0 ? (
              <div className="space-y-1.5">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="group flex flex-col justify-between gap-2 rounded-lg border border-transparent bg-folk-bg-warm p-3 transition-colors hover:border-folk-line hover:bg-folk-bg sm:flex-row sm:items-center md:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-folk-coral-bg text-[16px]">
                        📄
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-folk-ink">
                          {getServiceLabel(lead.service_type, locale)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-folk-ink3">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{lead.from_city}</span>
                          {lead.to_city && (
                            <>
                              <ArrowRight className="h-3 w-3" />
                              <span className="truncate">{lead.to_city}</span>
                            </>
                          )}
                        </div>
                        {lead.distance_km && (
                          <div className="mt-0.5 text-[10.5px] text-folk-ink4">
                            <span className="font-mono font-medium text-folk-coral">{lead.distance_km.toFixed(1)} km</span>
                            {lead.estimated_duration_minutes && (
                              <span className="ml-1.5">
                                (~<span className="font-mono">{Math.round(lead.estimated_duration_minutes)}</span>{" "}
                                {t("dashboard.minutesShort")})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-12 sm:pl-0">
                      {getStatusChip(lead.status)}
                      <span className="whitespace-nowrap font-mono text-[10.5px] text-folk-ink4">
                        {formatTimestamp(lead.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">📭</div>
                <p className="text-[15px] text-folk-ink3">{t("dashboard.recentLeads.empty")}</p>
                <p className="mt-1 text-[13px] text-folk-ink4">{t("dashboard.recentLeads.emptyHint")}</p>
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
