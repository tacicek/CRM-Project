// Step6Condition.tsx - Condition assessment step for Räumung wizard (Messie/Todesfall)

import { ConditionAssessment, ConditionLevel } from "@/types/raeumung";
import { ConditionCard } from "../ui/ConditionCard";
import { FillLevelSlider } from "../ui/FillLevelSlider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, Shield } from "lucide-react";

interface BesonderheitOption {
  key: keyof ConditionAssessment["besonderheiten"];
  label: string;
  icon: string;
  warning: boolean;
}

const besonderheitenOptions: BesonderheitOption[] = [
  { key: "muellberge", label: "Müllberge / Abfall", icon: "🗑️", warning: true },
  { key: "ungeziefer", label: "Ungeziefer", icon: "🪲", warning: true },
  { key: "schimmel", label: "Schimmelbefall", icon: "🦠", warning: true },
  { key: "geruch", label: "Starke Gerüche", icon: "👃", warning: false },
  { key: "gesundheitsgefahr", label: "Gesundheitsgefahr", icon: "☣️", warning: true },
  { key: "tierkot", label: "Tierkot / Urin", icon: "🐾", warning: true },
  { key: "bauliche_schaeden", label: "Bauliche Schäden", icon: "🏚️", warning: false },
];

interface Step6ConditionProps {
  condition: ConditionAssessment;
  onChange: (condition: ConditionAssessment) => void;
  serviceType: string;
}

export const Step6Condition = ({ condition, onChange, serviceType }: Step6ConditionProps) => {
  const hasWarnings = besonderheitenOptions.some(
    (opt) => opt.warning && condition.besonderheiten[opt.key]
  );

  const isMessee = serviceType === "hoarder_clearance";
  const isTodesfall = serviceType === "death_clearance" || serviceType === "estate_clearance";
  const isZwangsraeumung = serviceType === "forced_eviction";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Zustandsbewertung
        </h2>
        <p className="text-gray-600">
          {isMessee && "Bitte bewerten Sie den Zustand - alle Angaben werden vertraulich behandelt."}
          {isTodesfall && "Informationen über den Zustand helfen bei der Planung."}
          {isZwangsraeumung && "Dokumentieren Sie den aktuellen Zustand."}
        </p>
      </div>

      {/* Privacy notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-800">
              Vertrauliche Behandlung garantiert
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Alle Angaben werden streng vertraulich behandelt und nur an spezialisierte
              Anbieter weitergegeben, die Erfahrung mit solchen Situationen haben.
            </p>
          </div>
        </div>
      </div>

      {/* General Condition */}
      <ConditionCard
        value={condition.allgemein}
        onChange={(value: ConditionLevel) => onChange({ ...condition, allgemein: value })}
        label="Allgemeiner Zustand des Objekts"
      />

      {/* Fill Level (especially for Messie) */}
      {isMessee && (
        <FillLevelSlider
          value={condition.fuellgrad_prozent}
          onChange={(value) => onChange({ ...condition, fuellgrad_prozent: value })}
          label="Füllgrad / Belegung"
        />
      )}

      {/* Special Conditions */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Besondere Umstände
        </Label>
        <p className="text-sm text-gray-500">
          Wählen Sie alle zutreffenden Optionen aus. Dies hilft den Anbietern,
          sich vorzubereiten und angemessene Schutzausrüstung mitzubringen.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {besonderheitenOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                onChange({
                  ...condition,
                  besonderheiten: {
                    ...condition.besonderheiten,
                    [option.key]: !condition.besonderheiten[option.key],
                  },
                })
              }
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                condition.besonderheiten[option.key]
                  ? option.warning
                    ? "border-red-400 bg-red-50"
                    : "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
                  condition.besonderheiten[option.key]
                    ? option.warning
                      ? "bg-red-500"
                      : "bg-blue-500"
                    : "border-2 border-gray-300"
                )}
              >
                {condition.besonderheiten[option.key] && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <span className="font-medium text-sm">{option.label}</span>
                {option.warning && condition.besonderheiten[option.key] && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Spezielle Vorkehrungen erforderlich
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Protective Equipment Question */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          Ist spezielle Schutzausrüstung erforderlich?
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "nein", label: "Nein", icon: "👍" },
            { value: "unsicher", label: "Unsicher", icon: "🤔" },
            { value: "ja", label: "Ja", icon: "🛡️" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange({
                  ...condition,
                  schutzausruestung: option.value as "ja" | "nein" | "unsicher",
                })
              }
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                condition.schutzausruestung === option.value
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 hover:border-blue-300"
              )}
            >
              <span className="text-2xl mb-2">{option.icon}</span>
              <span className="font-medium text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800">
                Besondere Vorsichtsmassnahmen erforderlich
              </h4>
              <p className="text-sm text-red-700 mt-1">
                Aufgrund der angegebenen Umstände werden die Anbieter mit spezieller
                Ausrüstung und geschultem Personal kommen. Dies kann sich auf die
                Preisgestaltung auswirken.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Specific info boxes */}
      {isMessee && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💜</span>
            <div>
              <h4 className="font-semibold text-purple-800">
                Verständnis & Diskretion
              </h4>
              <p className="text-sm text-purple-700 mt-1">
                Unsere Partner-Unternehmen sind auf solche Situationen spezialisiert
                und gehen ohne Wertung vor. Ihre Privatsphäre wird vollständig geschützt.
              </p>
            </div>
          </div>
        </div>
      )}

      {isTodesfall && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🕯️</span>
            <div>
              <h4 className="font-semibold text-gray-800">
                Mit Respekt und Sorgfalt
              </h4>
              <p className="text-sm text-gray-700 mt-1">
                Wir verstehen, dass dies eine schwierige Zeit ist. Unsere Partner
                gehen mit grösster Sensibilität und Respekt vor.
              </p>
            </div>
          </div>
        </div>
      )}

      {isZwangsraeumung && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚖️</span>
            <div>
              <h4 className="font-semibold text-amber-800">
                Rechtliche Dokumentation
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Bei Zwangsräumungen wird der Zustand dokumentiert. Bitte halten Sie
                den Gerichtsbeschluss und relevante Dokumente bereit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step6Condition;


