import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Coins,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Gift,
  ShoppingCart,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  Loader2,
  Receipt,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { de } from "date-fns/locale";
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
  Legend,
} from "recharts";

interface FinancialStats {
  // Lead Statistics
  totalLeadsReceived: number;
  totalLeadsSold: number;
  leadsThisMonth: number;
  leadsSoldThisMonth: number;
  
  // Token Statistics
  tokensInCirculation: number;
  totalTokensPurchased: number;
  totalTokensSpent: number;
  totalTokensGrantedByAdmin: number;
  totalTokensDeductedByAdmin: number;
  
  // Monthly breakdown
  tokensThisMonthPurchased: number;
  tokensThisMonthSpent: number;
  tokensThisMonthGranted: number;
  
  // Revenue (based on token purchases)
  totalRevenueCHF: number;
  revenueThisMonthCHF: number;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  leadsSold: number;
  tokensSpent: number;
  tokensPurchased: number;
  tokensGranted: number;
  revenueCHF: number;
}

interface TransactionSummary {
  type: string;
  count: number;
  totalAmount: number;
}

const TOKEN_TO_CHF = 1; // 1 Token = 1 CHF

const AdminStatistics = () => {
  const [stats, setStats] = useState<FinancialStats>({
    totalLeadsReceived: 0,
    totalLeadsSold: 0,
    leadsThisMonth: 0,
    leadsSoldThisMonth: 0,
    tokensInCirculation: 0,
    totalTokensPurchased: 0,
    totalTokensSpent: 0,
    totalTokensGrantedByAdmin: 0,
    totalTokensDeductedByAdmin: 0,
    tokensThisMonthPurchased: 0,
    tokensThisMonthSpent: 0,
    tokensThisMonthGranted: 0,
    totalRevenueCHF: 0,
    revenueThisMonthCHF: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatistics = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
      const yearEnd = endOfYear(yearStart);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // === LEAD STATISTICS ===
      
      // Total leads received (all time)
      const { count: totalLeadsReceived } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .neq("source", "import");

      // Total leads sold (accepted distributions, all time)
      const { count: totalLeadsSold } = await supabase
        .from("lead_distributions")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted");

      // Leads this month
      const { count: leadsThisMonth } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .neq("source", "import")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      // Leads sold this month
      const { count: leadsSoldThisMonth } = await supabase
        .from("lead_distributions")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .gte("responded_at", monthStart.toISOString())
        .lte("responded_at", monthEnd.toISOString());

      // === TOKEN STATISTICS ===

      // Tokens currently in circulation
      const { data: companiesData } = await supabase
        .from("companies")
        .select("token_balance");
      
      const tokensInCirculation = companiesData?.reduce(
        (sum, c) => sum + Number(c.token_balance || 0), 0
      ) || 0;

      // Fetch token transactions filtered by selected year
      const { data: allTransactions } = await supabase
        .from("token_transactions")
        .select("*")
        .gte("created_at", yearStart.toISOString())
        .lte("created_at", yearEnd.toISOString())
        .order("created_at", { ascending: true });

      if (signal?.aborted) return;

      // Calculate totals from transactions
      let totalTokensPurchased = 0;
      let totalTokensSpent = 0;
      let totalTokensGrantedByAdmin = 0;
      let totalTokensDeductedByAdmin = 0;
      let tokensThisMonthPurchased = 0;
      let tokensThisMonthSpent = 0;
      let tokensThisMonthGranted = 0;

      const transactionCounts: Record<string, { count: number; totalAmount: number }> = {};

      allTransactions?.forEach((tx) => {
        const amount = Number(tx.amount || 0);
        const txDate = new Date(tx.created_at);
        const isThisMonth = txDate >= monthStart && txDate <= monthEnd;

        // Count by type
        if (!transactionCounts[tx.type]) {
          transactionCounts[tx.type] = { count: 0, totalAmount: 0 };
        }
        transactionCounts[tx.type].count++;
        transactionCounts[tx.type].totalAmount += amount;

        // Categorize by transaction type
        switch (tx.type) {
          case "purchase":
            totalTokensPurchased += amount;
            if (isThisMonth) tokensThisMonthPurchased += amount;
            break;
          case "charge":
            // Charge is stored as negative
            totalTokensSpent += Math.abs(amount);
            if (isThisMonth) tokensThisMonthSpent += Math.abs(amount);
            break;
          case "credit":
            totalTokensGrantedByAdmin += amount;
            if (isThisMonth) tokensThisMonthGranted += amount;
            break;
          case "debit":
            // Admin deduction (stored as positive, represents deduction)
            totalTokensDeductedByAdmin += amount;
            break;
          case "subscription":
            // Manual import subscription (negative amount)
            totalTokensSpent += Math.abs(amount);
            if (isThisMonth) tokensThisMonthSpent += Math.abs(amount);
            break;
        }
      });

      // Convert to array for display
      const summaryArray: TransactionSummary[] = Object.entries(transactionCounts).map(
        ([type, data]) => ({
          type,
          count: data.count,
          totalAmount: data.totalAmount,
        })
      );

      // === MONTHLY DATA FOR CHARTS ===
      const monthlyDataMap = new Map<string, MonthlyData>();

      // Initialize 12 months
      for (let i = 11; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthKey = format(date, "yyyy-MM");
        const monthLabel = format(date, "MMM yy", { locale: de });
        monthlyDataMap.set(monthKey, {
          month: monthLabel,
          monthKey,
          leadsSold: 0,
          tokensSpent: 0,
          tokensPurchased: 0,
          tokensGranted: 0,
          revenueCHF: 0,
        });
      }

      // Fill in transactions data
      allTransactions?.forEach((tx) => {
        const txDate = new Date(tx.created_at);
        const monthKey = format(txDate, "yyyy-MM");
        
        if (monthlyDataMap.has(monthKey)) {
          const data = monthlyDataMap.get(monthKey)!;
          const amount = Number(tx.amount || 0);

          switch (tx.type) {
            case "purchase":
              data.tokensPurchased += amount;
              data.revenueCHF += amount * TOKEN_TO_CHF;
              break;
            case "charge":
            case "subscription":
              data.tokensSpent += Math.abs(amount);
              break;
            case "credit":
              data.tokensGranted += amount;
              break;
          }
        }
      });

      // Fill in leads sold data
      const { data: acceptedDistributions } = await supabase
        .from("lead_distributions")
        .select("responded_at")
        .eq("status", "accepted")
        .not("responded_at", "is", null);

      acceptedDistributions?.forEach((dist) => {
        if (dist.responded_at) {
          const monthKey = format(new Date(dist.responded_at), "yyyy-MM");
          if (monthlyDataMap.has(monthKey)) {
            monthlyDataMap.get(monthKey)!.leadsSold++;
          }
        }
      });

      // Real CHF revenue from confirmed subscription payments in the selected year
      const { data: paymentsData } = await supabase
        .from("subscription_payments")
        .select("amount, created_at")
        .eq("status", "confirmed")
        .gte("created_at", yearStart.toISOString())
        .lte("created_at", yearEnd.toISOString());

      const totalRevenueCHF = paymentsData?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
      const revenueThisMonthCHF = paymentsData
        ?.filter((p) => {
          const d = new Date(p.created_at);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      setStats({
        totalLeadsReceived: totalLeadsReceived || 0,
        totalLeadsSold: totalLeadsSold || 0,
        leadsThisMonth: leadsThisMonth || 0,
        leadsSoldThisMonth: leadsSoldThisMonth || 0,
        tokensInCirculation,
        totalTokensPurchased,
        totalTokensSpent,
        totalTokensGrantedByAdmin,
        totalTokensDeductedByAdmin,
        tokensThisMonthPurchased,
        tokensThisMonthSpent,
        tokensThisMonthGranted,
        totalRevenueCHF,
        revenueThisMonthCHF,
      });

      setMonthlyData(Array.from(monthlyDataMap.values()));
      setTransactionSummary(summaryArray);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching statistics:", error);
      toast.error("Fehler beim Laden der Statistiken. Bitte Seite neu laden.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatistics(controller.signal);
    return () => { controller.abort(); };
  }, [fetchStatistics]);

  const exportToCSV = () => {
    const csvData = [
      ["Finanzstatistiken - Offerio"],
      ["Exportiert am", format(new Date(), "dd.MM.yyyy HH:mm", { locale: de })],
      [""],
      ["=== LEAD STATISTIKEN ==="],
      ["Metrik", "Wert"],
      ["Gesamt erhaltene Anfragen", stats.totalLeadsReceived],
      ["Gesamt verkaufte Anfragen", stats.totalLeadsSold],
      ["Anfragen diesen Monat", stats.leadsThisMonth],
      ["Verkaufte Anfragen diesen Monat", stats.leadsSoldThisMonth],
      [""],
      ["=== TOKEN STATISTIKEN ==="],
      ["Token im Umlauf", stats.tokensInCirculation],
      ["Gesamt gekaufte Token (Firmen)", stats.totalTokensPurchased],
      ["Gesamt verbrauchte Token", stats.totalTokensSpent],
      ["Admin Gutschriften", stats.totalTokensGrantedByAdmin],
      ["Admin Abbuchungen", stats.totalTokensDeductedByAdmin],
      [""],
      ["=== EINNAHMEN ==="],
      ["Gesamt Einnahmen (CHF)", stats.totalRevenueCHF.toFixed(2)],
      ["Einnahmen diesen Monat (CHF)", stats.revenueThisMonthCHF.toFixed(2)],
      [""],
      ["=== MONATLICHE ÜBERSICHT ==="],
      ["Monat", "Leads verkauft", "Tokens verbraucht", "Tokens gekauft", "Admin Gutschriften", "Einnahmen CHF"],
      ...monthlyData.map((m) => [
        m.month,
        m.leadsSold,
        m.tokensSpent,
        m.tokensPurchased,
        m.tokensGranted,
        m.revenueCHF.toFixed(2),
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `offerio-statistiken-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTransactionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      purchase: "Token-Kauf (Stripe)",
      credit: "Admin Gutschrift",
      debit: "Admin Abbuchung",
      charge: "Lead angenommen",
      subscription: "Abo-Gebühr",
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      purchase: "bg-green-100 text-green-800",
      credit: "bg-blue-100 text-blue-800",
      debit: "bg-red-100 text-red-800",
      charge: "bg-amber-100 text-amber-800",
      subscription: "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <Helmet>
        <title>Statistiken & Berichte | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Statistiken & Berichte</h1>
              <p className="text-muted-foreground">
                Finanzübersicht für Buchhaltung und Steuererklärung
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Main Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Revenue Card */}
                <Card className="col-span-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium">Gesamt Einnahmen</p>
                        <p className="text-3xl font-bold mt-1">
                          CHF {stats.totalRevenueCHF.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-green-100 text-sm mt-2">
                          Diesen Monat: CHF {stats.revenueThisMonthCHF.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-4 bg-white/20 rounded-2xl">
                        <Receipt className="w-8 h-8" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Leads Received */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Anfragen erhalten</p>
                        <p className="text-2xl font-bold">{stats.totalLeadsReceived}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          +{stats.leadsThisMonth} diesen Monat
                        </p>
                      </div>
                      <div className="p-3 bg-secondary/10 rounded-xl">
                        <FileText className="w-6 h-6 text-secondary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Leads Sold */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Anfragen verkauft</p>
                        <p className="text-2xl font-bold">{stats.totalLeadsSold}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          +{stats.leadsSoldThisMonth} diesen Monat
                        </p>
                      </div>
                      <div className="p-3 bg-accent/10 rounded-xl">
                        <ShoppingCart className="w-6 h-6 text-accent" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Token Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Coins className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Im Umlauf</p>
                        <p className="text-lg font-bold">{stats.tokensInCirculation.toLocaleString("de-CH")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gekauft (Firmen)</p>
                        <p className="text-lg font-bold text-green-600">+{stats.totalTokensPurchased.toLocaleString("de-CH")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Verbraucht</p>
                        <p className="text-lg font-bold text-red-600">-{stats.totalTokensSpent.toLocaleString("de-CH")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Gift className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Admin Gutschrift</p>
                        <p className="text-lg font-bold text-blue-600">+{stats.totalTokensGrantedByAdmin.toLocaleString("de-CH")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Admin Abbuchung</p>
                        <p className="text-lg font-bold text-gray-600">-{stats.totalTokensDeductedByAdmin.toLocaleString("de-CH")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Token-Käufe & Einnahmen
                    </CardTitle>
                    <CardDescription>Monatliche Übersicht der letzten 12 Monate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number, name: string) => [
                              name === "revenueCHF" ? `CHF ${value.toFixed(2)}` : value,
                              name === "tokensPurchased" ? "Tokens gekauft" : "Einnahmen CHF",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="tokensPurchased" name="Tokens gekauft" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Leads Sold Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      Verkaufte Leads
                    </CardTitle>
                    <CardDescription>Anzahl verkaufter Anfragen pro Monat</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="leadsSold"
                            name="Leads verkauft"
                            stroke="hsl(var(--secondary))"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="tokensSpent"
                            name="Tokens verbraucht"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Transaktionsübersicht</CardTitle>
                  <CardDescription>Zusammenfassung aller Token-Bewegungen nach Typ</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaktionstyp</TableHead>
                        <TableHead className="text-right">Anzahl</TableHead>
                        <TableHead className="text-right">Gesamtbetrag (Tokens)</TableHead>
                        <TableHead className="text-right">CHF Wert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionSummary.map((summary) => (
                        <TableRow key={summary.type}>
                          <TableCell>
                            <Badge className={getTransactionTypeColor(summary.type)}>
                              {getTransactionTypeLabel(summary.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {summary.count.toLocaleString("de-CH")}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={summary.totalAmount >= 0 ? "text-green-600" : "text-red-600"}>
                              {summary.totalAmount >= 0 ? "+" : ""}
                              {summary.totalAmount.toLocaleString("de-CH")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            CHF {Math.abs(summary.totalAmount * TOKEN_TO_CHF).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Monthly Breakdown Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Monatliche Aufschlüsselung</CardTitle>
                  <CardDescription>Detaillierte Übersicht für Buchhaltung und Steuererklärung</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Monat</TableHead>
                          <TableHead className="text-right">Leads verkauft</TableHead>
                          <TableHead className="text-right">Tokens verbraucht</TableHead>
                          <TableHead className="text-right">Tokens gekauft</TableHead>
                          <TableHead className="text-right">Admin Gutschriften</TableHead>
                          <TableHead className="text-right">Einnahmen CHF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyData.map((month) => (
                          <TableRow key={month.monthKey}>
                            <TableCell className="font-medium">{month.month}</TableCell>
                            <TableCell className="text-right">{month.leadsSold}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {month.tokensSpent > 0 ? `-${month.tokensSpent}` : "0"}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {month.tokensPurchased > 0 ? `+${month.tokensPurchased}` : "0"}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              {month.tokensGranted > 0 ? `+${month.tokensGranted}` : "0"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              CHF {month.revenueCHF.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Gesamt</TableCell>
                          <TableCell className="text-right">{stats.totalLeadsSold}</TableCell>
                          <TableCell className="text-right text-red-600">-{stats.totalTokensSpent}</TableCell>
                          <TableCell className="text-right text-green-600">+{stats.totalTokensPurchased}</TableCell>
                          <TableCell className="text-right text-blue-600">+{stats.totalTokensGrantedByAdmin}</TableCell>
                          <TableCell className="text-right">
                            CHF {stats.totalRevenueCHF.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Info Box */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg h-fit">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900">Hinweis für die Steuererklärung</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Diese Statistiken dienen als Grundlage für Ihre Buchhaltung. Die "Gesamt Einnahmen" 
                        entsprechen den tatsächlich bezahlten Token-Käufen der Firmen. Für die offizielle 
                        Steuererklärung konsultieren Sie bitte Ihren Steuerberater.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminStatistics;

