/**
 * BesichtigungAnalysisView - Standalone component for AI photo analysis
 * 
 * Displays analysis results (inventory table, volume, recommendations)
 * and provides a button to trigger AI analysis.
 * 
 * Completely modular - no dependencies on parent page state.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Package,
  Clock,
  Users,
  Truck,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Box,
  Zap,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DetectedItem {
  name: string;
  count: number;
  volume_m3: number;
  weight_kg?: number | null;
  special: boolean;
  category?: string;
}

interface RoomBreakdown {
  room: string;
  volume_m3: number;
  items: string[];
}

interface AnalysisResult {
  id?: string;
  session_id?: string;
  estimated_volume_m3: number | null;
  estimated_time_hours: number | null;
  recommended_workers: number | null;
  recommended_truck: string | null;
  room_breakdown: RoomBreakdown[];
  detected_items: DetectedItem[];
  special_items: string[];
  special_requirements: string[];
  from_access_difficulty: string | null;
  confidence: number | null;
  analyzed_at?: string;
  summary?: string;
}

interface BesichtigungAnalysisViewProps {
  sessionId: string;
  photoCount: number;
  sessionStatus: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const truckLabel = (truck: string | null) => {
  switch (truck) {
    case "transporter": return "Transporter";
    case "3.5t": return "3.5t LKW";
    case "7.5t": return "7.5t LKW";
    case "12t": return "12t LKW";
    case "18t": return "18t LKW";
    default: return truck || "–";
  }
};

const difficultyColor = (d: string | null) => {
  switch (d) {
    case "einfach": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "mittel": return "bg-amber-100 text-amber-700 border-amber-200";
    case "schwierig": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const categoryIcon = (cat?: string) => {
  switch (cat) {
    case "moebel": return "🪑";
    case "elektronik": return "📺";
    case "karton": return "📦";
    default: return "📋";
  }
};

// ─── Component ───────────────────────────────────────────────────────────────
export const BesichtigungAnalysisView = ({
  sessionId,
  photoCount,
  sessionStatus: _sessionStatus,
}: BesichtigungAnalysisViewProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  // Fetch existing analysis on mount
  useEffect(() => {
    const fetchAnalysis = async () => {
      setFetching(true);
      try {
        const { data, error } = await supabase.rpc(
          "get_besichtigung_analysis" as never,
          { p_session_id: sessionId } as never
        );
        if (!error && data) {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          if (parsed && parsed.id) {
            // Parse JSONB fields if they come as strings
            setAnalysis({
              ...parsed,
              room_breakdown: typeof parsed.room_breakdown === "string"
                ? JSON.parse(parsed.room_breakdown) : (parsed.room_breakdown || []),
              detected_items: typeof parsed.detected_items === "string"
                ? JSON.parse(parsed.detected_items) : (parsed.detected_items || []),
              special_items: parsed.special_items || [],
              special_requirements: parsed.special_requirements || [],
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch analysis:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchAnalysis();
  }, [sessionId]);

  // Start AI analysis
  const handleStartAnalysis = async () => {
    if (photoCount === 0) {
      toast.error("Keine Fotos vorhanden. Der Kunde muss zuerst Fotos hochladen.");
      return;
    }

    setLoading(true);
    try {
      // Get fresh auth token
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let accessToken = authSession?.access_token;
      if (!accessToken) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed.session?.access_token;
      }
      if (!accessToken) {
        toast.error("Sitzung abgelaufen. Bitte erneut einloggen.");
        return;
      }

      toast.info("KI-Analyse läuft... Dies kann 30-60 Sekunden dauern.");

      const { data, error } = await supabase.functions.invoke(
        "analyze-besichtigung",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { session_id: sessionId },
        }
      );

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis({
          ...data.analysis,
          room_breakdown: data.analysis.room_breakdown || [],
          detected_items: data.analysis.detected_items || [],
          special_items: data.analysis.special_items || [],
          special_requirements: data.analysis.special_requirements || [],
        });
        toast.success("KI-Analyse abgeschlossen!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: unknown) {
      console.error("Analysis error:", err);
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(`Analyse fehlgeschlagen: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRoom = (room: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room); else next.add(room);
      return next;
    });
  };

  // ── Loading state ──
  if (fetching) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Analyse wird geladen...</span>
      </div>
    );
  }

  // ── No analysis yet → Show trigger button ──
  if (!analysis) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-xl border border-dashed border-purple-200 dark:border-purple-800">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h4 className="font-semibold text-base mb-1">KI-Analyse</h4>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            Lassen Sie die KI alle Fotos analysieren und eine Inventarliste mit Volumen-Schätzung erstellen.
          </p>
          <Button
            onClick={handleStartAnalysis}
            disabled={loading || photoCount === 0}
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse läuft...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyse starten ({photoCount} Fotos)
              </>
            )}
          </Button>
          {photoCount === 0 && (
            <p className="text-xs text-red-500 mt-2">
              Es wurden noch keine Fotos hochgeladen.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Analysis results ──
  const totalItems = analysis.detected_items.reduce((sum, i) => sum + i.count, 0);
  const specialCount = analysis.detected_items.filter(i => i.special).length;

  return (
    <div className="space-y-4">
      {/* Header with re-analyze button */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          KI-Analyse Ergebnis
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleStartAnalysis}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Erneut analysieren
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
              {analysis.estimated_volume_m3 ?? "–"} m³
            </p>
            <p className="text-xs text-blue-600/70">Geschätztes Volumen</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-amber-600" />
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {analysis.estimated_time_hours ?? "–"} Std.
            </p>
            <p className="text-xs text-amber-600/70">Geschätzte Dauer</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {analysis.recommended_workers ?? "–"}
            </p>
            <p className="text-xs text-emerald-600/70">Empf. Arbeiter</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
              {truckLabel(analysis.recommended_truck)}
            </p>
            <p className="text-xs text-purple-600/70">Empf. Fahrzeug</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5">
          <Box className="w-3 h-3" />
          {totalItems} Gegenstände erkannt
        </Badge>
        {specialCount > 0 && (
          <Badge variant="outline" className="gap-1.5 border-amber-200 text-amber-700 bg-amber-50">
            <AlertTriangle className="w-3 h-3" />
            {specialCount} Spezial
          </Badge>
        )}
        {analysis.from_access_difficulty && (
          <Badge className={`gap-1.5 border ${difficultyColor(analysis.from_access_difficulty)}`}>
            <Shield className="w-3 h-3" />
            Zugang: {analysis.from_access_difficulty}
          </Badge>
        )}
        {analysis.confidence !== null && analysis.confidence !== undefined && (
          <Badge variant="outline" className="gap-1.5">
            <BarChart3 className="w-3 h-3" />
            Konfidenz: {Math.round(analysis.confidence * 100)}%
          </Badge>
        )}
      </div>

      {/* Special Items Warning */}
      {analysis.special_items.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-1.5">
          <h5 className="font-medium text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Spezielle Gegenstände
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {analysis.special_items.map((item, i) => (
              <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-100/50">
                ⚠️ {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Special Requirements */}
      {analysis.special_requirements.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-1.5">
          <h5 className="font-medium text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Besondere Anforderungen
          </h5>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-0.5">
            {analysis.special_requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Room Breakdown (collapsible) */}
      {analysis.room_breakdown.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Raum-Übersicht
          </h5>
          {analysis.room_breakdown.map((room, idx) => (
            <Card key={idx} className="overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleRoom(room.room)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🏠</span>
                  <span className="font-medium text-sm">{room.room}</span>
                  <Badge variant="secondary" className="text-xs">{room.items.length} Gegenstände</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{room.volume_m3} m³</span>
                  {expandedRooms.has(room.room) ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {expandedRooms.has(room.room) && (
                <div className="px-3 pb-3 border-t">
                  <ul className="text-sm space-y-0.5 mt-2">
                    {room.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Detected Items Table */}
      {analysis.detected_items.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Erkannte Gegenstände
          </h5>
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left p-2.5 pl-3">Gegenstand</th>
                    <th className="text-center p-2.5 w-16">Anz.</th>
                    <th className="text-center p-2.5 w-20">Volumen</th>
                    <th className="text-center p-2.5 w-20 hidden sm:table-cell">Gewicht</th>
                    <th className="text-center p-2.5 w-16">Typ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analysis.detected_items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-muted/30 transition-colors ${item.special ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                    >
                      <td className="p-2.5 pl-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {item.special && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {item.name}
                        </div>
                      </td>
                      <td className="p-2.5 text-center">{item.count}x</td>
                      <td className="p-2.5 text-center text-muted-foreground">{item.volume_m3} m³</td>
                      <td className="p-2.5 text-center text-muted-foreground hidden sm:table-cell">
                        {item.weight_kg ? `${item.weight_kg} kg` : "–"}
                      </td>
                      <td className="p-2.5 text-center">{categoryIcon(item.category)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold text-xs">
                    <td className="p-2.5 pl-3">Gesamt</td>
                    <td className="p-2.5 text-center">{totalItems}x</td>
                    <td className="p-2.5 text-center">
                      {analysis.detected_items.reduce((s, i) => s + (i.volume_m3 * i.count), 0).toFixed(1)} m³
                    </td>
                    <td className="p-2.5 text-center hidden sm:table-cell">–</td>
                    <td className="p-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {(analysis as AnalysisResult & { summary?: string }).summary && (
        <div className="bg-muted/30 rounded-xl p-3 text-sm text-muted-foreground italic">
          💡 {(analysis as AnalysisResult & { summary?: string }).summary}
        </div>
      )}

      {/* Data retention notice */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
        <span className="shrink-0 mt-0.5">⏰</span>
        <span>
          Fotos und Analysedaten werden <strong>3 Tage nach Offerte-Versand</strong> automatisch gelöscht.
          Bitte erstellen Sie vorher Ihre Offerte.
        </span>
      </div>
    </div>
  );
};

export default BesichtigungAnalysisView;
