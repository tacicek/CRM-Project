/**
 * Shared AddrCard component — MUST be defined outside parent components
 * to prevent focus loss on re-render.
 *
 * Features:
 * - Smart autofill: splits "Musterstrasse 12a" into street + nr automatically
 * - PLZ autocomplete with dropdown
 * - Correct autoComplete attributes
 */
import { cn } from "@/lib/utils";
import { splitStreetNr } from "@/lib/splitStreetNr";

export interface PlzEntry { p: string; o: string; k: string; }

const INPUT_CLS = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300";

export interface AddrCardProps {
  label: string;
  icon?: string;
  strVal: string;
  nrVal: string;
  plzVal: string;
  ortVal: string;
  onStr: (v: string) => void;
  onNr: (v: string) => void;
  onPlzChange: (v: string) => void;
  onOrt?: (v: string) => void;
  acOpenVal: boolean;
  acListVal: PlzEntry[];
  onPickPlz: (e: PlzEntry) => void;
  filled?: boolean;
  className?: string;
}

export function AddrCard({
  label, icon, strVal, nrVal, plzVal, ortVal,
  onStr, onNr, onPlzChange, onOrt, acOpenVal, acListVal, onPickPlz,
  filled, className,
}: AddrCardProps) {

  const handleStrChange = (raw: string) => {
    const split = splitStreetNr(raw);
    if (split) {
      if (!nrVal.trim()) {
        onStr(split.street);
        onNr(split.nr);
        return;
      }
      if (Math.abs(raw.trim().length - strVal.length) >= 3) {
        onStr(split.street);
        onNr(split.nr);
        return;
      }
    }
    onStr(raw);
  };

  const handleNrChange = (raw: string) => {
    const split = splitStreetNr(raw);
    if (split && !strVal.trim()) {
      onStr(split.street);
      onNr(split.nr);
      return;
    }
    onNr(raw);
  };

  return (
    <div className={cn("bg-white border-[1.5px] rounded-xl transition-all", filled ? "border-green-400" : "border-gray-200", className)}>
      {(icon || label) && (
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-3 border-b border-gray-100 bg-gray-50/70 rounded-t-xl">
          {icon && <span>{icon}</span>}
          <span className="text-[13px] font-semibold text-gray-700">{label}</span>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Strasse & Nr.</label>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <input
              type="text"
              value={strVal}
              placeholder="Musterstrasse"
              onChange={e => handleStrChange(e.target.value)}
              onInput={e => handleStrChange((e.target as HTMLInputElement).value)}
              className={INPUT_CLS}
              autoComplete="address-line1"
            />
            <input
              type="text"
              value={nrVal}
              placeholder="5a"
              onChange={e => handleNrChange(e.target.value)}
              onInput={e => handleNrChange((e.target as HTMLInputElement).value)}
              className={INPUT_CLS}
              autoComplete="address-line2"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">PLZ / Ort</label>
          <div className="relative">
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🇨🇭</span>
                <input
                  type="text"
                  value={plzVal}
                  placeholder="8001"
                  maxLength={4}
                  onChange={e => onPlzChange(e.target.value)}
                  className={cn(INPUT_CLS, "pl-7")}
                  autoComplete="postal-code"
                />
              </div>
              <input
                type="text"
                value={ortVal}
                placeholder="Zürich"
                onChange={e => onOrt?.(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            {acOpenVal && acListVal.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 bg-white border-[1.5px] border-blue-200 rounded-xl shadow-xl z-[500] max-h-48 overflow-y-auto"
                onMouseDown={e => e.preventDefault()}
              >
                {acListVal.map(e => (
                  <div
                    key={e.p}
                    onMouseDown={() => onPickPlz(e)}
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0 text-sm"
                  >
                    <span className="font-mono text-[11px] text-gray-400 w-9 flex-shrink-0">{e.p}</span>
                    <span className="font-medium text-gray-800">{e.o}</span>
                    <span className="ml-auto text-[11px] text-gray-400">{e.k}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
