/**
 * Admin Subscriptions Page
 * Manage CRM subscriptions, payments, and renewals
 */

import { Helmet } from "react-helmet-async";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Crown,
  Lock,
  RefreshCw,
  Loader2,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Building2,
  CalendarPlus,
  Receipt,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Zap,
  ExternalLink,
  Download,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// =============================================================================
// Constants
// =============================================================================
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAYMENT_AMOUNT = 0.01;
const MAX_PAYMENT_AMOUNT = 100000;
const VALID_EXTENSION_MONTHS = [1, 3, 6, 12];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely format date string to Swiss format
 */
const formatDateSafe = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

/**
 * Calculate days until expiry
 */
const getDaysUntilExpiry = (expiresAt: string | null): number | null => {
  if (!expiresAt) return null;
  try {
    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) return null;
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

/**
 * Validate payment amount
 */
const isValidPaymentAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= MIN_PAYMENT_AMOUNT && num <= MAX_PAYMENT_AMOUNT;
};

/**
 * Validate extension months
 */
const isValidExtensionMonths = (months: string): boolean => {
  const num = parseInt(months, 10);
  return !isNaN(num) && VALID_EXTENSION_MONTHS.includes(num);
};

/**
 * Type guard for Company
 */
const isValidCompany = (data: unknown): data is Company => {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.company_name === 'string';
};

/**
 * Type guard for Payment
 */
const isValidPayment = (data: unknown): data is Payment => {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.company_id === 'string';
};

/**
 * Get user-friendly error message
 */
const getUserFriendlyError = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
    }
    if (msg.includes('permission') || msg.includes('denied') || msg.includes('policy')) {
      return 'Keine Berechtigung für diese Aktion.';
    }
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return 'Diese Aktion wurde bereits durchgeführt.';
    }
    if (msg.includes('timeout')) {
      return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
    }
  }
  return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
};

interface Company {
  id: string;
  company_name: string;
  email: string;
  crm_enabled: boolean;
  subscription_type: "basic" | "crm" | "enterprise" | "trial" | null;
  subscription_expires_at: string | null;
  last_reminder_sent_at: string | null;
  last_reminder_type: string | null;
  trial_used?: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

interface Payment {
  id: string;
  company_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  subscription_months: number;
  status: string;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  invoice_number: string | null;
  company?: { company_name: string };
}

export default function AdminSubscriptions() {
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Data state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Loading states (granular)
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dialog state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isTrialDialogOpen, setIsTrialDialogOpen] = useState(false);
  const [trialDays, setTrialDays] = useState("14");
  
  // Form state
  const [extensionMonths, setExtensionMonths] = useState("1");
  const [paymentAmount, setPaymentAmount] = useState("99");
  const [paymentMethod, setPaymentMethod] = useState("invoice");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  
  // Submission state (per-company to prevent race conditions)
  const [submittingCompanyId, setSubmittingCompanyId] = useState<string | null>(null);
  const [isRunningSyncManager, setIsRunningSyncManager] = useState(false);
  const [isRunningStripeSync, setIsRunningStripeSync] = useState(false);
  const [isRunningStripeImport, setIsRunningStripeImport] = useState(false);

  // Stripe import results dialog
  const [stripeImportResult, setStripeImportResult] = useState<{
    matched: number;
    skipped: number;
    unmatched: Array<{ subscription_id: string; customer_email: string | null; status: string; amount: number; currency: string }>;
    errors: string[];
    diagnostic?: { key_mode: string; key_prefix: string; subscriptions_found: number; customers_found: number; hint: string };
  } | null>(null);
  const [isImportResultOpen, setIsImportResultOpen] = useState(false);

  // Manual Stripe link dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkCompany, setLinkCompany] = useState<Company | null>(null);
  const [linkCustomerId, setLinkCustomerId] = useState("");
  const [linkSubscriptionId, setLinkSubscriptionId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  
  // Search and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring" | "expired" | "basic">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // Validation errors
  const [formErrors, setFormErrors] = useState<{ amount?: string; months?: string }>({});

  const { toast } = useToast();
  const { user } = useAuth();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch data with abort support
  const fetchData = useCallback(async (isRefresh = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingCompanies(true);
      setIsLoadingPayments(true);
    }

    try {
      const [companiesRes, paymentsRes] = await Promise.all([
        supabase
          .from("companies")
          .select("id, company_name, email, crm_enabled, subscription_type, subscription_expires_at, last_reminder_sent_at, last_reminder_type, trial_used, stripe_customer_id, stripe_subscription_id")
          .order("company_name"),
        supabase
          .from("subscription_payments")
          .select("*, company:companies(company_name)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      // Check if component is still mounted
      if (!isMountedRef.current) return;

      if (companiesRes.error) throw companiesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      // Type-safe data handling
      const validCompanies = (companiesRes.data || []).filter(isValidCompany);
      const validPayments = (paymentsRes.data || []).filter(isValidPayment);

      setCompanies(validCompanies);
      setPayments(validPayments);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') return;
      
      toast({
        title: "Fehler beim Laden",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoadingCompanies(false);
        setIsLoadingPayments(false);
        setIsRefreshing(false);
      }
    }
  }, [toast]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Reset dialog form state
  const resetDialogState = useCallback(() => {
    setExtensionMonths("1");
    setPaymentAmount("99");
    setPaymentMethod("invoice");
    setPaymentReference("");
    setPaymentNotes("");
    setFormErrors({});
  }, []);

  // Validate extend form
  const validateExtendForm = useCallback((): boolean => {
    const errors: { months?: string } = {};
    
    if (!isValidExtensionMonths(extensionMonths)) {
      errors.months = "Bitte wählen Sie eine gültige Laufzeit.";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [extensionMonths]);

  // Validate payment form
  const validatePaymentForm = useCallback((): boolean => {
    const errors: { amount?: string; months?: string } = {};
    
    if (!isValidPaymentAmount(paymentAmount)) {
      errors.amount = `Betrag muss zwischen CHF ${MIN_PAYMENT_AMOUNT} und CHF ${MAX_PAYMENT_AMOUNT.toLocaleString('de-CH')} liegen.`;
    }
    
    if (!isValidExtensionMonths(extensionMonths)) {
      errors.months = "Bitte wählen Sie eine gültige Laufzeit.";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [paymentAmount, extensionMonths]);

  // Extend subscription (without payment)
  const extendSubscription = useCallback(async () => {
    if (!selectedCompany || !user) return;
    
    // Prevent double submission
    if (submittingCompanyId === selectedCompany.id) return;
    
    // Validate
    if (!validateExtendForm()) return;
    
    setSubmittingCompanyId(selectedCompany.id);
    
    try {
      const months = parseInt(extensionMonths, 10);
      
      const { error } = await supabase.rpc("extend_subscription", {
        p_company_id: selectedCompany.id,
        p_months: months,
        p_confirmed_by: user.id,
      });

      if (!isMountedRef.current) return;

      if (error) throw error;

      toast({
        title: "Abo verlängert",
        description: `${selectedCompany.company_name} wurde um ${months} Monat(e) verlängert.`,
      });

      setIsExtendDialogOpen(false);
      resetDialogState();
      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      toast({
        title: "Fehler beim Verlängern",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setSubmittingCompanyId(null);
      }
    }
  }, [selectedCompany, user, submittingCompanyId, extensionMonths, validateExtendForm, toast, resetDialogState, fetchData]);

  // Grant free trial
  const grantTrial = useCallback(async () => {
    if (!selectedCompany || !user) return;
    if (submittingCompanyId === selectedCompany.id) return;

    const days = parseInt(trialDays, 10);
    if (isNaN(days) || days < 1 || days > 365) return;

    setSubmittingCompanyId(selectedCompany.id);
    try {
      const { error } = await supabase.rpc("grant_trial", {
        p_company_id: selectedCompany.id,
        p_days: days,
        p_granted_by: user.id,
      });
      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Testzeitraum aktiviert",
        description: `${selectedCompany.company_name} hat ${days} Tage kostenlosen Testzugang.`,
      });
      setIsTrialDialogOpen(false);
      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setSubmittingCompanyId(null);
    }
  }, [selectedCompany, user, submittingCompanyId, trialDays, toast, fetchData]);

  // Record payment with transaction-like rollback
  const recordPayment = useCallback(async () => {
    if (!selectedCompany || !user) return;
    
    // Prevent double submission
    if (submittingCompanyId === selectedCompany.id) return;
    
    // Validate
    if (!validatePaymentForm()) return;
    
    setSubmittingCompanyId(selectedCompany.id);
    
    let paymentId: string | null = null;
    
    try {
      const amount = parseFloat(paymentAmount);
      const months = parseInt(extensionMonths, 10);
      
      // Step 1: Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from("subscription_payments")
        .insert({
          company_id: selectedCompany.id,
          amount: amount,
          currency: "CHF",
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim() || null,
          subscription_months: months,
          status: "confirmed",
          notes: paymentNotes.trim() || null,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        })
        .select("id")
        .single();

      if (paymentError) {
        if (!isMountedRef.current) return;
        throw paymentError;
      }

      paymentId = paymentData?.id || null;

      // Step 2: Extend subscription
      const { error: extendError } = await supabase.rpc("extend_subscription", {
        p_company_id: selectedCompany.id,
        p_months: months,
        p_confirmed_by: user.id,
      });

      if (extendError) {
        // Rollback: Delete the payment record regardless of mount state
        // to prevent orphaned payment records in the database.
        if (paymentId) {
          await supabase
            .from("subscription_payments")
            .delete()
            .eq("id", paymentId);
        }
        if (!isMountedRef.current) return;
        throw extendError;
      }

      if (!isMountedRef.current) return;

      toast({
        title: "Zahlung erfasst",
        description: `CHF ${amount.toFixed(2)} für ${selectedCompany.company_name} erfasst. Abo um ${months} Monat(e) verlängert.`,
      });

      setIsPaymentDialogOpen(false);
      resetDialogState();
      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      toast({
        title: "Fehler beim Erfassen",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setSubmittingCompanyId(null);
      }
    }
  }, [selectedCompany, user, submittingCompanyId, paymentAmount, extensionMonths, paymentMethod, paymentReference, paymentNotes, validatePaymentForm, toast, resetDialogState, fetchData]);

  // Run subscription manager (send reminders, deactivate expired)
  const runSubscriptionManager = useCallback(async () => {
    if (isRunningSyncManager) return;
    
    setIsRunningSyncManager(true);
    
    try {
      toast({
        title: "Abo-Manager gestartet",
        description: "Erinnerungen werden gesendet und abgelaufene Abos deaktiviert...",
      });

      const { data, error } = await supabase.functions.invoke("subscription-manager");

      if (!isMountedRef.current) return;

      if (error) throw error;

      const remindersSent = data?.reminders_sent ?? 0;
      const deactivated = data?.subscriptions_deactivated ?? 0;

      toast({
        title: "Abo-Manager abgeschlossen",
        description: `${remindersSent} Erinnerungen gesendet, ${deactivated} Abos deaktiviert.`,
      });

      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      toast({
        title: "Fehler beim Abo-Manager",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsRunningSyncManager(false);
      }
    }
  }, [isRunningSyncManager, toast, fetchData]);

  // Sync live Stripe subscription status
  const runStripeSync = useCallback(async () => {
    if (isRunningStripeSync) return;
    setIsRunningStripeSync(true);

    try {
      toast({
        title: "Stripe-Sync gestartet",
        description: "Abonnementstatus wird von Stripe abgerufen…",
      });

      const { data, error } = await supabase.functions.invoke("sync-stripe-subscriptions");

      if (!isMountedRef.current) return;
      if (error) throw error;

      const synced = data?.synced ?? 0;
      const total = data?.total ?? 0;

      toast({
        title: "Stripe-Sync abgeschlossen",
        description: `${synced} von ${total} Abonnement(s) aktualisiert.`,
      });

      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast({
        title: "Stripe-Sync fehlgeschlagen",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setIsRunningStripeSync(false);
    }
  }, [isRunningStripeSync, toast, fetchData]);

  // Import all Stripe subscriptions and match by e-mail
  const runStripeImport = useCallback(async () => {
    if (isRunningStripeImport) return;
    setIsRunningStripeImport(true);
    try {
      toast({ title: "Stripe-Import gestartet", description: "Alle Stripe-Abonnements werden abgerufen und zugeordnet…" });

      const { data, error } = await supabase.functions.invoke("import-stripe-subscriptions");
      if (!isMountedRef.current) return;
      if (error) throw error;

      setStripeImportResult(data);
      setIsImportResultOpen(true);
      toast({
        title: "Import abgeschlossen",
        description: `${data.matched} zugeordnet · ${data.skipped} bereits verknüpft · ${data.unmatched?.length ?? 0} nicht gefunden`,
      });
      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast({ title: "Import fehlgeschlagen", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setIsRunningStripeImport(false);
    }
  }, [isRunningStripeImport, toast, fetchData]);

  // Manually link Stripe IDs to a company
  const linkStripeIds = useCallback(async () => {
    if (!linkCompany || isLinking) return;
    const custId = linkCustomerId.trim();
    const subId = linkSubscriptionId.trim();
    if (!custId && !subId) return;

    setIsLinking(true);
    try {
      const update: Record<string, string | null> = {};
      if (custId) update.stripe_customer_id = custId;
      if (subId) update.stripe_subscription_id = subId;

      const { error } = await supabase.from("companies").update(update).eq("id", linkCompany.id);
      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({ title: "Stripe IDs verknüpft", description: `${linkCompany.company_name} wurde mit Stripe verbunden.` });
      setIsLinkDialogOpen(false);
      setLinkCompany(null);
      setLinkCustomerId("");
      setLinkSubscriptionId("");
      fetchData(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast({ title: "Fehler", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      if (isMountedRef.current) setIsLinking(false);
    }
  }, [linkCompany, isLinking, linkCustomerId, linkSubscriptionId, toast, fetchData]);

  // Open extend dialog
  const openExtendDialog = useCallback((company: Company) => {
    setSelectedCompany(company);
    resetDialogState();
    setIsExtendDialogOpen(true);
  }, [resetDialogState]);

  // Open payment dialog
  const openPaymentDialog = useCallback((company: Company) => {
    setSelectedCompany(company);
    resetDialogState();
    setIsPaymentDialogOpen(true);
  }, [resetDialogState]);

  // Close extend dialog
  const closeExtendDialog = useCallback(() => {
    setIsExtendDialogOpen(false);
    setSelectedCompany(null);
    resetDialogState();
  }, [resetDialogState]);

  // Close payment dialog
  const closePaymentDialog = useCallback(() => {
    setIsPaymentDialogOpen(false);
    setSelectedCompany(null);
    resetDialogState();
  }, [resetDialogState]);

  // Get expiry badge for a company
  const getExpiryBadge = useCallback((company: Company) => {
    if (!company.crm_enabled) {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 gap-1">
          <Lock className="w-3 h-3" />
          Basic
        </Badge>
      );
    }

    const daysLeft = getDaysUntilExpiry(company.subscription_expires_at);
    const isTrial = company.subscription_type === "trial";

    if (isTrial && daysLeft !== null && daysLeft > 0) {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
          <Clock className="w-3 h-3" />
          Trial · {daysLeft}d
        </Badge>
      );
    }

    if (daysLeft === null) {
      return (
        <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 gap-1">
          <Crown className="w-3 h-3" />
          CRM (unbegrenzt)
        </Badge>
      );
    }

    if (daysLeft <= 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Abgelaufen
        </Badge>
      );
    }

    if (daysLeft <= 7) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 gap-1">
          <Clock className="w-3 h-3" />
          {daysLeft} Tag(e)
        </Badge>
      );
    }

    if (daysLeft <= 30) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
          <Clock className="w-3 h-3" />
          {daysLeft} Tage
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle className="w-3 h-3" />
        {daysLeft} Tage
      </Badge>
    );
  }, []);

  // Memoized stats calculation
  const stats = useMemo(() => {
    return {
      // Only count CRM companies that are not yet expired (days > 0 or unlimited/no expiry)
      activeSubscriptions: companies.filter(c => {
        if (!c.crm_enabled) return false;
        const days = getDaysUntilExpiry(c.subscription_expires_at);
        return days === null || days > 0;
      }).length,
      expiringIn7Days: companies.filter(c => {
        const days = getDaysUntilExpiry(c.subscription_expires_at);
        return c.crm_enabled && days !== null && days > 0 && days <= 7;
      }).length,
      // Exclude the 7-day bucket to avoid double-counting in the UI
      expiringIn30Days: companies.filter(c => {
        const days = getDaysUntilExpiry(c.subscription_expires_at);
        return c.crm_enabled && days !== null && days > 7 && days <= 30;
      }).length,
      expired: companies.filter(c => {
        const days = getDaysUntilExpiry(c.subscription_expires_at);
        return c.crm_enabled && days !== null && days <= 0;
      }).length,
      basicCount: companies.filter(c => !c.crm_enabled).length,
    };
  }, [companies]);

  // Filtered companies based on search and status
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          company.company_name?.toLowerCase().includes(query) ||
          company.email?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== "all") {
        const days = getDaysUntilExpiry(company.subscription_expires_at);
        
        switch (statusFilter) {
          case "active":
            if (!company.crm_enabled) return false;
            if (days !== null && days <= 0) return false;
            break;
          case "expiring":
            if (!company.crm_enabled) return false;
            if (days === null || days <= 0 || days > 30) return false;
            break;
          case "expired":
            if (!company.crm_enabled) return false;
            if (days === null || days > 0) return false;
            break;
          case "basic":
            if (company.crm_enabled) return false;
            break;
        }
      }
      
      return true;
    });
  }, [companies, searchQuery, statusFilter]);

  // Paginated companies
  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCompanies.slice(startIndex, startIndex + pageSize);
  }, [filteredCompanies, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredCompanies.length / pageSize);
  }, [filteredCompanies.length, pageSize]);

  return (
    <>
      <Helmet>
        <title>Abonnements | Offerio Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">CRM-Abonnements</h2>
              <p className="text-muted-foreground text-sm">Abos verwalten, Zahlungen erfassen, Verlängerungen</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={runStripeImport}
                disabled={isRunningStripeImport}
                aria-busy={isRunningStripeImport}
                className="flex-1 sm:flex-none border-violet-200 text-violet-700 hover:bg-violet-50"
                title="Alle Stripe-Abonnements importieren und per E-Mail den Firmen zuordnen"
              >
                {isRunningStripeImport ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Stripe Import</span>
                <span className="sm:hidden">Import</span>
              </Button>
              <Button
                variant="outline"
                onClick={runStripeSync}
                disabled={isRunningStripeSync}
                aria-busy={isRunningStripeSync}
                className="flex-1 sm:flex-none border-violet-200 text-violet-700 hover:bg-violet-50"
                title="Live-Status aller Stripe-Abonnements abrufen und synchronisieren"
              >
                {isRunningStripeSync ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Stripe Sync</span>
                <span className="sm:hidden">Sync</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={runSubscriptionManager}
                disabled={isRunningSyncManager}
                aria-busy={isRunningSyncManager}
                className="flex-1 sm:flex-none"
              >
                {isRunningSyncManager ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Erinnerungen senden</span>
                <span className="sm:hidden">Erinnerungen</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => fetchData(true)} 
                disabled={isRefreshing}
                aria-label="Daten aktualisieren"
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Aktualisieren</span>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
                    <p className="text-sm text-muted-foreground">Aktive CRM-Abos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.expiringIn30Days}</p>
                    <p className="text-sm text-muted-foreground">8–30 Tage verbleibend</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.expiringIn7Days}</p>
                    <p className="text-sm text-muted-foreground">Läuft in 7 Tagen ab</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.expired}</p>
                    <p className="text-sm text-muted-foreground">Abgelaufen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="companies">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="companies" className="gap-2 flex-1 sm:flex-none">
                <Building2 className="w-4 h-4" />
                Firmen
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-2 flex-1 sm:flex-none">
                <CreditCard className="w-4 h-4" />
                Zahlungen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="companies" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle>Alle Firmen</CardTitle>
                      <CardDescription>CRM-Status und Abo-Verwaltung ({filteredCompanies.length} Firmen)</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Firma suchen..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 w-full sm:w-[200px]"
                          aria-label="Firma suchen"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                        <SelectTrigger className="w-full sm:w-[150px]" aria-label="Status Filter">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          <SelectItem value="active">Aktiv</SelectItem>
                          <SelectItem value="expiring">Läuft ab</SelectItem>
                          <SelectItem value="expired">Abgelaufen</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingCompanies ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                    </div>
                  ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {searchQuery || statusFilter !== "all" 
                        ? "Keine Firmen gefunden, die den Filterkriterien entsprechen."
                        : "Noch keine Firmen vorhanden."}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                      <Table aria-label="Firmen-Abonnements">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Firma</TableHead>
                            <TableHead>E-Mail</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ablaufdatum</TableHead>
                            <TableHead>Stripe</TableHead>
                            <TableHead>Letzte Erinnerung</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCompanies.map((company) => (
                            <TableRow key={company.id}>
                              <TableCell className="font-medium max-w-[200px] truncate" title={company.company_name}>
                                {company.company_name || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={company.email}>
                                {company.email || '-'}
                              </TableCell>
                              <TableCell>{getExpiryBadge(company)}</TableCell>
                              <TableCell>{formatDateSafe(company.subscription_expires_at)}</TableCell>
                              <TableCell>
                                {company.stripe_subscription_id ? (
                                  <div className="flex flex-col gap-1">
                                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1 text-xs w-fit">
                                      <CreditCard className="w-3 h-3" />
                                      Stripe
                                    </Badge>
                                    <a
                                      href={`https://dashboard.stripe.com/subscriptions/${company.stripe_subscription_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-muted-foreground hover:text-violet-700 flex items-center gap-0.5 transition-colors"
                                      title={company.stripe_subscription_id}
                                    >
                                      {company.stripe_subscription_id.slice(0, 14)}…
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : company.stripe_customer_id ? (
                                  <a
                                    href={`https://dashboard.stripe.com/customers/${company.stripe_customer_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-violet-700 flex items-center gap-0.5 transition-colors"
                                    title={company.stripe_customer_id}
                                  >
                                    Kunde
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">–</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {company.last_reminder_type ? (
                                  <Badge variant="outline" className="text-xs">
                                    {company.last_reminder_type.replace("expiry_", "").replace("_", " ")}
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setLinkCompany(company);
                                      setLinkCustomerId(company.stripe_customer_id ?? "");
                                      setLinkSubscriptionId(company.stripe_subscription_id ?? "");
                                      setIsLinkDialogOpen(true);
                                    }}
                                    disabled={submittingCompanyId === company.id}
                                    aria-label={`Stripe IDs für ${company.company_name} verknüpfen`}
                                    title="Stripe Kunden- oder Abonnement-ID manuell verknüpfen"
                                    className="text-violet-600 hover:text-violet-800 hover:bg-violet-50"
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Stripe
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setSelectedCompany(company); setIsTrialDialogOpen(true); }}
                                    disabled={submittingCompanyId === company.id}
                                    aria-label={`${company.company_name} Trial gewähren`}
                                    title={company.trial_used ? "Trial bereits verwendet" : "Kostenlosen Trial gewähren"}
                                  >
                                    {submittingCompanyId === company.id ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Clock className="w-3 h-3 mr-1" />
                                    )}
                                    Trial
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openExtendDialog(company)}
                                    disabled={submittingCompanyId === company.id}
                                    aria-label={`${company.company_name} Abo verlängern`}
                                  >
                                    {submittingCompanyId === company.id ? (
                                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                      <CalendarPlus className="w-4 h-4 mr-1" />
                                    )}
                                    Verlängern
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPaymentDialog(company)}
                                    disabled={submittingCompanyId === company.id}
                                    aria-label={`Zahlung für ${company.company_name} erfassen`}
                                  >
                                    <Receipt className="w-4 h-4 mr-1" />
                                    Zahlung
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Seite {currentPage} von {totalPages} ({filteredCompanies.length} Firmen)
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              aria-label="Vorherige Seite"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              aria-label="Nächste Seite"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Zahlungshistorie</CardTitle>
                  <CardDescription>Letzte {payments.length} Zahlungen</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPayments ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Noch keine Zahlungen erfasst
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table aria-label="Zahlungshistorie">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Firma</TableHead>
                          <TableHead>Betrag</TableHead>
                          <TableHead>Methode</TableHead>
                          <TableHead>Monate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Referenz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => {
                          const isStripe = payment.payment_method === "stripe";
                          // payment_reference for Stripe is the session/invoice ID
                          const stripeRef = isStripe && payment.payment_reference
                            ? payment.payment_reference
                            : null;
                          const stripeUrl = stripeRef
                            ? stripeRef.startsWith("cs_")
                              ? `https://dashboard.stripe.com/payments/${stripeRef}`
                              : stripeRef.startsWith("in_")
                              ? `https://dashboard.stripe.com/invoices/${stripeRef}`
                              : null
                            : null;

                          return (
                            <TableRow key={payment.id}>
                              <TableCell>{formatDateSafe(payment.created_at)}</TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {payment.company?.company_name || "-"}
                              </TableCell>
                              <TableCell>
                                CHF {(payment.amount ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {isStripe ? (
                                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    Stripe
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {payment.payment_method || '-'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{payment.subscription_months ?? 0} Mon.</TableCell>
                              <TableCell>
                                {payment.status === "confirmed" ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Bestätigt
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">{payment.status || '-'}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={payment.payment_reference || undefined}>
                                {stripeUrl ? (
                                  <a
                                    href={stripeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-violet-700 flex items-center gap-1 transition-colors"
                                    title={payment.payment_reference ?? undefined}
                                  >
                                    {(payment.payment_reference ?? "").slice(0, 16)}…
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  </a>
                                ) : (
                                  payment.payment_reference || "-"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Extend Dialog */}
        <Dialog open={isExtendDialogOpen} onOpenChange={(open) => !open && closeExtendDialog()}>
          <DialogContent aria-describedby="extend-dialog-description">
            <DialogHeader>
              <DialogTitle>Abo verlängern</DialogTitle>
              <DialogDescription id="extend-dialog-description">
                {selectedCompany?.company_name} - Abo ohne Zahlung verlängern (z.B. Testphase, Kulanz)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedCompany && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Aktueller Status: {selectedCompany.crm_enabled ? 'CRM aktiv' : 'Basic'} | 
                    Ablauf: {formatDateSafe(selectedCompany.subscription_expires_at)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="extension-months">Verlängerung um</Label>
                <Select value={extensionMonths} onValueChange={setExtensionMonths}>
                  <SelectTrigger id="extension-months" aria-label="Verlängerungsdauer wählen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Monat</SelectItem>
                    <SelectItem value="3">3 Monate</SelectItem>
                    <SelectItem value="6">6 Monate</SelectItem>
                    <SelectItem value="12">12 Monate</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.months && (
                  <p className="text-sm text-destructive">{formErrors.months}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeExtendDialog} disabled={submittingCompanyId !== null}>
                Abbrechen
              </Button>
              <Button 
                onClick={extendSubscription} 
                disabled={submittingCompanyId !== null}
                aria-busy={submittingCompanyId !== null}
              >
                {submittingCompanyId !== null && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verlängern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trial Dialog */}
        <Dialog open={isTrialDialogOpen} onOpenChange={(open) => { if (!open) { setIsTrialDialogOpen(false); setSelectedCompany(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Testzeitraum gewähren</DialogTitle>
              <DialogDescription>
                {selectedCompany?.company_name} — kostenlosen CRM-Testzugang aktivieren.
                {selectedCompany?.trial_used && (
                  <span className="block mt-1 text-amber-600 font-medium">⚠️ Diese Firma hat bereits einen Trial verwendet (Admin kann trotzdem gewähren).</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="trial-days">Dauer</Label>
                <Select value={trialDays} onValueChange={setTrialDays}>
                  <SelectTrigger id="trial-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Tage</SelectItem>
                    <SelectItem value="14">14 Tage</SelectItem>
                    <SelectItem value="30">30 Tage</SelectItem>
                    <SelectItem value="60">60 Tage</SelectItem>
                    <SelectItem value="90">90 Tage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  Nach Ablauf des Trials muss die Firma ein kostenpflichtiges Abonnement abschliessen. Billing startet sobald sie abonnieren.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsTrialDialogOpen(false); setSelectedCompany(null); }} disabled={submittingCompanyId !== null}>
                Abbrechen
              </Button>
              <Button onClick={grantTrial} disabled={submittingCompanyId !== null} className="bg-blue-600 hover:bg-blue-700">
                {submittingCompanyId !== null && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Trial aktivieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Stripe Link Dialog */}
        <Dialog open={isLinkDialogOpen} onOpenChange={(open) => { if (!open) { setIsLinkDialogOpen(false); setLinkCompany(null); setLinkCustomerId(""); setLinkSubscriptionId(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-600" />
                Stripe verknüpfen
              </DialogTitle>
              <DialogDescription>
                {linkCompany?.company_name} — Stripe-IDs manuell eingeben. Nach dem Speichern "Stripe Sync" ausführen, um den Status zu aktualisieren.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert className="bg-violet-50 border-violet-200">
                <AlertCircle className="h-4 w-4 text-violet-600" />
                <AlertDescription className="text-violet-800 text-sm">
                  Stripe Customer ID (cus_…) und/oder Subscription ID (sub_…) aus dem{" "}
                  <a href="https://dashboard.stripe.com/customers" target="_blank" rel="noopener noreferrer" className="underline">
                    Stripe Dashboard
                  </a>{" "}kopieren.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="link-customer-id">Stripe Customer ID</Label>
                <Input
                  id="link-customer-id"
                  value={linkCustomerId}
                  onChange={(e) => setLinkCustomerId(e.target.value)}
                  placeholder="cus_..."
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-subscription-id">Stripe Subscription ID</Label>
                <Input
                  id="link-subscription-id"
                  value={linkSubscriptionId}
                  onChange={(e) => setLinkSubscriptionId(e.target.value)}
                  placeholder="sub_..."
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsLinkDialogOpen(false); setLinkCompany(null); }} disabled={isLinking}>
                Abbrechen
              </Button>
              <Button
                onClick={linkStripeIds}
                disabled={isLinking || (!linkCustomerId.trim() && !linkSubscriptionId.trim())}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isLinking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stripe Import Results Dialog */}
        <Dialog open={isImportResultOpen} onOpenChange={setIsImportResultOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-violet-600" />
                Stripe Import Ergebnis
              </DialogTitle>
              <DialogDescription>
                {stripeImportResult && (
                  <span>
                    <strong className="text-emerald-700">{stripeImportResult.matched} zugeordnet</strong>
                    {" · "}
                    <strong className="text-slate-600">{stripeImportResult.skipped} bereits verknüpft</strong>
                    {" · "}
                    <strong className="text-amber-700">{stripeImportResult.unmatched?.length ?? 0} nicht gefunden</strong>
                    {stripeImportResult.errors?.length > 0 && (
                      <> · <strong className="text-red-700">{stripeImportResult.errors.length} Fehler</strong></>
                    )}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {stripeImportResult?.unmatched && stripeImportResult.unmatched.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-2">
                    Nicht zugeordnet (keine passende Firma-E-Mail gefunden):
                  </p>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">E-Mail</TableHead>
                          <TableHead className="text-xs">Subscription ID</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Betrag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stripeImportResult.unmatched.map((row) => (
                          <TableRow key={row.subscription_id}>
                            <TableCell className="text-xs">{row.customer_email ?? "–"}</TableCell>
                            <TableCell className="text-xs font-mono">
                              <a
                                href={`https://dashboard.stripe.com/subscriptions/${row.subscription_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-violet-700 flex items-center gap-1"
                              >
                                {row.subscription_id.slice(0, 20)}…
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={row.status === "active" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-600"}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{row.currency} {(row.amount ?? 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Für diese Abonnements "Stripe" → Manuell verknüpfen per Firma-Zeile in der Tabelle.
                  </p>
                </div>
              )}
              {stripeImportResult?.errors && stripeImportResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-red-700 mb-2">Fehler:</p>
                  <ul className="text-xs text-red-600 space-y-1 list-disc pl-4">
                    {stripeImportResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {stripeImportResult?.matched === 0 && stripeImportResult?.unmatched?.length === 0 && (
                <div className="space-y-3">
                  {stripeImportResult.diagnostic ? (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 space-y-2">
                        <p className="font-semibold">Stripe'da abonelik bulunamadı</p>
                        <div className="text-xs space-y-1 font-mono bg-amber-100 rounded p-2">
                          <p>Key modu: <strong>{stripeImportResult.diagnostic.key_mode}</strong> ({stripeImportResult.diagnostic.key_prefix})</p>
                          <p>Abonelikler: <strong>{stripeImportResult.diagnostic.subscriptions_found}</strong></p>
                          <p>Müşteriler: <strong>{stripeImportResult.diagnostic.customers_found}</strong></p>
                        </div>
                        <p className="text-sm">{stripeImportResult.diagnostic.hint}</p>
                        {stripeImportResult.diagnostic.key_mode === "test" && (
                          <p className="text-sm font-medium text-amber-900">
                            ⚠️ Test modu aktif. Eğer aboneliği live modda oluşturduysanız, Supabase'deki <code className="bg-amber-200 px-1 rounded">STRIPE_SECRET_KEY</code>'i <strong>sk_live_...</strong> anahtarıyla değiştirmeniz gerekiyor.
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Stripe-Abonnements gefunden. Bitte prüfen Sie den STRIPE_SECRET_KEY.
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsImportResultOpen(false)}>Schliessen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => !open && closePaymentDialog()}>
          <DialogContent className="max-w-md" aria-describedby="payment-dialog-description">
            <DialogHeader>
              <DialogTitle>Zahlung erfassen</DialogTitle>
              <DialogDescription id="payment-dialog-description">
                {selectedCompany?.company_name} - Zahlung erfassen und Abo automatisch verlängern
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedCompany && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Aktueller Status: {selectedCompany.crm_enabled ? 'CRM aktiv' : 'Basic'} | 
                    Ablauf: {formatDateSafe(selectedCompany.subscription_expires_at)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Betrag (CHF)</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min={MIN_PAYMENT_AMOUNT}
                    max={MAX_PAYMENT_AMOUNT}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="99.00"
                    aria-invalid={!!formErrors.amount}
                    aria-describedby={formErrors.amount ? "amount-error" : undefined}
                  />
                  {formErrors.amount && (
                    <p id="amount-error" className="text-sm text-destructive">{formErrors.amount}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-months">Laufzeit</Label>
                  <Select value={extensionMonths} onValueChange={setExtensionMonths}>
                    <SelectTrigger id="payment-months" aria-label="Laufzeit wählen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Monat</SelectItem>
                      <SelectItem value="3">3 Monate</SelectItem>
                      <SelectItem value="6">6 Monate</SelectItem>
                      <SelectItem value="12">12 Monate</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.months && (
                    <p className="text-sm text-destructive">{formErrors.months}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Zahlungsmethode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" aria-label="Zahlungsmethode wählen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Rechnung</SelectItem>
                    <SelectItem value="bank_transfer">Banküberweisung</SelectItem>
                    <SelectItem value="twint">TWINT</SelectItem>
                    <SelectItem value="stripe">Kreditkarte</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="other">Andere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Referenz / Transaktions-ID</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="z.B. INV-2024-001"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notizen</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optionale Notizen..."
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closePaymentDialog} disabled={submittingCompanyId !== null}>
                Abbrechen
              </Button>
              <Button 
                onClick={recordPayment} 
                disabled={submittingCompanyId !== null}
                aria-busy={submittingCompanyId !== null}
              >
                {submittingCompanyId !== null && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Zahlung erfassen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </>
  );
}

