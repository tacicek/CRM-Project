import * as React from "react";
import { cn } from "@/lib/utils";
import type { EmailValidationResult } from "@/lib/emailValidation";

interface EmailHintProps {
  email: string;
  result: EmailValidationResult;
  onAcceptSuggestion: (next: string) => void;
  /** Only start showing the hint once the user typed this many chars (default 3). */
  minChars?: number;
  className?: string;
}

/**
 * Inline error/warning line for wizards that render a plain <input type="email">
 * with their own custom styling. For shadcn-style fields prefer <EmailField/>.
 */
export function EmailHint({
  email,
  result,
  onAcceptSuggestion,
  minChars = 3,
  className,
}: EmailHintProps) {
  if (!result.severity) return null;
  if (email.trim().length < minChars) return null;

  const colour =
    result.severity === "error" ? "text-red-500" : "text-amber-600";

  return (
    <p className={cn("text-[11px] mt-1", colour, className)}>
      {result.message}
      {result.suggestion && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => onAcceptSuggestion(result.suggestion!)}
            className="underline font-medium hover:no-underline"
          >
            Meinten Sie {result.suggestion}?
          </button>
        </>
      )}
    </p>
  );
}
