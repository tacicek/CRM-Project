import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X } from "lucide-react";
import { diffWords, type SpellCheckFields } from "@/lib/spellCheckService";

// Human-readable labels for field keys
const FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung / Anmerkungen",
  termsAndConditions: "AGB / Zahlungsbedingungen",
  internalNotes: "Interne Notizen",
};

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // item_N_description → "Position N"
  const itemDescMatch = key.match(/^item_(\d+)_description$/);
  if (itemDescMatch) return `Position ${itemDescMatch[1]}`;
  const itemDetailMatch = key.match(/^item_(\d+)_detail_(\d+)$/);
  if (itemDetailMatch) return `Position ${itemDetailMatch[1]} – Detail ${itemDetailMatch[2]}`;
  return key;
}

interface DiffRowProps {
  label: string;
  original: string;
  corrected: string;
}

function DiffRow({ label, original, corrected }: DiffRowProps) {
  const tokens = diffWords(original, corrected);
  const hasChange = tokens.some((t) => t.changed);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {hasChange && (
          <Badge variant="secondary" className="text-xs">
            Korrigiert
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Original */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{original}</p>
        </div>
        {/* Corrected */}
        <div className="p-3 space-y-1 bg-green-50/40 dark:bg-green-900/10">
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Korrektur</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {tokens.map((token, i) =>
              token.changed ? (
                <mark
                  key={i}
                  className="bg-yellow-200 dark:bg-yellow-800/60 text-foreground rounded px-0.5"
                >
                  {token.text}
                </mark>
              ) : (
                <span key={i}>{token.text}</span>
              )
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SpellCheckModalProps {
  open: boolean;
  originalFields: SpellCheckFields;
  correctedFields: SpellCheckFields;
  onAccept: () => void;
  onKeepOriginal: () => void;
  onDismiss: () => void;
}

export default function SpellCheckModal({
  open,
  originalFields,
  correctedFields,
  onAccept,
  onKeepOriginal,
  onDismiss,
}: SpellCheckModalProps) {
  // Only show fields that actually have corrections
  const changedKeys = Object.keys(correctedFields).filter(
    (k) => correctedFields[k] !== originalFields[k]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Textkorrektur prüfen
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {changedKeys.length === 1
              ? "1 Feld wurde korrigiert."
              : `${changedKeys.length} Felder wurden korrigiert.`}{" "}
            Bitte prüfen Sie die Änderungen.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {changedKeys.map((key) => (
            <DiffRow
              key={key}
              label={fieldLabel(key)}
              original={originalFields[key] ?? ""}
              corrected={correctedFields[key]}
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onKeepOriginal} className="flex-1 sm:flex-none">
            Original behalten
          </Button>
          <Button onClick={onAccept} className="flex-1 sm:flex-none gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Korrekturen übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
