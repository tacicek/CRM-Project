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
import { useT } from "@/i18n/useI18n";
import type { MessageKey, Translator } from "@/i18n/translator";

// Human-readable labels for field keys — operator chrome (the modal only shows inside /firma).
const FIELD_LABEL_KEYS: Record<string, MessageKey> = {
  title: "offer.form.field.title",
  description: "offer.form.field.description",
  termsAndConditions: "offer.spell.field.terms",
  internalNotes: "offer.spell.field.internalNotes",
};

const fieldLabel = (key: string, t: Translator): string => {
  const labelKey = FIELD_LABEL_KEYS[key];
  if (labelKey) return t(labelKey);
  const itemDescMatch = key.match(/^item_(\d+)_description$/);
  if (itemDescMatch) return t("offer.spell.field.item", { n: itemDescMatch[1] });
  const itemDetailMatch = key.match(/^item_(\d+)_detail_(\d+)$/);
  if (itemDetailMatch) {
    return t("offer.spell.field.itemDetail", { n: itemDetailMatch[1], m: itemDetailMatch[2] });
  }
  return key;
};

interface DiffRowProps {
  label: string;
  original: string;
  corrected: string;
}

const DiffRow = ({ label, original, corrected }: DiffRowProps) => {
  const t = useT();
  const tokens = diffWords(original, corrected);
  const hasChange = tokens.some((token) => token.changed);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {hasChange && (
          <Badge variant="secondary" className="text-xs">
            {t("offer.spell.corrected")}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Original */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t("offer.spell.original")}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{original}</p>
        </div>
        {/* Corrected */}
        <div className="p-3 space-y-1 bg-green-50/40">
          <p className="text-xs font-medium text-green-700 mb-1">{t("offer.spell.correction")}</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {tokens.map((token, i) =>
              token.changed ? (
                <mark
                  key={i}
                  className="bg-yellow-200 text-foreground rounded px-0.5"
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
};

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
  const t = useT();
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
              {t("offer.spell.title")}
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
            {t("offer.spell.summary", { count: changedKeys.length })}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {changedKeys.map((key) => (
            <DiffRow
              key={key}
              label={fieldLabel(key, t)}
              original={originalFields[key] ?? ""}
              corrected={correctedFields[key]}
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onKeepOriginal} className="flex-1 sm:flex-none">
            {t("offer.spell.keepOriginal")}
          </Button>
          <Button onClick={onAccept} className="flex-1 sm:flex-none gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {t("offer.spell.accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
