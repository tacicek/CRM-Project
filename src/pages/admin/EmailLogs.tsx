import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Mail, CheckCircle, XCircle, Clock, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for EmailLog
 */
function isValidEmailLog(item: unknown): item is EmailLog {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.recipient_email === 'string' &&
    typeof obj.subject === 'string' &&
    typeof obj.email_type === 'string' &&
    typeof obj.status === 'string'
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
    return format(date, "dd.MM.yyyy HH:mm", { locale: de });
  } catch {
    return '-';
  }
}

/**
 * Sanitize search term for Supabase ilike query
 * Escape special characters that could break the query
 */
function sanitizeSearchTerm(term: string): string {
  // Escape special PostgreSQL LIKE characters
  return term
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
}

/**
 * User-friendly error message
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('rate limit')) {
    return 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
  }
  if (message.includes('not found')) {
    return 'E-Mail nicht gefunden.';
  }
  
  return message.length > 100 ? message.substring(0, 100) + '...' : message;
}

/**
 * Safely get metadata property
 */
function getMetadataBoolean(metadata: unknown, key: string): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const obj = metadata as Record<string, unknown>;
  return obj[key] === true;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  email_type: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  company_id: string | null;
  lead_id: string | null;
  created_at: string;
}

const emailTypeLabels: Record<string, string> = {
  lead_confirmation: "Lead-Bestätigung",
  lead_notification: "Lead-Benachrichtigung",
  offer_sent: "Offerte versendet",
  offer_response: "Offerten-Antwort",
  token_manual: "Token manuell",
  token_manual_add: "Token manuell",
  token_purchase: "Token-Kauf",
  token_spend: "Token-Ausgabe",
  password_reset: "Passwort-Reset",
  welcome: "Willkommen",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  sent: { label: "Gesendet", variant: "default", icon: CheckCircle },
  failed: { label: "Fehlgeschlagen", variant: "destructive", icon: XCircle },
  pending: { label: "Ausstehend", variant: "secondary", icon: Clock },
};

export default function EmailLogs() {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [resendingId, setResendingId] = useState<string | null>(null);
  
  // Resend confirmation dialog
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [pendingResendId, setPendingResendId] = useState<string | null>(null);
  const [pendingResendEmail, setPendingResendEmail] = useState<string>("");
  
  const queryClient = useQueryClient();
  
  // Ref for mounted state
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounced search
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, SEARCH_DEBOUNCE_MS);

  const { data: emailLogs, isLoading, error: queryError, refetch, isRefetching } = useQuery({
    queryKey: ["email-logs", searchTerm, typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200); // Reasonable limit; older records are rare in support scenarios

      // Sanitize search term to prevent SQL injection
      if (searchTerm) {
        const sanitized = sanitizeSearchTerm(searchTerm);
        if (sanitized) {
          query = query.or(`recipient_email.ilike.%${sanitized}%,subject.ilike.%${sanitized}%,recipient_name.ilike.%${sanitized}%`);
        }
      }

      if (typeFilter && typeFilter !== "all") {
        query = query.eq("email_type", typeFilter);
      }

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Type-safe filtering
      return (data || []).filter(isValidEmailLog);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (emailLogId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-email", {
        body: { emailLogId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;
      toast.success("E-Mail erfolgreich erneut gesendet");
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
    },
    onError: (error) => {
      if (!isMountedRef.current) return;
      toast.error(`Fehler: ${getUserFriendlyError(error)}`);
    },
    onSettled: () => {
      if (isMountedRef.current) {
        setResendingId(null);
      }
    },
  });

  // Request resend confirmation
  const requestResend = useCallback((emailLogId: string, recipientEmail: string) => {
    // Prevent double-click while another resend is in progress
    if (resendingId) return;
    
    setPendingResendId(emailLogId);
    setPendingResendEmail(recipientEmail);
    setResendConfirmOpen(true);
  }, [resendingId]);

  // Confirm and execute resend
  const confirmResend = useCallback(() => {
    if (pendingResendId) {
      setResendingId(pendingResendId);
      resendMutation.mutate(pendingResendId);
    }
    setResendConfirmOpen(false);
    setPendingResendId(null);
    setPendingResendEmail("");
  }, [pendingResendId, resendMutation]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Memoized unique types for filter dropdown
  const uniqueTypes = useMemo(() => 
    [...new Set(emailLogs?.map((log) => log.email_type) || [])].sort(),
    [emailLogs]
  );

  // Paginated data
  const totalPages = Math.ceil((emailLogs?.length || 0) / ITEMS_PER_PAGE);
  
  const paginatedLogs = useMemo(() => {
    if (!emailLogs) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return emailLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [emailLogs, currentPage]);

  const getEmailTypeLabel = (type: string) => {
    // Handle resend variants
    const baseType = type.replace(/_resend$/, "");
    const label = emailTypeLabels[baseType] || emailTypeLabels[type] || type;
    return type.endsWith("_resend") ? `${label} (Erneut)` : label;
  };

  const renderAttachmentBadges = (log: EmailLog) => {
    const hasOfferPdf = getMetadataBoolean(log.metadata, "hasOfferPdf");
    const hasAgbPdf = getMetadataBoolean(log.metadata, "hasAgbPdf");
    const hasChecklistPdf = getMetadataBoolean(log.metadata, "hasChecklistPdf");

    if (!hasOfferPdf && !hasAgbPdf && !hasChecklistPdf) return null;

    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {hasOfferPdf && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            Offerte PDF
          </Badge>
        )}
        {hasAgbPdf && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            AGB PDF
          </Badge>
        )}
        {hasChecklistPdf && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            Checkliste PDF
          </Badge>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">E-Mail-Protokoll</h1>
            <p className="text-muted-foreground">
              Übersicht aller versendeten E-Mails
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefetching}
            aria-label="Daten aktualisieren"
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>

        {/* Error Display */}
        {queryError && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <span>Fehler beim Laden: {getUserFriendlyError(queryError)}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
              Erneut versuchen
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach E-Mail, Betreff oder Empfänger..."
              value={searchInputValue}
              onChange={(e) => {
                setSearchInputValue(e.target.value);
                debouncedSetSearch(e.target.value);
              }}
              className="pl-10"
              aria-label="E-Mails durchsuchen"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="E-Mail-Typ filtern">
              <SelectValue placeholder="Alle Typen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getEmailTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Status filtern">
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="sent">Gesendet</SelectItem>
              <SelectItem value="failed">Fehlgeschlagen</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            ))}
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="border rounded-lg">
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Mail className="h-8 w-8" />
                <span>Keine E-Mails gefunden</span>
                {(searchTerm || typeFilter !== "all" || statusFilter !== "all") && (
                  <Button 
                    variant="link" 
                    onClick={() => { 
                      setSearchInputValue(""); 
                      setSearchTerm(""); 
                      setTypeFilter("all"); 
                      setStatusFilter("all"); 
                    }}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {paginatedLogs.map((log) => {
              const StatusIcon = statusConfig[log.status]?.icon || CheckCircle;
              const wasResent = getMetadataBoolean(log.metadata, 'resent');
              const canResend = log.status === "failed" && !wasResent;
              const isResending = resendingId === log.id;

              return (
                <div 
                  key={`mobile-${log.id}`}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  {/* Header: Date + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDateSafe(log.created_at)}
                    </span>
                    <Badge variant={statusConfig[log.status]?.variant || "default"} className="gap-1 shrink-0">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig[log.status]?.label || log.status}
                    </Badge>
                  </div>

                  {/* Recipient */}
                  <div>
                    <div className="font-medium truncate">{log.recipient_email}</div>
                    {log.recipient_name && (
                      <div className="text-sm text-muted-foreground">{log.recipient_name}</div>
                    )}
                  </div>

                  {/* Subject */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Betreff: </span>
                    <span className="line-clamp-2">{log.subject}</span>
                  </div>

                  {/* Type + Error */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getEmailTypeLabel(log.email_type)}
                    </Badge>
                    {wasResent && (
                      <span className="text-xs text-muted-foreground">✓ Erneut gesendet</span>
                    )}
                  </div>
                  {renderAttachmentBadges(log)}

                  {log.error_message && log.error_message.length > 0 && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {log.error_message.length > 100 
                        ? `${log.error_message.substring(0, 100)}...` 
                        : log.error_message}
                    </p>
                  )}

                  {/* Action */}
                  {canResend && (
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestResend(log.id, log.recipient_email)}
                        disabled={isResending || resendingId !== null}
                        className="w-full"
                      >
                        {isResending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Erneut senden
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => {
                  const StatusIcon = statusConfig[log.status]?.icon || CheckCircle;
                  const wasResent = getMetadataBoolean(log.metadata, 'resent');
                  const canResend = log.status === "failed" && !wasResent;
                  const isResending = resendingId === log.id;

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateSafe(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.recipient_email}</span>
                          {log.recipient_name && (
                            <span className="text-sm text-muted-foreground">{log.recipient_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={log.subject}>
                        {log.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getEmailTypeLabel(log.email_type)}
                        </Badge>
                        {renderAttachmentBadges(log)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[log.status]?.variant || "default"} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[log.status]?.label || log.status}
                        </Badge>
                        {log.error_message && log.error_message.length > 0 && (
                          <p className="text-xs text-destructive mt-1" title={log.error_message}>
                            {log.error_message.length > 50 
                              ? `${log.error_message.substring(0, 50)}...` 
                              : log.error_message}
                          </p>
                        )}
                        {wasResent && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ✓ Erneut gesendet
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {canResend && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestResend(log.id, log.recipient_email)}
                            disabled={isResending || resendingId !== null}
                            aria-label={`E-Mail an ${log.recipient_email} erneut senden`}
                          >
                            {isResending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}

        {/* Pagination */}
        {emailLogs && emailLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {emailLogs.length} E-Mail{emailLogs.length !== 1 ? "s" : ""} gefunden
              {totalPages > 1 && ` (Seite ${currentPage} von ${totalPages})`}
            </p>
            
            {totalPages > 1 && (
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
                  {currentPage} / {totalPages}
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
            )}
          </div>
        )}
      </div>

      {/* Resend Confirmation Dialog */}
      <AlertDialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail erneut senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die E-Mail an <strong>{pendingResendEmail}</strong> erneut senden?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingResendId(null); setPendingResendEmail(""); }}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmResend}>
              Erneut senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
