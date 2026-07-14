import { Check } from "lucide-react";

/**
 * Shared read-only position rendering for OfferteDetail + public OfferView (P4a) —
 * mirrors the PDF pattern (P2a/P2b): the first description line is the bold main
 * title, the remaining lines are a muted sub-line underneath.
 */
export const PositionDescription = ({ text }: { text: string }) => {
  const [main, ...rest] = (text ?? "").split("\n");
  const sub = rest.join("\n").trim();
  return (
    <div className="min-w-0">
      <div className="font-semibold text-foreground">{main}</div>
      {sub ? (
        <div className="text-xs text-muted-foreground whitespace-pre-line leading-snug mt-0.5">
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Free (inkl/optional) items — not listed as priced rows (no "CHF 0.00");
 * they appear side by side as a ✓-list under their service group, like the
 * PDF Leistungsumfang block.
 */
export const InklusiveList = ({
  items,
  label,
}: {
  items: { id: string; description: string }[];
  /**
   * Beschriftung der Liste. Muss vom Aufrufer kommen, nicht aus einem Context:
   * dieselbe Komponente rendert im Dashboard (Sprache der Firma) UND auf der
   * öffentlichen Offerten-Seite (Sprache des Kunden). Ohne Angabe bleibt es Deutsch —
   * der bisherige Wert, damit kein Aufrufer stillschweigend leer wird.
   */
  label?: string;
}) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {label ?? "Inklusive"}
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map((it) => (
        <span key={it.id} className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
          {(it.description ?? "").split("\n")[0]}
        </span>
      ))}
    </div>
  </div>
);
