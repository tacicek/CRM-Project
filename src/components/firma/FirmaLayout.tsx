import { ReactNode, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { firmaImports } from "@/App";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { SupportDialog } from "@/components/firma/SupportDialog";
import {
  LayoutDashboard,
  Coins,
  Settings,
  LogOut,
  Loader2,
  ShieldAlert,
  Inbox,
  ClipboardList,
  ListChecks,
  Building2,
  Zap,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  CheckSquare,
  Calendar,
  Users,
  Upload,
  Crown,
  Eye,
  Archive,
  Package,
  Calculator,
  Lock,
  FileCheck,
  HelpCircle,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";


interface FirmaLayoutProps {
  children: ReactNode;
}

interface Company {
  id: string;
  company_name: string;
  token_balance: number;
  logo_url: string | null;
  is_verified?: boolean | null;
  manual_import_enabled?: boolean;
  crm_enabled?: boolean;
  subscription_type?: "basic" | "crm" | "enterprise" | "trial";
  subscription_expires_at?: string | null;
}

// =============================================================================
// Sidebar Sub-Components (defined outside FirmaLayout to prevent re-creation)
// =============================================================================

interface SidebarHeaderProps {
  company: Company;
}

// Header component that uses useSidebar hook
const FirmaSidebarHeader = ({ company }: SidebarHeaderProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className={`${isCollapsed ? 'p-2' : 'p-4 pb-6'} relative overflow-hidden`}>
      {/* Gradient background decoration */}
      {!isCollapsed && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5" />
      )}
      <Link to="/firma" className="relative flex items-center justify-center gap-3 group">
        <div className="relative flex-shrink-0">
          {company.logo_url ? (
            isCollapsed ? (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/10 flex items-center justify-center shadow-sm border border-secondary/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-4 h-4 text-secondary" />
              </div>
            ) : (
              <div className="relative">
                <img src={company.logo_url} alt={company.company_name} className="h-12 w-auto max-w-[160px] object-contain drop-shadow-sm" />
              </div>
            )
          ) : (
            <div className={`${isCollapsed ? 'h-9 w-9' : 'h-12 w-12'} rounded-xl bg-gradient-to-br from-secondary/20 to-primary/10 flex items-center justify-center shadow-sm border border-secondary/20 group-hover:scale-105 transition-transform`}>
              <Building2 className={`${isCollapsed ? 'w-4 h-4' : 'w-6 h-6'} text-secondary`} />
            </div>
          )}
        </div>
        {!isCollapsed && !company.logo_url && (
          <div className="flex flex-col">
            <span className="font-bold text-base truncate max-w-[140px] bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              {company.company_name}
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">
              Dashboard
            </span>
          </div>
        )}
      </Link>
      {/* Bottom border with gradient */}
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
};

interface SidebarQuickActionsProps {
  pendingCount: number;
  tokenBalance: number;
}

// Quick Actions component - hidden when collapsed
const FirmaSidebarQuickActions = ({ pendingCount: _pendingCount, tokenBalance }: SidebarQuickActionsProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) return null;

  return (
    <>
      {/* Token Balance Card */}
      <div className="p-3 mt-2">
        <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-secondary via-secondary/90 to-primary/80 shadow-lg shadow-secondary/20">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Token-Guthaben</span>
            </div>
            <div className="text-3xl font-bold text-white mt-2 tracking-tight">
              {Number(tokenBalance).toLocaleString("de-CH")}
            </div>
            <Link to="/firma/tokens">
              <Button size="sm" className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm shadow-none">
                <Zap className="w-4 h-4 mr-1.5" />
                Tokens aufladen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

interface SidebarFooterProps {
  userEmail: string;
  onSignOut: () => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  isPushEnabled: boolean;
  togglePushNotifications: () => void;
  pushPermission: NotificationPermission;
}

// CRM Upgrade item - adapts to collapsed/expanded state
const CrmUpgradeItem = ({ to, onPrefetch }: { to: string; onPrefetch: (url: string) => void }) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <div className="flex justify-center px-1">
        <Link
          to={to}
          onMouseEnter={() => onPrefetch(to)}
          title="CRM freischalten"
          className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Lock className="w-4 h-4 text-white" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2">
      <Link
        to={to}
        onMouseEnter={() => onPrefetch(to)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-all duration-200"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">CRM freischalten</p>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 truncate">Kalender, Aufträge, Team &amp; mehr</p>
        </div>
        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      </Link>
    </div>
  );
};

// Footer component - only shown when sidebar is collapsed (just a logout icon)
const FirmaSidebarFooter = ({ onSignOut }: Pick<SidebarFooterProps, "onSignOut">) => {
  const { state } = useSidebar();
  if (state !== "collapsed") return null;

  return (
    <div className="mt-auto p-2 border-t border-border/50 flex flex-col items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        title="Abmelden"
        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
};

// =============================================================================
// End of Sidebar Sub-Components
// =============================================================================

// Cache key for company data
const COMPANY_CACHE_KEY = "firma_company_cache";

// Get cached company data
const getCachedCompany = (): Company | null => {
  try {
    const cached = sessionStorage.getItem(COMPANY_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

// Set cached company data
// Merges new data with existing cache to prevent losing fields like crm_enabled
const setCachedCompany = (company: Company | null) => {
  try {
    if (company) {
      // Get existing cache and merge with new data
      const existingCache = getCachedCompany();
      const mergedData = existingCache 
        ? { ...existingCache, ...company }
        : company;
      sessionStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(mergedData));
    } else {
      sessionStorage.removeItem(COMPANY_CACHE_KEY);
    }
  } catch {
    // Ignore cache errors
  }
};

const FirmaLayout = ({ children }: FirmaLayoutProps) => {
  const { user, isLoading, signOut } = useAuth();
  const { 
    isSoundEnabled, 
    toggleSound, 
    isPushEnabled, 
    togglePushNotifications,
    pushPermission,
    notify 
  } = useNotificationSound();
  const {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    loadNotifications,
  } = useNotificationHistory();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize with cached data for instant page transitions
  const cachedCompany = getCachedCompany();
  const [company, setCompany] = useState<Company | null>(cachedCompany);
  const companyId = company?.id ?? null;
  const [pendingCount, setPendingCount] = useState(0);
  const [besichtigungUploadedCount, setBesichtigungUploadedCount] = useState(0);
  // Only show loading if we have no cached data
  const [companyLoading, setCompanyLoading] = useState(!cachedCompany);

  // Combined notify function that also adds to history with optional route
  const notifyWithHistory = useCallback((
    title: string, 
    body?: string, 
    route?: string, 
    type?: string,
    id?: string, // DB notification ID for proper sync
    metadata?: Record<string, unknown>
  ) => {
    notify(title, body);
    addNotification(title, body, route, type, id, metadata);
  }, [notify, addNotification]);

  // Handle notification click - navigate to route
  const handleNotificationClick = useCallback((notification: { route?: string }) => {
    if (notification.route) {
      navigate(notification.route);
    }
  }, [navigate]);

  // Mark single notification as read - persist to database
  const handleMarkAsRead = useCallback(async (id: string) => {
    markAsRead(id);
    // Update in database
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
  }, [markAsRead]);

  // Mark all notifications as read - persist to database
  const handleMarkAllAsRead = useCallback(async () => {
    markAllAsRead();
    if (companyId) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("company_id", companyId)
        .eq("read", false);
    }
     
  }, [companyId, markAllAsRead]);

  // Clear all notifications - delete from database
  const handleClearAll = useCallback(async () => {
    clearAll();
    if (companyId) {
      await supabase
        .from("notifications")
        .delete()
        .eq("company_id", companyId);
    }
     
  }, [clearAll, companyId]);

  // Load existing notifications from database
  useEffect(() => {
    if (!companyId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        loadNotifications(data.map(n => {
          // Determine route based on notification type
          const metadata = n.metadata as Record<string, unknown> | null;
          let route: string | undefined;
          
          if (n.type === 'offer_response' && metadata?.offer_id) {
            route = `/firma/offerten`;
          } else if (n.type === 'new_lead') {
            route = '/firma/anfragen';
          } else if (n.type === 'appointment' || n.type === 'appointment_reschedule') {
            route = '/firma/kalender';
          } else if (n.type === 'besichtigung_confirmed' || n.type === 'besichtigung_rejected') {
            route = '/firma/kalender';
          } else if (n.type === 'besichtigung_request' || n.type === 'besichtigung_uploaded') {
            route = '/firma/besichtigungen';
          }
          
          return {
            id: n.id,
            title: n.title,
            body: n.body || undefined,
            timestamp: new Date(n.created_at || Date.now()),
            read: n.read || false,
            route,
            type: n.type,
            metadata: metadata || undefined,
          };
        }));
      }
    };

    fetchNotifications();
     
  }, [companyId, loadNotifications]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const fetchCompanyAndPending = useCallback(async () => {
    if (!user) return;

    try {
      const data = await fetchSingleCompanyForUser<Company>({
        userId: user.id,
        userEmail: user.email,
        select: "id, company_name, token_balance, logo_url, is_verified, manual_import_enabled, crm_enabled, subscription_type, subscription_expires_at",
      });

      // Update state and cache
      setCompany(data);
      setCachedCompany(data);

      if (data) {
        // Fetch pending leads count (only non-expired)
        const { count } = await supabase
          .from("lead_distributions")
          .select("*", { count: "exact", head: true })
          .eq("company_id", data.id)
          .eq("status", "sent")
          .gt("expires_at", new Date().toISOString());

        setPendingCount(count || 0);

        // Fetch uploaded virtual besichtigung sessions (awaiting analysis)
        const { count: uploadedCount } = await supabase
          .from("virtual_besichtigung_sessions")
          .select("*", { count: "exact", head: true })
          .eq("company_id", data.id)
          .eq("status", "uploaded");

        setBesichtigungUploadedCount(uploadedCount || 0);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setCompanyLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCompanyAndPending();
    }
     
  }, [fetchCompanyAndPending, user]);

  // Auto-refresh pending count every 30 seconds (replaces realtime subscription
  // on lead_distributions which caused 16M+ realtime.list_changes calls/hour)
  useEffect(() => {
    if (!user || !companyId) return;

    const interval = setInterval(() => {
      fetchCompanyAndPending();
    }, 30_000);

    return () => clearInterval(interval);
  }, [companyId, fetchCompanyAndPending, user]);

  // Real-time subscription for company token balance updates
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel("firma-company-updates")
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "companies",
          filter: `id=eq.${companyId}`
        },
        (payload) => {
          // Update token balance when company is updated
          const updatedCompany = payload.new as Company;
          if (updatedCompany) {
            setCompany(prev => {
              const updated = prev ? { ...prev, token_balance: updatedCompany.token_balance } : null;
              // Also update cache
              setCachedCompany(updated);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
     
  }, [companyId, user]);

  // Real-time subscription for offer response notifications
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel("firma-notifications")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "notifications",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const notification = payload.new as {
            id: string;
            title: string;
            body: string;
            type: string;
            metadata: Record<string, unknown>;
          };
          
          // Determine route based on notification type
          let route: string | undefined;
          if (notification.type === 'offer_response') {
            route = '/firma/offerten';
          } else if (notification.type === 'appointment_reschedule') {
            route = '/firma/kalender';
          } else if (notification.type === 'besichtigung_confirmed' || notification.type === 'besichtigung_rejected') {
            route = '/firma/kalender';
          } else if (notification.type === 'besichtigung_request' || notification.type === 'besichtigung_uploaded') {
            route = '/firma/besichtigungen';
          } else if (notification.type === 'new_lead') {
            route = '/firma/anfragen';
          }
          
          // Refresh besichtigung badge when an upload notification arrives
          if (notification.type === 'besichtigung_uploaded' && companyId) {
            supabase
              .from("virtual_besichtigung_sessions")
              .select("*", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("status", "uploaded")
              .then(({ count }) => setBesichtigungUploadedCount(count || 0));
          }

          // Show notification with sound/push - pass DB ID for proper sync
          notifyWithHistory(
            notification.title, 
            notification.body, 
            route, 
            notification.type,
            notification.id, // Pass the DB notification ID
            notification.metadata
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
     
  }, [companyId, notifyWithHistory, user]);

  // Real-time subscription for virtual besichtigung sessions (badge count)
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel("firma-besichtigung-sessions")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "virtual_besichtigung_sessions",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Refresh uploaded count whenever a session status changes
          supabase
            .from("virtual_besichtigung_sessions")
            .select("*", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("status", "uploaded")
            .then(({ count }) => setBesichtigungUploadedCount(count || 0));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, user]);

  // Real-time subscription for appointments (Termine)
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel("firma-appointments")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "appointments",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const appointment = payload.new as {
            title: string;
            appointment_type: string;
            appointment_date: string;
          };
          
          const typeLabels: Record<string, string> = {
            besichtigung: "Besichtigung",
            service: "Service-Termin",
            follow_up: "Follow-up",
            meeting: "Meeting",
            blocked: "Blockiert",
          };
          
          const typeLabel = typeLabels[appointment.appointment_type] || "Termin";
          notifyWithHistory(
            `Neuer ${typeLabel}`,
            `${appointment.title} am ${new Date(appointment.appointment_date).toLocaleDateString("de-CH")}`,
            "/firma/kalender",
            "appointment"
          );
        }
      )
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "appointments",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const appointment = payload.new as {
            title: string;
            status: string;
          };
          const oldRecord = payload.old as { status?: string } | null;
          if (oldRecord && oldRecord.status !== appointment.status) {
            const statusLabels: Record<string, string> = {
              confirmed: "bestätigt",
              cancelled: "abgesagt",
              completed: "abgeschlossen",
              rescheduled: "verschoben",
            };
            
            const statusLabel = statusLabels[appointment.status];
            if (statusLabel) {
              notifyWithHistory(
                `Termin ${statusLabel}`,
                appointment.title,
                "/firma/kalender",
                "appointment"
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
     
  }, [companyId, notifyWithHistory, user]);

  const handleSignOut = async () => {
    // Clear cached company data on sign out
    setCachedCompany(null);
    await signOut();
    navigate("/auth");
  };

  // Map URL to import function for prefetching
  const urlToImport: Record<string, () => Promise<unknown>> = useMemo(() => ({
    "/firma": firmaImports.Dashboard,
    "/firma/anfragen": firmaImports.Anfragen,
    "/firma/tokens": firmaImports.Tokens,
    "/firma/einstellungen": firmaImports.Einstellungen,
    "/firma/offerten": firmaImports.Offerten,
    "/firma/quittungen": firmaImports.Quittungen,
    "/firma/kalender": firmaImports.Kalender,
    "/firma/auftraege": firmaImports.Auftraege,
    "/firma/umzugsboxen": firmaImports.Umzugsboxen,
    "/firma/besichtigungen": firmaImports.Besichtigungen,
    "/firma/manual-import": firmaImports.ManualImport,
    "/firma/leistungskatalog": firmaImports.Leistungskatalog,
    "/firma/checkliste": firmaImports.Checkliste,
    "/firma/team": firmaImports.Team,
    "/firma/preisgestaltung": firmaImports.Preisgestaltung,
    "/firma/datenarchiv": firmaImports.Datenarchiv,
    "/firma/crm-upgrade": firmaImports.CrmUpgrade,
  }), []);

  // Track prefetched URLs to avoid duplicate requests
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Prefetch page on hover (with 100ms delay to avoid unnecessary loads)
  const handlePrefetch = useCallback((url: string) => {
    if (prefetchedRef.current.has(url)) return;
    
    const importFn = urlToImport[url];
    if (importFn) {
      const timeoutId = setTimeout(() => {
        prefetchedRef.current.add(url);
        importFn(); // Start loading the chunk
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [urlToImport]);

  // Preload most common pages during idle time
  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const preloadCommonPages = () => {
      const commonPages = [
        "/firma/anfragen",
        "/firma/offerten", 
        "/firma/kalender",
      ];
      
      commonPages.forEach((url, index) => {
        if (!prefetchedRef.current.has(url)) {
          setTimeout(() => {
            const importFn = urlToImport[url];
            if (importFn) {
              prefetchedRef.current.add(url);
              importFn();
            }
          }, index * 500); // Stagger loads by 500ms
        }
      });
    };

    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(preloadCommonPages);
    } else {
      setTimeout(preloadCommonPages, 2000);
    }
  }, [urlToImport]);

  // Menu groups — KERN is always accessible, BETRIEB requires CRM
  const menuGroups = [
    {
      id: "kern",
      label: "Hauptbereich",
      requiresCrm: false,
      items: [
        { title: "Übersicht", url: "/firma", icon: LayoutDashboard },
        {
          title: "Anfragen",
          url: "/firma/anfragen",
          icon: Inbox,
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { title: "Offerten", url: "/firma/offerten", icon: ClipboardList, requiresCrm: true, hideWhenLocked: true },
        { title: "Quittungen", url: "/firma/quittungen", icon: Receipt, requiresCrm: true, hideWhenLocked: true },
        { title: "Kalender", url: "/firma/kalender", icon: Calendar, requiresCrm: true, hideWhenLocked: true },
        { title: "Aufträge", url: "/firma/auftraege", icon: FileCheck, requiresCrm: true, hideWhenLocked: true },
      ],
    },
    {
      id: "betrieb",
      label: "Betrieb",
      requiresCrm: true,
      items: [
        {
          title: "Besichtigungen",
          url: "/firma/besichtigungen",
          icon: Eye,
          badge: besichtigungUploadedCount > 0 ? besichtigungUploadedCount : undefined,
        },
        { title: "Umzugsboxen", url: "/firma/umzugsboxen", icon: Package },
        { title: "Team", url: "/firma/team", icon: Users },
        { title: "Checkliste", url: "/firma/checkliste", icon: CheckSquare },
        {
          title: "Eigene Anfragen",
          url: "/firma/manual-import",
          icon: Upload,
          premium: !company?.manual_import_enabled,
        },
      ],
    },
    {
      id: "verwaltung",
      label: "Einstellungen",
      requiresCrm: false,
      items: [
        { title: "Tokens", url: "/firma/tokens", icon: Coins },
        { title: "Meine Leistungen", url: "/firma/leistungskatalog", icon: ListChecks, requiresCrm: true, hideWhenLocked: true },
        { title: "Meine Preise", url: "/firma/preisgestaltung", icon: Calculator, requiresCrm: true, hideWhenLocked: true },
        { title: "Archiv", url: "/firma/datenarchiv", icon: Archive },
        { title: "Einstellungen", url: "/firma/einstellungen", icon: Settings },
      ],
    },
  ];

  // Check if CRM is enabled
  // Use cached company if current company is null (during page transitions)
  const hasCrmAccess = (): boolean => {
    const companyToCheck = company || getCachedCompany();
    if (!companyToCheck) return false;
    if (!companyToCheck.crm_enabled) return false;
    const type = companyToCheck.subscription_type ?? "";
    if (type !== "crm" && type !== "trial" && type !== "enterprise") return false;
    if (companyToCheck.subscription_expires_at) {
      const expiryDate = new Date(companyToCheck.subscription_expires_at);
      if (expiryDate < new Date()) return false;
    }
    return true;
  };

  const crmEnabled = hasCrmAccess();

  if (isLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <ShieldAlert className="w-16 h-16 text-warning mx-auto" />
          <h1 className="text-2xl font-bold">Keine Firma gefunden</h1>
          <p className="text-muted-foreground">
            Ihr Account ist nicht mit einer Firma verknüpft. Bitte kontaktieren Sie den Support.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Zur Startseite
            </Button>
            <Button variant="hero" onClick={handleSignOut}>
              Abmelden
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (company.is_verified === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <ShieldAlert className="w-16 h-16 text-warning mx-auto" />
          <h1 className="text-2xl font-bold">Firma noch nicht verifiziert</h1>
          <p className="text-muted-foreground">
            Ihr Firmenkonto ist registriert, aber noch nicht freigeschaltet. Bitte kontaktieren Sie den Support, falls die Freigabe zu lange dauert.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Zur Startseite
            </Button>
            <Button variant="hero" onClick={handleSignOut}>
              Abmelden
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon" className="border-r border-border">
          <FirmaSidebarHeader company={company} />

          <SidebarContent>
            {menuGroups.map((group, groupIndex) => {
              // BETRIEB group: hide entirely if CRM not enabled, show upgrade item instead
              if (group.requiresCrm && !crmEnabled) {
                return (
                  <SidebarGroup key={group.id} className="px-2 py-2">
                    <SidebarGroupLabel className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
                      {group.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <CrmUpgradeItem to="/firma/crm-upgrade" onPrefetch={handlePrefetch} />
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              }

              return (
                <SidebarGroup key={group.id} className={`px-2 ${groupIndex === 0 ? 'py-3' : 'py-2'}`}>
                  {groupIndex > 0 && (
                    <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  )}
                  <SidebarGroupLabel className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                    {group.label}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        const isItemLocked = ('requiresCrm' in item && item.requiresCrm) && !crmEnabled;

                        if (isItemLocked && 'hideWhenLocked' in item && item.hideWhenLocked) {
                          return null;
                        }

                        if (isItemLocked) {
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <Link
                                  to="/firma/crm-upgrade"
                                  onMouseEnter={() => handlePrefetch("/firma/crm-upgrade")}
                                  className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
                                >
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/30 relative shrink-0">
                                    <item.icon className="w-4 h-4 text-muted-foreground/40" />
                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500/90 flex items-center justify-center">
                                      <Lock className="w-2 h-2 text-white" />
                                    </div>
                                  </div>
                                  <span className="flex-1 text-sm font-medium">{item.title}</span>
                                  <span className="text-[9px] font-semibold text-amber-600/70 dark:text-amber-400/70">CRM</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        }

                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <Link
                                to={item.url}
                                onMouseEnter={() => handlePrefetch(item.url)}
                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                                  isActive
                                    ? "bg-gradient-to-r from-secondary/15 to-secondary/5 text-secondary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                }`}
                              >
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-secondary to-primary rounded-r-full" />
                                )}
                                <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 shrink-0 ${
                                  isActive
                                    ? 'bg-secondary/20'
                                    : 'bg-muted/50 group-hover:bg-muted group-hover:scale-105'
                                }`}>
                                  <item.icon className={`w-4 h-4 transition-colors ${
                                    isActive ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'
                                  }`} />
                                  {/* Badge overlay — only visible in icon-only (collapsed) mode */}
                                  {'badge' in item && item.badge && (
                                    <span className="hidden group-data-[collapsible=icon]:flex absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 items-center justify-center rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <span className={`flex-1 text-sm font-medium transition-colors ${
                                  isActive ? 'text-secondary' : ''
                                }`}>
                                  {item.title}
                                </span>
                                {/* Badge label — only visible in expanded mode */}
                                {'badge' in item && item.badge && (
                                  <span className="group-data-[collapsible=icon]:hidden px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm animate-pulse">
                                    {item.badge}
                                  </span>
                                )}
                                {'premium' in item && item.premium && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/50">
                                    <Crown className="w-2.5 h-2.5" />
                                    Pro
                                  </span>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}

            {/* Quick Actions & Token - Hidden when collapsed */}
            <FirmaSidebarQuickActions 
              pendingCount={pendingCount} 
              tokenBalance={company.token_balance} 
            />
          </SidebarContent>

          {/* Footer - Only shown when collapsed (logout icon only) */}
          <FirmaSidebarFooter onSignOut={handleSignOut} />
        </Sidebar>

        <main className="flex-1 bg-muted/20 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-4">
            <SidebarTrigger className="shrink-0" />
            <h1 className="text-sm sm:text-lg font-semibold flex-1 min-w-0 truncate">
              {menuGroups.flatMap(g => g.items).find((item) => item.url === location.pathname)?.title || "Dashboard"}
            </h1>
            <Link 
              to="/firma/tokens" 
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors shrink-0"
            >
              <Coins className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-secondary text-sm">
                {Number(company.token_balance).toLocaleString("de-CH")}
              </span>
            </Link>
            <ThemeToggle className="shrink-0 h-9 w-9" />
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onClearAll={handleClearAll}
              onNotificationClick={handleNotificationClick}
            />
            {/* Mobile: icon-only */}
            <SupportDialog trigger={
              <Button variant="outline" size="icon" className="sm:hidden h-9 w-9 shrink-0">
                <HelpCircle className="w-4 h-4" />
              </Button>
            } />
            {/* Desktop: with label */}
            <SupportDialog trigger={
              <Button variant="outline" className="hidden sm:flex gap-2 shrink-0">
                <HelpCircle className="w-4 h-4" />
                Support
              </Button>
            } />

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 px-2 sm:px-3 shrink-0"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="hidden sm:block max-w-[120px] truncate text-sm font-medium">
                    {user.email?.split("@")[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col gap-1 pb-2">
                  <span className="text-sm font-semibold truncate">{user.email}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Building2 className="w-3 h-3" />
                    Firma-Account
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={toggleSound}
                  className="cursor-pointer gap-2"
                >
                  {isSoundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>{isSoundEnabled ? "Ton aktiv" : "Ton deaktiviert"}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${isSoundEnabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {isSoundEnabled ? "An" : "Aus"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={togglePushNotifications}
                  disabled={pushPermission === "denied"}
                  className="cursor-pointer gap-2"
                >
                  {isPushEnabled ? (
                    <Bell className="w-4 h-4 text-blue-600" />
                  ) : (
                    <BellOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="flex-1">
                    {pushPermission === "denied" ? "Benachr. blockiert" : isPushEnabled ? "Push aktiv" : "Push deaktiviert"}
                  </span>
                  {pushPermission !== "denied" && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isPushEnabled ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                      {isPushEnabled ? "An" : "Aus"}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default FirmaLayout;
