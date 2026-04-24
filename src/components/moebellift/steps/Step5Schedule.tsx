import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MoebelliftAnfrage, TimeSlot, Duration, Flexibility, estimateDuration } from "@/types/moebellift";
import { format, addDays } from "date-fns";
import { AlertTriangle, Lightbulb } from "lucide-react";

interface Step5Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const timeSlots: { value: TimeSlot; label: string; description: string }[] = [
  { value: 'early', label: 'Früh', description: '07:00-09:00' },
  { value: 'morning', label: 'Vormittags', description: '09:00-12:00' },
  { value: 'afternoon', label: 'Nachmittags', description: '13:00-17:00' },
  { value: 'flexible', label: 'Flexibel', description: 'Egal' },
];

const durations: { value: Duration; label: string; description: string; priceHint: string }[] = [
  { value: 'short', label: 'Kurz', description: '1-2 Stunden', priceHint: 'Minimum' },
  { value: 'half_day', label: 'Halbtags', description: '3-4 Stunden', priceHint: 'Halbtags-Tarif' },
  { value: 'full_day', label: 'Ganztags', description: '5-8 Stunden', priceHint: 'Ganztags-Tarif' },
  { value: 'multi_day', label: 'Mehrtägig', description: 'Mehrere Tage', priceHint: 'Tages-Tarif' },
];

const flexibilities: { value: Flexibility; label: string }[] = [
  { value: 'fixed', label: 'Festes Datum' },
  { value: 'flex_2_days', label: '± 1-2 Tage flexibel' },
  { value: 'flex_1_week', label: '± 1 Woche flexibel' },
  { value: 'fully_flexible', label: 'Komplett flexibel' },
];

export function Step5Schedule({ data, updateData }: Step5Props) {
  const updateTermin = (updates: Partial<typeof data.termin>) => {
    updateData({ termin: { ...data.termin, ...updates } });
  };

  // Calculate minimum date (2 days for normal, 7 days if Halteverbot is needed)
  const minDays = data.gegebenheiten.parkplatz === 'no_parking_zone' ? 7 : 2;
  const minDate = addDays(new Date(), minDays);
  const minDateStr = format(minDate, 'yyyy-MM-dd');

  // Get recommended duration
  const recommendedDuration = estimateDuration(data);

  // Duration labels for recommendation
  const durationLabelMap: Record<Duration, string> = {
    short: 'Kurz (1-2 Stunden)',
    half_day: 'Halbtags (3-4 Stunden)',
    full_day: 'Ganztags (5-8 Stunden)',
    multi_day: 'Mehrtägig'
  };

  return (
    <div className="space-y-8">
      {/* Preferred Date */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Wunschdatum
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wann soll der Möbellift eingesetzt werden?
          </p>
        </div>
        
        <div>
          <Input
            type="date"
            value={data.termin.wunschdatum}
            onChange={(e) => updateTermin({ wunschdatum: e.target.value })}
            min={minDateStr}
            className="max-w-xs"
          />
          
          {data.gegebenheiten.parkplatz === 'no_parking_zone' && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Bei Halteverbot benötigen wir mindestens 7 Tage Vorlauf.
            </p>
          )}
        </div>
      </div>
      
      {/* Preferred Time */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Wunschzeit
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Zu welcher Tageszeit bevorzugen Sie den Einsatz?
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {timeSlots.map((slot) => (
            <button
              key={slot.value}
              type="button"
              onClick={() => updateTermin({ wunschzeit: slot.value })}
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-center",
                "hover:border-orange-300",
                data.termin.wunschzeit === slot.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <p className={cn(
                "font-medium",
                data.termin.wunschzeit === slot.value ? "text-orange-700" : "text-gray-700"
              )}>
                {slot.label}
              </p>
              <p className="text-xs text-gray-400">{slot.description}</p>
            </button>
          ))}
        </div>
        
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Lightbulb className="w-3 h-3" />
          Frühe Termine sind in Wohngebieten oft günstiger (weniger Parkprobleme)
        </p>
      </div>
      
      {/* Duration */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Geschätzte Dauer
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wie lange wird der Möbellift voraussichtlich benötigt?
          </p>
        </div>
        
        {/* Recommendation */}
        {data.zweck === 'umzug' && data.transport.umzug && (
          <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Lightbulb className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Empfohlene Dauer basierend auf Ihren Angaben:
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {data.transport.umzug.wohnungsgroesse.replace('_room', '-Zimmer').replace('_plus', '+')} Wohnung, {data.einsatzort.stockwerk.replace('floor_', '').replace('_plus', '+')}. Stock
              </p>
              <p className="text-sm font-semibold text-blue-700 mt-1">
                → {durationLabelMap[recommendedDuration]}
              </p>
              <p className="text-xs text-blue-500 mt-2">
                ℹ️ Tipp: Planen Sie etwas Puffer ein!
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {durations.map((dur) => (
            <button
              key={dur.value}
              type="button"
              onClick={() => updateTermin({ dauer: dur.value })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                "hover:border-orange-300",
                data.termin.dauer === dur.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white",
                dur.value === recommendedDuration && data.termin.dauer !== dur.value
                  ? "ring-2 ring-blue-200"
                  : ""
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                data.termin.dauer === dur.value
                  ? "border-orange-500 bg-orange-500"
                  : "border-gray-300"
              )}>
                {data.termin.dauer === dur.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "font-medium",
                    data.termin.dauer === dur.value ? "text-orange-700" : "text-gray-800"
                  )}>
                    {dur.label}
                  </p>
                  {dur.value === recommendedDuration && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      empfohlen
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{dur.description}</p>
              </div>
              <span className="text-xs text-gray-400">{dur.priceHint}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Flexibility */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Flexibilität
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wie flexibel sind Sie beim Datum?
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {flexibilities.map((flex) => (
            <button
              key={flex.value}
              type="button"
              onClick={() => updateTermin({ flexibilitaet: flex.value })}
              className={cn(
                "p-3 rounded-lg border-2 transition-all text-center",
                "hover:border-orange-300",
                data.termin.flexibilitaet === flex.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <span className={cn(
                "text-sm font-medium",
                data.termin.flexibilitaet === flex.value ? "text-orange-700" : "text-gray-700"
              )}>
                {flex.label}
              </span>
            </button>
          ))}
        </div>
        
        {data.termin.flexibilitaet !== 'fixed' && (
          <p className="text-xs text-green-600">
            ✓ Flexible Termine ermöglichen oft bessere Preise
          </p>
        )}
      </div>
    </div>
  );
}


