import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Check, Languages, Lock } from "lucide-react";
import { useT } from "@/i18n/useI18n";
import { LOCALE_NAMES, type Locale } from "@/i18n/locale";
import {
  applyOfferLanguageRebase,
  type RebaseAnwendung,
  type RebaseFeldBefund,
  type RebasePlan,
} from "@/lib/offerLanguageRebase";

/**
 * Der Sprachwechsel als Vorgang mit Vorschau — statt als Schalter, der etwas
 * anderes behauptet, als er tut.
 *
 * Bis 2026-08-28 setzte der Wähler `offers.language` und sonst nichts. Titel,
 * Positionstexte und Zahlungskondition blieben in der vorigen Sprache stehen,
 * während die Oberfläche „Französisch" anzeigte. Der Hinweistext warnte vor
 * genau einem Teil davon (den Positionen) und schwieg über den Rest.
 *
 * Dieser Dialog zeigt den PLAN, bevor er wirkt: was übernommen wird, was
 * bereits stimmt, was von Hand geschrieben ist und deshalb stehen bleibt, und
 * wofür schlicht keine Übersetzung hinterlegt ist.
 *
 * Die Sprache dieses Dialogs ist die des BEDIENERS (`useT`) — er liest ihn. Die
 * Werte darin sind die des KUNDEN. Zwei Achsen, gleichzeitig sichtbar.
 */

interface Props {
  plan: RebasePlan | null;
  onAbbrechen: () => void;
  onAnwenden: (wirkung: RebaseAnwendung) => void;
}

const Zeile = ({
  befund,
  gewaehlt,
  onWechsel,
}: {
  befund: RebaseFeldBefund;
  gewaehlt?: boolean;
  onWechsel?: (an: boolean) => void;
}) => {
  const t = useT();
  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        {onWechsel && (
          <Checkbox
            className="mt-0.5"
            checked={gewaehlt ?? false}
            onCheckedChange={(v) => onWechsel(v === true)}
            aria-label={befund.feld}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <code className="text-xs text-muted-foreground">{befund.feld}</code>
          <p className="truncate">
            <span className="text-muted-foreground">{t("offer.lang.rebase.current")}: </span>
            {befund.aktuellerWert || "—"}
          </p>
          {befund.vorschlag !== undefined && (
            <p className="truncate text-folk-mint">
              <span className="text-muted-foreground">{t("offer.lang.rebase.next")}: </span>
              {befund.vorschlag}
            </p>
          )}
          {befund.quelleBezeichnung && (
            <code className="block text-[11px] text-muted-foreground">{befund.quelleBezeichnung}</code>
          )}
        </div>
      </div>
    </div>
  );
};

export const SprachwechselDialog = ({ plan, onAbbrechen, onAnwenden }: Props) => {
  const t = useT();
  const [zustimmung, setZustimmung] = useState<Set<string>>(new Set());

  // Zustimmungen gelten NUR für den Plan, für den sie gegeben wurden.
  //
  // Bei `plan === null` gibt die Komponente `null` zurück — sie wird dadurch
  // aber nicht ausgehängt, ihr Zustand überlebt. Ohne dieses Zurücksetzen
  // wanderte ein Haken aus einer abgebrochenen Sitzung (de→fr, Kästchen
  // gesetzt, Abbrechen) in die nächste (de→en, Anwenden) — die Feldpfade sind
  // stabil, also wurde der von Hand geschriebene Text dort ersetzt, ohne dass
  // in dieser Sitzung je ein Kästchen gesetzt worden wäre. Gefunden von der
  // unabhängigen Durchsicht am 2026-08-28.
  const planKennung = plan ? `${plan.von}→${plan.nach}:${plan.felder.length}` : null;
  useEffect(() => {
    setZustimmung(new Set());
  }, [planKennung]);

  const gruppen = useMemo(() => {
    const leer = { REBASE_AVAILABLE: [], ALREADY_CORRECT: [], USER_EDITED_CONFLICT: [], TRANSLATION_MISSING: [], NON_LOCALIZED: [], IMMUTABLE: [] } as Record<
      RebaseFeldBefund["kategorie"],
      RebaseFeldBefund[]
    >;
    for (const f of plan?.felder ?? []) leer[f.kategorie].push(f);
    return leer;
  }, [plan]);

  if (!plan) return null;

  const wechsel = (feld: string, an: boolean) =>
    setZustimmung((prev) => {
      const next = new Set(prev);
      if (an) next.add(feld);
      else next.delete(feld);
      return next;
    });

  const anwenden = () => {
    onAnwenden(applyOfferLanguageRebase(plan, [...zustimmung]));
    setZustimmung(new Set());
  };

  const nichtsZuTun =
    gruppen.REBASE_AVAILABLE.length === 0 &&
    gruppen.USER_EDITED_CONFLICT.length === 0 &&
    gruppen.TRANSLATION_MISSING.length === 0;

  return (
    <Dialog open onOpenChange={(offen) => { if (!offen) onAbbrechen(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {t("offer.lang.rebase.title")}
          </DialogTitle>
          <DialogDescription>
            {t("offer.lang.rebase.intro", {
              from: LOCALE_NAMES[plan.von as Locale],
              to: LOCALE_NAMES[plan.nach as Locale],
            })}
          </DialogDescription>
        </DialogHeader>

        {plan.eingefroren ? (
          <p className="flex items-start gap-2 rounded-md border border-folk-coral/40 bg-folk-coral-bg p-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {t("offer.lang.rebase.immutable")}
          </p>
        ) : (
          <div className="space-y-4">
            {nichtsZuTun && (
              <p className="text-sm text-muted-foreground">{t("offer.lang.rebase.nothingToDo")}</p>
            )}

            {gruppen.REBASE_AVAILABLE.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Check className="h-4 w-4 text-folk-mint" />
                  {t("offer.lang.rebase.available")}
                  <Badge variant="secondary">{gruppen.REBASE_AVAILABLE.length}</Badge>
                </h3>
                {gruppen.REBASE_AVAILABLE.map((f) => <Zeile key={f.feld} befund={f} />)}
              </section>
            )}

            {gruppen.USER_EDITED_CONFLICT.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-folk-lemon" />
                  {t("offer.lang.rebase.conflict")}
                  <Badge variant="secondary">{gruppen.USER_EDITED_CONFLICT.length}</Badge>
                </h3>
                <p className="text-xs text-muted-foreground">{t("offer.lang.rebase.conflictHint")}</p>
                {gruppen.USER_EDITED_CONFLICT.map((f) => (
                  <Zeile
                    key={f.feld}
                    befund={f}
                    gewaehlt={zustimmung.has(f.feld)}
                    // Ohne Vorschlag gibt es nichts zu übernehmen — dann auch
                    // kein Kästchen, das eine Wahl vortäuscht.
                    onWechsel={f.vorschlag !== undefined ? (an) => wechsel(f.feld, an) : undefined}
                  />
                ))}
              </section>
            )}

            {gruppen.TRANSLATION_MISSING.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-folk-coral" />
                  {t("offer.lang.rebase.missing")}
                  <Badge variant="secondary">{gruppen.TRANSLATION_MISSING.length}</Badge>
                </h3>
                <p className="text-xs text-muted-foreground">{t("offer.lang.rebase.missingHint")}</p>
                {gruppen.TRANSLATION_MISSING.map((f) => <Zeile key={f.feld} befund={f} />)}
              </section>
            )}

            <p className="text-xs text-muted-foreground">
              {t("offer.lang.rebase.alreadyCorrect")}: {gruppen.ALREADY_CORRECT.length} ·{" "}
              {t("offer.lang.rebase.nonLocalized")}: {gruppen.NON_LOCALIZED.length}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onAbbrechen}>
            {t("offer.lang.rebase.cancel")}
          </Button>
          {!plan.eingefroren && (
            <Button onClick={anwenden}>{t("offer.lang.rebase.apply")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
