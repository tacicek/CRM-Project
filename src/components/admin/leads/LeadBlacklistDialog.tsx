import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Ban, Plus, Trash2, Loader2 } from "lucide-react";
import type { BlacklistEntry } from "./types";

interface LeadBlacklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blacklist: BlacklistEntry[];
  newIp: string;
  setNewIp: (ip: string) => void;
  newReason: string;
  setNewReason: (reason: string) => void;
  isProcessing: boolean;
  onAdd: (ip: string, reason: string) => void;
  onRemove: (id: string) => void;
}

export function LeadBlacklistDialog({
  open,
  onOpenChange,
  blacklist,
  newIp,
  setNewIp,
  newReason,
  setNewReason,
  isProcessing,
  onAdd,
  onRemove,
}: LeadBlacklistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5" />
            IP-Blacklist verwalten
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new IP */}
          <div className="p-4 border rounded-lg space-y-3">
            <h4 className="font-medium">Neue IP-Adresse hinzuf&uuml;gen</h4>
            <div className="flex gap-2">
              <Input
                placeholder="IP-Adresse (z.B. 192.168.1.1)"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Grund (optional)"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => onAdd(newIp, newReason)}
                disabled={isProcessing || !newIp.trim()}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Blacklist entries */}
          <div className="space-y-2">
            <h4 className="font-medium">Gesperrte IP-Adressen ({blacklist.length})</h4>
            {blacklist.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine IP-Adressen auf der Blacklist
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {blacklist.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-medium">{entry.ip_address}</div>
                      {entry.reason && (
                        <div className="text-xs text-muted-foreground">{entry.reason}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Blockiert: {entry.blocked_count}x | Hinzugef&uuml;gt: {new Date(entry.created_at).toLocaleDateString("de-CH")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onRemove(entry.id)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schlie&szlig;en
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
