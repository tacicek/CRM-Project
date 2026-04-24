import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Building2, Users, TrendingUp, Coins, Clock, ArrowUpRight, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface WeeklyData {
  name: string;
  leads: number;
}

interface ServiceData {
  name: string;
  count: number;
}

interface RecentActivity {
  id: string;
  type: "lead" | "company" | "transaction";
  title: string;
  description: string;
  time: string;
  created_at: string; // Raw ISO timestamp for correct sorting
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalCompanies: 0,
    pendingLeads: 0,
    activeCompanies: 0,
    totalTokens: 0,
    todayLeads: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [serviceData, setServiceData] = useState<ServiceData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        // Fetch leads count
        const { count: leadsCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .neq("source", "import");

        // Fetch pending leads count
        const { count: pendingCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .neq("source", "import");

        // Fetch companies count
        const { count: companiesCount } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true });

        // Fetch active companies count
        const { count: activeCompaniesCount } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        // Fetch total tokens across all companies
        const { data: companiesData } = await supabase
          .from("companies")
          .select("token_balance");

        const totalTokens = companiesData?.reduce((sum, c) => sum + Number(c.token_balance || 0), 0) || 0;

        // Fetch today's leads
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString())
          .neq("source", "import");

        // Fetch leads for weekly chart
        const { data: leadsData } = await supabase
          .from("leads")
          .select("created_at, service_type")
          .neq("source", "import")
          .order("created_at", { ascending: true });

        // Process weekly data — use ISO date as key to avoid same-day-name collision
        const weekMap = new Map<string, { label: string; count: number }>();
        const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          const isoKey = date.toISOString().slice(0, 10);
          const dayLabel = days[date.getDay()];
          weekMap.set(isoKey, { label: dayLabel, count: 0 });
        }

        leadsData?.forEach((lead) => {
          const date = new Date(lead.created_at);
          const isoKey = date.toISOString().slice(0, 10);
          if (weekMap.has(isoKey)) {
            weekMap.get(isoKey)!.count++;
          }
        });

        const weekly = Array.from(weekMap.values()).map(({ label, count }) => ({ name: label, leads: count }));

        // Process service distribution
        const serviceMap = new Map<string, number>();
        leadsData?.forEach((lead) => {
          const service = lead.service_type || "Andere";
          serviceMap.set(service, (serviceMap.get(service) || 0) + 1);
        });

        const services = Array.from(serviceMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Fetch recent activity
        const { data: recentLeads } = await supabase
          .from("leads")
          .select("id, slug, service_type, customer_first_name, created_at")
          .neq("source", "import")
          .order("created_at", { ascending: false })
          .limit(5);

        const { data: recentCompanies } = await supabase
          .from("companies")
          .select("id, company_name, created_at")
          .order("created_at", { ascending: false })
          .limit(3);

        const activities: RecentActivity[] = [];

        recentLeads?.forEach((lead) => {
          activities.push({
            id: lead.id,
            type: "lead",
            title: `Neue Anfrage: ${lead.service_type}`,
            description: `von ${lead.customer_first_name}`,
            time: formatTimeAgo(new Date(lead.created_at)),
            created_at: lead.created_at,
          });
        });

        recentCompanies?.forEach((company) => {
          activities.push({
            id: company.id,
            type: "company",
            title: `Neue Firma registriert`,
            description: company.company_name,
            time: formatTimeAgo(new Date(company.created_at)),
            created_at: company.created_at,
          });
        });

        // Sort by actual timestamp, not by formatted string
        activities.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        if (!isMounted) return;
        setStats({
          totalLeads: leadsCount || 0,
          totalCompanies: companiesCount || 0,
          pendingLeads: pendingCount || 0,
          activeCompanies: activeCompaniesCount || 0,
          totalTokens,
          todayLeads: todayCount || 0,
        });
        setWeeklyData(weekly);
        setServiceData(services);
        setRecentActivity(activities.slice(0, 8));
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min`;
    if (diffHours < 24) return `vor ${diffHours} Std`;
    return `vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
  };

  // Material Design 3 stat cards with filled container style
  const statCards = [
    {
      title: "Gesamt Leads",
      value: stats.totalLeads,
      icon: FileText,
      containerColor: "bg-secondary/10",
      iconColor: "text-secondary",
      link: "/admin/leads",
    },
    {
      title: "Offene Leads",
      value: stats.pendingLeads,
      icon: TrendingUp,
      containerColor: "bg-warning/10",
      iconColor: "text-warning",
      link: "/admin/leads",
    },
    {
      title: "Aktive Firmen",
      value: stats.activeCompanies,
      icon: Building2,
      containerColor: "bg-accent/10",
      iconColor: "text-accent",
      link: "/admin/companies",
    },
    {
      title: "Token im Umlauf",
      value: stats.totalTokens,
      icon: Coins,
      containerColor: "bg-primary/10",
      iconColor: "text-primary",
      link: "/admin/token-packages",
    },
    {
      title: "Heute neu",
      value: stats.todayLeads,
      icon: Clock,
      containerColor: "bg-secondary/10",
      iconColor: "text-secondary",
      link: "/admin/leads",
    },
    {
      title: "Gesamt Firmen",
      value: stats.totalCompanies,
      icon: Users,
      containerColor: "bg-muted",
      iconColor: "text-muted-foreground",
      link: "/admin/companies",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6 md:space-y-8">
          {/* Material Design 3: Headline with supporting text */}
          <header className="space-y-1">
            <h1 className="text-2xl md:text-[28px] font-normal tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Übersicht über alle Leads und Firmen
            </p>
          </header>

          {/* Material Design 3: Metric Cards Grid with elevated surface */}
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            {statCards.map((stat, index) => (
              <Link to={stat.link} key={index} className="group">
                <Card className="relative overflow-hidden border-0 bg-card shadow-sm hover:shadow-md transition-all duration-200 h-full">
                  {/* State layer for interaction */}
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/[0.08] transition-colors duration-200" />
                  
                  <CardContent className="p-4 md:p-5 relative">
                    {/* Icon container - Material Design 3 style */}
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl ${stat.containerColor} flex items-center justify-center mb-3 md:mb-4`}>
                      <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.iconColor}`} />
                    </div>
                    
                    {/* Value - Display Large style */}
                    <p className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-1">
                      {isLoading ? "–" : stat.value.toLocaleString("de-CH")}
                    </p>
                    
                    {/* Label - Label Medium style */}
                    <p className="text-xs md:text-sm text-muted-foreground font-medium">
                      {stat.title}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>

          {/* Material Design 3: Charts Section with outlined cards */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Weekly Leads Chart */}
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-2 md:pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base md:text-lg font-medium">
                      Leads diese Woche
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Anzahl neuer Anfragen pro Tag
                    </CardDescription>
                  </div>
                  <Link 
                    to="/admin/leads" 
                    className="p-2 rounded-full hover:bg-muted/80 transition-colors"
                    title="Zu Leads"
                  >
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[200px] md:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        dy={8}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          padding: "12px 16px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500, marginBottom: 4 }}
                        itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="leads"
                        stroke="hsl(var(--secondary))"
                        strokeWidth={2.5}
                        dot={{ fill: "hsl(var(--secondary))", strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, fill: "hsl(var(--secondary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        name="Leads"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Services Chart */}
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-2 md:pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base md:text-lg font-medium">
                      Top Services
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Beliebteste Service-Kategorien
                    </CardDescription>
                  </div>
                  <Link 
                    to="/admin/analytics" 
                    className="p-2 rounded-full hover:bg-muted/80 transition-colors"
                    title="Zu Analytics"
                  >
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[200px] md:h-[280px]">
                  {serviceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceData} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px 16px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500, marginBottom: 4 }}
                          itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                        />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--accent))"
                          radius={[6, 6, 0, 0]}
                          name="Anzahl"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Keine Daten verfügbar
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Material Design 3: Bottom Section with Lists */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Recent Activity - Material Design 3 List */}
            <Card className="lg:col-span-2 border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base md:text-lg font-medium">
                      Letzte Aktivitäten
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Neueste Ereignisse auf der Plattform
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-border">
                    {recentActivity.map((activity) => (
                      <div 
                        key={`${activity.type}-${activity.id}`}
                        className="flex items-start sm:items-center gap-3 md:gap-4 py-3 md:py-4 first:pt-0 last:pb-0"
                      >
                        {/* Leading element - Avatar/Icon */}
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ${
                          activity.type === "lead" ? "bg-secondary/10" : "bg-accent/10"
                        }`}>
                          {activity.type === "lead" ? (
                            <FileText className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                          ) : (
                            <Building2 className="w-5 h-5 md:w-6 md:h-6 text-accent" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base font-medium text-foreground truncate">
                            {activity.title}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        </div>
                        
                        {/* Trailing element - Time */}
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-1 sm:pt-0">
                          {activity.time}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Noch keine Aktivitäten</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions - Material Design 3 Navigation Rail style */}
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg font-medium">
                  Schnellzugriff
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <nav className="space-y-1">
                  {[
                    { to: "/admin/leads", icon: FileText, label: "Leads verwalten", color: "text-secondary" },
                    { to: "/admin/companies", icon: Building2, label: "Firmen verwalten", color: "text-accent" },
                    { to: "/admin/token-packages", icon: Coins, label: "Token-Pakete", color: "text-primary" },
                    { to: "/admin/pricing", icon: TrendingUp, label: "Preisgestaltung", color: "text-warning" },
                    { to: "/admin/analytics", icon: ArrowUpRight, label: "Analytics", color: "text-muted-foreground" },
                    { to: "/admin/statistics", icon: TrendingUp, label: "Statistiken & Berichte", color: "text-green-600" },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/80 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-background transition-colors">
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1">
                        {item.label}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </section>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminDashboard;
