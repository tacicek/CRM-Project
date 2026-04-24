import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, Shield, Zap, UserCheck, AlertCircle } from "lucide-react";

interface LeadStatCardsProps {
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  noMatchCount: number;
  autoVerifiedCount: number;
  manualVerifiedCount: number;
  onTabChange: (tab: string) => void;
}

export function LeadStatCards({
  pendingCount,
  verifiedCount,
  rejectedCount,
  noMatchCount,
  autoVerifiedCount,
  manualVerifiedCount,
  onTabChange,
}: LeadStatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      <Card
        className="cursor-pointer hover:border-warning transition-colors"
        onClick={() => onTabChange("pending_verification")}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Ausstehend</p>
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:border-green-500 transition-colors"
        onClick={() => onTabChange("verified")}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{verifiedCount}</p>
            <p className="text-sm text-muted-foreground">Verifiziert</p>
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:border-destructive transition-colors"
        onClick={() => onTabChange("rejected")}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold">{rejectedCount}</p>
            <p className="text-sm text-muted-foreground">Abgelehnt</p>
          </div>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:border-orange-400 transition-colors"
        onClick={() => onTabChange("no_matches")}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{noMatchCount}</p>
            <p className="text-sm text-muted-foreground">Kein Treffer</p>
          </div>
        </CardContent>
      </Card>

      {/* Auto vs Manual Verification Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-secondary" />
            <span className="font-medium text-sm">Verifizierungsart</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Auto
                </span>
              </div>
              <span className="font-bold">{autoVerifiedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Manuell
                </span>
              </div>
              <span className="font-bold">{manualVerifiedCount}</span>
            </div>
            {verifiedCount > 0 && (
              <div className="pt-2 border-t mt-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="bg-purple-500 transition-all"
                    style={{ width: `${(autoVerifiedCount / verifiedCount) * 100}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${(manualVerifiedCount / verifiedCount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {Math.round((autoVerifiedCount / verifiedCount) * 100)}% automatisch
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
