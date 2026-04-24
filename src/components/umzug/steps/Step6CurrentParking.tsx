// Step6CurrentParking.tsx - Current property parking and access info

import { DistanceSlider } from "../ui/DistanceSlider";
import { PropertyDetails, StepsRange } from "@/types/umzug";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ParkingCircle, Footprints, AlertTriangle, Check } from "lucide-react";

interface Step6Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

const STEPS_OPTIONS: { value: StepsRange; label: string; level: number }[] = [
  { value: 'steps_0_10', label: '0-10 Stufen', level: 1 },
  { value: 'steps_11_30', label: '11-30 Stufen', level: 2 },
  { value: 'steps_31_50', label: '31-50 Stufen', level: 3 },
  { value: 'steps_51_plus', label: '51+ Stufen', level: 4 },
];

export const Step6CurrentParking = ({ data, onChange }: Step6Props) => {
  const updateParkplatz = (updates: Partial<PropertyDetails['parkplatz']>) => {
    onChange({ 
      parkplatz: { ...data.parkplatz, ...updates } 
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
          <ParkingCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Distanz zwischen Parkplatz und Gebäudeeingang
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Diese Information hilft bei der Planung des Transportweges
        </p>
      </div>

      {/* Distance Slider */}
      <div className="space-y-2">
        <DistanceSlider
          label="Distanz in Meter"
          value={data.parkplatz?.distanz_meter ?? 10}
          onChange={(value) => updateParkplatz({ distanz_meter: value })}
        />
      </div>

      {/* Steps Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Footprints className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">
            Stufen bis zum Gebäudeeingang
          </h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STEPS_OPTIONS.map((option) => {
            const isSelected = data.parkplatz?.stufen === option.value;
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateParkplatz({ stufen: option.value })}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-center",
                  "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary",
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center text-sm font-bold",
                  isSelected ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                )}>
                  {option.level}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-gray-700 dark:text-gray-300"
                )}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Path Obstruction */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.parkplatz?.weg_beeintraechtigt ?? false}
            onChange={(e) => updateParkplatz({ 
              weg_beeintraechtigt: e.target.checked,
              beeintraechtigung_details: e.target.checked ? data.parkplatz?.beeintraechtigung_details : ''
            })}
            className="w-5 h-5 mt-0.5 rounded border-gray-300"
          />
          <div>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              Der Weg ist anderweitig beeinträchtigt
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              (z.B. enger Weg, Treppen ohne Geländer, steile Auffahrt)
            </p>
          </div>
        </label>

        {data.parkplatz?.weg_beeintraechtigt && (
          <div className="ml-8 animate-in slide-in-from-top-4 duration-300">
            <Textarea
              value={data.parkplatz?.beeintraechtigung_details || ''}
              onChange={(e) => updateParkplatz({ beeintraechtigung_details: e.target.value })}
              placeholder="Bitte beschreiben Sie die Beeinträchtigung..."
              className="min-h-[100px]"
            />
          </div>
        )}
      </div>

      {/* Summary Info */}
      <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          {(data.parkplatz?.distanz_meter ?? 0) > 50 || 
           data.parkplatz?.stufen === 'steps_31_50' || 
           data.parkplatz?.stufen === 'steps_51_plus' ||
           data.parkplatz?.weg_beeintraechtigt ? (
            <>
              <AlertTriangle className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Hinweis:</strong> Der erschwerte Zugang kann zusätzliche Zeit 
                und Personal erfordern. Dies wird im Angebot berücksichtigt.
              </div>
            </>
          ) : (
            <>
              <Check className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Sehr gut!</strong> Der Zugang scheint unkompliziert zu sein. 
                Das ermöglicht einen effizienten Umzug.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


