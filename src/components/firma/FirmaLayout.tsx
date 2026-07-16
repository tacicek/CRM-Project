import { ReactNode, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import { firmaImports } from "@/App";
import { getModuleForPath, isModuleEnabled } from "@/config/moduleRoutes";
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
import { LanguageSwitcher } from "@/components/firma/LanguageSwitcher";
import { useI18n, useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";
import { getAppointmentStatusLabel, getAppointmentTypeLabel } from "@/i18n/domain";
import { formatDate } from "@/i18n/format";
import {
  LogOut,
  Loader2,
  ShieldAlert,
  Building2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  ChevronDown,
  Check,
  Menu,
  X,
  Search,
  MoreHorizontal,
} from "lucide-react";

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
// Menu data — Folk-style nav: each item has an emoji, label, route, moduleKey
// =============================================================================

type MenuItem = {
  /** Catalog key — the label is resolved in the operator's dashboard locale at render time. */
  titleKey: MessageKey;
  url: string;
  emoji: string;
  badge?: number;
};

type MenuGroup = { id: string; labelKey: MessageKey; items: MenuItem[] };

/**
 * A nav item is shown when its route's module is enabled. Ungated urls (the dashboard)
 * resolve to `null` → always shown. Same central map that guards the routes, so menu
 * visibility and route enforcement can never drift.
 */
const isMenuItemVisible = (item: MenuItem): boolean => {
  const module = getModuleForPath(item.url);
  return module === null || isModuleEnabled(module);
};

// =============================================================================
// Sidebar
// =============================================================================

const FirmaSidebar = ({
  company,
  user,
  groups,
  quickLinks,
  onSignOut,
  onClose,
}: {
  company: Company;
  user: { email?: string | null };
  groups: MenuGroup[];
  quickLinks: MenuItem[];
  onSignOut: () => void;
  onClose?: () => void;
}) => {
  const location = useLocation();
  const t = useT();
  const isActive = (url: string) => location.pathname === url;

  const initials = company.company_name
    .replace(/[^a-zA-ZäöüÄÖÜ\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "CO";

  const userEmail = user.email || "";
  const userName = userEmail.split("@")[0] || t("nav.user");
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-folk-line bg-folk-sidebar font-sans text-folk-ink">
      {/* Workspace header */}
      <div className="border-b border-folk-line px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.company_name} className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-md bg-folk-ink text-[13px] font-bold tracking-tight text-folk-bg">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight text-folk-ink">
              {company.company_name}
            </div>
            <div className="mt-px text-[13px] text-folk-ink3">{t("nav.workspace")}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-folk-ink3" strokeWidth={1.8} />
          {onClose && (
            <button onClick={onClose} className="ml-1 grid h-6 w-6 place-items-center rounded-md text-folk-ink3 hover:bg-folk-bg-warm md:hidden" aria-label={t("nav.closeMenu")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-folk-line bg-folk-card px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-folk-ink3" strokeWidth={1.8} />
          <span className="flex-1 text-[12.5px] text-folk-ink4">{t("nav.searchPlaceholder")}</span>
          <kbd className="rounded-[3px] bg-folk-bg px-1.5 py-px font-mono text-[10px] text-folk-ink3">⌘K</kbd>
        </div>
      </div>

      {/* Quick links */}
      {quickLinks.length > 0 && (
        <div className="px-2 pt-2.5 pb-1">
          {quickLinks.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[15px] transition-colors ${
                  active ? "bg-folk-card font-semibold text-folk-ink shadow-[0_1px_2px_rgba(24,24,26,0.03)]" : "text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
              >
                <span className="text-[14px] leading-none">{item.emoji}</span>
                <span className="flex-1 truncate">{t(item.titleKey)}</span>
                {item.badge ? (
                  <span className="font-mono text-[13px] text-folk-ink3">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {/* Grouped nav */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <div key={group.id} className="mt-3">
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-0.5">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{t(group.labelKey)}</span>
            </div>
            {group.items.map((item) => {
              const active = isActive(item.url);
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[15px] transition-colors ${
                    active
                      ? "border border-folk-line bg-folk-card font-semibold text-folk-ink"
                      : "border border-transparent text-folk-ink2 hover:bg-folk-bg-warm"
                  }`}
                >
                  <span className="text-[14px] leading-none">{item.emoji}</span>
                  <span className="flex-1 truncate">{t(item.titleKey)}</span>
                  {item.badge ? (
                    <span className="font-mono text-[13px] text-folk-ink3">{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Profile footer */}
      <div className="flex items-center gap-2 border-t border-folk-line px-2.5 py-2">
        <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-folk-coral text-[13px] font-bold text-white">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold leading-tight text-folk-ink">{userName}</div>
          <div className="truncate text-[13px] text-folk-ink3">{userEmail}</div>
        </div>
        <button
          onClick={onSignOut}
          title={t("nav.logout")}
          className="grid h-7 w-7 place-items-center rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </aside>
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
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const company = activeCompany as Company | null;
  const [besichtigungUploadedCount, setBesichtigungUploadedCount] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
        notifyWithHistory(
          t("nav.notifications.newAppointment", { type: getAppointmentTypeLabel(a.appointment_type, locale) }),
          t("nav.notifications.appointmentOn", { title: a.title, date: formatDate(a.appointment_date, locale) }),
          "/firma/kalender",
          "appointment",
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments", filter: `company_id=eq.${companyId}` }, (payload) => {
        const a = payload.new as { title: string; status: string };
        const old = payload.old as { status?: string } | null;
        // Nur diese Statuswechsel lösen eine Meldung aus — wie zuvor (die alte Label-Map
        // war zugleich die Whitelist).
        const NOTIFIED_STATUSES = ["confirmed", "cancelled", "completed", "rescheduled"];
        if (old && old.status !== a.status && NOTIFIED_STATUSES.includes(a.status)) {
          notifyWithHistory(
            t("nav.notifications.appointmentStatusChanged", { status: getAppointmentStatusLabel(a.status, locale) }),
            a.title,
            "/firma/kalender",
            "appointment",
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, notifyWithHistory, user, t, locale]);

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
    "/firma/rechnungen": firmaImports.Rechnungen,
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

  // Folk-style menu: emoji + label, organized in sections
  const quickLinksRaw: MenuItem[] = useMemo(() => [
    { titleKey: "nav.overview", url: "/firma", emoji: "🏠" },
    { titleKey: "nav.anfragen", url: "/firma/anfragen", emoji: "📥" },
    { titleKey: "nav.kalender", url: "/firma/kalender", emoji: "📅" },
  ], []);

  const menuGroups: MenuGroup[] = useMemo(() => [
    {
      id: "hauptbereich", labelKey: "nav.group.hauptbereich", items: [
        { titleKey: "nav.offerten", url: "/firma/offerten", emoji: "📄" },
        { titleKey: "nav.auftraege", url: "/firma/auftraege", emoji: "✅" },
        { titleKey: "nav.quittungen", url: "/firma/quittungen", emoji: "🧾" },
        { titleKey: "nav.rechnungen", url: "/firma/rechnungen", emoji: "💳" },
      ],
    },
    {
      id: "betrieb", labelKey: "nav.group.betrieb", items: [
        { titleKey: "nav.besichtigungen", url: "/firma/besichtigungen", emoji: "🔎", badge: besichtigungUploadedCount > 0 ? besichtigungUploadedCount : undefined },
        { titleKey: "nav.umzugsboxen", url: "/firma/umzugsboxen", emoji: "📦" },
        { titleKey: "nav.team", url: "/firma/team", emoji: "👥" },
        { titleKey: "nav.checkliste", url: "/firma/checkliste", emoji: "☑️" },
      ],
    },
    {
      id: "verwaltung", labelKey: "nav.group.verwaltung", items: [
        { titleKey: "nav.leistungskatalog", url: "/firma/leistungskatalog", emoji: "🛠️" },
        { titleKey: "nav.preisgestaltung", url: "/firma/preisgestaltung", emoji: "💰" },
        { titleKey: "nav.archiv", url: "/firma/datenarchiv", emoji: "🗂️" },
        { titleKey: "nav.einstellungen", url: "/firma/einstellungen", emoji: "⚙️" },
      ],
    },
  ], [besichtigungUploadedCount]);

  // Module-flag filtering — see isMenuItemVisible (module scope).
  const quickLinks = useMemo(() => quickLinksRaw.filter(isMenuItemVisible), [quickLinksRaw]);
  const filteredGroups = useMemo(() => menuGroups
    .map(g => ({ ...g, items: g.items.filter(isMenuItemVisible) }))
    .filter(g => g.items.length > 0), [menuGroups]);

  // Prefetch on hover (attach via wrapping the sidebar links is complex with the new structure;
  // simplest: prefetch on hover of all rendered links via event delegation on the <aside>).
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = sidebarRef.current;
    if (!root) return;
    const onOver = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (href) handlePrefetch(href);
    };
    root.addEventListener("mouseover", onOver);
    return () => root.removeEventListener("mouseover", onOver);
  }, [handlePrefetch]);

  // Loading
  if (isLoading || companyLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-folk-bg">
      <Loader2 className="h-8 w-8 animate-spin text-folk-coral" />
    </div>
  );

  if (!user) return null;

  // No company
  if (!company) return (
    <div className="flex min-h-screen items-center justify-center bg-folk-bg">
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-folk-coral" />
        <h1 className="text-2xl font-bold">{t("nav.noCompany.title")}</h1>
        <p className="text-folk-ink3">{t("nav.noCompany.description")}</p>
        <Button variant="hero" onClick={handleSignOut}>{t("nav.logout")}</Button>
      </div>
    </div>
  );

  // Not verified
  if (company.is_verified === false) return (
    <div className="flex min-h-screen items-center justify-center bg-folk-bg">
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-folk-coral" />
        <h1 className="text-2xl font-bold">{t("nav.notVerified.title")}</h1>
        <p className="text-folk-ink3">{t("nav.notVerified.description")}</p>
        <Button variant="hero" onClick={handleSignOut}>{t("nav.logout")}</Button>
      </div>
    </div>
  );

  const hasMultipleCompanies = companies.length > 1;
  const allItems = [...quickLinks, ...menuGroups.flatMap(g => g.items)];
  const currentItem = allItems.find(i => i.url === location.pathname);
  const pageTitle = t(currentItem?.titleKey ?? "nav.overview");
  const pageEmoji = currentItem?.emoji || "🏠";

  return (
    <div className="flex min-h-screen w-full bg-folk-bg">
      {/* Sidebar (desktop) */}
      <div ref={sidebarRef} className="hidden md:block">
        <FirmaSidebar
          company={company}
          user={user}
          groups={filteredGroups}
          quickLinks={quickLinks}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Sidebar drawer (mobile) */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-folk-ink/40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <FirmaSidebar
              company={company}
              user={user}
              groups={filteredGroups}
              quickLinks={quickLinks}
              onSignOut={handleSignOut}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main column */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-folk-line bg-folk-bg px-3 sm:px-7">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-folk-ink2 hover:bg-folk-bg-warm md:hidden"
            aria-label={t("nav.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb + title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden truncate text-[14px] text-folk-ink3 sm:inline">
              {company.company_name} <span className="mx-1.5 text-folk-ink4">/</span>
            </span>
            <span className="text-base leading-none sm:text-lg">{pageEmoji}</span>
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-folk-ink sm:text-base">
              {pageTitle}
            </h1>
          </div>

          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAll}
            onNotificationClick={handleNotificationClick}
          />

          {/* Dashboard-Sprache: wirkt nur auf diese Ansicht, nicht auf Kundendokumente */}
          <LanguageSwitcher />

          {/* Company switcher / profile */}
          {hasMultipleCompanies ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 border-folk-line bg-folk-card px-2 text-folk-ink2 hover:bg-folk-bg-warm sm:px-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-folk-coral-bg">
                    <Building2 className="h-3.5 w-3.5 text-folk-coral" />
                  </div>
                  <span className="hidden max-w-[100px] truncate text-sm font-medium sm:block">{company.company_name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-folk-ink3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-folk-ink3">{t("nav.switchCompany")}</DropdownMenuLabel>
                {companies.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => switchCompany(c.id)} className="cursor-pointer gap-2">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{c.company_name}</span>
                    {c.id === company.id && <Check className="h-4 w-4 text-folk-coral" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="h-4 w-4" />{t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 border-folk-line bg-folk-card px-2 text-folk-ink2 hover:bg-folk-bg-warm sm:px-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-folk-coral-bg">
                    <Building2 className="h-3.5 w-3.5 text-folk-coral" />
                  </div>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{user.email?.split("@")[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-folk-ink3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col gap-1 pb-2">
                  <span className="truncate text-sm font-semibold">{user.email}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-folk-coral">
                    <Building2 className="h-3 w-3" />
                    {role === 'owner' ? t("nav.role.owner") : role === 'admin' ? t("nav.role.admin") : t("nav.role.member")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleSound} className="cursor-pointer gap-2">
                  {isSoundEnabled ? <Volume2 className="h-4 w-4 text-folk-mint" /> : <VolumeX className="h-4 w-4 text-folk-ink3" />}
                  <span>{isSoundEnabled ? t("nav.sound.on") : t("nav.sound.off")}</span>
                  <span className={`ml-auto rounded-full px-1.5 py-0.5 text-xs ${isSoundEnabled ? "bg-folk-mint-bg text-folk-mint" : "bg-folk-bg-warm text-folk-ink3"}`}>{isSoundEnabled ? t("nav.state.on") : t("nav.state.off")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={togglePushNotifications} disabled={pushPermission === "denied"} className="cursor-pointer gap-2">
                  {isPushEnabled ? <Bell className="h-4 w-4 text-folk-sky" /> : <BellOff className="h-4 w-4 text-folk-ink3" />}
                  <span className="flex-1">{pushPermission === "denied" ? t("nav.push.blocked") : isPushEnabled ? t("nav.push.on") : t("nav.push.off")}</span>
                  {pushPermission !== "denied" && <span className={`rounded-full px-1.5 py-0.5 text-xs ${isPushEnabled ? "bg-folk-sky-bg text-folk-sky" : "bg-folk-bg-warm text-folk-ink3"}`}>{isPushEnabled ? t("nav.state.on") : t("nav.state.off")}</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="h-4 w-4" />{t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
};

export default FirmaLayout;
