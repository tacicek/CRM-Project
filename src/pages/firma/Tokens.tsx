import { Helmet } from "react-helmet-async";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Coins, 
  Loader2, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  Gift,
  CreditCard,
  History,
  Crown,
  Percent,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface TokenPackage {
  id: string;
  name: string;
  tokens_included: number;
  bonus_tokens: number | null;
  price_chf: number;
  is_featured: boolean | null;
  badge_text: string | null;
  stripe_price_id: string | null;
}

interface TokenTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  created_at: string;
}

const FirmaTokens = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [_companyId, setCompanyId] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const tokensParam = searchParams.get("tokens");
    const expectedTokens = tokensParam ? parseInt(tokensParam, 10) : 0;

    if (canceled === "true") {
      toast({
        title: "Kauf abgebrochen",
        description: "Der Kaufvorgang wurde abgebrochen.",
        variant: "destructive",
      });
      setSearchParams({});
      return;
    }

    if (success === "true" && user) {
      let cancelled = false;

      const pollForBalanceUpdate = async () => {
        const initialCompany = await fetchSingleCompanyForUser<{ id: string; token_balance: number }>({
          userId: user.id,
          userEmail: user.email ?? undefined,
          select: "id, token_balance",
        });
        if (!initialCompany || cancelled) return;

        const initialBalance = Number(initialCompany.token_balance) || 0;
        const targetBalance = initialBalance + (isNaN(expectedTokens) ? 0 : expectedTokens);

        // Poll up to 6 times: immediate check, then every 1.5s (~7.5s max)
        for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 1500));
          }

          const company = await fetchSingleCompanyForUser<{ token_balance: number }>({
            userId: user.id,
            userEmail: user.email ?? undefined,
            select: "token_balance",
          });
          if (!company || cancelled) return;

          const currentBalance = Number(company.token_balance) || 0;
          const balanceIncreased = currentBalance > initialBalance;
          const targetReached = currentBalance >= targetBalance;
          if (targetReached || (balanceIncreased && expectedTokens > 0) || attempt === 5) {
            if (cancelled) return;
            toast({
              title: "Kauf erfolgreich!",
              description: expectedTokens
                ? `${expectedTokens} Tokens wurden Ihrem Konto gutgeschrieben.`
                : "Ihre Tokens wurden Ihrem Konto gutgeschrieben.",
            });
            setSearchParams({});
            window.location.reload();
            return;
          }
        }

        if (cancelled) return;
        // Timeout: show success anyway (webhook may have been delayed)
        toast({
          title: "Kauf erfolgreich!",
          description: expectedTokens
            ? `${expectedTokens} Tokens wurden Ihrem Konto gutgeschrieben.`
            : "Ihre Tokens wurden Ihrem Konto gutgeschrieben.",
        });
        setSearchParams({});
        window.location.reload();
      };

      pollForBalanceUpdate();
      return () => {
        cancelled = true;
      };
    } else if (success === "true" && !user) {
      // User not loaded yet - wait for next render when user is available
      return;
    }
  }, [searchParams, setSearchParams, toast, user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const company = await fetchSingleCompanyForUser<{ id: string; token_balance: number }>({
          userId: user.id,
          userEmail: user.email,
          select: "id, token_balance",
        });

        if (!company) return;
        setCompanyId(company.id);
        setTokenBalance(Number(company.token_balance) || 0);

        const { data: pkgs } = await supabase
          .from("token_packages")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        setPackages(pkgs || []);

        const { data: txns } = await supabase
          .from("token_transactions")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(20);

        setTransactions(txns || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handlePurchase = async (pkg: TokenPackage) => {
    if (!pkg.stripe_price_id) {
      toast({
        title: "Fehler",
        description: "Dieses Paket ist nicht für den Kauf verfügbar.",
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(pkg.id);

    try {
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let activeSession = initialSession;
      if (!activeSession?.access_token) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        activeSession = refreshed.session;
      }

      if (!activeSession?.access_token) {
        throw new Error("Sitzung abgelaufen. Bitte erneut einloggen.");
      }

      const { data, error } = await supabase.functions.invoke("create-token-checkout", {
        body: { packageId: pkg.id },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw error;
      }

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Fehler",
        description: "Der Checkout konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(price);
  };

  const getTransactionTypeConfig = (type: string) => {
    switch (type) {
      case "purchase":
        return { label: "Kauf", icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-100" };
      case "charge":
        return { label: "Belastung", icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-100" };
      case "refund":
        return { label: "Rückerstattung", icon: ArrowUpRight, color: "text-amber-600", bg: "bg-amber-100" };
      case "bonus":
        return { label: "Bonus", icon: Gift, color: "text-purple-600", bg: "bg-purple-100" };
      case "credit":
        return { label: "Gutschrift", icon: Sparkles, color: "text-blue-600", bg: "bg-blue-100" };
      default:
        return { label: type, icon: Coins, color: "text-slate-600", bg: "bg-slate-100" };
    }
  };

  // Calculate savings percentage for packages
  const calculateSavings = (pkg: TokenPackage) => {
    const basePrice = packages[0]?.price_chf / packages[0]?.tokens_included || 0;
    const pkgPrice = Number(pkg.price_chf) / (pkg.tokens_included + (pkg.bonus_tokens || 0));
    if (basePrice <= 0) return 0;
    return Math.round((1 - pkgPrice / basePrice) * 100);
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Tokens | Firma</title>
        </Helmet>
        <FirmaLayout>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
            <p className="text-slate-500">Lade Token-Daten...</p>
          </div>
        </FirmaLayout>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Tokens | Firma</title>
      </Helmet>
      <FirmaLayout>
        <div className="space-y-6">
          {/* Modern Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 p-6 md:p-8 text-white">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            
            {/* Decorative coins */}
            <div className="absolute top-6 right-6 opacity-20">
              <Coins className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold">Token-Verwaltung</h1>
                      <p className="text-white/80 text-sm">Verwalten Sie Ihr Token-Guthaben</p>
                    </div>
                  </div>
                </div>
                
                {/* Current Balance */}
                <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Aktuelles Guthaben</p>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-bold">
                        {tokenBalance.toLocaleString("de-CH")}
                      </span>
                      <span className="text-white/80 text-lg">Tokens</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Token Packages */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Token-Pakete</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg, _index) => {
                const savings = calculateSavings(pkg);
                const totalTokens = pkg.tokens_included + (pkg.bonus_tokens || 0);
                
                return (
                  <div
                    key={pkg.id}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      pkg.is_featured
                        ? "border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30 ring-2 ring-amber-400/50"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    {/* Featured badge */}
                    {pkg.is_featured && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1.5 text-xs font-bold rounded-bl-xl flex items-center gap-1.5 shadow-lg">
                        <Crown className="w-3.5 h-3.5" />
                        Beliebt
                      </div>
                    )}
                    
                    {/* Savings badge */}
                    {savings > 0 && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <Percent className="w-3 h-3" />
                          {savings} SPAREN
                        </span>
                      </div>
                    )}

                    <div className="p-6 pt-12">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{pkg.name}</h3>
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            pkg.is_featured 
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            <Coins className="w-5 h-5" />
                          </div>
                          <span className="text-3xl font-bold text-slate-900 dark:text-white">
                            {pkg.tokens_included.toLocaleString("de-CH")}
                          </span>
                        </div>
                        {(pkg.bonus_tokens ?? 0) > 0 && (
                          <div className="flex items-center justify-center gap-1.5 mt-2 text-emerald-600 dark:text-emerald-400">
                            <Gift className="w-4 h-4" />
                            <span className="text-sm font-semibold">+ {pkg.bonus_tokens} Bonus</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center mb-6">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                          {formatPrice(Number(pkg.price_chf))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {(Number(pkg.price_chf) / totalTokens).toFixed(2)} CHF/Token
                        </p>
                      </div>
                      
                      <Button
                        className={`w-full h-11 ${
                          pkg.is_featured 
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25' 
                            : ''
                        }`}
                        variant={pkg.is_featured ? "default" : "outline"}
                        onClick={() => handlePurchase(pkg)}
                        disabled={isPurchasing === pkg.id}
                      >
                        {isPurchasing === pkg.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4 mr-2" />
                        )}
                        {isPurchasing === pkg.id ? "Wird geladen..." : "Jetzt kaufen"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction History */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600" />
            
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Transaktionshistorie</h2>
                  <p className="text-sm text-slate-500">Ihre letzten Token-Bewegungen</p>
                </div>
              </div>
              
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 dark:border-slate-800">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Datum</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Typ</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Beschreibung</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Betrag</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn, _index) => {
                        const typeConfig = getTransactionTypeConfig(txn.type);
                        const TypeIcon = typeConfig.icon;
                        
                        return (
                          <TableRow 
                            key={txn.id} 
                            className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                              {formatDate(txn.created_at)}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                                <TypeIcon className="w-3.5 h-3.5" />
                                {typeConfig.label}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-slate-700 dark:text-slate-300">
                              {txn.description || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`inline-flex items-center gap-1 font-mono font-semibold ${
                                  Number(txn.amount) >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {Number(txn.amount) >= 0 ? (
                                  <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4" />
                                )}
                                {Number(txn.amount) >= 0 ? "+" : ""}
                                {Number(txn.amount).toLocaleString("de-CH")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                              {txn.balance_after?.toLocaleString("de-CH") || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <History className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">Noch keine Transaktionen</p>
                  <p className="text-sm text-slate-400 mt-1">Ihre Token-Bewegungen erscheinen hier</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </FirmaLayout>
    </>
  );
};

export default FirmaTokens;
