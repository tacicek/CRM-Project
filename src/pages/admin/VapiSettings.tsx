import { useCallback, useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Bot,
    Phone,
    Activity,
    Check,
    AlertCircle,
    ExternalLink,
    Clock,
    TrendingUp,
    MessageSquare,
    Loader2,
    RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AiLead {
    id: string;
    slug: string;
    created_at: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    service_type: string;
    ai_confidence_score: number | null;
    conversation_duration: number | null;
    vapi_call_id: string | null;
    status: string;
    from_city: string;
}

interface Stats {
    totalLeads: number;
    avgConfidence: number;
    totalDuration: number;
    last7Days: number;
}

const VapiSettings = () => {
    const [stats, setStats] = useState<Stats>({ totalLeads: 0, avgConfidence: 0, totalDuration: 0, last7Days: 0 });
    const [recentLeads, setRecentLeads] = useState<AiLead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Check if Vapi is configured via env vars
    const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
    const vapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
    const isVapiConfigured = !!(vapiPublicKey && vapiAssistantId);

    // Supabase project ref for webhook URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
    const webhookUrl = projectRef
        ? `https://${projectRef}.supabase.co/functions/v1/vapi-webhook`
        : "https://[project-ref].supabase.co/functions/v1/vapi-webhook";

    const fetchStats = async () => {
        try {
            // Get all AI voice leads - use type assertion for columns not in generated types
            const { data: allLeads, error: allError } = await supabase
                .from("leads")
                .select("id, ai_confidence_score, conversation_duration, created_at")
                .eq("source", "ai_voice") as { data: Array<{ id: string; ai_confidence_score: number | null; conversation_duration: number | null; created_at: string }> | null; error: unknown };

            if (!isMountedRef.current) return;
            if (allError) throw allError;

            // Calculate stats
            const totalLeads = allLeads?.length || 0;

            const validScores = allLeads?.filter(l => l.ai_confidence_score !== null && l.ai_confidence_score !== undefined) || [];
            const avgConfidence = validScores.length > 0
                ? Math.round(validScores.reduce((sum, l) => sum + (l.ai_confidence_score || 0), 0) / validScores.length)
                : 0;

            const totalDuration = allLeads?.reduce((sum, l) => sum + (l.conversation_duration || 0), 0) || 0;

            // Last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const last7Days = allLeads?.filter(l => new Date(l.created_at) >= sevenDaysAgo).length || 0;

            setStats({ totalLeads, avgConfidence, totalDuration, last7Days });
        } catch (error) {
            if (!isMountedRef.current) return;
            console.error("Error fetching stats:", error);
            toast.error("Fehler beim Laden der Statistiken");
        }
    };

    const fetchRecentLeads = async () => {
        try {
            // Use type assertion for columns not in generated types
            const { data, error } = await supabase
                .from("leads")
                .select("id, slug, created_at, customer_first_name, customer_last_name, customer_email, service_type, ai_confidence_score, conversation_duration, vapi_call_id, status, from_city")
                .eq("source", "ai_voice")
                .order("created_at", { ascending: false })
                .limit(20) as { data: AiLead[] | null; error: unknown };

            if (!isMountedRef.current) return;
            if (error) throw error;
            setRecentLeads(data || []);
        } catch (error) {
            if (!isMountedRef.current) return;
            console.error("Error fetching leads:", error);
            toast.error("Fehler beim Laden der Leads");
        }
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([fetchStats(), fetchRecentLeads()]);
        if (isMountedRef.current) setIsLoading(false);
    }, []);  

    const refreshData = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        await Promise.all([fetchStats(), fetchRecentLeads()]);
        if (!isMountedRef.current) return;
        setIsRefreshing(false);
        toast.success("Daten aktualisiert");
    }, [isRefreshing]);  

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return "-";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "-";
            return date.toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return "-";
        }
    };

    const getConfidenceBadge = (score: number | null) => {
        if (score === null) return <Badge variant="outline">-</Badge>;
        if (score >= 70) return <Badge className="bg-accent/10 text-accent">{score}%</Badge>;
        if (score >= 50) return <Badge className="bg-warning/10 text-warning">{score}%</Badge>;
        return <Badge className="bg-destructive/10 text-destructive">{score}%</Badge>;
    };

    const serviceTypeLabels: Record<string, string> = {
        umzug: "Umzug",
        umzug_privat: "Privat Umzug",
        umzug_firma: "Firmenumzug",
        reinigung: "Reinigung",
        raeumung: "Räumung",
        entsorgung: "Entsorgung",
        klaviertransport: "Klaviertransport",
        moebellift: "Möbellift",
        lagerung: "Lagerung",
    };

    if (isLoading) {
        return (
            <>
                <Helmet>
                    <title>KI-Assistent | LeadFlow Admin</title>
                </Helmet>
                <AdminLayout>
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                    </div>
                </AdminLayout>
            </>
        );
    }

    return (
        <>
            <Helmet>
                <title>KI-Assistent | LeadFlow Admin</title>
            </Helmet>
            <AdminLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Bot className="w-6 h-6 text-secondary shrink-0" />
                                KI-Assistent (Vapi.ai)
                            </h2>
                            <p className="text-muted-foreground text-sm">Sprachassistent-Konfiguration und Anrufstatistiken</p>
                        </div>
                        <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="w-full sm:w-auto">
                            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                            Aktualisieren
                        </Button>
                    </div>

                    {/* Configuration Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-start gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                                    <Bot className="w-5 h-5 text-secondary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="text-lg">Vapi.ai Konfiguration</CardTitle>
                                        {isVapiConfigured ? (
                                            <Badge className="bg-accent/10 text-accent">
                                                <Check className="w-3 h-3 mr-1" /> Konfiguriert
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-warning/10 text-warning">
                                                <AlertCircle className="w-3 h-3 mr-1" /> Nicht konfiguriert
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription>Frontend-Integration Status</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                        <span className="text-muted-foreground text-xs font-mono">VITE_VAPI_PUBLIC_KEY</span>
                                        {vapiPublicKey ? (
                                            <span className="text-accent text-xs">****{vapiPublicKey.slice(-8)}</span>
                                        ) : (
                                            <span className="text-warning text-xs">Nicht gesetzt</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                        <span className="text-muted-foreground text-xs font-mono">VITE_VAPI_ASSISTANT_ID</span>
                                        {vapiAssistantId ? (
                                            <span className="text-accent text-xs">{vapiAssistantId.slice(0, 8)}...</span>
                                        ) : (
                                            <span className="text-warning text-xs">Nicht gesetzt</span>
                                        )}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => window.open("https://dashboard.vapi.ai", "_blank")}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Vapi Dashboard öffnen
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-start gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                                    <Activity className="w-5 h-5 text-secondary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg">Webhook (n8n)</CardTitle>
                                    <CardDescription>Backend-Integration für Lead-Erfassung</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                    <p className="text-muted-foreground mb-1">Webhook URL:</p>
                                    <code className="text-xs break-all bg-muted px-2 py-1 rounded block">
                                        {webhookUrl}
                                    </code>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                    <p className="text-muted-foreground mb-1">Benötigtes Secret:</p>
                                    <code className="bg-muted px-2 py-1 rounded text-xs break-all">N8N_WEBHOOK_SECRET</code>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.totalLeads}</p>
                                        <p className="text-sm text-muted-foreground">Gesamt KI-Leads</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.avgConfidence}%</p>
                                        <p className="text-sm text-muted-foreground">Ø Confidence</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{Math.round(stats.totalDuration / 60)}</p>
                                        <p className="text-sm text-muted-foreground">Minuten gesamt</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.last7Days}</p>
                                        <p className="text-sm text-muted-foreground">Letzte 7 Tage</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent AI Leads */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Letzte KI-Gespräche</CardTitle>
                            <CardDescription>Leads die über den Sprachassistenten erfasst wurden</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentLeads.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Noch keine KI-Gespräche erfasst</p>
                                </div>
                            ) : (
                                <div className="rounded-lg border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Datum</TableHead>
                                                <TableHead>Kunde</TableHead>
                                                <TableHead className="hidden sm:table-cell">Service</TableHead>
                                                <TableHead className="hidden sm:table-cell">Ort</TableHead>
                                                <TableHead className="hidden md:table-cell">Dauer</TableHead>
                                                <TableHead className="hidden md:table-cell">Confidence</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recentLeads.map((lead) => (
                                                <TableRow key={lead.id}>
                                                    <TableCell className="text-sm whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-sm">{lead.customer_first_name} {lead.customer_last_name}</p>
                                                            <p className="text-xs text-muted-foreground hidden sm:block">{lead.customer_email}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <Badge variant="outline">
                                                            {serviceTypeLabels[lead.service_type] || lead.service_type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">{lead.from_city}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{formatDuration(lead.conversation_duration)}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{getConfidenceBadge(lead.ai_confidence_score)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={lead.status === "verified" ? "default" : "outline"}>
                                                            {lead.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Documentation Link */}
                    <Card>
                        <CardContent className="py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <Bot className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-sm text-muted-foreground">
                                        Konversationsfluss dokumentiert in <code className="bg-muted px-1 rounded break-all">docs/VAPI_CONVERSATION_GUIDE.md</code>
                                    </span>
                                </div>
                                <Button variant="ghost" size="sm" className="w-full sm:w-auto shrink-0" onClick={() => window.open("/ai-berater", "_blank")}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    KI-Berater Seite öffnen
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AdminLayout>
        </>
    );
};

export default VapiSettings;
