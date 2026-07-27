import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useT } from "@/i18n/useI18n";

/**
 * Eingabefeld für einen Zugangsschlüssel, das den Schlüssel nie anzeigt.
 *
 * Vorher lag der Klartext-Wert in der React-State und war an ein
 * `type="password"`-Feld gebunden. Das verbirgt ihn optisch, ändert aber nichts:
 * der Wert steht im DOM, im Netzwerk-Tab und in jedem HAR-Mitschnitt — und ein
 * Klick auf das Augen-Symbol machte ihn ohnehin sichtbar.
 *
 * Hier kommt vom Server nur noch "ist gesetzt" und die letzten vier Zeichen.
 * Das genügt, um zu erkennen WELCHER Schlüssel hinterlegt ist, und reicht nicht,
 * um ihn zu benutzen. Ein neuer Wert wird eingegeben und sofort weggeschickt;
 * er wird nie zurückgelesen.
 */

export interface SecretStatus {
  configured: boolean;
  last4: string | null;
}

interface SecretKeyFieldProps {
  label: string;
  status: SecretStatus | undefined;
  placeholder?: string;
  /** Hinweistext unter dem Feld. */
  hint?: string;
  disabled?: boolean;
  /** Neuen Wert setzen. `null` löscht den hinterlegten Schlüssel. */
  onSave: (value: string | null) => Promise<void>;
}

export const SecretKeyField = ({
  label,
  status,
  placeholder,
  hint,
  disabled,
  onSave,
}: SecretKeyFieldProps) => {
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const configured = status?.configured ?? false;

  const submit = async (value: string | null) => {
    setIsBusy(true);
    try {
      await onSave(value);
      setDraft("");
      setIsEditing(false);
    } finally {
      setIsBusy(false);
    }
  };

  // Bekannter Schlüssel, nicht im Bearbeitungsmodus: nur Zustand zeigen.
  if (configured && !isEditing) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-folk-line bg-folk-bg-warm px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-folk-mint">
            <Check className="h-4 w-4" />
            {t("settings.secret.configured")}
          </span>
          {status?.last4 && (
            <span className="font-mono text-sm text-folk-ink3">····{status.last4}</span>
          )}
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isBusy}
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("settings.secret.change")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isBusy}
              onClick={() => submit(null)}
              className="text-folk-coral hover:text-folk-coral"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {hint && <p className="text-xs text-folk-ink3">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          disabled={disabled || isBusy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled || isBusy || !draft.trim()}
          onClick={() => submit(draft.trim())}
        >
          {t("common.save")}
        </Button>
        {configured && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              setDraft("");
              setIsEditing(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-folk-ink3">{hint}</p>}
    </div>
  );
};
