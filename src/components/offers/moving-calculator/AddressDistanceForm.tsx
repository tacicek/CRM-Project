// AddressDistanceForm.tsx - Address Input with Auto Distance Calculation

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, Clock, Loader2, AlertCircle, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GooglePlacesAutocomplete, PlaceResult } from '@/components/ui/google-places-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { AddressData } from './types';

// Re-export for backward compatibility
export type { AddressData } from './types';

interface DistanceResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
}

interface AddressDistanceFormProps {
  originAddress: AddressData | null;
  destinationAddress: AddressData | null;
  distanceKm: number;
  drivingTimeMinutes: number;
  additionalStops: number;
  onOriginChange: (address: AddressData | null) => void;
  onDestinationChange: (address: AddressData | null) => void;
  onDistanceChange: (km: number) => void;
  onDrivingTimeChange: (minutes: number) => void;
  onAdditionalStopsChange: (stops: number) => void;
}

export function AddressDistanceForm({
  originAddress,
  destinationAddress,
  distanceKm,
  drivingTimeMinutes,
  additionalStops,
  onOriginChange,
  onDestinationChange,
  onDistanceChange,
  onDrivingTimeChange,
  onAdditionalStopsChange,
}: AddressDistanceFormProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [lastCalculated, setLastCalculated] = useState<{ origin: string; destination: string } | null>(null);
  
  // Ref to track the latest calculation request and prevent race conditions
  const calculationRequestRef = useRef<number>(0);

  // Build a proper address string for the API
  const buildAddressString = (addr: AddressData): string => {
    // If we have a good formatted address, use it
    if (addr.formattedAddress && addr.formattedAddress.length > 10) {
      return addr.formattedAddress;
    }
    // Otherwise build from components
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.houseNumber) parts.push(addr.houseNumber);
    if (addr.plz) parts.push(addr.plz);
    if (addr.city) parts.push(addr.city);
    parts.push('Schweiz');
    return parts.filter(Boolean).join(' ');
  };

  // Calculate distance when both addresses are set
  const calculateDistance = useCallback(async (force: boolean = false) => {
    if (!originAddress || !destinationAddress) {
      if (force) setCalculationError('Bitte beide Adressen eingeben');
      return;
    }

    // Need at least PLZ and city for calculation
    const originValid = originAddress.plz || originAddress.city || originAddress.formattedAddress;
    const destValid = destinationAddress.plz || destinationAddress.city || destinationAddress.formattedAddress;
    
    if (!originValid || !destValid) {
      if (force) setCalculationError('Adressdaten unvollständig');
      return;
    }

    // Check if we already calculated for these addresses (unless forced)
    const originKey = `${originAddress.plz}-${originAddress.city}`;
    const destKey = `${destinationAddress.plz}-${destinationAddress.city}`;
    
    if (!force && 
        lastCalculated?.origin === originKey && 
        lastCalculated?.destination === destKey) {
      console.log('[AddressDistanceForm] Already calculated for these addresses');
      return;
    }

    // Increment request counter to track this specific request
    const currentRequest = ++calculationRequestRef.current;

    setIsCalculating(true);
    setCalculationError(null);

    try {
      // Use coordinates if valid (> 0), otherwise use formatted address
      const originHasCoords = originAddress.lat && originAddress.lng && originAddress.lat !== 0 && originAddress.lng !== 0;
      const destHasCoords = destinationAddress.lat && destinationAddress.lng && destinationAddress.lat !== 0 && destinationAddress.lng !== 0;
      
      const origin = originHasCoords 
        ? { lat: originAddress.lat, lng: originAddress.lng }
        : buildAddressString(originAddress);
      
      const destination = destHasCoords
        ? { lat: destinationAddress.lat, lng: destinationAddress.lng }
        : buildAddressString(destinationAddress);

      console.log('[AddressDistanceForm] Calculating distance:', { origin, destination });

      const { data, error } = await supabase.functions.invoke('calculate-distance', {
        body: { origin, destination, mode: 'driving' }
      });

      // Check if this is still the latest request (prevents race conditions)
      if (currentRequest !== calculationRequestRef.current) {
        console.log('[AddressDistanceForm] Stale request, ignoring result');
        return;
      }

      if (error) {
        console.error('[AddressDistanceForm] API error:', error);
        throw error;
      }

      if (data?.result) {
        const result: DistanceResult = data.result;
        console.log('[AddressDistanceForm] Distance result:', result);
        onDistanceChange(result.distanceKm);
        onDrivingTimeChange(result.durationMinutes);
        setLastCalculated({ origin: originKey, destination: destKey });
        setCalculationError(null);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      // Only update error state if this is still the latest request
      if (currentRequest === calculationRequestRef.current) {
        console.error('Error calculating distance:', err);
        setCalculationError('Distanz konnte nicht berechnet werden. Bitte manuell eingeben.');
      }
    } finally {
      // Only update loading state if this is still the latest request
      if (currentRequest === calculationRequestRef.current) {
        setIsCalculating(false);
      }
    }
  }, [originAddress, destinationAddress, onDistanceChange, onDrivingTimeChange, lastCalculated]);

  // Auto-calculate when both addresses change.
  useEffect(() => {
    if (originAddress && destinationAddress && 
        originAddress.formattedAddress && destinationAddress.formattedAddress) {
      // Small delay to ensure state is fully updated and debounce rapid changes
      const timer = setTimeout(() => {
        calculateDistance(false);
      }, 500);
      return () => clearTimeout(timer);
    }
     
  }, [calculateDistance, destinationAddress, originAddress]);

  const handleOriginSelect = (place: PlaceResult) => {
    onOriginChange({
      formattedAddress: place.formattedAddress,
      street: place.street,
      houseNumber: place.houseNumber,
      plz: place.plz,
      city: place.city,
      canton: place.canton,
      country: place.country,
      lat: place.lat,
      lng: place.lng,
    });
  };

  const handleDestinationSelect = (place: PlaceResult) => {
    onDestinationChange({
      formattedAddress: place.formattedAddress,
      street: place.street,
      houseNumber: place.houseNumber,
      plz: place.plz,
      city: place.city,
      canton: place.canton,
      country: place.country,
      lat: place.lat,
      lng: place.lng,
    });
  };

  const hasDistance = distanceKm > 0 && drivingTimeMinutes > 0;

  return (
    <Card>
      <CardHeader className="pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <CardTitle className="text-sm sm:text-lg">Adressen & Distanz</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Origin Address */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-xs font-bold text-green-600">A</span>
            </div>
            Auszugsadresse
          </Label>
          <GooglePlacesAutocomplete
            value={originAddress?.formattedAddress || ''}
            onPlaceSelect={handleOriginSelect}
            placeholder="Strasse, PLZ, Ort eingeben..."
            country="ch"
          />
          {originAddress && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {originAddress.plz} {originAddress.city}
              </Badge>
              {originAddress.canton && (
                <Badge variant="secondary" className="text-xs">
                  {originAddress.canton}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Destination Address */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-xs font-bold text-red-600">B</span>
            </div>
            Einzugsadresse
          </Label>
          <GooglePlacesAutocomplete
            value={destinationAddress?.formattedAddress || ''}
            onPlaceSelect={handleDestinationSelect}
            placeholder="Strasse, PLZ, Ort eingeben..."
            country="ch"
          />
          {destinationAddress && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {destinationAddress.plz} {destinationAddress.city}
              </Badge>
              {destinationAddress.canton && (
                <Badge variant="secondary" className="text-xs">
                  {destinationAddress.canton}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Distance Calculation Result */}
        {(originAddress && destinationAddress) && (
          <div className="p-3 sm:p-4 rounded-lg bg-muted/50 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-xs sm:text-sm flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                Berechnete Route
              </h4>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => calculateDistance(true)}
                disabled={isCalculating}
                className="h-8 text-xs"
              >
                {isCalculating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Navigation className="h-3 w-3 mr-1" />
                )}
                {isCalculating ? 'Berechne...' : 'Berechnen'}
              </Button>
            </div>

            {calculationError && (
              <div className="flex items-start gap-2 text-xs sm:text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{calculationError}</span>
              </div>
            )}

            {hasDistance && !calculationError && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-lg border">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Entfernung</p>
                    <p className="text-base sm:text-lg font-semibold">{distanceKm} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-lg border">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Fahrzeit</p>
                    <p className="text-base sm:text-lg font-semibold">
                      {Math.floor(drivingTimeMinutes / 60) > 0 && `${Math.floor(drivingTimeMinutes / 60)} Std `}
                      {drivingTimeMinutes % 60} Min
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!hasDistance && !isCalculating && !calculationError && (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">
                Klicken Sie auf "Berechnen" um die Distanz zu ermitteln
              </p>
            )}
          </div>
        )}

        {/* Manual Override Section */}
        <div className="space-y-3 sm:space-y-4 pt-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs sm:text-sm font-medium">Manuelle Anpassung</Label>
            {hasDistance && (
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                Berechnet
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Entfernung (km)</Label>
              <Input
                type="number"
                min="0"
                max="1000"
                value={distanceKm || ''}
                onChange={(e) => onDistanceChange(parseFloat(e.target.value) || 0)}
                placeholder="z.B. 15"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Fahrzeit (Min)</Label>
              <Input
                type="number"
                min="0"
                max="600"
                value={drivingTimeMinutes || ''}
                onChange={(e) => onDrivingTimeChange(parseInt(e.target.value) || 0)}
                placeholder="z.B. 30"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Additional Stops */}
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-xs sm:text-sm">Zusätzliche Stopps</Label>
          <div className="flex items-center gap-2 sm:gap-3">
            <Input
              type="number"
              min="0"
              max="10"
              value={additionalStops || ''}
              onChange={(e) => onAdditionalStopsChange(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-20 sm:w-32 h-10"
            />
            <span className="text-xs sm:text-sm text-muted-foreground">Stopps</span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            z.B. Möbellager, Entsorgungsstelle (+15 Min pro Stopp)
          </p>
        </div>

        {/* Distance Warning */}
        {distanceKm > 30 && (
          <div className="p-2 sm:p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs sm:text-sm text-amber-800">
              ⚠️ Bei Distanzen über 30 km: CHF 2.00 pro km Zuschlag
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
