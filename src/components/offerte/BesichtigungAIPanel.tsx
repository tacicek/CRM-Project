/**
 * BesichtigungAIPanel - Shows AI analysis from Virtual Besichtigung in the Offerte form
 * 
 * Standalone, modular component. Does NOT modify parent state directly.
 * Instead, it calls an onApplyItems callback to inject items into the offer.
 * 
 * Usage:
 *   <BesichtigungAIPanel
 *     companyId="..."
 *     leadId="..."
 *     customerName="Max Mustermann"
 *     onApplyItems={(items) => { ... }}
 *   />
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Sparkles,
  Package,
  Clock,
  Users,
  Truck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  Camera,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/useI18n";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";

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

interface AnalysisData {
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
}

interface VirtualSession {
  id: string;
  status: string;
  customer_name: string;
  photo_count: number;
  created_at: string;
}

export interface AIOfferItem {
  description: string;
  quantity: number;
  unit: string;
  note?: string;
}

interface BesichtigungAIPanelProps {
  companyId: string;
  leadId?: string | null;
  customerName?: string; // kept for API compatibility but no longer used for matching
  onApplyItems?: (items: AIOfferItem[]) => void;
  /**
   * DOCUMENT locale of the offer (offers.language / lead.language). `handleApplyItems`
   * below writes descriptions straight into offer_items.description — customer-bound
   * text — so those strings must be resolved in the customer's language, not the
   * operator's dashboard language. Follows the SurchargeEditor `documentLocale` pattern.
   */
  documentLocale: Locale;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Operator-facing label (dashboard locale) — never written into the offer itself.
const truckLabelKeys: Record<string, MessageKey> = {
  transporter: "offer.ai.truck.transporter",
  "3.5t": "offer.ai.truck.3_5t",
  "7.5t": "offer.ai.truck.7_5t",
  "12t": "offer.ai.truck.12t",
  "18t": "offer.ai.truck.18t",
};

const truckLabel = (truck: string | null, t: (key: MessageKey) => string): string => {
  if (!truck) return "–";
  const key = truckLabelKeys[truck];
  return key ? t(key) : truck;
};

// ─── Component ───────────────────────────────────────────────────────────────
export const BesichtigungAIPanel = ({
  companyId,
  leadId,
  onApplyItems,
  documentLocale,
}: BesichtigungAIPanelProps) => {
  const t = useT();
  // Text that ends up INSIDE offer_items.description → customer's language.
  const documentT = documentI18nFor(documentLocale).t;
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [session, setSession] = useState<VirtualSession | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);

  // Fetch virtual besichtigung sessions for this company (optionally filtered by lead)
  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      try {
        const { data: sessionsRaw, error } = await supabase.rpc(
          "get_company_besichtigung_sessions" as never,
          { p_company_id: companyId } as never
        );

        if (error || !sessionsRaw) {
          setLoading(false);
          return;
        }

        const sessions = typeof sessionsRaw === "string" ? JSON.parse(sessionsRaw) : sessionsRaw;
        if (!Array.isArray(sessions) || sessions.length === 0) {
          setLoading(false);
          return;
        }

        // Match ONLY by lead_id — customer name matching is unreliable and causes
        // data leaks (same name can appear in multiple sessions, e.g. company owner testing).
        let matchedSession = null;

        if (leadId) {
          matchedSession = sessions.find((s: { lead_id?: string }) => s.lead_id === leadId);
        }

        if (matchedSession) {
          setSession({
            id: matchedSession.id,
            status: matchedSession.status,
            customer_name: matchedSession.customer_name,
            photo_count: matchedSession.photo_count || 0,
            created_at: matchedSession.created_at,
          });

          // Fetch analysis if exists
          if (matchedSession.status === "analyzed" || matchedSession.status === "completed") {
            const { data: analysisRaw } = await supabase.rpc(
              "get_besichtigung_analysis" as never,
              { p_session_id: matchedSession.id } as never
            );
            if (analysisRaw) {
              const parsed = typeof analysisRaw === "string" ? JSON.parse(analysisRaw) : analysisRaw;
              if (parsed?.id) {
                setAnalysis({
                  ...parsed,
                  room_breakdown: typeof parsed.room_breakdown === "string"
                    ? JSON.parse(parsed.room_breakdown) : (parsed.room_breakdown || []),
                  detected_items: typeof parsed.detected_items === "string"
                    ? JSON.parse(parsed.detected_items) : (parsed.detected_items || []),
                  special_items: parsed.special_items || [],
                  special_requirements: parsed.special_requirements || [],
                });
                // Pre-select all items
                const allIdxs = new Set(
                  (typeof parsed.detected_items === "string"
                    ? JSON.parse(parsed.detected_items)
                    : (parsed.detected_items || [])
                  ).map((_: DetectedItem, i: number) => i)
                );
                setSelectedItems(allIdxs);
                setIsExpanded(true);
              }
            }
          }
        }
      } catch (err) {
        console.warn("BesichtigungAIPanel fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [companyId, leadId]);

  // Start analysis if session exists but not yet analyzed
  const handleAnalyze = async () => {
    if (!session) return;
    setAnalyzing(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let accessToken = authSession?.access_token;
      if (!accessToken) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed.session?.access_token;
      }
      if (!accessToken) {
        toast.error(t("offer.ai.toast.sessionExpired"));
        return;
      }

      toast.info(t("offer.ai.toast.analyzing"));

      const { data, error } = await supabase.functions.invoke("analyze-besichtigung", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { session_id: session.id },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis({
          ...data.analysis,
          room_breakdown: data.analysis.room_breakdown || [],
          detected_items: data.analysis.detected_items || [],
          special_items: data.analysis.special_items || [],
          special_requirements: data.analysis.special_requirements || [],
        });
        const allIdxs = new Set((data.analysis.detected_items || []).map((_: DetectedItem, i: number) => i));
        setSelectedItems(allIdxs);
        setSession(prev => prev ? { ...prev, status: "analyzed" } : null);
        toast.success(t("offer.ai.toast.analysisComplete"));
      }
    } catch (err: unknown) {
      console.error("Analysis error:", err);
      toast.error(t("offer.ai.toast.analysisFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply selected items as offer positions
  const handleApplyItems = () => {
    if (!analysis || !onApplyItems) return;

    const itemsToApply: AIOfferItem[] = analysis.detected_items
      .filter((_, idx) => selectedItems.has(idx))
      .map(item => ({
        description: item.special
          ? documentT("offer.doc.ai.specialItem", { name: item.name })
          : item.name,
        quantity: item.count,
        unit: "Stück",
        note: item.volume_m3 > 0 ? `~${item.volume_m3} m³` : undefined,
      }));

    // Add special requirements as a note item
    if (analysis.special_requirements.length > 0) {
      itemsToApply.push({
        description: documentT("offer.doc.ai.specialRequirements", {
          list: analysis.special_requirements.join(", "),
        }),
        quantity: 1,
        unit: "Pauschale",
      });
    }

    onApplyItems(itemsToApply);
    setApplied(true);
    toast.success(t("offer.ai.toast.itemsApplied", { count: itemsToApply.length }));
  };

  const toggleItem = (idx: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
    setApplied(false);
  };

  const toggleAll = () => {
    if (selectedItems.size === analysis?.detected_items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(analysis?.detected_items.map((_, i) => i)));
    }
    setApplied(false);
  };

  // ── Nothing to show ──
  if (loading) return null;
  if (!session) return null;

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
      <CardHeader
        className="cursor-pointer px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                {t("offer.ai.title")}
                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  {t("offer.ai.photoCount", { count: session.photo_count })}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {analysis
                  ? t("offer.ai.summaryDetected", {
                      count: analysis.detected_items.length,
                      volume: analysis.estimated_volume_m3 ?? "?",
                    })
                  : t("offer.ai.summaryVirtual", { name: session.customer_name })
                }
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Collapsed summary */}
        {!isExpanded && analysis && (
          <div className="mt-3 p-3 bg-purple-100/50 rounded-lg border border-purple-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1 text-purple-700">
                <Package className="w-3.5 h-3.5" />
                {analysis.estimated_volume_m3} m³
              </span>
              <span className="flex items-center gap-1 text-purple-700">
                <Clock className="w-3.5 h-3.5" />
                {analysis.estimated_time_hours} Std.
              </span>
              <span className="flex items-center gap-1 text-purple-700">
                <Users className="w-3.5 h-3.5" />
                {analysis.recommended_workers} Arbeiter
              </span>
              <span className="flex items-center gap-1 text-purple-700">
                <Truck className="w-3.5 h-3.5" />
                {truckLabel(analysis.recommended_truck, t)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-4">
          {/* No analysis yet → prompt to analyze */}
          {!analysis ? (
            <div className="text-center py-6 space-y-3">
              <Camera className="w-10 h-10 mx-auto text-purple-400" />
              <p className="text-sm text-muted-foreground">
                {session.photo_count > 0
                  ? t("offer.ai.prompt.hasPhotos")
                  : t("offer.ai.prompt.noPhotos")
                }
              </p>
              {session.photo_count > 0 && (
                <Button
                  onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                  disabled={analyzing}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {analyzing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t("offer.ai.analyzing")}</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> {t("offer.ai.startAnalysis")}</>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded-lg p-2.5 text-center border">
                  <Package className="w-4 h-4 mx-auto mb-0.5 text-blue-500" />
                  <p className="text-lg font-bold">{analysis.estimated_volume_m3 ?? "–"} m³</p>
                  <p className="text-[10px] text-muted-foreground">{t("offer.ai.stat.volume")}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-center border">
                  <Clock className="w-4 h-4 mx-auto mb-0.5 text-amber-500" />
                  <p className="text-lg font-bold">{analysis.estimated_time_hours ?? "–"} Std.</p>
                  <p className="text-[10px] text-muted-foreground">{t("offer.ai.stat.duration")}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-center border">
                  <Users className="w-4 h-4 mx-auto mb-0.5 text-emerald-500" />
                  <p className="text-lg font-bold">{analysis.recommended_workers ?? "–"}</p>
                  <p className="text-[10px] text-muted-foreground">{t("offer.ai.stat.workers")}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-center border">
                  <Truck className="w-4 h-4 mx-auto mb-0.5 text-purple-500" />
                  <p className="text-lg font-bold">{truckLabel(analysis.recommended_truck, t)}</p>
                  <p className="text-[10px] text-muted-foreground">{t("offer.ai.stat.vehicle")}</p>
                </div>
              </div>

              {/* Special warnings */}
              {analysis.special_items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  {analysis.special_items.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-700">
                      {item}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Items Selection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium">{t("offer.ai.detectedItems")}</h5>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                    {selectedItems.size === analysis.detected_items.length ? t("offer.ai.toggleAll.deselect") : t("offer.ai.toggleAll.select")}
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="w-8 p-2"></th>
                        <th className="text-left p-2">{t("offer.ai.table.item")}</th>
                        <th className="text-center p-2 w-14">{t("offer.ai.table.count")}</th>
                        <th className="text-center p-2 w-16">m³</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analysis.detected_items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`cursor-pointer transition-colors ${
                            selectedItems.has(idx) ? "bg-purple-50/50" : "hover:bg-muted/30"
                          } ${item.special ? "bg-amber-50/30" : ""}`}
                          onClick={() => toggleItem(idx)}
                        >
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={selectedItems.has(idx)}
                              onCheckedChange={() => toggleItem(idx)}
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </td>
                          <td className="p-2">
                            <span className={item.special ? "font-medium text-amber-700" : ""}>
                              {item.special && "⚠️ "}{item.name}
                            </span>
                          </td>
                          <td className="p-2 text-center">{item.count}x</td>
                          <td className="p-2 text-center text-muted-foreground">{item.volume_m3}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Apply Button */}
              {/* Data retention notice */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-600">
                <span className="shrink-0">⏰</span>
                <span>
                  {t("offer.ai.retentionNotice.pre")}
                  <strong>{t("offer.ai.retentionNotice.bold")}</strong>
                  {t("offer.ai.retentionNotice.post")}
                </span>
              </div>

              {onApplyItems && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {t("offer.ai.selectedCount", { selected: selectedItems.size, total: analysis.detected_items.length })}
                  </p>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleApplyItems(); }}
                    disabled={selectedItems.size === 0 || applied}
                    className="gap-2"
                    variant={applied ? "outline" : "default"}
                    size="sm"
                  >
                    {applied ? (
                      <><Check className="w-4 h-4 text-green-600" /> {t("offer.ai.applied")}</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> {t("offer.ai.applyAction")}</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default BesichtigungAIPanel;
