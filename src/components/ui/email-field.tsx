import * as React from "react";
import { Mail, AlertCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { validateEmail, type EmailValidationResult } from "@/lib/emailValidation";

interface EmailFieldProps {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  /** Hide the built-in label (useful when caller renders its own). */
  hideLabel?: boolean;
  /** Called whenever validation result changes — for wizards to drive canProceed(). */
  onValidationChange?: (result: EmailValidationResult) => void;
}

/**
 * Accessible email input with live typo detection.
 *
 * Behaviour:
 *   - red border + message when severity === "error" (invalid TLD, broken format, disposable)
 *   - amber border + message when severity === "warning" (likely typo domain)
 *   - suggestion chip ("Meinten Sie ...?") — clicking replaces the value
 */
export const EmailField = React.forwardRef<HTMLInputElement, EmailFieldProps>(
  function EmailField(
    {
      value,
      onChange,
      id,
      label = "E-Mail-Adresse",
      placeholder = "max.muster@example.ch",
      required,
      autoComplete = "email",
      className,
      inputClassName,
      hideLabel,
      onValidationChange,
    },
    ref,
  ) {
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    const [touched, setTouched] = React.useState(false);

    const result = React.useMemo(() => validateEmail(value), [value]);

    React.useEffect(() => {
      onValidationChange?.(result);
    }, [result, onValidationChange]);

    // Only show hint once the user has interacted OR typed enough to be meaningful
    const showHint = (touched || value.trim().length > 4) && !!result.severity;

    return (
      <div className={cn("space-y-1.5", className)}>
        {!hideLabel && (
          <Label
            htmlFor={fieldId}
            className="text-base font-medium flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {label}
            {required && <span className="text-red-500">*</span>}
          </Label>
        )}

        <Input
          ref={ref}
          id={fieldId}
          type="email"
          inputMode="email"
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={result.severity === "error" ? true : undefined}
          aria-describedby={showHint ? `${fieldId}-hint` : undefined}
          className={cn(
            showHint && result.severity === "error" && "border-red-400 focus-visible:ring-red-400",
            showHint && result.severity === "warning" && "border-amber-400 focus-visible:ring-amber-400",
            inputClassName,
          )}
        />

        {showHint && (
          <div
            id={`${fieldId}-hint`}
            role={result.severity === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-1.5 text-[13px] leading-snug",
              result.severity === "error" ? "text-red-600" : "text-amber-700",
            )}
          >
            {result.severity === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p>{result.message}</p>
              {result.suggestion && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(result.suggestion!);
                    setTouched(true);
                  }}
                  className="underline underline-offset-2 font-medium hover:no-underline"
                >
                  Meinten Sie <span className="font-semibold">{result.suggestion}</span>?
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default EmailField;
