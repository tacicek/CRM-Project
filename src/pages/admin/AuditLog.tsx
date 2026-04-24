import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** RPC names not present on generated Database types */
type UntypedRpc = (
  fn: string,
  params?: Record<string, unknown>
) => Promise<{ data: unknown; error: PostgrestError | null }>;

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Users, Clock, LogIn, RefreshCw, Loader2,
  UserCheck, Building2, Search, ChevronLeft, ChevronRight,
  Activity, Eye,
} from "lucide-react";

type TabId = "logins" | "activities" | "users";

interface AuthAuditEntry {
  id: string;
  payload: {
    action?: string;
    actor_id?: string;
    actor_username?: string;
    log_type?: string;
    traits?: { provider?: string };
  };
  ip_address: string;
  created_at: string;
}

interface AdminActivityEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface UserOverviewEntry {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  user_type: string;
  last_sign_in_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Anmeldung", color: "bg-green-100 text-green-800" },
  logout: { label: "Abmeldung", color: "bg-gray-100 text-gray-700" },
  token_refreshed: { label: "Token", color: "bg-blue-50 text-blue-600" },
  token_revoked: { label: "Token widerrufen", color: "bg-orange-100 text-orange-700" },
  user_signedup: { label: "Registrierung", color: "bg-purple-100 text-purple-700" },
  user_invited: { label: "Einladung", color: "bg-indigo-100 text-indigo-700" },
  user_deleted: { label: "Gelöscht", color: "bg-red-100 text-red-700" },
  user_updated: { label: "Aktualisiert", color: "bg-amber-100 text-amber-700" },
};

const USER_TYPE_BADGES: Record<string, { label: string; color: string; icon: typeof UserCheck }> = {
  staff: { label: "Admin/Staff", color: "bg-red-100 text-red-700", icon: Shield },
  company: { label: "Firma", color: "bg-blue-100 text-blue-700", icon: Building2 },
  unknown: { label: "Unbekannt", color: "bg-gray-100 text-gray-600", icon: Users },
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  return formatDateTime(iso);
}

export default function AuditLogPage() {
  const { isOwner, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("logins");

  const [authLogs, setAuthLogs] = useState<AuthAuditEntry[]>([]);
  const [activities, setActivities] = useState<AdminActivityEntry[]>([]);
  const [userOverview, setUserOverview] = useState<UserOverviewEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !isOwner) {
      navigate("/admin");
    }
  }, [authLoading, isOwner, navigate]);

  const fetchAuthLogs = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const { data, error } = await untypedRpc("get_auth_audit_log", {
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      setAuthLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch auth audit log:", err);
      setAuthLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivities = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const { data, error } = await untypedRpc("get_admin_activity_log", {
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error("Failed to fetch admin activities:", err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await untypedRpc("get_user_overview");
      if (error) throw error;
      setUserOverview(data || []);
    } catch (err) {
      console.error("Failed to fetch user overview:", err);
      setUserOverview([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    setPage(0);
    if (activeTab === "logins") fetchAuthLogs(0);
    else if (activeTab === "activities") fetchActivities(0);
    else if (activeTab === "users") fetchUsers();
  }, [activeTab, isOwner, fetchAuthLogs, fetchActivities, fetchUsers]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (activeTab === "logins") fetchAuthLogs(newPage * PAGE_SIZE);
    else if (activeTab === "activities") fetchActivities(newPage * PAGE_SIZE);
  };

  const filteredAuthLogs = searchQuery
    ? authLogs.filter((l) =>
        (l.payload?.actor_username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.payload?.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.ip_address || "").includes(searchQuery)
      )
    : authLogs;

  const loginOnlyLogs = filteredAuthLogs.filter(
    (l) => l.payload?.action === "login" || l.payload?.action === "user_signedup" || l.payload?.action === "logout"
  );

  const filteredUsers = searchQuery
    ? userOverview.filter((u) =>
        (u.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.first_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.last_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : userOverview;

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isOwner) return null;

  const tabs: { id: TabId; label: string; icon: typeof LogIn }[] = [
    { id: "logins", label: "Anmeldungen", icon: LogIn },
    { id: "activities", label: "Admin-Aktionen", icon: Activity },
    { id: "users", label: "Benutzerübersicht", icon: Users },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Eye className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Aktivitätsprotokoll</h2>
              <p className="text-sm text-muted-foreground">
                Systemweite Überwachung — nur für den Systeminhaber sichtbar
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === "users" ? "Benutzer suchen…" : "Suchen…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "logins") fetchAuthLogs(page * PAGE_SIZE);
              else if (activeTab === "activities") fetchActivities(page * PAGE_SIZE);
              else fetchUsers();
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* LOGIN HISTORY TAB */}
            {activeTab === "logins" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Anmeldeprotokoll
                    <Badge variant="secondary" className="ml-2">{loginOnlyLogs.length} Einträge</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loginOnlyLogs.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Keine Einträge gefunden</p>
                  ) : (
                    <div className="space-y-0 divide-y">
                      {loginOnlyLogs.map((log) => {
                        const action = log.payload?.action || "unknown";
                        const meta = ACTION_LABELS[action] || { label: action, color: "bg-gray-100 text-gray-600" };
                        return (
                          <div key={log.id} className="flex items-center gap-4 py-3 text-sm">
                            <Badge className={`${meta.color} font-medium min-w-[110px] justify-center`}>
                              {meta.label}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">
                                {log.payload?.actor_username || "—"}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-xs hidden sm:block">
                              {log.ip_address || "—"}
                            </span>
                            <div className="text-right min-w-[120px]">
                              <div className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</div>
                              <div className="text-[11px] text-muted-foreground/60">{formatDateTime(log.created_at)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ADMIN ACTIVITIES TAB */}
            {activeTab === "activities" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Admin-Aktionen
                    <Badge variant="secondary" className="ml-2">{activities.length} Einträge</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                      <p className="text-muted-foreground text-sm">Noch keine Admin-Aktionen aufgezeichnet</p>
                      <p className="text-muted-foreground/60 text-xs">
                        Aktionen wie Lead-Verifizierung, Benutzererstellung usw. werden hier protokolliert
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0 divide-y">
                      {activities.map((act) => (
                        <div key={act.id} className="flex items-center gap-4 py-3 text-sm">
                          <Badge variant="outline" className="min-w-[130px] justify-center">
                            {act.action}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{act.user_email}</span>
                            {act.entity_type && (
                              <span className="text-xs text-muted-foreground">
                                {act.entity_type}{act.entity_id ? `: ${act.entity_id.slice(0, 8)}…` : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-right min-w-[120px]">
                            <div className="text-xs text-muted-foreground">{timeAgo(act.created_at)}</div>
                            <div className="text-[11px] text-muted-foreground/60">{formatDateTime(act.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* USER OVERVIEW TAB */}
            {activeTab === "users" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Alle Benutzer
                    <Badge variant="secondary" className="ml-2">{filteredUsers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredUsers.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Keine Benutzer gefunden</p>
                  ) : (
                    <div className="space-y-0 divide-y">
                      {filteredUsers.map((u) => {
                        const typeMeta = USER_TYPE_BADGES[u.user_type] || USER_TYPE_BADGES.unknown;
                        const TypeIcon = typeMeta.icon;
                        return (
                          <div key={u.user_id} className="flex items-center gap-4 py-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <TypeIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {u.first_name || u.last_name
                                    ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                                    : u.email}
                                </span>
                                <Badge className={`${typeMeta.color} text-[11px]`}>
                                  {typeMeta.label}
                                </Badge>
                                {u.role !== "user" && (
                                  <Badge variant="outline" className="text-[11px]">
                                    {u.role}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate block">{u.email}</span>
                            </div>
                            <div className="text-right hidden sm:block min-w-[160px]">
                              <div className="flex items-center gap-1 justify-end text-xs">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "Nie angemeldet"}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                                Erstellt: {formatDateTime(u.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pagination (for logins and activities) */}
            {(activeTab === "logins" || activeTab === "activities") && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Zurück
                </Button>
                <span className="text-sm text-muted-foreground">Seite {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={
                    (activeTab === "logins" && loginOnlyLogs.length < PAGE_SIZE) ||
                    (activeTab === "activities" && activities.length < PAGE_SIZE)
                  }
                >
                  Weiter
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
