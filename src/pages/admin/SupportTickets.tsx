/**
 * Admin Support Tickets Page
 * View and manage support tickets from companies
 */

import { Helmet } from "react-helmet-async";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  Send,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  User,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedCallback } from "use-debounce";

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEMS_PER_PAGE = 20;
const MAX_MESSAGE_LENGTH = 5000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for Ticket
 */
function isValidTicket(item: unknown): item is Ticket {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.subject === 'string' &&
    typeof obj.status === 'string'
  );
}

/**
 * Type guard for TicketMessage
 */
function isValidTicketMessage(item: unknown): item is TicketMessage {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.message === 'string'
  );
}

/**
 * Safe date formatting
 */
function formatDateSafe(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return '-';
  }
}

/**
 * Calculate time since date
 */
function getTimeSinceSafe(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch {
    return '-';
  }
}

/**
 * User-friendly error message
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('permission') || message.includes('policy')) {
    return 'Keine Berechtigung für diese Aktion.';
  }
  
  return 'Fehler bei der Aktion. Bitte versuchen Sie es erneut.';
}

interface Ticket {
  id: string;
  company_id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  company?: {
    company_name: string;
    email: string;
  };
}

interface TicketMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
  is_internal: boolean;
}

const statusOptions = [
  { value: "open", label: "Offen", color: "bg-blue-100 text-blue-700" },
  { value: "in_progress", label: "In Bearbeitung", color: "bg-amber-100 text-amber-700" },
  { value: "answered", label: "Beantwortet", color: "bg-green-100 text-green-700" },
  { value: "closed", label: "Geschlossen", color: "bg-slate-100 text-slate-500" },
];

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
  urgent: "bg-red-200 text-red-800",
};

const categoryLabels: Record<string, string> = {
  technical: "Technisch",
  billing: "Abrechnung",
  feature_request: "Feature",
  bug_report: "Bug",
  general: "Allgemein",
  account: "Konto",
};

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTicketsForStats, setAllTicketsForStats] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Status change confirmation
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ ticketId: string; status: string } | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Refs for async safety
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Debounced search
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, 300);

  // Fetch all tickets for stats (unfiltered)
  const fetchAllTicketsForStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, status");

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      setAllTicketsForStats((data || []) as Ticket[]);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    try {
      let query = supabase
        .from("support_tickets")
        .select("*, company:companies(company_name, email)")
        .order("created_at", { ascending: false });

      if (activeFilter !== "all") {
        query = query.eq("status", activeFilter);
      }

      const { data, error } = await query;

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validTickets = (data || []).filter(isValidTicket);
      setTickets(validTickets);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching tickets:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeFilter, toast]);

  useEffect(() => {
    fetchTickets();
    fetchAllTicketsForStats();
  }, [fetchTickets, fetchAllTicketsForStats]);

  const fetchTicketMessages = useCallback(async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validMessages = (data || []).filter(isValidTicketMessage);
      setTicketMessages(validMessages);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error fetching messages:", error);
    }
  }, []);

  const openTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
    setIsInternal(false);
    fetchTicketMessages(ticket.id);
  }, [fetchTicketMessages]);

  // Request status change confirmation for "closed"
  const requestStatusChange = (ticketId: string, status: string) => {
    if (status === "closed") {
      setPendingStatusChange({ ticketId, status });
      setStatusConfirmOpen(true);
    } else {
      updateTicketStatusDirect(ticketId, status);
    }
  };

  const updateTicketStatusDirect = useCallback(async (ticketId: string, status: string) => {
    if (isUpdatingStatus) return;
    
    setIsUpdatingStatus(true);
    
    // Optimistic update
    const previousTickets = [...tickets];
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status } : t
    ));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status } : prev);
    }
    
    try {
      const updates: Record<string, string | null> = { status };
      if (status === "closed") {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Status aktualisiert",
        description: `Ticket-Status wurde auf "${statusOptions.find(s => s.value === status)?.label}" geändert.`,
      });

      // Update stats
      fetchAllTicketsForStats();
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Rollback on error
      setTickets(previousTickets);
      if (selectedTicket?.id === ticketId) {
        const originalTicket = previousTickets.find(t => t.id === ticketId);
        if (originalTicket) {
          setSelectedTicket(originalTicket);
        }
      }
      
      console.error("Error updating status:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsUpdatingStatus(false);
      }
    }
  }, [isUpdatingStatus, tickets, selectedTicket, toast, fetchAllTicketsForStats]);

  const confirmStatusChange = useCallback(() => {
    if (pendingStatusChange) {
      updateTicketStatusDirect(pendingStatusChange.ticketId, pendingStatusChange.status);
    }
    setStatusConfirmOpen(false);
    setPendingStatusChange(null);
  }, [pendingStatusChange, updateTicketStatusDirect]);

  const sendReply = useCallback(async () => {
    // Double submit protection
    if (isSubmitting) return;
    
    if (!replyMessage.trim()) {
      toast({
        title: "Validierung",
        description: "Bitte geben Sie eine Nachricht ein.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedTicket) return;
    
    if (replyMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Validierung",
        description: `Nachricht darf max. ${MAX_MESSAGE_LENGTH} Zeichen haben.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    const messageToSend = replyMessage.trim();
    const wasInternal = isInternal;
    
    // Optimistic update for message
    const optimisticMessage: TicketMessage = {
      id: `temp-${Date.now()}`,
      sender_type: "admin",
      message: messageToSend,
      created_at: new Date().toISOString(),
      is_internal: wasInternal,
    };
    setTicketMessages(prev => [...prev, optimisticMessage]);
    setReplyMessage("");
    setIsInternal(false);
    
    try {
      // Add message
      const { error: msgError } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user?.id,
          sender_type: "admin",
          message: messageToSend,
          is_internal: wasInternal,
        });

      if (!isMountedRef.current) return;
      if (msgError) throw msgError;

      // Only update status and first_response_at for real replies, not internal notes.
      // An internal note is not visible to the customer, so the ticket is not "answered".
      if (!wasInternal) {
        const updates: Record<string, string> = {
          status: "answered",
        };
        if (!selectedTicket.first_response_at) {
          updates.first_response_at = new Date().toISOString();
        }

        await supabase
          .from("support_tickets")
          .update(updates)
          .eq("id", selectedTicket.id);

        // Update ticket in list
        setTickets(prev => prev.map(t =>
          t.id === selectedTicket.id ? { ...t, status: "answered" } : t
        ));
        setSelectedTicket(prev => prev ? { ...prev, status: "answered" } : prev);
      }

      toast({
        title: wasInternal ? "Interne Notiz hinzugefügt" : "Antwort gesendet",
        description: wasInternal 
          ? "Die interne Notiz wurde gespeichert."
          : "Die Antwort wurde an den Kunden gesendet.",
      });

      // Refresh messages to get real ID
      fetchTicketMessages(selectedTicket.id);

      fetchAllTicketsForStats();
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Rollback optimistic update
      setTicketMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setReplyMessage(messageToSend);
      setIsInternal(wasInternal);
      
      console.error("Error sending reply:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, replyMessage, selectedTicket, isInternal, user?.id, toast, fetchTicketMessages, fetchAllTicketsForStats]);

  // Stats from all tickets (not filtered)
  const stats = useMemo(() => ({
    open: allTicketsForStats.filter(t => t.status === "open").length,
    inProgress: allTicketsForStats.filter(t => t.status === "in_progress").length,
    answered: allTicketsForStats.filter(t => t.status === "answered").length,
    total: allTicketsForStats.length,
  }), [allTicketsForStats]);

  // Filtered and paginated tickets
  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    
    const query = searchQuery.toLowerCase();
    return tickets.filter(ticket => 
      ticket.subject.toLowerCase().includes(query) ||
      ticket.message.toLowerCase().includes(query) ||
      ticket.company?.company_name?.toLowerCase().includes(query) ||
      ticket.contact_email?.toLowerCase().includes(query)
    );
  }, [tickets, searchQuery]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  return (
    <>
      <Helmet>
        <title>Support-Tickets | Offerio Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Support-Tickets</h2>
              <p className="text-muted-foreground">Kundenanfragen bearbeiten</p>
            </div>
            <Button variant="outline" onClick={fetchTickets} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveFilter("open")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.open}</p>
                    <p className="text-sm text-muted-foreground">Offen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveFilter("in_progress")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                    <p className="text-sm text-muted-foreground">In Bearbeitung</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveFilter("answered")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.answered}</p>
                    <p className="text-sm text-muted-foreground">Beantwortet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveFilter("all")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Gesamt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Tabs and Search */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <Tabs value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setCurrentPage(1); }}>
              <TabsList>
                <TabsTrigger value="open">Offen</TabsTrigger>
                <TabsTrigger value="in_progress">In Bearbeitung</TabsTrigger>
                <TabsTrigger value="answered">Beantwortet</TabsTrigger>
                <TabsTrigger value="closed">Geschlossen</TabsTrigger>
                <TabsTrigger value="all">Alle</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche..."
                value={searchInputValue}
                onChange={(e) => {
                  setSearchInputValue(e.target.value);
                  debouncedSetSearch(e.target.value);
                }}
                className="pl-9"
                aria-label="Tickets durchsuchen"
              />
            </div>
          </div>

          {/* Tickets Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Priorität</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Alter</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell>
                          <Skeleton className="h-5 w-48 mb-1" />
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Keine Tickets gefunden</p>
                  {searchQuery && (
                    <Button 
                      variant="link" 
                      onClick={() => { setSearchInputValue(""); setSearchQuery(""); }}
                      className="mt-2"
                    >
                      Suche zurücksetzen
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Priorität</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Alter</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTickets.map((ticket) => (
                        <TableRow 
                          key={ticket.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openTicket(ticket)}
                        >
                          <TableCell>
                            <div className="font-medium">{ticket.subject}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {ticket.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {ticket.company?.company_name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {categoryLabels[ticket.category] || ticket.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={priorityColors[ticket.priority] || ""}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusOptions.find(s => s.value === ticket.status)?.color || ""}>
                              {statusOptions.find(s => s.value === ticket.status)?.label || ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {getTimeSinceSafe(ticket.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline">
                              Öffnen
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {filteredTickets.length} Tickets gefunden
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Zurück
                        </Button>
                        <span className="flex items-center px-3 text-sm">
                          Seite {currentPage} von {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Weiter
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-xl">{selectedTicket?.subject}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Erstellt am {formatDateSafe(selectedTicket?.created_at)}
                  </p>
                </div>
                <Select
                  value={selectedTicket?.status}
                  onValueChange={(value) => selectedTicket && requestStatusChange(selectedTicket.id, value)}
                  disabled={isUpdatingStatus}
                >
                  <SelectTrigger className="w-40" aria-label="Ticket-Status ändern">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <Badge className={status.color}>{status.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Company Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedTicket?.company?.company_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedTicket?.contact_email || selectedTicket?.company?.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedTicket?.contact_email && (
                        <a href={`mailto:${selectedTicket.contact_email}`}>
                          <Button size="sm" variant="outline">
                            <Mail className="w-4 h-4 mr-1" />
                            E-Mail
                          </Button>
                        </a>
                      )}
                      {selectedTicket?.contact_phone && (
                        <a href={`tel:${selectedTicket.contact_phone}`}>
                          <Button size="sm" variant="outline">
                            <Phone className="w-4 h-4 mr-1" />
                            Anrufen
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Original Message */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Kunde</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateSafe(selectedTicket?.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{selectedTicket?.message}</p>
              </div>

              {/* Messages Thread */}
              {ticketMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-4 ${
                    msg.is_internal
                      ? "bg-amber-50 border border-amber-200"
                      : msg.sender_type === "admin"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {msg.sender_type === "admin" ? (
                      <Badge variant="outline" className="text-xs">
                        {msg.is_internal ? "Interne Notiz" : "Support-Team"}
                      </Badge>
                    ) : (
                      <span className="text-sm font-medium">Kunde</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateSafe(msg.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            {selectedTicket?.status !== "closed" && (
              <div className="border-t pt-4 space-y-3">
                <div className="relative">
                  <Textarea
                    id="reply-message"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={isInternal ? "Interne Notiz (nur für Admins sichtbar)..." : "Antwort an den Kunden..."}
                    rows={3}
                    maxLength={MAX_MESSAGE_LENGTH}
                    aria-label="Antwort schreiben"
                    aria-describedby="reply-char-count"
                  />
                  <span 
                    id="reply-char-count" 
                    className="absolute bottom-2 right-2 text-xs text-muted-foreground"
                  >
                    {replyMessage.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="internal-note"
                      checked={isInternal}
                      onCheckedChange={(checked) => setIsInternal(checked === true)}
                    />
                    <Label 
                      htmlFor="internal-note" 
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Interne Notiz (nicht für Kunde sichtbar)
                    </Label>
                  </div>
                  <Button 
                    onClick={sendReply} 
                    disabled={isSubmitting || !replyMessage.trim()}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isInternal ? "Notiz speichern" : "Antwort senden"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Status Change Confirmation Dialog */}
        <AlertDialog open={statusConfirmOpen} onOpenChange={(open) => {
          if (!open) setPendingStatusChange(null);
          setStatusConfirmOpen(open);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ticket schließen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie dieses Ticket wirklich schließen? 
                Der Kunde kann danach keine weiteren Nachrichten senden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingStatusChange(null)}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange}>
                Ticket schließen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </>
  );
}

