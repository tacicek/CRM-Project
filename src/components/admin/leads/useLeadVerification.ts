import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getServiceLabel } from "@/lib/serviceLabels";
import { useAuth } from "@/hooks/useAuth";
import { logAdminAction } from "@/lib/auditLogger";
import {
  DEFAULT_PAGE_SIZE,
  MAX_CONCURRENT_REQUESTS,
  PENDING_STATUSES,
  VERIFIED_STATUSES,
  NO_MATCH_STATUSES,
  AWAITING_CONFIRMATION_STATUSES,
  RISKY_STATUSES,
  type Lead,
  type BlacklistEntry,
  type LeadDistribution,
} from "./types";
import { isVerifiedStatus, isValidIpAddress, escapeCSV, processBatch, formatDate } from "./utils";

function buildSearchOrClause(searchQuery: string): string {
  // Escape PostgreSQL LIKE wildcards (_ and \) to prevent unintended matches
  const normalized = searchQuery.trim()
    .replace(/\\/g, "\\\\")
    .replace(/_/g, "\\_")
    .replace(/[,%]/g, " ");
  if (!normalized) return "";

  return [
    `customer_first_name.ilike.%${normalized}%`,
    `customer_last_name.ilike.%${normalized}%`,
    `customer_email.ilike.%${normalized}%`,
    `customer_phone.ilike.%${normalized}%`,
    `from_city.ilike.%${normalized}%`,
    `slug.ilike.%${normalized}%`,
  ].join(",");
}

export function useLeadVerification() {
  const { user } = useAuth();

  // Core state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [filteredTotalCount, setFilteredTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending_verification");
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Blacklist
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [isBlacklistDialogOpen, setIsBlacklistDialogOpen] = useState(false);
  const [newBlacklistIp, setNewBlacklistIp] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");

  // Distributions
  const [selectedLeadDistributions, setSelectedLeadDistributions] = useState<LeadDistribution[]>([]);

  // Bulk dialogs
  const [showBulkVerifyDialog, setShowBulkVerifyDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);

  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [noMatchCount, setNoMatchCount] = useState(0);
  const [autoVerifiedCount, setAutoVerifiedCount] = useState(0);
  const [manualVerifiedCount, setManualVerifiedCount] = useState(0);
  const [awaitingConfirmationCount, setAwaitingConfirmationCount] = useState(0);
  const [riskyCount, setRiskyCount] = useState(0);

  // Background refresh state (used by realtime events — does NOT show loading spinner)
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filteredTotalCount / pageSize));
  const startIndex = filteredTotalCount === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredTotalCount);
  const paginatedLeads = filteredLeads;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedLeads([]);
  }, [activeTab, searchQuery, serviceFilter, pageSize]);

  // --- Data fetching ---
  const fetchLeadStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const [
        { count: pending }, { count: verified }, { count: rejected }, { count: noMatch },
        { count: auto }, { count: manual },
        { count: awaitingConfirm }, { count: risky },
      ] = await Promise.all([
        supabase.from("leads").select("id", { head: true, count: "exact" }).in("status", [...PENDING_STATUSES]).neq("source", "import"),
        supabase.from("leads").select("id", { head: true, count: "exact" }).in("status", [...VERIFIED_STATUSES]).neq("source", "import"),
        supabase.from("leads").select("id", { head: true, count: "exact" }).eq("status", "rejected").neq("source", "import"),
        supabase.from("leads").select("id", { head: true, count: "exact" }).in("status", [...NO_MATCH_STATUSES]).neq("source", "import"),
        supabase
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .in("status", [...VERIFIED_STATUSES])
          .is("verified_by", null)
          .not("verified_at", "is", null)
          .neq("source", "import"),
        supabase
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .in("status", [...VERIFIED_STATUSES])
          .not("verified_by", "is", null)
          .neq("source", "import"),
        supabase.from("leads").select("id", { head: true, count: "exact" }).in("status", [...AWAITING_CONFIRMATION_STATUSES]).neq("source", "import"),
        supabase.from("leads").select("id", { head: true, count: "exact" }).in("status", [...RISKY_STATUSES]).neq("source", "import"),
      ]);

      if (signal?.aborted) return;

      setPendingCount(pending ?? 0);
      setVerifiedCount(verified ?? 0);
      setRejectedCount(rejected ?? 0);
      setNoMatchCount(noMatch ?? 0);
      setAutoVerifiedCount(auto ?? 0);
      setManualVerifiedCount(manual ?? 0);
      setAwaitingConfirmationCount(awaitingConfirm ?? 0);
      setRiskyCount(risky ?? 0);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching lead stats:", error);
    }
  }, []);

  const fetchLeads = useCallback(async (signal?: AbortSignal, showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false }).neq("source", "import");

      if (activeTab === "pending_verification") {
        query = query.in("status", [...PENDING_STATUSES]);
      } else if (activeTab === "verified") {
        query = query.in("status", [...VERIFIED_STATUSES]);
      } else if (activeTab === "rejected") {
        query = query.eq("status", "rejected");
      } else if (activeTab === "no_matches") {
        query = query.in("status", [...NO_MATCH_STATUSES]);
      } else if (activeTab === "awaiting_confirmation") {
        query = query.in("status", [...AWAITING_CONFIRMATION_STATUSES]);
      } else if (activeTab === "risky") {
        query = query.in("status", [...RISKY_STATUSES]);
      }

      if (serviceFilter !== "all") {
        query = query.eq("service_type", serviceFilter);
      }

      const searchClause = buildSearchOrClause(searchQuery);
      if (searchClause) {
        query = query.or(searchClause);
      }

      const { data, error, count } = await query.range(from, to);

      if (signal?.aborted) return;
      if (error) throw error;

      const pageRows = Array.isArray(data) ? (data as unknown as Lead[]) : [];
      setLeads(pageRows);
      setFilteredLeads(pageRows);
      setFilteredTotalCount(count ?? 0);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching leads:", error);
      toast.error("Fehler beim Laden der Leads");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeTab, currentPage, pageSize, searchQuery, serviceFilter]);

  const fetchBlacklist = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from("ip_blacklist")
        .select("*")
        .order("created_at", { ascending: false });

      if (signal?.aborted) return;
      if (error) throw error;
      setBlacklist(Array.isArray(data) ? (data as BlacklistEntry[]) : []);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching blacklist:", error);
    }
  }, []);

  // Initial fetch + cleanup
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchLeads(controller.signal);
    fetchLeadStats(controller.signal);
    fetchBlacklist(controller.signal);
    return () => { controller.abort(); };
  }, [fetchLeads, fetchLeadStats, fetchBlacklist]);

  // Auto-refresh leads list every 30 seconds (replaces postgres_changes subscription
  // on the leads table which contributed to excessive realtime.list_changes load).
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeads(undefined, false);
      fetchLeadStats();
    }, 30_000);

    return () => clearInterval(interval);
  }, [fetchLeads, fetchLeadStats]);

  const refreshLeadData = useCallback(async (showSpinner = true) => {
    await Promise.all([fetchLeads(undefined, showSpinner), fetchLeadStats()]);
  }, [fetchLeads, fetchLeadStats]);

  // --- Lead Actions ---
  const handleVerify = async (lead: Lead) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const previousState = {
      status: lead.status,
      verified_at: lead.verified_at,
      admin_notes: lead.admin_notes,
    };

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user?.id ?? null,
          admin_notes: adminNotes || null,
        })
        .eq("id", lead.id);
      if (error) throw error;

      toast.info("Lead wird an Firmen verteilt...");
      const { data: matchResult, error: matchError } = await supabase.functions.invoke("match-lead", {
        body: { lead_id: lead.id },
      });

      if (matchError) {
        let errorDetails: string | null = null;
        try {
          if (matchError.context && typeof matchError.context.json === "function") {
            const errorJson = await matchError.context.json();
            errorDetails = errorJson?.error || errorJson?.message || JSON.stringify(errorJson);
          }
        } catch { /* ignore */ }
        await supabase
          .from("leads")
          .update({
            status: previousState.status,
            verified_at: previousState.verified_at,
            verified_by: null,
            admin_notes: previousState.admin_notes,
          })
          .eq("id", lead.id);
        toast.error(`Verteilung fehlgeschlagen: ${errorDetails || matchError.message || "Unbekannter Fehler"}`);
        // Keep dialog open so admin can retry
        return;
      } else {
        const matchedCount = matchResult?.matched_count || 0;
        const emailsSent = matchResult?.emails_sent || 0;
        if (matchedCount > 0) {
          toast.success(`Lead an ${matchedCount} Firmen verteilt! (${emailsSent} E-Mails gesendet)`);
        } else {
          toast.warning("Lead verifiziert, aber keine passenden Firmen gefunden.");
        }
      }

      logAdminAction({
        action: "lead_verified",
        entity_type: "lead",
        entity_id: lead.id,
        details: { service_type: lead.service_type, matched_count: matchResult?.matched_count || 0 },
      });

      setIsDetailOpen(false);
      setAdminNotes("");
      await refreshLeadData(false);
    } catch (error) {
      console.error("Error verifying lead:", error);
      toast.error("Fehler beim Verifizieren");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLead || !rejectionReason.trim()) {
      toast.error("Bitte geben Sie einen Ablehnungsgrund ein");
      return;
    }
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "rejected", rejection_reason: rejectionReason.trim(), verified_at: new Date().toISOString(), admin_notes: adminNotes?.trim() || null })
        .eq("id", selectedLead.id);
      if (error) throw error;

      logAdminAction({
        action: "lead_rejected",
        entity_type: "lead",
        entity_id: selectedLead.id,
        details: { reason: rejectionReason.trim(), service_type: selectedLead.service_type },
      });

      toast.success("Lead als Spam markiert");
      setIsRejectDialogOpen(false);
      setIsDetailOpen(false);
      setRejectionReason("");
      setAdminNotes("");
      await refreshLeadData(false);
    } catch (error) {
      console.error("Error rejecting lead:", error);
      toast.error("Fehler beim Ablehnen");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkVerify = async () => {
    if (selectedLeads.length === 0) return;
    setShowBulkVerifyDialog(false);
    setIsProcessing(true);
    const leadsToProcess = [...selectedLeads];
    const verifiedLeadIds: string[] = [];

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "verified", verified_at: new Date().toISOString(), verified_by: user?.id ?? null })
        .in("id", leadsToProcess);
      if (error) throw error;
      verifiedLeadIds.push(...leadsToProcess);

      toast.info(`${leadsToProcess.length} Leads werden an Firmen verteilt...`);
      const { successes, failures } = await processBatch(
        leadsToProcess,
        async (leadId) => {
          const { error: matchError } = await supabase.functions.invoke("match-lead", { body: { lead_id: leadId } });
          if (matchError) throw matchError;
          return leadId;
        },
        MAX_CONCURRENT_REQUESTS
      );

      if (successes.length > 0) toast.success(`${successes.length} Leads erfolgreich verteilt!`);
      if (failures.length > 0) {
        const failedIds = failures.map((f) => f.item);
        // Don't touch admin_notes on rollback — they may have pre-existed
        await supabase
          .from("leads")
          .update({ status: "pending_verification", verified_at: null })
          .in("id", failedIds);
        toast.warning(`${failures.length} Leads konnten nicht verteilt werden.`);
      }

      setSelectedLeads([]);
      await refreshLeadData(false);
    } catch (error) {
      console.error("Error bulk verifying:", error);
      if (verifiedLeadIds.length > 0) {
        // Don't touch admin_notes on rollback — they may have pre-existed
        await supabase
          .from("leads")
          .update({ status: "pending_verification", verified_at: null })
          .in("id", verifiedLeadIds);
      }
      toast.error("Fehler bei Massenverifizierung.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedLeads.length === 0) return;
    setShowBulkRejectDialog(false);
    setIsProcessing(true);
    const count = selectedLeads.length;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "rejected", rejection_reason: "Massenablehnung als Spam", verified_at: new Date().toISOString() })
        .in("id", selectedLeads);
      if (error) throw error;
      toast.success(`${count} Leads abgelehnt`);
      setSelectedLeads([]);
      await refreshLeadData(false);
    } catch (error) {
      console.error("Error bulk rejecting:", error);
      toast.error("Fehler bei Massenablehnung");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Selection ---
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const selectAllVisible = () => {
    const visibleIds = paginatedLeads.map((l) => l.id);
    setSelectedLeads((prev) => {
      const newIds = visibleIds.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  };

  const deselectAll = () => setSelectedLeads([]);

  // --- Blacklist ---
  const addToBlacklist = async (ipAddress: string, reason: string) => {
    const trimmedIp = ipAddress.trim();
    if (!trimmedIp) { toast.error("Bitte geben Sie eine IP-Adresse ein"); return; }
    if (!isValidIpAddress(trimmedIp)) { toast.error("Ungültiges IP-Adressformat."); return; }

    setIsProcessing(true);
    try {
      const { error } = await supabase.from("ip_blacklist").insert({ ip_address: trimmedIp, reason: reason.trim() || null });
      if (error) {
        if (error.code === "23505") { toast.error("IP bereits auf der Blacklist"); } else { throw error; }
        return;
      }
      toast.success("IP zur Blacklist hinzugefügt");
      setNewBlacklistIp("");
      setNewBlacklistReason("");
      setIsBlacklistDialogOpen(false);
      fetchBlacklist();
    } catch (error) {
      console.error("Error adding to blacklist:", error);
      toast.error("Fehler beim Hinzufügen zur Blacklist");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFromBlacklist = async (id: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from("ip_blacklist").delete().eq("id", id);
      if (error) throw error;
      toast.success("IP von der Blacklist entfernt");
      fetchBlacklist();
    } catch (error) {
      console.error("Error removing from blacklist:", error);
      toast.error("Fehler beim Entfernen");
    } finally {
      setIsProcessing(false);
    }
  };

  const addLeadIpToBlacklist = (lead: Lead) => {
    if (lead.ip_address) {
      setNewBlacklistIp(lead.ip_address);
      setNewBlacklistReason(`Spam von Lead ${lead.slug || lead.id.substring(0, 8)}`);
      setIsBlacklistDialogOpen(true);
    }
  };

  // --- Detail dialog ---
  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setAdminNotes(lead.admin_notes || "");
    setIsDetailOpen(true);
    setSelectedLeadDistributions([]);

    if (isVerifiedStatus(lead.status)) {
      try {
        const { data, error } = await supabase
          .from("lead_distributions")
          .select("id, company_id, status, sent_at, token_cost, companies(company_name)")
          .eq("lead_id", lead.id)
          .order("sent_at", { ascending: false });

        if (!error && data) {
          const dists: LeadDistribution[] = data.map((d: Record<string, unknown>) => ({
            id: d.id as string,
            company_id: d.company_id as string,
            company_name: (d.companies as Record<string, unknown>)?.company_name as string || "Unbekannt",
            status: d.status as string,
            sent_at: d.sent_at as string,
            token_cost: d.token_cost as number,
          }));
          setSelectedLeadDistributions(dists);
        }
      } catch (error) {
        console.error("Error fetching distributions:", error);
      }
    }
  };

  // --- CSV Export ---
  const exportToCSV = async () => {
    try {
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).neq("source", "import");

      if (activeTab === "pending_verification") {
        query = query.in("status", [...PENDING_STATUSES]);
      } else if (activeTab === "verified") {
        query = query.in("status", [...VERIFIED_STATUSES]);
      } else if (activeTab === "rejected") {
        query = query.eq("status", "rejected");
      } else if (activeTab === "no_matches") {
        query = query.in("status", [...NO_MATCH_STATUSES]);
      } else if (activeTab === "awaiting_confirmation") {
        query = query.in("status", [...AWAITING_CONFIRMATION_STATUSES]);
      } else if (activeTab === "risky") {
        query = query.in("status", [...RISKY_STATUSES]);
      }

      if (serviceFilter !== "all") {
        query = query.eq("service_type", serviceFilter);
      }

      const searchClause = buildSearchOrClause(searchQuery);
      if (searchClause) {
        query = query.or(searchClause);
      }

      const { data, error } = await query;
      if (error) throw error;

      const exportRows = Array.isArray(data) ? (data as unknown as Lead[]) : [];
      const headers = ["Slug", "Service", "Status", "Vorname", "Nachname", "Email", "Telefon", "PLZ Von", "Ort Von", "PLZ Nach", "Ort Nach", "Datum", "Erstellt"];
      const rows = exportRows.map((l) => [
        escapeCSV(l.slug), escapeCSV(getServiceLabel(l.service_type)), escapeCSV(l.status),
        escapeCSV(l.customer_first_name), escapeCSV(l.customer_last_name),
        escapeCSV(l.customer_email), escapeCSV(l.customer_phone),
        escapeCSV(l.from_plz), escapeCSV(l.from_city),
        escapeCSV(l.to_plz), escapeCSV(l.to_city),
        escapeCSV(l.preferred_date ? formatDate(l.preferred_date) : "-"),
        escapeCSV(formatDate(l.created_at)),
      ]);

      const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("CSV Export fehlgeschlagen");
    }
  };

  return {
    // Core
    leads, filteredLeads, filteredTotalCount, isLoading, isRefreshing, selectedLead, setSelectedLead,
    isDetailOpen, setIsDetailOpen,
    isRejectDialogOpen, setIsRejectDialogOpen,
    rejectionReason, setRejectionReason,
    adminNotes, setAdminNotes,
    isProcessing,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    serviceFilter, setServiceFilter,
    selectedLeads, setSelectedLeads,

    // Pagination
    currentPage, setCurrentPage, pageSize, setPageSize,
    totalPages, startIndex, endIndex, paginatedLeads,

    // Blacklist
    blacklist, isBlacklistDialogOpen, setIsBlacklistDialogOpen,
    newBlacklistIp, setNewBlacklistIp,
    newBlacklistReason, setNewBlacklistReason,
    addToBlacklist, removeFromBlacklist, addLeadIpToBlacklist,

    // Distributions
    selectedLeadDistributions,

    // Bulk
    showBulkVerifyDialog, setShowBulkVerifyDialog,
    showBulkRejectDialog, setShowBulkRejectDialog,

    // Stats
    pendingCount, verifiedCount, rejectedCount, noMatchCount,
    autoVerifiedCount, manualVerifiedCount,
    awaitingConfirmationCount, riskyCount,

    // Actions
    fetchLeads: () => refreshLeadData(),
    handleVerify, handleReject,
    handleBulkVerify, handleBulkReject,
    toggleLeadSelection, selectAllVisible, deselectAll,
    openLeadDetail, exportToCSV,
  };
}
