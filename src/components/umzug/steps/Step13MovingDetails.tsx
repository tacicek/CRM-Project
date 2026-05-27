// Step13MovingDetails.tsx - Moving date and time details

import { MovingDetails, FlexibilityType } from "@/types/umzug";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, Info } from "lucide-react";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";

interface Step13Props {
  data: MovingDetails;
  onChange: (data: Partial<MovingDetails>) => void;
}

const FLEXIBILITY_OPTIONS: { value: FlexibilityType; label: string; description: string }[] = [
  { value: 'fixed', label: 'Festes Datum', description: 'Der Umzug muss an diesem Tag stattfinden' },
  { value: 'flex_3_days', label: '± 3 Tage', description: 'Flexibilität von 3 Tagen vor/nach' },
  { value: 'flex_1_week', label: '± 1 Woche', description: 'Flexibilität von einer Woche' },
  { value: 'flex_2_weeks', label: '± 2 Wochen', description: 'Maximale Flexibilität' },
];

const TIME_OPTIONS = [
  { value: '07:00', label: '07:00' },
  { value: '08:00', label: '08:00' },
  { value: '09:00', label: '09:00' },
  { value: '10:00', label: '10:00' },
  { value: '11:00', label: '11:00' },
  { value: '12:00', label: '12:00' },
  { value: 'flexibel', label: 'Flexibel' },
];

export const Step13MovingDetails = ({ data, onChange }: Step13Props) => {
  const minDate = addDays(new Date(), 2);
  const maxDate = addDays(new Date(), 365);
  
  const selectedDate = data.datum ? new Date(data.datum) : undefined;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <CalendarDays className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Details zu Ihrem Umzug
        </h2>
        <p className="text-gray-600">
          Wann soll der Umzug stattfinden?
        </p>
      </div>

      {/* Date Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">
          Umzugsdatum
        </h3>
        
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange({ datum: date ? format(date, 'yyyy-MM-dd') : '' })}
            disabled={(date) => date < minDate || date > maxDate}
            locale={de}
            className="rounded-xl border shadow-sm"
          />
        </div>
        
        {selectedDate && (
          <p className="text-center text-blue-600 font-medium">
            Gewählt: {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </p>
        )}
      </div>

      {/* Flexibility Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">
          Flexibilität
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FLEXIBILITY_OPTIONS.map((option) => {
            const isSelected = data.flexibilitaet === option.value;
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ flexibilitaet: option.value })}
                className={cn(
                  "p-3 rounded-xl border-2 transition-all duration-200 text-left",
                  "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300"
                )}
              >
                <span className={cn(
                  "font-medium block mb-1",
                  isSelected ? "text-blue-700" : "text-gray-800"
                )}>
                  {option.label}
                </span>
                <span className="text-xs text-gray-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        
        {data.flexibilitaet && data.flexibilitaet !== 'fixed' && (
          <p className="text-sm text-gray-600">
            Flexibilität ermöglicht oft bessere Preise!
          </p>
        )}
      </div>

      {/* Start Time Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">
            Gewünschte Startzeit
          </h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((option) => {
            const isSelected = data.startzeit === option.value;
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ startzeit: option.value })}
                className={cn(
                  "px-4 py-2 rounded-lg border-2 transition-all duration-200",
                  "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  isSelected
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-200 hover:border-blue-300 text-gray-700"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            <strong>Hinweis:</strong> Der genaue Zeitpunkt wird mit dem Umzugsunternehmen 
            abgestimmt. Frühere Startzeiten sind bei längeren Umzügen empfohlen.
          </p>
        </div>
      </div>
    </div>
  );
};


