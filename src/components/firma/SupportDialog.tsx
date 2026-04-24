/**
 * Support Dialog Component
 * Allows companies to create support tickets and contact admin
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  MessageCircle,
  Send,
  Loader2,
  Phone,
  Mail,
  HelpCircle,
  Clock,
  CheckCircle,
  MessageSquare,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SUBJECT_LENGTH = 100;
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
 * User-friendly error message
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
      return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
    if (msg.includes('unauthorized') || msg.includes('401'))
      return 'Sie sind nicht berechtigt. Bitte melden Sie sich erneut an.';
    if (msg.includes('timeout') || msg.includes('aborted'))
      return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
    if (msg.includes('duplicate') || msg.includes('already exists'))
      return 'Ein Ticket mit diesem Betreff existiert bereits.';
    return error.message;
  }
  return 'Fehler bei der Aktion. Bitte versuchen Sie es erneut.';
}

interface SupportDialogProps {
  trigger?: React.ReactNode;
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
  is_internal?: boolean;
}

const categoryOptions = [
  { value: "general", label: "Allgemeine Frage" },
  { value: "technical", label: "Technisches Problem" },
  { value: "billing", label: "Abrechnung & Zahlung" },
  { value: "feature_request", label: "Feature-Vorschlag" },
  { value: "bug_report", label: "Fehler melden" },
  { value: "account", label: "Konto & Einstellungen" },
];

const priorityOptions = [
  { value: "low", label: "Niedrig", color: "bg-green-100 text-green-700" },
  { value: "medium", label: "Mittel", color: "bg-amber-100 text-amber-700" },
  { value: "high", label: "Hoch", color: "bg-red-100 text-red-700" },
];

const statusLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Offen", color: "bg-blue-100 text-blue-700", icon: Clock },
  in_progress: { label: "In Bearbeitung", color: "bg-amber-100 text-amber-700", icon: Loader2 },
  answered: { label: "Beantwortet", color: "bg-green-100 text-green-700", icon: CheckCircle },
  closed: { label: "Geschlossen", color: "bg-slate-100 text-slate-500", icon: CheckCircle },
};

export function SupportDialog({ trigger }: SupportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "tickets">("new");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyEmail, setCompanyEmail] = useState<string>("");

  // Form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [replyMessage, setReplyMessage] = useState("");

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

  const fetchCompanyInfo = useCallback(async () => {
    if (!user) return;
    try {
      const company = await fetchSingleCompanyForUser<{
        id: string;
        company_name: string;
        email: string;
      }>({
        userId: user.id,
        userEmail: user.email,
        select: "id, company_name, email",
      });

      if (!isMountedRef.current) return;
      
      if (company) {
        setCompanyId(company.id);
        setCompanyName(company.company_name);
        setCompanyEmail(company.email);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error fetching company:", error);
    }
  }, [user]);

  const fetchTickets = useCallback(async () => {
    if (!user || !companyId) return;
    
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    try {
      // Filter by company_id for RLS safety
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validTickets = (data || []).filter(isValidTicket);
      setTickets(validTickets);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching tickets:", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user, companyId]);

  const fetchTicketMessages = useCallback(async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("is_internal", false) // CRITICAL: Filter out internal notes!
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

  // Fetch company info first, then tickets
  useEffect(() => {
    if (open && user) {
      fetchCompanyInfo();
    }
  }, [open, user, fetchCompanyInfo]);

  // Fetch tickets after company is loaded
  useEffect(() => {
    if (open && companyId) {
      fetchTickets();
    }
  }, [open, companyId, fetchTickets]);

  const handleSubmit = useCallback(async () => {
    // Double submit protection
    if (isSubmitting) return;
    
    // Validation
    if (!subject.trim()) {
      toast({
        title: "Validierung",
        description: "Bitte geben Sie einen Betreff ein.",
        variant: "destructive",
      });
      return;
    }
    
    if (subject.length > MAX_SUBJECT_LENGTH) {
      toast({
        title: "Validierung",
        description: `Betreff darf max. ${MAX_SUBJECT_LENGTH} Zeichen haben.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!message.trim()) {
      toast({
        title: "Validierung",
        description: "Bitte geben Sie eine Nachricht ein.",
        variant: "destructive",
      });
      return;
    }
    
    if (message.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Validierung",
        description: `Nachricht darf max. ${MAX_MESSAGE_LENGTH} Zeichen haben.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!companyId) {
      toast({
        title: "Fehler",
        description: "Firma nicht gefunden. Bitte laden Sie die Seite neu.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          company_id: companyId,
          user_id: user?.id,
          subject: subject.trim(),
          message: message.trim(),
          category,
          priority,
          contact_email: companyEmail,
          page_url: window.location.href,
        })
        .select()
        .single();

      if (!isMountedRef.current) return;
      if (ticketError) throw ticketError;

      // Send notification email (fire and forget)
      supabase.functions.invoke("notify-support-ticket", {
        body: {
          ticketId: ticket.id,
          companyName,
          companyEmail,
          subject: subject.trim(),
          message: message.trim(),
          category,
          priority,
        },
      }).catch(emailError => {
        console.error("Error sending notification:", emailError);
      });

      toast({
        title: "Ticket erstellt",
        description: "Ihre Anfrage wurde gesendet. Wir melden uns schnellstmöglich bei Ihnen.",
      });

      // Reset form
      setSubject("");
      setMessage("");
      setCategory("general");
      setPriority("medium");

      // Refresh tickets
      fetchTickets();
      setActiveTab("tickets");
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error("Error creating ticket:", error);
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
  }, [isSubmitting, subject, message, companyId, user?.id, category, priority, companyEmail, companyName, toast, fetchTickets]);

  const handleReply = useCallback(async () => {
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
    
    if (replyMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Validierung",
        description: `Nachricht darf max. ${MAX_MESSAGE_LENGTH} Zeichen haben.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedTicket) return;

    setIsSubmitting(true);
    
    const messageToSend = replyMessage.trim();
    
    // Optimistic update
    const optimisticMessage: TicketMessage = {
      id: `temp-${Date.now()}`,
      sender_type: "company",
      message: messageToSend,
      created_at: new Date().toISOString(),
    };
    setTicketMessages(prev => [...prev, optimisticMessage]);
    setReplyMessage("");
    
    try {
      const { error } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user?.id,
          sender_type: "company",
          message: messageToSend,
        });

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Nachricht gesendet",
        description: "Ihre Antwort wurde gesendet.",
      });

      // Refresh to get real ID
      fetchTicketMessages(selectedTicket.id);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Rollback optimistic update
      setTicketMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setReplyMessage(messageToSend);
      
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
  }, [isSubmitting, replyMessage, selectedTicket, user?.id, toast, fetchTicketMessages]);

  const openTicketDetail = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
    fetchTicketMessages(ticket.id);
  }, [fetchTicketMessages]);

  // Open ticket count for badge
  const openTicketCount = useMemo(() => 
    tickets.filter(t => t.status !== "closed").length,
    [tickets]
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset all form/navigation state when dialog closes
      setSubject("");
      setMessage("");
      setCategory("general");
      setPriority("medium");
      setReplyMessage("");
      setSelectedTicket(null);
      setActiveTab("new");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            Support
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Support & Hilfe
          </DialogTitle>
          <DialogDescription>
            Haben Sie Fragen oder Probleme? Wir helfen Ihnen gerne weiter.
          </DialogDescription>
        </DialogHeader>

        {selectedTicket ? (
          // Ticket Detail View
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTicket(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Zurück
              </Button>
              <div className="flex-1" />
              <Badge className={statusLabels[selectedTicket.status]?.color || ""}>
                {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
              </Badge>
            </div>

            <h3 className="font-semibold text-lg mb-2">{selectedTicket.subject}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Erstellt am {formatDateSafe(selectedTicket.created_at)}
            </p>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
              {/* Original message */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Sie</p>
                <p className="whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Thread messages */}
              {ticketMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 ${
                    msg.sender_type === "admin"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/50"
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {msg.sender_type === "admin" ? "Support-Team" : "Sie"} •{" "}
                    {formatDateSafe(msg.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Reply input */}
            {selectedTicket.status !== "closed" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Textarea
                    id="reply-message"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Ihre Antwort..."
                    rows={2}
                    maxLength={MAX_MESSAGE_LENGTH}
                    className="flex-1"
                    aria-label="Antwort schreiben"
                  />
                  <Button
                    onClick={handleReply}
                    disabled={isSubmitting || !replyMessage.trim()}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {replyMessage.length}/{MAX_MESSAGE_LENGTH}
                </p>
              </div>
            )}
          </div>
        ) : (
          // Main View with Tabs
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "new" | "tickets")} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="new" className="gap-2">
                <Plus className="w-4 h-4" />
                Neue Anfrage
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Meine Tickets
                {openTicketCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {openTicketCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="flex-1 overflow-y-auto mt-4 space-y-4">
              {/* Quick Contact Info */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="tel:+41793363402"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Telefon</p>
                    <p className="text-xs text-muted-foreground">+41 79 336 34 02</p>
                  </div>
                </a>
                <a
                  href="mailto:info@offerio.ch"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">E-Mail</p>
                    <p className="text-xs text-muted-foreground">info@offerio.ch</p>
                  </div>
                </a>
              </div>

              {/* Ticket Form */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorität</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={`px-2 py-0.5 rounded text-xs ${opt.color}`}>
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket-subject">Betreff *</Label>
                  <Input
                    id="ticket-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Kurze Beschreibung Ihres Anliegens"
                    maxLength={MAX_SUBJECT_LENGTH}
                    aria-describedby="subject-count"
                  />
                  <p id="subject-count" className="text-xs text-muted-foreground text-right">
                    {subject.length}/{MAX_SUBJECT_LENGTH}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket-message">Nachricht *</Label>
                  <Textarea
                    id="ticket-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich..."
                    rows={5}
                    maxLength={MAX_MESSAGE_LENGTH}
                    aria-describedby="message-count"
                  />
                  <p id="message-count" className="text-xs text-muted-foreground text-right">
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </p>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !subject.trim() || !message.trim()}
                  className="w-full"
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Anfrage senden
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="tickets" className="flex-1 overflow-y-auto mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={`skeleton-${i}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <Skeleton className="h-5 w-48 mb-2" />
                            <Skeleton className="h-4 w-64 mb-1" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-5 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Noch keine Tickets vorhanden</p>
                  <Button
                    variant="link"
                    onClick={() => setActiveTab("new")}
                    className="mt-2"
                  >
                    Erste Anfrage erstellen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => {
                    const StatusIcon = statusLabels[ticket.status]?.icon || Clock;
                    return (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openTicketDetail(ticket)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{ticket.subject}</h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {ticket.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDateSafe(ticket.created_at)}
                              </p>
                            </div>
                            <Badge className={statusLabels[ticket.status]?.color || ""}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusLabels[ticket.status]?.label || ticket.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SupportDialog;

