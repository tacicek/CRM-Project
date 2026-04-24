import { ReactNode, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, ROLE_LABELS, AdminPermission } from "@/lib/adminPermissions";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  Settings,
  LogOut,
  Loader2,
  ShieldAlert,
  Coins,
  BarChart3,
  Mail,
  Upload,
  PieChart,
  BookOpen,
  FormInput,
  BadgeEuro,
  ShieldCheck,
  Layers,
  Archive,
  Crown,
  MessageCircle,
  Bot,
  Eye,
} from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, isLoading, isAdminLoading, isAdmin, isOwner, adminRole, signOut } = useAuth();
  const {
    notify
  } = useNotificationSound();
  const {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingLeads, setPendingLeads] = useState(0);
  const [unverifiedCompanies, setUnverifiedCompanies] = useState(0);

  const notifyWithHistory = useCallback((
    title: string,
    body?: string,
    route?: string,
    type?: string,
    id?: string,
    metadata?: import("@/hooks/useNotificationHistory").NotificationMetadata
  ) => {
    notify(title, body);
    addNotification(title, body, route, type, id, metadata);
  }, [notify, addNotification]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const fetchPendingCounts = useCallback(async () => {
    if (!user || !isAdmin) return;

    try {
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending_verification", "pending"])
        .neq("source", "import");

      setPendingLeads(leadsCount || 0);

      const { count: companiesCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("is_verified", false);

      setUnverifiedCompanies(companiesCount || 0);
    } catch (error) {
      console.error("Error fetching pending counts:", error);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchPendingCounts();
    }
  }, [user, isAdmin, fetchPendingCounts]);

  // Auto-refresh badge counts every 30 seconds.
  // Previously used postgres_changes on leads/companies/offers/lead_distributions
  // which caused massive realtime.list_changes load. Counts are low-latency enough
  // at 30s polling for the admin badge use case.
  useEffect(() => {
    if (!user || !isAdmin) return;

    const interval = setInterval(() => {
      fetchPendingCounts();
    }, 30_000);

    return () => clearInterval(interval);
  }, [user, isAdmin, fetchPendingCounts]);

  // Keep only the lead_distributions accepted toast (actionable instant feedback)
  // and the new-lead INSERT toast so admins are notified without full table polling.
  useEffect(() => {
    if (!user || !isAdmin) return;

    const leadsChannel = supabase
      .channel("admin-leads-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          // Ignore private company manual imports
          if ((payload.new as { source?: string })?.source === "import") return;
          fetchPendingCounts();
          const leadId = (payload.new as { id?: string })?.id;
          notifyWithHistory(
            "Neue Anfrage eingegangen",
            "Ein Kunde hat eine neue Anfrage gesendet – jetzt prüfen",
            "/admin/verification",
            "new_lead",
            leadId ? `lead-insert-${leadId}` : undefined
          );
        }
      )
      .subscribe();

    const distributionsChannel = supabase
      .channel("admin-distributions-accepted")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lead_distributions" },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status;
          const oldStatus = (payload.old as { status?: string })?.status;

          if (newStatus === "accepted" && oldStatus !== "accepted") {
            notifyWithHistory("Lead angenommen", "Eine Firma hat einen Lead angenommen");
            fetchPendingCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(distributionsChannel);
    };
  }, [user, isAdmin, notifyWithHistory, fetchPendingCounts]);

  // Menu items organized by groups
  const menuGroups = useMemo(() => [
    {
      label: "Übersicht",
      items: [
        { title: "Dashboard", url: "/admin", icon: LayoutDashboard, permission: "dashboard.view" as AdminPermission },
        { title: "Verifizierung", url: "/admin/verification", icon: ShieldCheck, permission: "verification.view" as AdminPermission, badge: pendingLeads > 0 ? pendingLeads : undefined },
        { title: "Analytics", url: "/admin/analytics", icon: BarChart3, permission: "analytics.view" as AdminPermission },
        { title: "Statistiken", url: "/admin/statistics", icon: PieChart, permission: "statistics.view" as AdminPermission },
      ],
    },
    {
      label: "Anfragen & Firmen",
      items: [
        { title: "Leads", url: "/admin/leads", icon: FileText, permission: "leads.view" as AdminPermission },
        { title: "Formulare", url: "/admin/forms", icon: FormInput, permission: "forms.view" as AdminPermission },
        { title: "Firmen", url: "/admin/companies", icon: Building2, permission: "companies.view" as AdminPermission, badge: unverifiedCompanies > 0 ? unverifiedCompanies : undefined },
        { title: "Manueller Import", url: "/admin/manual-import", icon: Upload, permission: "manual_import.view" as AdminPermission },
      ],
    },
    {
      label: "Finanzen",
      items: [
        { title: "CRM-Abos", url: "/admin/subscriptions", icon: Crown, permission: "companies.view" as AdminPermission },
        { title: "Token-Pakete", url: "/admin/token-packages", icon: Coins, permission: "token_packages.view" as AdminPermission },
        { title: "Preisgestaltung", url: "/admin/pricing", icon: BadgeEuro, permission: "pricing.view" as AdminPermission },
      ],
    },
    {
      label: "Webseite",
      items: [
        { title: "Website Einstellungen", url: "/admin/webseite/settings", icon: Settings, permission: "settings.view" as AdminPermission },
        { title: "Geteilte Inhalte", url: "/admin/webseite/shared-content", icon: Layers, permission: "blog.view" as AdminPermission },
        { title: "Blog", url: "/admin/blog", icon: BookOpen, permission: "blog.view" as AdminPermission },
      ],
    },
    {
      label: "System",
      items: [
        { title: "Support-Tickets", url: "/admin/support", icon: MessageCircle, permission: "settings.view" as AdminPermission },
        { title: "E-Mail-Protokoll", url: "/admin/email-logs", icon: Mail, permission: "email_logs.view" as AdminPermission },
        { title: "KI-Assistent", url: "/admin/vapi", icon: Bot, permission: "settings.view" as AdminPermission },
        { title: "Datenarchiv", url: "/admin/archive", icon: Archive, permission: "settings.view" as AdminPermission },
        { title: "Benutzer", url: "/admin/users", icon: Users, permission: "users.view" as AdminPermission },
        { title: "Einstellungen", url: "/admin/settings", icon: Settings, permission: "settings.view" as AdminPermission },
      ],
    },
  ], [pendingLeads, unverifiedCompanies]);

  const filteredMenuGroups = useMemo(() => {
    const filtered = menuGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => hasPermission(adminRole, item.permission)),
      }))
      .filter(group => group.items.length > 0);

    if (isOwner) {
      filtered.push({
        label: "Inhaber",
        items: [
          { title: "Aktivitätsprotokoll", url: "/admin/audit-log", icon: Eye, permission: "dashboard.view" as AdminPermission },
        ],
      });
    }

    return filtered;
  }, [adminRole, menuGroups, isOwner]);

  // Flat list for header title lookup
  const allMenuItems = menuGroups.flatMap(g => g.items);

  // Show loader while auth or admin status is loading
  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Zugriff verweigert</h1>
          <p className="text-muted-foreground">Sie haben keine Admin-Berechtigung.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>Zur Startseite</Button>
            <Button variant="hero" onClick={() => signOut().then(() => navigate("/auth"))}>Abmelden</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <Sidebar className="border-r border-border">
          <div className="p-3 sm:p-4 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-semibold text-foreground">Admin Panel</span>
            </Link>
          </div>
          <SidebarContent>
            {filteredMenuGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${location.pathname === item.url || location.pathname.startsWith(item.url + "/")
                              ? "bg-secondary/10 text-secondary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1">{item.title}</span>
                            {item.badge && <Badge className="bg-warning text-warning-foreground text-xs">{item.badge}</Badge>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <div className="mt-auto p-3 sm:p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              {isOwner ? (
                <>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">System Owner</p>
                    <span className="text-xs text-amber-600">Vollzugriff</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    adminRole === "super_admin" ? "bg-red-500/10 text-red-600" :
                    adminRole === "admin" ? "bg-orange-500/10 text-orange-600" :
                    "bg-amber-500/10 text-amber-600"
                  }`}>
                    {adminRole === "super_admin" ? "S" : adminRole === "admin" ? "A" : "M"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    <span className={`text-xs ${
                      adminRole === "super_admin" ? "text-red-600" :
                      adminRole === "admin" ? "text-orange-600" :
                      "text-amber-600"
                    }`}>
                      {adminRole ? ROLE_LABELS[adminRole] : "Admin"}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => signOut().then(() => navigate("/auth"))}>
                <LogOut className="w-4 h-4 mr-2" /> Abmelden
              </Button>
            </div>
          </div>
        </Sidebar>
        <main className="flex-1 min-w-0 bg-muted/20">
          <header className="h-14 md:h-16 border-b border-border bg-card flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-4">
            <SidebarTrigger />
            <h1 className="text-base sm:text-lg font-semibold flex-1 min-w-0 truncate">
              {allMenuItems.find((item) => location.pathname === item.url || location.pathname.startsWith(item.url + "/"))?.title || "Admin"}
            </h1>
            <ThemeToggle className="shrink-0 h-9 w-9" />
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClearAll={clearAll}
              onNotificationClick={(notification) => {
                if (notification.route) navigate(notification.route);
              }}
            />
          </header>
          <div className="p-3 sm:p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
