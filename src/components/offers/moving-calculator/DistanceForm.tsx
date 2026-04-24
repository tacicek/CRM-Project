// DistanceForm.tsx - Distance and Driving Time Form Component

import React from 'react';
import { MapPin, Clock, Route, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface DistanceFormProps {
  distanceKm: number;
  drivingTimeMinutes: number;
  additionalStops: number;
  onDistanceChange: (km: number) => void;
  onDrivingTimeChange: (minutes: number) => void;
  onAdditionalStopsChange: (stops: number) => void;
}

export function DistanceForm({
  distanceKm,
  drivingTimeMinutes,
  additionalStops,
  onDistanceChange,
  onDrivingTimeChange,
  onAdditionalStopsChange,
}: DistanceFormProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-primary" />
          <CardTitle>Distanz & Fahrzeit</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distance */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Entfernung zwischen Auszug und Einzug
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="1000"
              value={distanceKm || ''}
              onChange={(e) => onDistanceChange(parseFloat(e.target.value) || 0)}
              placeholder="z.B. 15"
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">Kilometer</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Über 30 km wird ein Distanz-Zuschlag berechnet
          </p>
        </div>

        {/* Driving Time */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Geschätzte Fahrzeit (einfache Strecke)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="600"
              value={drivingTimeMinutes || ''}
              onChange={(e) => onDrivingTimeChange(parseInt(e.target.value) || 0)}
              placeholder="z.B. 30"
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">Minuten</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Berücksichtigen Sie Verkehr und Stosszeiten
          </p>
        </div>

        {/* Additional Stops */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            Zusätzliche Stopps
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="10"
              value={additionalStops || ''}
              onChange={(e) => onAdditionalStopsChange(parseInt(e.target.value) || 0)}
              placeholder="z.B. 1"
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">Stopps</span>
          </div>
          <p className="text-xs text-muted-foreground">
            z.B. Möbellager, Entsorgungsstelle, Kellerabteil (je +15 Min)
          </p>
        </div>

        {/* Quick Estimate Helper */}
        {distanceKm > 0 && drivingTimeMinutes === 0 && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tipp:</strong> Für {distanceKm} km können Sie mit ca.{' '}
              {Math.round(distanceKm * 1.5)} - {Math.round(distanceKm * 2)} Minuten
              Fahrzeit rechnen (je nach Strecke und Verkehr).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
