import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Highlighter, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SERVICE_OPTIONS } from "@/lib/offerServiceType";
import { itemAmountDisplay, type AmountBasis } from "@/lib/offerPricing";
import { useState, useEffect, useRef } from "react";

export interface ItemTimeEstimate {
  minHours: string;
  maxHours: string;
  hourlyRate: string;
}

export interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  priceType: "pauschale" | "per_unit" | "per_hour" | "inkl" | "optional";
  highlighted: boolean;
  details: string[];
  timeEstimate?: ItemTimeEstimate | null;
  serviceType?: string | null; // clean base (output of normalizeToCatalogBase), null = Allgemein
  amountBasis?: AmountBasis;    // fixed = Betrag in Summe | rate = nur Ansatz (nicht in Summe) | range = min–max
  kostendachMax?: number | null; // Item-/Service-level Kostendach (nur bei rate relevant)
}

// Price type options with their auto-derived units
// fixedUnit = true means the unit is always derived from the price type (Einheit hidden)
// fixedUnit = false means the user picks the unit themselves (Einheit shown)
const priceTypeOptions = [
  { value: "pauschale", label: "Pauschale",             defaultUnit: "Pauschal",  fixedUnit: true  },
  { value: "per_unit",  label: "Pro Einheit",           defaultUnit: "Stk.",      fixedUnit: false },
  { value: "per_hour",  label: "Pro Stunde",            defaultUnit: "Stunden",   fixedUnit: true  },
  { value: "inkl",      label: "Inklusive (kein Preis)",defaultUnit: "",          fixedUnit: true  },
  { value: "optional",  label: "Optional",              defaultUnit: "Stk.",      fixedUnit: false },
] as const;

// Unit options shown only when priceType has fixedUnit = false (Pro Einheit / Optional)
const unitOptions = [
  { value: "Stk.",    label: "Stück (Stk.)" },
  { value: "m²",     label: "Quadratmeter (m²)" },
  { value: "m³",     label: "Kubikmeter (m³)" },
  { value: "lfm",    label: "Laufmeter (lfm)" },
  { value: "kg",     label: "Kilogramm (kg)" },
  { value: "Tag",    label: "Tag" },
  { value: "Fahrt",  label: "Fahrt" },
  { value: "Person", label: "Person" },
];

interface OfferteItemRowProps {
  item: OfferItem;
  index: number;
  onUpdate: (index: number, field: keyof OfferItem, value: unknown) => void;
  onRemove: (index: number) => void;
  onAddDetail: (index: number) => void;
  onUpdateDetail: (itemIndex: number, detailIndex: number, value: string) => void;
  onRemoveDetail: (itemIndex: number, detailIndex: number) => void;
  canRemove: boolean;
  formatCurrency: (amount: number) => string;
  offerteType?: 'normal' | 'blind';
}

export const OfferteItemRow = ({
  item,
  index,
  onUpdate,
  onRemove,
  onAddDetail,
  onUpdateDetail,
  onRemoveDetail,
  canRemove,
  formatCurrency,
  offerteType,
}: OfferteItemRowProps) => {
  const te = item.timeEstimate;
  // Zeitschätzungs-Range nur anzeigen, wenn Min/Max/Ansatz gültige positive Zahlen sind
  // (sonst wäre die „min – max"-Zeile 0.00 oder NaN). Spiegelt hourlyRange-Semantik.
  const teValid = !!(
    te &&
    parseFloat(te.minHours) > 0 &&
    parseFloat(te.maxHours) > 0 &&
    parseFloat(te.hourlyRate) > 0
  );
  // SINGLE SOURCE fuer die Total-Anzeige (fixed | rate | range) — kein eigenes 0.00-Rechnen mehr.
  const amountDisplay = itemAmountDisplay({
    priceType: item.priceType,
    amountBasis: item.amountBasis ?? null,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    unit: item.unit,
    timeEstimate:
      te && te.minHours && te.maxHours && te.hourlyRate
        ? { minHours: Number(te.minHours), maxHours: Number(te.maxHours), hourlyRate: Number(te.hourlyRate) }
        : null,
  });
  const [isExpanded, setIsExpanded] = useState(true);

  // Local string states so decimals like "1." don't get swallowed by parseFloat
  const [quantityStr, setQuantityStr] = useState(String(item.quantity));
  const [priceStr, setPriceStr] = useState(String(item.unit_price));

  // Keep local strings in sync if parent state changes externally (e.g. AI fill)
  const prevQuantity = useRef(item.quantity);
  const prevPrice   = useRef(item.unit_price);
  useEffect(() => {
    if (item.quantity !== prevQuantity.current) {
      setQuantityStr(String(item.quantity));
      prevQuantity.current = item.quantity;
    }
  }, [item.quantity]);
  useEffect(() => {
    if (item.unit_price !== prevPrice.current) {
      setPriceStr(String(item.unit_price));
      prevPrice.current = item.unit_price;
    }
  }, [item.unit_price]);

  const currentPriceType = priceTypeOptions.find(o => o.value === item.priceType);
  const unitIsFixed = currentPriceType?.fixedUnit ?? true;

  // Kostendach-Eingabe: Std oder CHF. Gespeichert wird IMMER CHF (= Std × Ansatz/unit_price),
  // kein Schema-Change. Std wird beim Anzeigen aus CHF/Ansatz zurueckgerechnet.
  const kdInit = (() => {
    const c = item.kostendachMax;
    if (c === null || c === undefined) return "";
    return item.unit_price > 0 ? String(+(c / item.unit_price).toFixed(2)) : String(c);
  })();
  const [kdUnit, setKdUnit] = useState<"std" | "chf">("std");
  const [kdStr, setKdStr] = useState<string>(kdInit);
  const commitKostendach = (str: string, unit: "std" | "chf") => {
    const v = parseFloat(str.replace(",", "."));
    if (str.trim() === "" || !isFinite(v) || v < 0) { onUpdate(index, "kostendachMax", null); return; }
    const chf = unit === "std" ? (item.unit_price > 0 ? v * item.unit_price : 0) : v;
    onUpdate(index, "kostendachMax", Math.round(chf * 100) / 100);
  };
  const switchKdUnit = (u: "std" | "chf") => {
    if (u === kdUnit) return;
    const c = item.kostendachMax;
    setKdUnit(u);
    if (c === null || c === undefined) return;
    setKdStr(u === "std" && item.unit_price > 0 ? String(+(c / item.unit_price).toFixed(2)) : String(c));
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "p-2.5 sm:p-4 rounded-lg border transition-all",
            item.highlighted
              ? "bg-yellow-50 border-yellow-300"
              : "bg-muted/30 border-border",
            snapshot.isDragging && "shadow-lg ring-2 ring-secondary"
          )}
        >
          {/* Mobile Header - Collapsible */}
          <div className="flex gap-2 sm:gap-3 items-start">
            {/* Drag Handle */}
            <div
              {...provided.dragHandleProps}
              className="mt-1.5 sm:mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            >
              <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            {/* Position Number */}
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-secondary/10 flex items-center justify-center text-xs sm:text-sm font-medium shrink-0">
              {item.position}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-4 overflow-hidden">
              {/* Description Row - Always visible */}
              <div className="space-y-2.5 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Beschreibung</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => onUpdate(index, "description", e.target.value)}
                    placeholder="z.B. Umzugstarif - 1 Möbelwagen"
                    className="font-medium text-sm h-9 sm:h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Preisart</Label>
                  <Select
                    value={item.priceType}
                    onValueChange={(value) => {
                      const option = priceTypeOptions.find(o => o.value === value);
                      onUpdate(index, "priceType", value);
                      // Always sync unit to the canonical default for this price type
                      if (option) {
                        onUpdate(index, "unit", option.defaultUnit);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Service (Gruppierung)</Label>
                  <Select
                    value={item.serviceType ?? "allgemein"}
                    onValueChange={(v) => onUpdate(index, "serviceType", v === "allgemein" ? null : v)}
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {item.priceType !== "inkl" && item.priceType !== "optional" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] sm:text-xs text-muted-foreground">Preisbasis</Label>
                    <Select
                      value={item.amountBasis ?? "fixed"}
                      onValueChange={(v) => onUpdate(index, "amountBasis", v as AmountBasis)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fester Betrag</SelectItem>
                        <SelectItem value="rate">Ansatz (nach Aufwand)</SelectItem>
                        <SelectItem value="range">Spanne (min–max)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Expand/Collapse Toggle - Mobile Only */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full justify-center py-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Weniger anzeigen
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Mehr anzeigen
                  </>
                )}
              </button>

              {/* Expandable Content */}
              <div className={cn("space-y-2.5 sm:space-y-4", !isExpanded && "hidden sm:block")}>
                {/* Details (Sub-items) */}
                <div className="space-y-2">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Details (optional)</Label>
                  {item.details.map((detail, detailIndex) => (
                    <div key={detailIndex} className="flex gap-1.5 sm:gap-2">
                      <Input
                        value={detail}
                        onChange={(e) => onUpdateDetail(index, detailIndex, e.target.value)}
                        placeholder="z.B. inkl. Möbel einwickeln"
                        className="flex-1 text-xs sm:text-sm h-8 sm:h-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveDetail(index, detailIndex)}
                        className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddDetail(index)}
                    className="text-[10px] sm:text-xs h-7 sm:h-8"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Detail hinzufügen
                  </Button>
                </div>

                {/* Price Row (only if not "inkl") */}
                {item.priceType !== "inkl" && (
                  <div className={cn(
                    "grid gap-2 sm:gap-4",
                    unitIsFixed
                      ? "grid-cols-2 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4"
                  )}>
                    {/* Menge — hidden for Pauschale (always 1) */}
                    {item.priceType !== "pauschale" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Menge</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={quantityStr}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setQuantityStr(raw);
                          }}
                          onBlur={() => {
                            const parsed = parseFloat(quantityStr);
                            const valid  = isFinite(parsed) && parsed >= 0 ? parsed : item.quantity;
                            setQuantityStr(String(valid));
                            onUpdate(index, "quantity", valid);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="h-8 sm:h-10 text-sm"
                        />
                      </div>
                    )}

                    {/* Einheit — shown only when user needs to choose (Pro Einheit / Optional) */}
                    {!unitIsFixed && (
                      <div className="space-y-1">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Einheit</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => onUpdate(index, "unit", value)}
                        >
                          <SelectTrigger className="h-8 sm:h-10 text-sm">
                            <SelectValue placeholder="Einheit wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[10px] sm:text-xs text-muted-foreground">Einzelpreis</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={priceStr}
                        onChange={(e) => {
                          setPriceStr(e.target.value);
                        }}
                        onBlur={() => {
                          const parsed = parseFloat(priceStr);
                          const valid  = isFinite(parsed) && parsed >= 0 ? parsed : item.unit_price;
                          setPriceStr(String(valid));
                          onUpdate(index, "unit_price", valid);
                        }}
                        onFocus={(e) => e.target.select()}
                        className="h-8 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] sm:text-xs text-muted-foreground">Total</Label>
                      {amountDisplay.kind === "range" ? (
                        <p className="font-bold text-sm sm:text-base h-8 sm:h-10 flex items-center text-amber-700">
                          {formatCurrency(amountDisplay.min)} – {formatCurrency(amountDisplay.max)}
                        </p>
                      ) : amountDisplay.kind === "rate" ? (
                        <p className="font-bold text-sm sm:text-base h-8 sm:h-10 flex items-center">
                          {formatCurrency(amountDisplay.unitPrice)} / {amountDisplay.unit}
                        </p>
                      ) : (
                        <p className="font-bold text-sm sm:text-lg h-8 sm:h-10 flex items-center">
                          {formatCurrency(amountDisplay.kind === "fixed" ? amountDisplay.amount : item.quantity * item.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Item-/Service-level Kostendach — nur bei Preisbasis 'Ansatz' (rate). Std ODER CHF. */}
                {item.priceType !== "inkl" && item.amountBasis === "rate" && (
                  <div className="space-y-1 max-w-[340px]">
                    <Label className="text-[10px] sm:text-xs text-muted-foreground">Kostendach (optional)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={kdStr}
                        onChange={(e) => setKdStr(e.target.value)}
                        onBlur={(e) => commitKostendach(e.target.value, kdUnit)}
                        onFocus={(e) => e.target.select()}
                        placeholder={kdUnit === "std" ? "z.B. 9" : "z.B. 3105"}
                        className="h-8 sm:h-10 text-sm flex-1"
                      />
                      <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
                        {(["std", "chf"] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => switchKdUnit(u)}
                            className={cn(
                              "px-2.5 py-1.5",
                              kdUnit === u ? "bg-secondary text-secondary-foreground" : "bg-background text-muted-foreground",
                            )}
                          >
                            {u === "std" ? "Std" : "CHF"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(item.kostendachMax ?? null) !== null && (
                      <p className="text-[10px] text-muted-foreground">
                        {`= ${formatCurrency(Number(item.kostendachMax))}`}
                        {item.unit_price > 0 ? ` (${+(Number(item.kostendachMax) / item.unit_price).toFixed(2)} Std × ${formatCurrency(item.unit_price)})` : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Blind Offerte — per-item Zeitschätzung */}
                {offerteType === 'blind' && (
                  <div className="mt-2 border-t border-amber-100 pt-2">
                    {item.timeEstimate ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-amber-700">⏱ Zeitschätzung</span>
                          <button
                            type="button"
                            onClick={() => onUpdate(index, 'timeEstimate', null)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Entfernen
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Min. Std.</Label>
                            <input
                              type="number" min={1} step={1} placeholder="7"
                              value={item.timeEstimate.minHours}
                              onChange={(e) => onUpdate(index, 'timeEstimate', { ...item.timeEstimate!, minHours: e.target.value })}
                              className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Max. Std.</Label>
                            <input
                              type="number" min={1} step={1} placeholder="9"
                              value={item.timeEstimate.maxHours}
                              onChange={(e) => onUpdate(index, 'timeEstimate', { ...item.timeEstimate!, maxHours: e.target.value })}
                              className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">CHF / Std.</Label>
                            <input
                              type="number" min={0} step={0.05} placeholder="95"
                              value={item.timeEstimate.hourlyRate}
                              onChange={(e) => onUpdate(index, 'timeEstimate', { ...item.timeEstimate!, hourlyRate: e.target.value })}
                              className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                            />
                          </div>
                        </div>
                        {teValid && (
                          <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800">
                            {formatCurrency(parseFloat(te!.minHours) * parseFloat(te!.hourlyRate))} – {formatCurrency(parseFloat(te!.maxHours) * parseFloat(te!.hourlyRate))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdate(index, 'timeEstimate', { minHours: '', maxHours: '', hourlyRate: '' })}
                        className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                      >
                        <span>+</span> Zeitschätzung hinzufügen
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom Controls */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">

                  {/* Right side: Highlight + Remove */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdate(index, "highlighted", !item.highlighted)}
                      title="Hervorheben"
                      className={cn(
                        "h-6 w-6 rounded flex items-center justify-center transition-colors",
                        item.highlighted
                          ? "text-amber-500 bg-amber-100 hover:bg-amber-200"
                          : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Highlighter className="w-3 h-3" />
                    </button>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 sm:h-8 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                        Entfernen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};