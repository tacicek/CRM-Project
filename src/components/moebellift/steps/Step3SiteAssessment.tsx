import { Label } from "@/components/ui/label";
import { SpaceAssessment } from "../ui/SpaceAssessment";
import { cn } from "@/lib/utils";
import { MoebelliftAnfrage, ParkingSituation, PowerAvailability } from "@/types/moebellift";

interface Step3Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const obstacles = [
  { key: 'baeume', label: 'Bäume / Äste im Weg', icon: '🌳' },
  { key: 'stromleitungen', label: 'Stromleitungen', icon: '⚡' },
  { key: 'vordach', label: 'Vordach / Markise', icon: '🏠' },
  { key: 'parkierte_fahrzeuge', label: 'Parkierte Fahrzeuge', icon: '🚗' },
  { key: 'baustelle', label: 'Baustelle in der Nähe', icon: '🚧' },
  { key: 'enge_zufahrt', label: 'Enge Zufahrt', icon: '↔️' },
  { key: 'hang', label: 'Steile Strasse / Hang', icon: '⛰️' },
  { key: 'keine', label: 'Keine Hindernisse', icon: '✅' },
] as const;

const parkingOptions: { value: ParkingSituation; label: string; description: string }[] = [
  { value: 'parking_available', label: 'Parkplatz vorhanden', description: 'Ideal für den Lifteinsatz' },
  { value: 'no_parking_zone', label: 'Halteverbot nötig', description: 'Kann beantragt werden' },
  { value: 'street_side', label: 'Strassenrand möglich', description: 'Regelungen prüfen' },
  { value: 'unsure', label: 'Unsicher', description: 'Beratung gewünscht' },
];

const powerOptions: { value: PowerAvailability; label: string; description: string }[] = [
  { value: 'power_available', label: '230V Steckdose vorhanden', description: 'In max. 20m Entfernung' },
  { value: 'no_power', label: 'Keine Steckdose in Reichweite', description: 'Generator benötigt' },
  { value: 'unsure', label: 'Unsicher', description: 'Wir klären dies ab' },
];

export function Step3SiteAssessment({ data, updateData }: Step3Props) {
  const updateGegebenheiten = (updates: Partial<typeof data.gegebenheiten>) => {
    updateData({
      gegebenheiten: { ...data.gegebenheiten, ...updates }
    });
  };

  const toggleObstacle = (key: keyof typeof data.gegebenheiten.hindernisse) => {
    const newHindernisse = { ...data.gegebenheiten.hindernisse };
    
    if (key === 'keine') {
      // If selecting "keine", reset all others
      Object.keys(newHindernisse).forEach((k) => {
        newHindernisse[k as keyof typeof newHindernisse] = k === 'keine';
      });
    } else {
      // Toggle the selected obstacle
      newHindernisse[key] = !newHindernisse[key];
      // Uncheck "keine" if any obstacle is selected
      if (newHindernisse[key]) {
        newHindernisse.keine = false;
      }
      // If all obstacles are unchecked, check "keine"
      const anySelected = Object.entries(newHindernisse)
        .filter(([k]) => k !== 'keine')
        .some(([, v]) => v);
      if (!anySelected) {
        newHindernisse.keine = true;
      }
    }
    
    updateGegebenheiten({ hindernisse: newHindernisse });
  };

  return (
    <div className="space-y-8">
      {/* Space Assessment */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Stellfläche vor dem Gebäude
          </Label>
        </div>
        
        <SpaceAssessment
          value={data.gegebenheiten.stellflaeche}
          onChange={(space) => updateGegebenheiten({ stellflaeche: space })}
        />
      </div>
      
      {/* Obstacles */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Hindernisse
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Gibt es Hindernisse, die den Lifteinsatz beeinträchtigen könnten?
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {obstacles.map((obstacle) => {
            const isSelected = data.gegebenheiten.hindernisse[obstacle.key];
            return (
              <button
                key={obstacle.key}
                type="button"
                onClick={() => toggleObstacle(obstacle.key)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  "hover:border-orange-300",
                  isSelected
                    ? obstacle.key === 'keine'
                      ? "border-green-500 bg-green-50"
                      : "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <span className="text-lg">{obstacle.icon}</span>
                <span className={cn(
                  "text-sm",
                  isSelected 
                    ? obstacle.key === 'keine' ? "text-green-700 font-medium" : "text-orange-700 font-medium"
                    : "text-gray-700"
                )}>
                  {obstacle.label}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Obstacle warnings */}
        {data.gegebenheiten.hindernisse.stromleitungen && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Stromleitungen</p>
              <p className="text-xs text-red-600 mt-0.5">
                Bei Stromleitungen in der Nähe ist besondere Vorsicht geboten. Der Mindestabstand muss eingehalten werden.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Parking */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Parkplatz / Halteverbot
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wo kann das Liftfahrzeug abgestellt werden?
          </p>
        </div>
        
        <div className="space-y-2">
          {parkingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateGegebenheiten({ parkplatz: option.value })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                "hover:border-orange-300",
                data.gegebenheiten.parkplatz === option.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                data.gegebenheiten.parkplatz === option.value
                  ? "border-orange-500 bg-orange-500"
                  : "border-gray-300"
              )}>
                {data.gegebenheiten.parkplatz === option.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className={cn(
                  "font-medium",
                  data.gegebenheiten.parkplatz === option.value ? "text-orange-700" : "text-gray-800"
                )}>
                  {option.label}
                </p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Halteverbot info */}
        {data.gegebenheiten.parkplatz === 'no_parking_zone' && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Halteverbotszone</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Bei Bedarf können wir das Halteverbot für Sie beantragen. Vorlaufzeit: 7-14 Tage. Kosten: CHF 150-250.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Power Supply */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Stromversorgung
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Bei elektrischen Liften wird eine 230V/10A Steckdose benötigt
          </p>
        </div>
        
        <div className="space-y-2">
          {powerOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateGegebenheiten({ strom: option.value })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                "hover:border-orange-300",
                data.gegebenheiten.strom === option.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                data.gegebenheiten.strom === option.value
                  ? "border-orange-500 bg-orange-500"
                  : "border-gray-300"
              )}>
                {data.gegebenheiten.strom === option.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className={cn(
                  "font-medium",
                  data.gegebenheiten.strom === option.value ? "text-orange-700" : "text-gray-800"
                )}>
                  {option.label}
                </p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


