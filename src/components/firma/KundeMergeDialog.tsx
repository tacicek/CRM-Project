import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/useI18n";
import type { Kunde } from "@/hooks/useKunden";

type Vorschau = {
  moves: Record<string, number>;
  fills: Record<string, string> | null;
  conflicts: Record<string, { ziel: string; quelle: string }> | null;
};

type Props = {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  /** Der Kunde, dessen Karte gerade offen ist — zunaechst das Ziel. */
  aktuell: Kunde;
  /** Der Kandidat aus dem Hinweisband. */
  kandidat: { id: string; display_name: string };
  darfZusammenfuehren: boolean;
  vorschauLaden: (quelleId: string, zielId: string) => Promise<unknown>;
  ausfuehren: (quelleId: string, zielId: string, grund: string | null) => Promise<unknown>;
  onFertig: (zielId: string) => void;
};

/**
 * Zusammenfuehren ist nicht ruecknehmbar und gefaehrlicher als Loeschen: es
 * werden keine Daten entfernt, sondern zwei Menschen zu einem gemacht. Deshalb
 * liegt die Schwelle hoeher als beim Loeschdialog im Datenarchiv (dort genuegt
 * ein Haken):
 *
 *   1. Die Richtung ist sichtbar UND mit einem Klick umkehrbar — das eigentliche
 *      Risiko ist, den falschen Ueberlebenden zu waehlen.
 *   2. Was umgehaengt wird und was dabei verloren geht, steht als Zahl da
 *      (customer_merge_preview), nicht als Vermutung.
 *   3. Bestaetigt wird durch ABTIPPEN des Quellnamens. Ein Haken wird reflexhaft
 *      gesetzt; einen Namen zu tippen zwingt zum Lesen.
 *
 * Die Rollenpruefung hier ist nur ein lesbarer Satz — die eigentliche Sperre
 * sitzt in merge_customers() und gilt auch fuer direkte API-Aufrufe.
 */
export const KundeMergeDialog = ({
  offen,
  onOpenChange,
  aktuell,
  kandidat,
  darfZusammenfuehren,
  vorschauLaden,
  ausfuehren,
  onFertig,
}: Props) => {
  const t = useT();
  // false: aktueller Kunde ist das Ziel. true: die Richtung ist getauscht.
  const [getauscht, setGetauscht] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [bestaetigung, setBestaetigung] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const ziel = getauscht ? kandidat : aktuell;
  const quelle = getauscht ? aktuell : kandidat;

  useEffect(() => {
    if (!offen) return;
    setBestaetigung("");
    setVorschau(null);
    let abgebrochen = false;
    vorschauLaden(quelle.id, ziel.id).then((d) => {
      if (!abgebrochen) setVorschau((d as Vorschau) ?? null);
    });
    return () => {
      abgebrochen = true;
    };
  }, [offen, getauscht, quelle.id, ziel.id, vorschauLaden]);

  const darfAbsenden =
    darfZusammenfuehren &&
    !laeuft &&
    bestaetigung.trim() === quelle.display_name.trim();

  const absenden = async () => {
    setLaeuft(true);
    const ergebnis = await ausfuehren(quelle.id, ziel.id, null);
    setLaeuft(false);
    if (ergebnis) {
      onOpenChange(false);
      onFertig(ziel.id);
    }
  };

  const bewegungen = Object.entries(vorschau?.moves ?? {}).filter(([, n]) => n > 0);
  const uebernahmen = Object.entries(vorschau?.fills ?? {});
  const verluste = Object.entries(vorschau?.conflicts ?? {});

  return (
    <Dialog open={offen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("kunde.merge.title")}</DialogTitle>
          <DialogDescription className="text-folk-coral">
            {t("kunde.merge.irreversible")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-lg border border-folk-mint bg-folk-mint-bg p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-folk-ink3">
                {t("kunde.merge.target")}
              </div>
              <div className="mt-0.5 truncate font-semibold text-folk-ink">{ziel.display_name}</div>
            </div>
            <button
              type="button"
              onClick={() => setGetauscht((v) => !v)}
              title={t("kunde.merge.swap")}
              aria-label={t("kunde.merge.swap")}
              className="grid w-10 shrink-0 place-items-center rounded-lg border border-folk-line bg-folk-card text-folk-ink3 transition-colors hover:bg-folk-bg-warm"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div className="flex-1 rounded-lg border border-folk-line bg-folk-bg-warm p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-folk-ink3">
                {t("kunde.merge.source")}
              </div>
              <div className="mt-0.5 truncate font-semibold text-folk-ink">
                {quelle.display_name}
              </div>
            </div>
          </div>

          {vorschau === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-folk-ink4" />
            </div>
          ) : (
            <dl className="space-y-2 text-[14px]">
              <div>
                <dt className="text-folk-ink3">{t("kunde.merge.moves")}</dt>
                <dd className="text-folk-ink">
                  {bewegungen.length === 0
                    ? t("kunde.merge.nothing")
                    : bewegungen.map(([k, n]) => `${n} ${k}`).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-folk-ink3">{t("kunde.merge.fills")}</dt>
                <dd className="text-folk-ink">
                  {uebernahmen.length === 0
                    ? t("kunde.merge.nothing")
                    : uebernahmen.map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </dd>
              </div>
              {verluste.length > 0 && (
                <div>
                  <dt className="text-folk-coral">{t("kunde.merge.conflicts")}</dt>
                  <dd className="text-folk-ink2">
                    {verluste
                      .map(([k, v]) => `${k}: „${v.quelle}" → „${v.ziel}"`)
                      .join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="merge-bestaetigung" className="text-[13px] text-folk-ink2">
              {t("kunde.merge.confirmLabel")}
            </Label>
            <Input
              id="merge-bestaetigung"
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)}
              placeholder={quelle.display_name}
              autoComplete="off"
            />
          </div>

          {!darfZusammenfuehren && (
            <p className="text-[13px] text-folk-coral">{t("kunde.merge.forbidden")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={laeuft}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={absenden}
            disabled={!darfAbsenden}
            className="bg-folk-coral text-white hover:bg-folk-coral/90"
          >
            {laeuft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("kunde.merge.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
