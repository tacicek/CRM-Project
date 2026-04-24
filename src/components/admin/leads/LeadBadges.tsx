import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Shield, Clock, CheckCircle, XCircle, Zap, UserCheck, MapPin, Mail, Bot } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Lead } from "./types";
import { isVerifiedStatus } from "./utils";

export function SpamRiskBadge({ lead }: { lead: Lead }) {
  const riskScore = lead.spam_score || 0;

  if (riskScore >= 4) {
    return <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" /> Hoch ({riskScore})</Badge>;
  }
  if (riskScore >= 2) {
    return <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30"><AlertCircle className="w-3 h-3 mr-1" /> Mittel ({riskScore})</Badge>;
  }
  if (riskScore >= 1) {
    return <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Niedrig ({riskScore})</Badge>;
  }
  return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30"><Shield className="w-3 h-3 mr-1" /> OK</Badge>;
}

export function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "pending_verification":
    case "pending":
    case "new":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" /> Ausstehend</Badge>;
    case "verified":
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Verifiziert</Badge>;
    case "distributed":
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Verteilt</Badge>;
    case "fallback_distributed":
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30"><MapPin className="w-3 h-3 mr-1" /> Verteilt (Fallback)</Badge>;
    case "no_matches":
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Keine Firmen</Badge>;
    case "unknown_plz":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/30"><MapPin className="w-3 h-3 mr-1" /> PLZ unbekannt</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Abgelehnt</Badge>;
    case "completed":
      return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Abgeschlossen</Badge>;
    case "awaiting_customer_confirmation":
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30"><Mail className="w-3 h-3 mr-1" /> Wartet auf Best&auml;tigung</Badge>;
    case "unconfirmed_risky":
      return <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Riskant / unbest&auml;tigt</Badge>;
    default:
      return <Badge variant="outline">{status || "Unbekannt"}</Badge>;
  }
}

/**
 * AI-tabanli Lead Quality skoru + sinyal listesi tooltip'i.
 * - Yesil: >=80
 * - Sari:  40-79
 * - Kirmizi: <40 (veya is_valid=false)
 */
export function AiQualityBadge({ lead }: { lead: Lead }) {
  if (lead.ai_quality_score === null || lead.ai_quality_score === undefined) {
    return null;
  }

  const score = lead.ai_quality_score;
  const signals = lead.ai_validation_signals ?? [];
  const reason = lead.ai_rejected_reason;

  let colorClass = "bg-green-500/10 text-green-700 border-green-500/30";
  if (score < 40) {
    colorClass = "bg-red-500/10 text-red-700 border-red-500/30";
  } else if (score < 80) {
    colorClass = "bg-amber-500/10 text-amber-700 border-amber-500/30";
  }

  const badge = (
    <Badge variant="outline" className={`text-xs ${colorClass}`}>
      <Bot className="w-3 h-3 mr-1" /> AI: {score}
      {signals.length > 0 && <span className="ml-1">({signals.length})</span>}
    </Badge>
  );

  if (signals.length === 0 && !reason) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">
              AI-Qualit&auml;tsscore: {score}/100
            </div>
            {reason && (
              <div className="text-red-700 font-medium">
                {reason}
              </div>
            )}
            {signals.length > 0 && (
              <>
                <div className="font-medium mt-1">Sinyale:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {signals.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function VerificationTypeBadge({ lead }: { lead: Lead }) {
  if (!isVerifiedStatus(lead.status)) return null;

  if (!lead.verified_by && lead.verified_at) {
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
        <Zap className="w-3 h-3 mr-1" /> Auto
      </Badge>
    );
  }

  if (lead.verified_by) {
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
        <UserCheck className="w-3 h-3 mr-1" /> Manuell
      </Badge>
    );
  }

  return null;
}
