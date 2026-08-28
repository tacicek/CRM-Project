import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface PlaceResult {
  formattedAddress: string;
  street: string;
  houseNumber: string;
  plz: string;
  city: string;
  canton: string;
  country: string;
  lat: number;
  lng: number;
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onPlaceSelect: (place: PlaceResult) => void;
  /**
   * Every keystroke, not just a picked suggestion.
   *
   * Without it the parent only ever learns about addresses that Google knows.
   * "c/o Meier, Hinterhaus links" has no place_id and would be silently
   * discarded on submit — the field would look filled and save empty. Optional,
   * so existing call sites that only want a resolved place stay unchanged.
   */
  onInputChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  country?: string;
  id?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export function GooglePlacesAutocomplete({
  value,
  onPlaceSelect,
  onInputChange,
  placeholder = "Adresse eingeben...",
  className = "",
  disabled = false,
  country = "ch",
  id,
}: GooglePlacesAutocompleteProps) {
  // Die bezahlten Google-Endpunkte verlangen seit 2026-08-28 ein geprueftes JWT
  // UND die Firma des Aufrufers: der Budgetzaehler in Postgres fuehrt einen Topf
  // je Benutzer und je Firma. Alle Aufrufstellen dieser Komponente liegen unter
  // /firma, der aktive Mandant steht also immer bereit.
  const { companyId } = useCompanyContext();
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear any pending debounce on unmount to prevent state updates on dead component
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      return;
    }
    // Ohne aufgeloesten Mandanten wird nicht gefragt — der Server wuerde mit 400
    // antworten, und eine Anfrage, die sicher scheitert, stellt man nicht.
    if (!companyId) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-autocomplete", {
        body: { input, country, company_id: companyId },
      });

      if (!isMountedRef.current) return;
      if (error) throw error;
      setPredictions(data?.predictions || []);
      setShowDropdown(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Error fetching predictions:", err);
      setPredictions([]);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [country, companyId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onInputChange?.(newValue);
    setSelectedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    setIsLoading(true);
    setShowDropdown(false);
    setInputValue(prediction.description);
    onInputChange?.(prediction.description);

    try {
      const { data, error } = await supabase.functions.invoke("google-places-details", {
        body: { placeId: prediction.place_id, company_id: companyId },
      });

      if (error) throw error;

      if (data?.result) {
        onPlaceSelect(data.result);
      }
    } catch (err) {
      console.error("Error fetching place details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, predictions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelectPrediction(predictions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 pr-9 ${className}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handleSelectPrediction(prediction)}
              className={`w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors flex items-start gap-3 ${
                index === selectedIndex ? "bg-accent/50" : ""
              }`}
            >
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {prediction.structured_formatting?.main_text || prediction.description.split(",")[0]}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {prediction.structured_formatting?.secondary_text || 
                   prediction.description.split(",").slice(1).join(",").trim()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
