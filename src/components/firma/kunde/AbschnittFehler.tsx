import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/useI18n";
import type { Ladefehler } from "@/lib/ladefehler";
import type { MessageKey } from "@/i18n/translator";

/**
 * Ein Abschnitt, der nicht geladen werden konnte — sichtbar als solcher.
 *
 * Der Kasten sagt drei Dinge und in dieser Reihenfolge: WAS fehlt, WARUM es
 * nicht null bedeutet, und was der Bediener tun kann. Ohne den mittleren Satz
 * liest sich ein leerer Finanzblock wie "dieser Kunde schuldet nichts".
 *
 * Traegt bewusst ein Symbol UND einen Text: Farbe allein waere keine Auskunft
 * (WCAG 1.4.1).
 */
export const AbschnittFehler = ({
  titelKey,
  hinweisKey,
  fehler,
  onRetry,
  laedt,
}: {
  titelKey: MessageKey;
  hinweisKey?: MessageKey;
  fehler: Ladefehler;
  onRetry: () => void;
  laedt?: boolean;
}) => {
  const t = useT();

  // Der Grund schlaegt den Abschnittstitel: "kein Zugriff" verlangt eine andere
  // Handlung als "keine Verbindung", und "Erneut versuchen" hilft nur bei einer.
  const grundTitel: MessageKey =
    fehler.art === "kein_zugriff"
      ? "kunde.error.noAccess"
      : fehler.art === "schema_veraltet"
        ? "kunde.error.schemaStale"
        : titelKey;
  const grundHinweis: MessageKey | undefined =
    fehler.art === "kein_zugriff"
      ? "kunde.error.noAccessHint"
      : fehler.art === "verbindung"
        ? "kunde.error.offline"
        : fehler.art === "schema_veraltet"
          ? "kunde.error.schemaStaleHint"
          : hinweisKey;

  // Wiederholen hilft nur, wenn der naechste Versuch anders ausgehen kann. Bei
  // fehlender Berechtigung und bei veralteter Datenbank kann er das nicht.
  const wiederholbar = fehler.art !== "kein_zugriff" && fehler.art !== "schema_veraltet";

  return (
    <div
      role="alert"
      className="rounded-xl border border-folk-coral/40 bg-folk-coral-bg p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-folk-coral" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-folk-ink">{t(grundTitel)}</p>
          {grundHinweis && (
            <p className="mt-0.5 text-[13px] text-folk-ink2">{t(grundHinweis)}</p>
          )}
          {fehler.nachricht && (
            <p className="mt-1 break-words text-[12px] text-folk-ink3">{fehler.nachricht}</p>
          )}
        </div>
        {wiederholbar && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={laedt}
            onClick={onRetry}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${laedt ? "animate-spin" : ""}`} aria-hidden />
            {t("kunde.error.retry")}
          </Button>
        )}
      </div>
    </div>
  );
};
