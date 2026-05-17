import { ReactNode, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import { firmaImports } from "@/App";
import { MODULES } from "@/config/modules";
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
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Loader2,
  ShieldAlert,
  Inbox,
  ClipboardList,
  ListChecks,
  Building2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  CheckSquare,
  Calendar,
  Users,
  Upload,
  Eye,
  Archive,
  Package,
  Calculator,
  FileCheck,
  ChevronDown,
  Receipt,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface FirmaLayoutProps {
  children: ReactNode;
}

interface Company {
  id: string;
  company_name: string;
  logo_url: string | null;
  is_verified?: boolean | null;
}

// =============================================================================
// Sidebar Sub-Components
// =============================================================================

interface SidebarHeaderProps {
  company: Company;
}

const FirmaSidebarHeader = ({ company }: SidebarHeaderProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <div className={`${isCollapsed ? 'p-2' : 'p-4 pb-6'} relative overflow-hidden`}>
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
            <span className="font-bold text-base truncate max-w-[140px] bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{company.company_name}</span>
            <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">Dashboard</span>
          </div>
        )}
      </Link>
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
};

const FirmaSidebarFooter = ({ onSignOut }: { onSignOut: () => void }) => {
  const { state } = useSidebar();
  if (state !== "collapsed") return null;
  return (
    <div className="mt-auto p-2 border-t border-border/50 flex flex-col items-center gap-2">
      <Button variant="ghost" size="icon" onClick={onSignOut} title="Abmelden" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors">
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
};

// =============================================================================
// Main Layout
// =============================================================================

const FirmaLayout = ({ children }: FirmaLayoutProps) => {
  const { user, isLoading, signOut } = useAuth();
  const { companies, activeCompany, companyId, role, loading: companyLoading, switchCompany } = useCompanyContext();
  const { isSoundEnabled, toggleSound, isPushEnabled, togglePushNotifications, pushPermission, notify } = useNotificationSound();
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll, loadNotifications } = useNotificationHistory();
  const navigate = useNavigate();
  const location = useLocation();

  const company = activeCompany as Company | null;
  const [besichtigungUploadedCount, setBesichtigungUploadedCount] = useState(0);

  const notifyWithHistory = useCallback((title: string, body?: string, route?: string, type?: string, id?: string, metadata?: Record<string, unknown>) => {
    notify(title, body);
    addNotification(title, body, route, type, id, metadata);
  }, [notify, addNotification]);

  const handleNotificationClick = useCallback((notification: { route?: string }) => {
    if (notification.route) navigate(notification.route);
  }, [navigate]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    markAsRead(id);
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    markAllAsRead();
    if (companyId) await supabase.from("notifications").update({ read: true }).eq("company_id", companyId).eq("read", false);
  }, [companyId, markAllAsRead]);

  const handleClearAll = useCallback(async () => {
    clearAll();
    if (companyId) await supabase.from("notifications").delete().eq("company_id", companyId);
  }, [clearAll, companyId]);

  // Fetch notifications
  useEffect(() => {
    if (!companyId) return;
    const fetchNotifications = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(20);
      if (data) {
        loadNotifications(data.map(n => {
          const m = n.metadata as Record<string, unknown> | null;
          let route: string | undefined;
          if (n.type === 'offer_response') route = `/firma/offerten`;
          else if (n.type === 'appointment' || n.type === 'appointment_reschedule') route = '/firma/kalender';
          else if (n.type === 'besichtigung_confirmed' || n.type === 'besichtigung_rejected') route = '/firma/kalender';
          else if (n.type === 'besichtigung_request' || n.type === 'besichtigung_uploaded') route = '/firma/besichtigungen';
          return { id: n.id, title: n.title, body: n.body || undefined, timestamp: new Date(n.created_at || Date.now()), read: n.read || false, route, type: n.type, metadata: m || undefined };
        }));
      }
    };
    fetchNotifications();
  }, [companyId, loadNotifications]);

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  // Besichtigung count
  useEffect(() => {
    if (!companyId) return;
    supabase.from("virtual_besichtigung_sessions").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "uploaded").then(({ count }) => setBesichtigungUploadedCount(count || 0));
  }, [companyId]);

  // Real-time: notifications
  useEffect(() => {
    if (!user || !companyId) return;
    const channel = supabase.channel("firma-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `company_id=eq.${companyId}` }, (payload) => {
      const n = payload.new as { id: string; title: string; body: string; type: string; metadata: Record<string, unknown> };
      let route: string | undefined;
      if (n.type === 'offer_response') route = '/firma/offerten';
      else if (n.type === 'appointment_reschedule') route = '/firma/kalender';
      else if (n.type === 'besichtigung_confirmed' || n.type === 'besichtigung_rejected') route = '/firma/kalender';
      else if (n.type === 'besichtigung_request' || n.type === 'besichtigung_uploaded') route = '/firma/besichtigungen';
      if (n.type === 'besichtigung_uploaded' && companyId) {
        supabase.from("virtual_besichtigung_sessions").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "uploaded").then(({ count }) => setBesichtigungUploadedCount(count || 0));
      }
      notifyWithHistory(n.title, n.body, route, n.type, n.id, n.metadata);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, notifyWithHistory, user]);

  // Real-time: besichtigung sessions
  useEffect(() => {
    if (!user || !companyId) return;
    const channel = supabase.channel("firma-besichtigung-sessions").on("postgres_changes", { event: "UPDATE", schema: "public", table: "virtual_besichtigung_sessions", filter: `company_id=eq.${companyId}` }, () => {
      supabase.from("virtual_besichtigung_sessions").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "uploaded").then(({ count }) => setBesichtigungUploadedCount(count || 0));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, user]);

  // Real-time: appointments
  useEffect(() => {
    if (!user || !companyId) return;
    const channel = supabase.channel("firma-appointments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` }, (payload) => {
        const a = payload.new as { title: string; appointment_type: string; appointment_date: string };
        const labels: Record<string, string> = { besichtigung: "Besichtigung", service: "Service-Termin", follow_up: "Follow-up", meeting: "Meeting", blocked: "Blockiert" };
        notifyWithHistory(`Neuer ${labels[a.appointment_type] || "Termin"}`, `${a.title} am ${new Date(a.appointment_date).toLocaleDateString("de-CH")}`, "/firma/kalender", "appointment");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` }, (payload) => {
        const a = payload.new as { title: string; status: string };
        const old = payload.old as { status?: string } | null;
        if (old && old.status !== a.status) {
          const labels: Record<string, string> = { confirmed: "bestätigt", cancelled: "abgesagt", completed: "abgeschlossen", rescheduled: "verschoben" };
          const label = labels[a.status];
          if (label) notifyWithHistory(`Termin ${label}`, a.title, "/firma/kalender", "appointment");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, notifyWithHistory, user]);

  const handleSignOut = async () => {
    try { sessionStorage.removeItem("crm_active_company_id"); } catch { /* */ }
    try { sessionStorage.removeItem("firma_company_cache"); } catch { /* */ }
    await signOut();
    navigate("/auth");
  };

  // Prefetch map
  const urlToImport: Record<string, () => Promise<unknown>> = useMemo(() => ({
    "/firma": firmaImports.Dashboard,
    "/firma/einstellungen": firmaImports.Einstellungen,
    "/firma/offerten": firmaImports.Offerten,
    "/firma/quittungen": firmaImports.Quittungen,
    "/firma/kalender": firmaImports.Kalender,
    "/firma/auftraege": firmaImports.Auftraege,
    "/firma/umzugsboxen": firmaImports.Umzugsboxen,
    "/firma/besichtigungen": firmaImports.Besichtigungen,
    "/firma/manual-import": firmaImports.ManualImport,
    "/firma/anfragen": firmaImports.Anfragen,
    "/firma/leistungskatalog": firmaImports.Leistungskatalog,
    "/firma/checkliste": firmaImports.Checkliste,
    "/firma/team": firmaImports.Team,
    "/firma/preisgestaltung": firmaImports.Preisgestaltung,
    "/firma/datenarchiv": firmaImports.Datenarchiv,
  }), []);

  const prefetchedRef = useRef<Set<string>>(new Set());
  const handlePrefetch = useCallback((url: string) => {
    if (prefetchedRef.current.has(url)) return;
    const importFn = urlToImport[url];
    if (importFn) {
      const timeoutId = setTimeout(() => { prefetchedRef.current.add(url); importFn(); }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [urlToImport]);

  useEffect(() => {
    const preload = () => {
      ["/firma/offerten", "/firma/kalender"].forEach((url, i) => {
        if (!prefetchedRef.current.has(url)) {
          setTimeout(() => { const fn = urlToImport[url]; if (fn) { prefetchedRef.current.add(url); fn(); } }, i * 500);
        }
      });
    };
    if ("requestIdleCallback" in window) (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(preload);
    else setTimeout(preload, 2000);
  }, [urlToImport]);

  // Menus
  const menuGroups = [
    { id: "kern", label: "Hauptbereich", items: [
      { title: "Übersicht", url: "/firma", icon: LayoutDashboard, moduleKey: "reports" as const },
      { title: "Offerten", url: "/firma/offerten", icon: ClipboardList, moduleKey: "offers" as const },
      { title: "Quittungen", url: "/firma/quittungen", icon: Receipt, moduleKey: "receipts" as const },
      { title: "Kalender", url: "/firma/kalender", icon: Calendar, moduleKey: "calendar" as const },
      { title: "Aufträge", url: "/firma/auftraege", icon: FileCheck, moduleKey: "orders" as const },
    ]},
    { id: "betrieb", label: "Betrieb", items: [
      { title: "Besichtigungen", url: "/firma/besichtigungen", icon: Eye, moduleKey: "inspections" as const, badge: besichtigungUploadedCount > 0 ? besichtigungUploadedCount : undefined },
      { title: "Umzugsboxen", url: "/firma/umzugsboxen", icon: Package, moduleKey: "movingBoxes" as const },
      { title: "Team", url: "/firma/team", icon: Users, moduleKey: "team" as const },
      { title: "Checkliste", url: "/firma/checkliste", icon: CheckSquare, moduleKey: "checklist" as const },
      { title: "Anfragen", url: "/firma/anfragen", icon: Inbox, moduleKey: "manualImport" as const },
    ]},
    { id: "verwaltung", label: "Einstellungen", items: [
      { title: "Meine Leistungen", url: "/firma/leistungskatalog", icon: ListChecks, moduleKey: "serviceCatalog" as const },
      { title: "Meine Preise", url: "/firma/preisgestaltung", icon: Calculator, moduleKey: "pricing" as const },
      { title: "Archiv", url: "/firma/datenarchiv", icon: Archive, moduleKey: "archive" as const },
      { title: "Einstellungen", url: "/firma/einstellungen", icon: Settings, moduleKey: "settings" as const },
    ]},
  ];

  // Loading
  if (isLoading || companyLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
    </div>
  );

  if (!user) return null;

  // No company
  if (!company) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md mx-auto p-6">
        <ShieldAlert className="w-16 h-16 text-warning mx-auto" />
        <h1 className="text-2xl font-bold">Keine Firma gefunden</h1>
        <p className="text-muted-foreground">Ihr Account ist nicht mit einer Firma verknüpft. Bitte kontaktieren Sie den Support.</p>
        <Button variant="hero" onClick={handleSignOut}>Abmelden</Button>
      </div>
    </div>
  );

  // Not verified
  if (company.is_verified === false) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md mx-auto p-6">
        <ShieldAlert className="w-16 h-16 text-warning mx-auto" />
        <h1 className="text-2xl font-bold">Firma noch nicht verifiziert</h1>
        <p className="text-muted-foreground">Ihr Firmenkonto ist registriert, aber noch nicht freigeschaltet. Bitte kontaktieren Sie den Support.</p>
        <Button variant="hero" onClick={handleSignOut}>Abmelden</Button>
      </div>
    </div>
  );

  const hasMultipleCompanies = companies.length > 1;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon" className="border-r border-border">
          <FirmaSidebarHeader company={company} />
          <SidebarContent>
            {menuGroups.map((group, groupIndex) => (
              <SidebarGroup key={group.id} className={`px-2 ${groupIndex === 0 ? 'py-3' : 'py-2'}`}>
                {groupIndex > 0 && <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />}
                <SidebarGroupLabel className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {group.items.filter(i => MODULES[i.moduleKey]).map(item => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <Link to={item.url} onMouseEnter={() => handlePrefetch(item.url)} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive ? "bg-gradient-to-r from-secondary/15 to-secondary/5 text-secondary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
                              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-secondary to-primary rounded-r-full" />}
                              <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 shrink-0 ${isActive ? 'bg-secondary/20' : 'bg-muted/50 group-hover:bg-muted group-hover:scale-105'}`}>
                                <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                                {'badge' in item && item.badge && <span className="hidden group-data-[collapsible=icon]:flex absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 items-center justify-center rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">{item.badge}</span>}
                              </div>
                              <span className={`flex-1 text-sm font-medium transition-colors ${isActive ? 'text-secondary' : ''}`}>{item.title}</span>
                              {'badge' in item && item.badge && <span className="group-data-[collapsible=icon]:hidden px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm animate-pulse">{item.badge}</span>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <FirmaSidebarFooter onSignOut={handleSignOut} />
        </Sidebar>

        <main className="flex-1 bg-muted/20 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-4">
            <SidebarTrigger className="shrink-0" />
            <h1 className="text-sm sm:text-lg font-semibold flex-1 min-w-0 truncate">
              {menuGroups.flatMap(g => g.items).find(i => i.url === location.pathname)?.title || "Dashboard"}
            </h1>
            <ThemeToggle className="shrink-0 h-9 w-9" />
            <NotificationDropdown notifications={notifications} unreadCount={unreadCount} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllAsRead} onClearAll={handleClearAll} onNotificationClick={handleNotificationClick} />

            {/* ── Company Switcher ── */}
            {hasMultipleCompanies ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2 sm:px-3 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-primary" /></div>
                    <span className="hidden sm:block max-w-[100px] truncate text-sm font-medium">{company.company_name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Firma wechseln</DropdownMenuLabel>
                  {companies.map(c => (
                    <DropdownMenuItem key={c.id} onClick={() => switchCompany(c.id)} className="cursor-pointer gap-2">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{c.company_name}</span>
                      {c.id === company.id && <Check className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="w-4 h-4" />Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2 sm:px-3 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-primary" /></div>
                    <span className="hidden sm:block max-w-[120px] truncate text-sm font-medium">{user.email?.split("@")[0]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex flex-col gap-1 pb-2">
                    <span className="text-sm font-semibold truncate">{user.email}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Building2 className="w-3 h-3" />
                      {role === 'owner' ? 'Inhaber' : role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleSound} className="cursor-pointer gap-2">
                    {isSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                    <span>{isSoundEnabled ? "Ton aktiv" : "Ton deaktiviert"}</span>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${isSoundEnabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{isSoundEnabled ? "An" : "Aus"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={togglePushNotifications} disabled={pushPermission === "denied"} className="cursor-pointer gap-2">
                    {isPushEnabled ? <Bell className="w-4 h-4 text-blue-600" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                    <span className="flex-1">{pushPermission === "denied" ? "Benachr. blockiert" : isPushEnabled ? "Push aktiv" : "Push deaktiviert"}</span>
                    {pushPermission !== "denied" && <span className={`text-xs px-1.5 py-0.5 rounded-full ${isPushEnabled ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>{isPushEnabled ? "An" : "Aus"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="w-4 h-4" />Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>
          <div className="p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default FirmaLayout;