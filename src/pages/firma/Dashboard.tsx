import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Coins, 
  CheckCircle, 
  ArrowRight, 
  Eye, 
  Calendar, 
  Phone, 
  CalendarCheck, 
  MapPin,
  Sparkles,
  Zap,
  ChevronRight,
  ArrowUpRight,
  Package,
  AlertTriangle,
  Truck,
  ClipboardList,
  X,
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { AcceptBesichtigungDialog } from "@/components/firma/AcceptBesichtigungDialog";

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

const FirmaDashboard = () => {
  const { user } = useAuth();
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
  const [showTokenBanner, setShowTokenBanner] = useState(false);

  const LOW_TOKEN_THRESHOLD = 50;

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

        // Date helpers for queries
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);

        // PARALLEL QUERIES - run all queries concurrently
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
          // 1. Neue Anfragen: pending lead distributions (not yet expired)
          supabase
            .from("lead_distributions")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .eq("status", "sent")
            .gt("expires_at", new Date().toISOString()),

          // 2. Offene Offerten: sent or viewed (awaiting customer response)
          supabase
            .from("offers")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .in("status", ["sent", "viewed"]),

          // 3. Aufträge diesen Monat: service appointments this month
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .eq("appointment_type", "service")
            .gte("appointment_date", monthStart.toISOString())
            .lte("appointment_date", monthEnd.toISOString())
            .neq("status", "cancelled"),

          // 4. Recent distributions with lead data (avoids N+1 via join)
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

          // 5. Besichtigung notifications
          supabase
            .from("notifications")
            .select("id, type, title, body, metadata, created_at, read")
            .eq("company_id", company.id)
            .eq("type", "besichtigung_request")
            .order("created_at", { ascending: false })
            .limit(5),

          // 6. Appointments for besichtigung filtering
          supabase
            .from("appointments")
            .select("offer_id")
            .eq("company_id", company.id)
            .eq("appointment_type", "besichtigung")
            .neq("status", "cancelled"),

          // 7. Today's appointments
          supabase
            .from("appointments")
            .select("id, title, appointment_date, appointment_type")
            .eq("company_id", company.id)
            .gte("appointment_date", todayStart.toISOString())
            .lte("appointment_date", todayEnd.toISOString())
            .neq("status", "cancelled")
            .order("appointment_date", { ascending: true })
            .limit(8),

          // 8. Box stats (inside try-catch)
          supabase
            .rpc("get_box_rental_stats", { p_company_id: company.id })
            .then(({ data, error }) => ({ data, error }))
            .catch((error) => ({ data: null, error })),
        ]);

        // Process recent leads (JOIN'dan gelen data)
        if (distributions && distributions.length > 0) {
          const recentWithDetails = distributions.map((d: { id: string; status: string; sent_at: string; leads: { service_type?: string; from_city?: string; to_city?: string; distance_km?: number; estimated_duration_minutes?: number; created_at?: string } | null }) => {
            const lead = d.leads;
            return {
              id: d.id,
              service_type: lead?.service_type || "Unbekannt",
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

        // Process besichtigung requests
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
              title: metadata?.offer_title as string || "Besichtigung",
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

        // Today's appointments
        if (todayAppts) {
          setTodayAppointments(todayAppts as TodayAppointment[]);
        }

        // Box stats
        if (boxStatsResult.data && boxStatsResult.data.length > 0) {
          setBoxStats(boxStatsResult.data[0] as BoxStats);
        }

        setStats({
          tokenBalance: 0, // CRM-FORK: no token balance in standalone CRM
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Neu
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-2.5 h-2.5" />
            Akzeptiert
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
            Abgelehnt
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenAcceptDialog = (request: BesichtigungRequest) => {
    setSelectedBesichtigung(request);
    setIsAcceptDialogOpen(true);
  };
  
  // Transform request for AcceptBesichtigungDialog
  const getDialogRequest = (request: BesichtigungRequest | null) => {
    if (!request) return null;
    return {
      id: request.offer_id,
      title: request.title,
      customer_first_name: request.customer_name.split(" ")[0] || "",
      customer_last_name: request.customer_name.split(" ").slice(1).join(" ") || "",
      customer_email: request.customer_email,
      customer_phone: request.customer_phone,
      customer_response_note: `Besichtigung gewünscht am ${request.besichtigung_date ? new Date(request.besichtigung_date).toLocaleDateString("de-CH") : ""}${request.besichtigung_time ? ` um ${request.besichtigung_time} Uhr` : ""}${request.customer_note ? `. ${request.customer_note}` : ""}`,
    };
  };

  const handleBesichtigungSuccess = () => {
    if (user) {
      window.location.reload();
    }
  };

  // Stats card configurations — CRM-FORK: removed Token-Guthaben card
  const statsConfig = [
    {
      title: "Neue Anfragen",
      value: stats.pendingLeads,
      icon: Sparkles,
      gradient: "from-violet-500 to-purple-500",
      bgGradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
      textColor: "text-violet-600 dark:text-violet-400",
      link: "/firma/anfragen",
      highlight: stats.pendingLeads > 0,
    },
    {
      title: "Offene Offerten",
      value: stats.openOffers,
      icon: ClipboardList,
      gradient: "from-emerald-500 to-green-500",
      bgGradient: "from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
      iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
      link: "/firma/offerten",
      subtitle: "Warten auf Antwort",
    },
    {
      title: "Aufträge diesen Monat",
      value: stats.jobsThisMonth,
      icon: Truck,
      gradient: "from-slate-500 to-slate-600",
      bgGradient: "from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50",
      iconBg: "bg-gradient-to-br from-slate-400 to-slate-500",
      textColor: "text-slate-600 dark:text-slate-400",
      link: "/firma/kalender",
    },
    {
      title: "Besichtigungen",
      value: stats.besichtigungCount,
      icon: Eye,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
      iconBg: "bg-gradient-to-br from-blue-400 to-cyan-500",
      textColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | Firma</title>
      </Helmet>
        <div className="space-y-6 md:space-y-8">
          {/* CRM-FORK: removed Low Token Banner */}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {statsConfig.map((stat, index) => {
              const IconComponent = stat.icon;
              const content = (
                <div
                  className={`
                    group relative overflow-hidden rounded-xl p-4 md:p-5
                    bg-gradient-to-br ${stat.bgGradient}
                    border border-slate-200/50 dark:border-slate-700/50
                    transition-all duration-300 ease-out
                    hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50
                    hover:scale-[1.02] hover:-translate-y-0.5
                    ${stat.highlight ? 'ring-2 ring-violet-400/50 ring-offset-2' : ''}
                  `}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Decorative gradient orb */}
                  <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
                  
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] md:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {stat.title}
                      </span>
                      <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-lg`}>
                        <IconComponent className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                    </div>
                    <div className={`text-2xl md:text-3xl font-bold ${stat.textColor} tracking-tight`}>
                      {isLoading ? (
                        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      ) : (
                        stat.value.toLocaleString("de-CH")
                      )}
                    </div>
                    {'subtitle' in stat && stat.subtitle && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{stat.subtitle}</p>
                    )}
                    {stat.link && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                        <span>Details</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
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

          {/* Heute Widget */}
          {todayAppointments.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 via-green-50/40 to-transparent dark:from-emerald-950/30 dark:via-green-950/20 dark:to-transparent p-5 md:p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/10 to-green-400/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Heute</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {todayAppointments.length} {todayAppointments.length === 1 ? "Termin" : "Termine"} heute
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {todayAppointments.map((appt) => {
                    const apptTime = appt.appointment_date
                      ? new Date(appt.appointment_date).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
                      : "";
                    const typeIcons: Record<string, React.ReactNode> = {
                      service: <Truck className="w-4 h-4 text-emerald-600" />,
                      besichtigung: <Eye className="w-4 h-4 text-blue-600" />,
                      follow_up: <Phone className="w-4 h-4 text-violet-600" />,
                    };
                    const typeLabels: Record<string, string> = {
                      service: "Umzug/Service",
                      besichtigung: "Besichtigung",
                      follow_up: "Follow-up",
                    };
                    return (
                      <Link
                        key={appt.id}
                        to="/firma/kalender"
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900 hover:shadow-md transition-all duration-200"
                      >
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                          {typeIcons[appt.appointment_type] ?? <Calendar className="w-4 h-4 text-slate-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{appt.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {typeLabels[appt.appointment_type] ?? "Termin"}{apptTime ? ` · ${apptTime}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Besichtigung Requests Section */}
          {besichtigungRequests.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-cyan-50/50 to-transparent dark:from-blue-950/30 dark:via-cyan-950/20 dark:to-transparent p-5 md:p-6">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Besichtigungsanfragen</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Kunden wünschen vor der Auftragserteilung eine Besichtigung
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {besichtigungRequests.map((request) => {
                    const formattedBesichtigungDate = request.besichtigung_date 
                      ? new Date(request.besichtigung_date).toLocaleDateString("de-CH")
                      : "";
                    
                    return (
                      <div
                        key={request.notification_id}
                        className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200">
                                <Eye className="w-3 h-3" />
                                Besichtigung
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(request.created_at)}
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-1">{request.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {request.customer_name}
                            </p>
                            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                              <Calendar className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                Besichtigung gewünscht am {formattedBesichtigungDate}
                                {request.besichtigung_time && ` um ${request.besichtigung_time} Uhr`}
                                {request.customer_note && `. ${request.customer_note}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              size="sm" 
                              className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/20"
                              onClick={() => handleOpenAcceptDialog(request)}
                            >
                              <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                              Bestätigen
                            </Button>
                            {request.customer_phone && (
                              <a href={`tel:${request.customer_phone}`}>
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                                  Anrufen
                                </Button>
                              </a>
                            )}
                            {request.offer_id && (
                              <Link to={`/firma/offerten/${request.offer_id}`}>
                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                  Offerte
                                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Recent Leads Card */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-secondary/80 to-secondary/60" />
              
              <div className="p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center shadow-lg shadow-secondary/20">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Letzte Anfragen</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ihre neuesten Leads</p>
                    </div>
                  </div>
                  <Link to="/firma/anfragen">
                    <Button variant="outline" size="sm" className="h-8 text-xs group">
                      Alle anzeigen
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </div>

                {recentLeads.length > 0 ? (
                  <div className="space-y-2">
                    {recentLeads.map((lead, index) => (
                      <div
                        key={lead.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-all duration-200"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileText className="w-5 h-5 text-secondary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{lead.service_type}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <MapPin className="w-3 h-3" />
                              <span>{lead.from_city}</span>
                              {lead.to_city && (
                                <>
                                  <ArrowRight className="w-3 h-3" />
                                  <span>{lead.to_city}</span>
                                </>
                              )}
                            </div>
                            {lead.distance_km && (
                              <div className="flex items-center gap-1.5 text-[10px] text-secondary mt-0.5">
                                <span className="font-medium">{lead.distance_km.toFixed(1)} km</span>
                                {lead.estimated_duration_minutes && (
                                  <span className="text-slate-400">
                                    (~{Math.round(lead.estimated_duration_minutes)} Min.)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 sm:mt-0 pl-13 sm:pl-0">
                          {getStatusBadge(lead.status)}
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatDate(lead.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine Anfragen erhalten</p>
                    <p className="text-xs text-slate-400 mt-1">Neue Leads erscheinen hier automatisch</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              {/* Umzugsboxen Widget */}
              {boxStats && (boxStats.total_active > 0 || boxStats.overdue > 0) && (
                <div className="relative overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Umzugsboxen</h3>
                        <p className="text-[10px] text-slate-500">Offene Vermietungen</p>
                      </div>
                    </div>
                    {boxStats.overdue > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {boxStats.overdue} überfällig
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-900">
                      <p className="text-[10px] text-slate-500 mb-1">Aktiv</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{boxStats.total_active}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-900">
                      <p className="text-[10px] text-slate-500 mb-1">Heute abholen</p>
                      <p className="text-xl font-bold text-orange-600">{boxStats.pickup_today}</p>
                    </div>
                  </div>
                  
                  <Link to="/firma/umzugsboxen" className="block">
                    <Button variant="outline" className="w-full h-9 text-xs group border-orange-200 dark:border-orange-800 hover:bg-orange-100/50 dark:hover:bg-orange-900/30">
                      <Package className="w-3.5 h-3.5 mr-2 text-orange-500" />
                      Boxen verwalten
                      <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </div>
              )}

              {/* Neue Anfragen CTA — shown when pending leads exist */}
              {stats.pendingLeads > 0 && (
                <Link to="/firma/anfragen" className="block">
                  <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20 p-5 hover:shadow-lg transition-all duration-200 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {stats.pendingLeads} neue {stats.pendingLeads === 1 ? "Anfrage" : "Anfragen"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Jetzt prüfen und reagieren</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-violet-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Accept Besichtigung Dialog */}
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
