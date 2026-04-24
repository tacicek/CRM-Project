import { Home, Building, Users, Warehouse, Briefcase, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectableCardCompact } from "../ui/SelectableCard";
import { UnterkunftArt, ROOM_COUNT_OPTIONS } from "@/types/reinigung";

interface Step1Props {
  serviceType: string;
  unterkunftArt: UnterkunftArt | "";
  zimmerAnzahl: string;
  wohnflaecheM2: number;
  onUnterkunftArtChange: (value: UnterkunftArt) => void;
  onZimmerAnzahlChange: (value: string) => void;
  onWohnflaecheChange: (value: number) => void;
  onEditService?: () => void;
  errors?: Record<string, string>;
}

const PROPERTY_TYPES = [
  { value: "haus" as UnterkunftArt, label: "Haus", icon: Home },
  { value: "wohnung" as UnterkunftArt, label: "Wohnung", icon: Building },
  { value: "wg_zimmer" as UnterkunftArt, label: "WG-Zimmer", icon: Users },
  { value: "lager" as UnterkunftArt, label: "Lager", icon: Warehouse },
  { value: "buero" as UnterkunftArt, label: "Büro", icon: Briefcase },
];

export function Step1ServiceUnterkunft({
  serviceType,
  unterkunftArt,
  zimmerAnzahl,
  wohnflaecheM2,
  onUnterkunftArtChange,
  onZimmerAnzahlChange,
  onWohnflaecheChange,
  onEditService,
  errors = {},
}: Step1Props) {
  const showRoomCount = unterkunftArt === "haus" || unterkunftArt === "wohnung";

  const getServiceLabel = (type: string) => {
    const labels: Record<string, string> = {
      uebergabereinigung: "Übergabereinigung",
      unterhaltsreinigung: "Unterhaltsreinigung",
      grundreinigung: "Grundreinigung",
      reinigung_end: "Endreinigung",
      reinigung_grund: "Grundreinigung",
    };
    return labels[type] || "Reinigung";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Erhalten Sie mit wenigen Klicks Angebote in weniger als 24 Stunden
        </h2>
        <p className="text-sm text-gray-500">
          Wählen Sie die Art Ihrer Unterkunft und geben Sie die Wohnfläche an.
        </p>
      </div>

      {/* Selected Service Badge */}
      <div className="flex justify-center">
        <Badge
          variant="secondary"
          className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary flex items-center gap-2"
        >
          <span>Ihr gewählter Service:</span>
          <span className="font-semibold">{getServiceLabel(serviceType)}</span>
          {onEditService && (
            <button
              type="button"
              onClick={onEditService}
              className="ml-1 hover:text-primary/80 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </Badge>
      </div>

      {/* Property Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Art der Unterkunft <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {PROPERTY_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <SelectableCardCompact
                key={type.value}
                selected={unterkunftArt === type.value}
                onSelect={() => onUnterkunftArtChange(type.value)}
                icon={<Icon className="w-6 h-6" />}
                title={type.label}
              />
            );
          })}
        </div>
        {errors.unterkunft_art && (
          <p className="text-sm text-destructive">{errors.unterkunft_art}</p>
        )}
      </div>

      {/* Room Count - Conditional */}
      {showRoomCount && (
        <div className="space-y-2">
          <Label htmlFor="zimmer_anzahl" className="text-sm font-medium">
            Zimmeranzahl <span className="text-destructive">*</span>
          </Label>
          <Select value={zimmerAnzahl} onValueChange={onZimmerAnzahlChange}>
            <SelectTrigger
              id="zimmer_anzahl"
              className={errors.zimmer_anzahl ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Anzahl Zimmer wählen" />
            </SelectTrigger>
            <SelectContent>
              {ROOM_COUNT_OPTIONS.map((room) => (
                <SelectItem key={room} value={room}>
                  {room} Zimmer
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.zimmer_anzahl && (
            <p className="text-sm text-destructive">{errors.zimmer_anzahl}</p>
          )}
        </div>
      )}

      {/* Living Space */}
      <div className="space-y-2">
        <Label htmlFor="wohnflaeche" className="text-sm font-medium">
          Wohnfläche <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="wohnflaeche"
            type="number"
            min={10}
            max={1000}
            placeholder="z.B. 85"
            value={wohnflaecheM2 || ""}
            onChange={(e) => onWohnflaecheChange(parseInt(e.target.value) || 0)}
            className={`pr-12 ${errors.wohnflaeche_m2 ? "border-destructive" : ""}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            m²
          </span>
        </div>
        {errors.wohnflaeche_m2 && (
          <p className="text-sm text-destructive">{errors.wohnflaeche_m2}</p>
        )}
        <p className="text-xs text-gray-500">
          Geben Sie die Gesamtfläche der zu reinigenden Wohnung/des Hauses an.
        </p>
      </div>
    </div>
  );
}

export default Step1ServiceUnterkunft;


