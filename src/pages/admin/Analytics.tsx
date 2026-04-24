import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Users, FileText, Coins } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface WeeklyData {
  week: string;
  count: number;
}

interface ServiceData {
  name: string;
  count: number;
}

interface StatusData {
  name: string;
  value: number;
}

const COLORS = ["hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--muted-foreground))"];

const AdminAnalytics = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyLeads, setWeeklyLeads] = useState<WeeklyData[]>([]);
  const [serviceDistribution, setServiceDistribution] = useState<ServiceData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusData[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalCompanies: 0,
    totalTokensSpent: 0,
    avgLeadsPerWeek: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        // Fetch all leads for analysis
        const { data: leads, error: leadsError } = await supabase
          .from("leads")
          .select("id, service_type, status, created_at, token_cost")
          .neq("source", "import")
          .order("created_at", { ascending: true });

        if (leadsError) throw leadsError;

        // Fetch companies count
        const { count: companiesCount } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true });

        // Fetch total tokens spent from transactions
        const { data: transactions } = await supabase
          .from("token_transactions")
          .select("amount")
          .eq("type", "charge");

        const totalTokensSpent = transactions?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

        // Process weekly leads — include year in key to avoid cross-year collisions
        const weeklyMap = new Map<string, { label: string; count: number }>();
        const now = new Date();
        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - i * 7);
          const weekNum = getWeekNumber(weekStart);
          const year = weekStart.getFullYear();
          const isoKey = `${year}-KW${weekNum}`;
          const label = `KW ${weekNum}`;
          weeklyMap.set(isoKey, { label, count: 0 });
        }

        leads?.forEach((lead) => {
          const date = new Date(lead.created_at);
          const weekNum = getWeekNumber(date);
          const year = date.getFullYear();
          const isoKey = `${year}-KW${weekNum}`;
          if (weeklyMap.has(isoKey)) {
            weeklyMap.get(isoKey)!.count++;
          }
        });

        const weeklyData = Array.from(weeklyMap.values()).map(({ label, count }) => ({
          week: label,
          count,
        }));

        // Process service distribution
        const serviceMap = new Map<string, number>();
        leads?.forEach((lead) => {
          const service = lead.service_type || "Unbekannt";
          serviceMap.set(service, (serviceMap.get(service) || 0) + 1);
        });

        const serviceData = Array.from(serviceMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Process status distribution
        const statusMap = new Map<string, number>();
        leads?.forEach((lead) => {
          const status = getStatusLabel(lead.status);
          statusMap.set(status, (statusMap.get(status) || 0) + 1);
        });

        const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({
          name,
          value,
        }));

        if (!isMounted) return;
        setWeeklyLeads(weeklyData);
        setServiceDistribution(serviceData);
        setStatusDistribution(statusData);
        setStats({
          totalLeads: leads?.length || 0,
          totalCompanies: companiesCount || 0,
          totalTokensSpent,
          avgLeadsPerWeek: Math.round((leads?.length || 0) / 8),
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAnalytics();
    return () => { isMounted = false; };
  }, []);

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const getStatusLabel = (status: string | null): string => {
    switch (status) {
      case "pending":
        return "Offen";
      case "pending_verification":
        return "Prüfung ausstehend";
      case "new":
        return "Neu";
      case "verified":
        return "Verifiziert";
      case "distributed":
        return "Verteilt";
      case "completed":
        return "Abgeschlossen";
      case "expired":
        return "Abgelaufen";
      case "no_matches":
        return "Keine Matches";
      case "imported":
        return "Importiert";
      case "rejected":
        return "Abgelehnt";
      default:
        return status ?? "Unbekannt";
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Analytics | LeadFlow Admin</title>
        </Helmet>
        <AdminLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        </AdminLayout>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Analytics | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Analytics</h2>
            <p className="text-muted-foreground">Übersicht und Auswertungen der Plattform</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gesamt Leads
                </CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalLeads}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Registrierte Firmen
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tokens verbraucht
                </CardTitle>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTokensSpent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ø Leads/Woche
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgLeadsPerWeek}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Leads Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Leads pro Woche</CardTitle>
                <CardDescription>Entwicklung der letzten 8 Wochen</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyLeads}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--secondary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--secondary))" }}
                        name="Leads"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Service Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
                <CardDescription>Verteilung nach Service-Typ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--accent))"
                        radius={[0, 4, 4, 0]}
                        name="Anzahl"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Status</CardTitle>
                <CardDescription>Verteilung nach Status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Zusammenfassung</CardTitle>
                <CardDescription>Wichtige Kennzahlen</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Konversionsrate</span>
                    <span className="font-medium">
                      {stats.totalLeads > 0
                        ? `${Math.round((statusDistribution.find(s => s.name === "Abgeschlossen")?.value || 0) / stats.totalLeads * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Durchschn. Token/Lead</span>
                    <span className="font-medium">
                      {stats.totalLeads > 0
                        ? Math.round(stats.totalTokensSpent / stats.totalLeads)
                        : 0} T
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Leads pro Firma</span>
                    <span className="font-medium">
                      {stats.totalCompanies > 0
                        ? (stats.totalLeads / stats.totalCompanies).toFixed(1)
                        : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Leads letzte Woche</span>
                    <span className="font-medium text-accent">
                      {stats.avgLeadsPerWeek} / Woche (Ø)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminAnalytics;
