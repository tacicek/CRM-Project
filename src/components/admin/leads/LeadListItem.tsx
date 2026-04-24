import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServiceLabel } from "@/lib/serviceLabels";
import { Eye, Check, X, AlertTriangle } from "lucide-react";
import type { Lead } from "./types";
import { getSpamRiskTooltip, getTimeAgo } from "./utils";
import { SpamRiskBadge, StatusBadge, VerificationTypeBadge, AiQualityBadge } from "./LeadBadges";

interface LeadListItemProps {
  lead: Lead;
  activeTab: string;
  isSelected: boolean;
  isProcessing: boolean;
  onToggleSelection: (leadId: string) => void;
  onOpenDetail: (lead: Lead) => void;
  onVerify: (lead: Lead) => void;
  onReject: (lead: Lead) => void;
}

export function LeadListItem({
  lead,
  activeTab,
  isSelected,
  isProcessing,
  onToggleSelection,
  onOpenDetail,
  onVerify,
  onReject,
}: LeadListItemProps) {
  return (
    <div
      className={`p-4 border rounded-lg transition-all hover:shadow-md ${
        isSelected ? "border-secondary bg-secondary/5" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {activeTab === "pending_verification" && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(lead.id)}
            className="mt-1 w-4 h-4 rounded border-gray-300"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary">{getServiceLabel(lead.service_type)}</Badge>
            <StatusBadge status={lead.status} />
            <VerificationTypeBadge lead={lead} />
            {activeTab === "pending_verification" && <SpamRiskBadge lead={lead} />}
            {(activeTab === "pending_verification" ||
              activeTab === "awaiting_confirmation" ||
              activeTab === "risky") && <AiQualityBadge lead={lead} />}
            <span className="text-sm text-muted-foreground">{getTimeAgo(lead.created_at)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Kunde:</span>
              <div className="font-medium">{lead.customer_first_name} {lead.customer_last_name}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Kontakt:</span>
              <div className="font-medium truncate">{lead.customer_email}</div>
              <div className="text-muted-foreground">{lead.customer_phone}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Route:</span>
              <div className="font-medium">{lead.from_plz} {lead.from_city}</div>
              {lead.to_city && <div className="text-muted-foreground">&rarr; {lead.to_plz} {lead.to_city}</div>}
            </div>
            <div>
              <span className="text-muted-foreground">Wunschdatum:</span>
              <div className="font-medium">
                {lead.preferred_date
                  ? new Date(lead.preferred_date).toLocaleDateString("de-CH")
                  : "Nicht angegeben"}
              </div>
            </div>
          </div>

          {/* IP and spam info for high-risk leads */}
          {(lead.spam_score || 0) >= 2 && lead.ip_address && (
            <div className="mt-2 p-2 bg-warning/10 rounded text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>
                <span className="font-medium">IP: {lead.ip_address}</span>
                <span className="text-muted-foreground ml-2">| {getSpamRiskTooltip(lead)}</span>
              </span>
            </div>
          )}

          {lead.rejection_reason && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
              <span className="font-medium text-destructive">Ablehnungsgrund:</span> {lead.rejection_reason}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenDetail(lead)}>
            <Eye className="w-4 h-4" />
          </Button>
          {activeTab === "pending_verification" && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => onVerify(lead)}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onReject(lead)}
                disabled={isProcessing}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
