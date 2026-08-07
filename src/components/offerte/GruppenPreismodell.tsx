import { useEffect, useMemo, useState } from "react";
import { Lock, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/useI18n";
import {
  derivePriceModel,
  isFreeItem,
  priceTypeForRateUnit,
  priceTypeShape,
  type AmountBasis,
  type PriceModelName,
} from "@/lib/offerPricing";
import type { MessageKey } from "@/i18n/translator";

/** Eine Position der Servicegruppe, so wie beide Formulare sie kennen. */
export interface GruppenPosition {
  id: string;
  description: string;
  priceType: string;
  amountBasis: AmountBasis | null;
  quantity: number;
  unitPrice: number;
  unit: string;
  kostendachMax: number | null;
}

/** Was das Formular auf einer Position setzen soll. Enthält NUR die betroffenen Felder. */
export interface PositionsAenderung {
  id: string;
  priceType: string;
  unit: string;
  amountBasis: AmountBasis;
  quantity: number;
  unitPrice: number;
  kostendachMax: number | null;
}

/**
 * Die waehlbaren Ansatz-Einheiten.
 *
 * `rateUnitForService` liefert nur die VORBELEGUNG — welche Einheit fuer diesen Service die
 * naheliegende ist. Die anderen bleiben waehlbar: eine Firma kann eine Entsorgung sehr wohl
 * nach Stunden anbieten, und ihr das zu verbieten waere dieselbe Bevormundung wie die Frage
 * nach einem Stundensatz fuer eine m³-Leistung. Die Firma entscheidet, das Formular schlaegt
 * nur vor.
 */
const EINHEITEN: { wert: string; labelKey: MessageKey; feldKey: MessageKey }[] = [
  { wert: "Stunden", labelKey: "offer.form.groupPriceModel.unitHours", feldKey: "offer.form.groupPriceModel.rate" },
  { wert: "m³", labelKey: "offer.form.groupPriceModel.unitM3", feldKey: "offer.form.groupPriceModel.rateFieldM3" },
  { wert: "Monat", labelKey: "offer.form.groupPriceModel.unitMonth", feldKey: "offer.form.groupPriceModel.rateFieldMonth" },
];

const zahl = (wert: string): number => {
  const n = Number(wert.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Das Preismodell EINER Servicegruppe — und der einzige Ort, an dem es gesetzt wird.
 *
 * WARUM JE GRUPPE
 * 19 der 66 Offerten in der Produktion tragen mehr als eine Servicegruppe. „Umzug nach
 * Aufwand, Reinigung pauschal" ist der Normalfall; ein Modell für die ganze Offerte kann
 * dort nie stimmen. Das frühere Offerte-Kästchen konnte es nicht abbilden — und hat die
 * Positionen ohnehin nie erreicht: in allen drei Fällen, in denen es benutzt wurde, sagte
 * das Dokument „Stundenansatz" und gerechnet wurde eine feste Summe.
 *
 * WARUM OHNE DIALOG
 * Dieses Kästchen steht auf der Karte SEINER Servicegruppe, direkt über deren Positionen.
 * Was sich ändert, steht eine Zeile darunter und ist beim Klick zu sehen — ein Fenster,
 * das dieselbe Liste noch einmal zeigt, wäre ein Klick ohne Erkenntnis.
 *
 * Der Preis dafür: ein Fehlklick ist nicht von selbst umkehrbar (Pauschal 2'080 → Ansatz
 * 290 → zurück auf Pauschal ergäbe 290, nicht 2'080). Deshalb merkt sich die Komponente
 * den Zustand VOR der letzten Umstellung und bietet ihn als „Rückgängig" an — exakt die
 * alten Werte, nicht eine Näherung.
 */
export const GruppenPreismodell = ({
  gruppenLabel,
  rateUnit,
  positionen,
  metaAnsatz,
  gesperrt,
  onAnwenden,
}: {
  gruppenLabel: string;
  /** Ansatz-Einheit dieses Services: "Stunden" | "m³" | "Monat" (rateUnitForService). */
  rateUnit: string;
  positionen: GruppenPosition[];
  /** Stundensatz aus den Service-Details dieser Gruppe — Vorbelegung, keine Wahrheit. */
  metaAnsatz?: number | null;
  /** Gesetzt, wenn die Offerte den Betrieb bereits verlassen hat. */
  gesperrt?: "versendet" | "abgeschlossen";
  onAnwenden: (aenderungen: PositionsAenderung[]) => void;
}) => {
  const t = useT();

  // Berechnete Positionen — inkl/optional sind Leistungsumfang und kein Preismodell.
  const bezahlt = useMemo(() => positionen.filter((p) => !isFreeItem(p.priceType)), [positionen]);

  const aktuell = useMemo(
    () =>
      derivePriceModel(
        bezahlt.map((p) => ({
          priceType: p.priceType,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          timeEstimate: null,
          amountBasis: p.amountBasis,
          kostendachMax: p.kostendachMax,
        })),
      ),
    [bezahlt],
  );

  /** Die gewaehlte Ansatz-Einheit. Vorbelegt vom Service, danach Sache des Bedieners. */
  const [einheit, setEinheit] = useState(rateUnit);
  const [ansatz, setAnsatz] = useState("");
  const [deckel, setDeckel] = useState("");
  /** Der Zustand VOR der letzten Umstellung — die Grundlage von „Rückgängig". */
  const [rueckgaengig, setRueckgaengig] = useState<{
    anzahl: number;
    modell: PriceModelName;
    werte: PositionsAenderung[];
  } | null>(null);

  // Die Felder folgen dem, was tatsächlich in den Positionen steht — solange der Bediener
  // nicht selbst tippt. Sonst zeigte das Feld 290, während die Zeilen 260 tragen.
  useEffect(() => {
    setAnsatz(
      aktuell.hourlyRate !== null
        ? String(aktuell.hourlyRate)
        : metaAnsatz && metaAnsatz > 0
          ? String(metaAnsatz)
          : "",
    );
    setDeckel(aktuell.kostendachMax !== null ? String(aktuell.kostendachMax) : "");
    // Tragen die Positionen bereits einen Ansatz, gilt DEREN Einheit — nicht die
    // Vorbelegung des Services. Sonst zeigte das Feld "CHF/m³", waehrend der Beleg
    // "CHF/Stunden" druckt.
    const vorhandene = bezahlt.find((p) => p.amountBasis === "rate")?.unit;
    setEinheit(vorhandene && vorhandene.trim() !== "" ? vorhandene : rateUnit);
  }, [aktuell.hourlyRate, aktuell.kostendachMax, metaAnsatz, bezahlt, rateUnit]);

  const ansatzZahl = zahl(ansatz);
  const deckelZahl = zahl(deckel);

  /** Rechnet aus, wie die Gruppe unter `modell` aussieht. Rein — schreibt nichts. */
  const berechne = (
    modell: PriceModelName,
    satz: number,
    cap: number,
    mitEinheit: string = einheit,
  ): PositionsAenderung[] => {
    const zielPriceType =
      modell === "pauschal" ? "pauschale" : priceTypeForRateUnit(mitEinheit);
    const ersteId = bezahlt[0]?.id;
    return bezahlt.map((p) => {
      const shape = priceTypeShape(zielPriceType, {
        // Bei m³/Monat gibt der Service die Einheit vor, nicht die alte Zeile.
        unit: modell === "pauschal" ? p.unit : mitEinheit,
        quantity: p.quantity,
        kostendachMax: p.kostendachMax,
        // Beim Umstellen entscheidet das Modell, nicht eine alte Zeitschätzung:
        // ein Ansatz heisst offene Menge ('rate').
        hasValidTimeEstimate: false,
        alsAnsatz: modell !== "pauschal",
      });
      return {
        id: p.id,
        priceType: zielPriceType,
        unit: shape.unit,
        amountBasis: shape.amountBasis,
        quantity: shape.quantity,
        // Beim Ansatz ist der Einzelpreis der Stundensatz; pauschal behält seinen Betrag.
        unitPrice: modell === "pauschal" ? p.unitPrice : satz,
        // Das Kostendach gehört der GRUPPE und wird deshalb genau einmal abgelegt — auf der
        // ersten Position, dort liest der Beleg es (ServiceTable groupCap).
        kostendachMax: modell === "kostendach" && p.id === ersteId ? cap : null,
      };
    });
  };

  /** Der Zustand der Gruppe, so wie er JETZT ist — als umkehrbare Änderung. */
  const jetzigerZustand = (): PositionsAenderung[] =>
    bezahlt.map((p) => ({
      id: p.id,
      priceType: p.priceType,
      unit: p.unit,
      amountBasis: p.amountBasis ?? "fixed",
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      kostendachMax: p.kostendachMax,
    }));

  const anwenden = (modell: PriceModelName, satz = ansatzZahl, cap = deckelZahl) => {
    if (gesperrt || bezahlt.length === 0) return;
    setRueckgaengig({ anzahl: bezahlt.length, modell, werte: jetzigerZustand() });
    onAnwenden(berechne(modell, satz, cap));
  };

  // Ein Ansatz ohne Zahl kann nichts setzen. Statt still nichts zu tun, bleibt der Knopf
  // gesperrt und das Feld daneben sagt, was fehlt.
  const kannAnsatz = ansatzZahl > 0;
  const kannDeckel = kannAnsatz && deckelZahl > 0 && deckelZahl >= ansatzZahl;
  const erlaubt = (m: PriceModelName) =>
    !gesperrt && (m === "pauschal" || (m === "stundenansatz" ? kannAnsatz : kannDeckel));

  const einheitDef = EINHEITEN.find((e) => e.wert === einheit) ?? EINHEITEN[0];
  const modelle: { wert: PriceModelName; labelKey: MessageKey }[] = [
    { wert: "pauschal", labelKey: "offer.form.priceModel.pauschal" },
    { wert: "stundenansatz", labelKey: "offer.form.groupPriceModel.rateGeneric" },
    { wert: "kostendach", labelKey: "offer.form.groupPriceModel.capGeneric" },
  ];

  if (bezahlt.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Label className="text-xs sm:text-sm font-medium">
          {t("offer.form.groupPriceModel.title")}
        </Label>
        <span className="text-[11px] text-muted-foreground">{gruppenLabel}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {modelle.map((m) => (
          <button
            key={m.wert}
            type="button"
            disabled={!erlaubt(m.wert)}
            onClick={() => anwenden(m.wert)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
              aktuell.model === m.wert
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      {/* Ansatz und Kostendach stehen NEBEN den Knöpfen, nicht in einem Fenster.
          Eine Änderung hier zieht die Positionen sofort nach — dieselbe Top-down-Idee,
          die der Bediener vom alten Kästchen kennt. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("offer.form.groupPriceModel.unit")}
          </Label>
          <Select
            value={einheit}
            disabled={!!gesperrt}
            onValueChange={(v) => {
              setEinheit(v);
              // Eine andere Einheit ist eine andere Aussage — sie zieht die Positionen
              // sofort nach, genau wie ein geaenderter Ansatz.
              if (aktuell.model !== "pauschal" && ansatzZahl > 0) {
                setRueckgaengig({ anzahl: bezahlt.length, modell: aktuell.model, werte: jetzigerZustand() });
                onAnwenden(
                  berechne(aktuell.model, ansatzZahl, deckelZahl, v),
                );
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EINHEITEN.map((e) => (
                <SelectItem key={e.wert} value={e.wert}>{t(e.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`gpm-rate-${gruppenLabel}`} className="text-[11px] text-muted-foreground">
            {t(einheitDef.feldKey)}
          </Label>
          <Input
            id={`gpm-rate-${gruppenLabel}`}
            inputMode="decimal"
            value={ansatz}
            disabled={!!gesperrt}
            onChange={(e) => setAnsatz(e.target.value)}
            onBlur={() => {
              const neu = zahl(ansatz);
              if (neu > 0 && aktuell.model !== "pauschal" && neu !== aktuell.hourlyRate) {
                anwenden(aktuell.model, neu, deckelZahl);
              }
            }}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`gpm-cap-${gruppenLabel}`} className="text-[11px] text-muted-foreground">
            {t("offer.form.groupPriceModel.cap")}
          </Label>
          <Input
            id={`gpm-cap-${gruppenLabel}`}
            inputMode="decimal"
            value={deckel}
            disabled={!!gesperrt}
            onChange={(e) => setDeckel(e.target.value)}
            onBlur={() => {
              const neu = zahl(deckel);
              if (neu > 0 && aktuell.model === "kostendach" && neu !== aktuell.kostendachMax) {
                anwenden("kostendach", ansatzZahl, neu);
              }
            }}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {!gesperrt && !kannAnsatz && (
        <p className="text-[11px] text-muted-foreground">
          {t("offer.form.groupPriceModel.rateRequired")}
        </p>
      )}

      {/* Die Umkehr des letzten Klicks — mit den EXAKTEN alten Werten, nicht mit einer
          Näherung. Ohne sie wäre ein Fehlklick nur von Hand zu reparieren. */}
      {rueckgaengig && !gesperrt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <span className="text-[12px] text-amber-900">
            {t("offer.form.groupPriceModel.applied", {
              count: String(rueckgaengig.anzahl),
              model: t(
                modelle.find((m) => m.wert === rueckgaengig.modell)?.labelKey ??
                  "offer.form.priceModel.pauschal",
              ),
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 gap-1.5 text-[12px]"
            onClick={() => {
              onAnwenden(rueckgaengig.werte);
              setRueckgaengig(null);
            }}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t("offer.form.groupPriceModel.undo")}
          </Button>
        </div>
      )}

      {gesperrt && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {t(
            gesperrt === "versendet"
              ? "offer.form.groupPriceModel.locked.sent"
              : "offer.form.groupPriceModel.locked.closed",
          )}
        </p>
      )}
    </div>
  );
};
