// BuildingInfoForm.tsx - Building Information Form Component

import React from 'react';
import { Building2, ArrowUpDown, ParkingCircle, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BuildingInfo, ElevatorSize, StairwellType } from './types';

interface BuildingInfoFormProps {
  title: string;
  data: BuildingInfo;
  onChange: (data: BuildingInfo) => void;
}

export function BuildingInfoForm({ title, data, onChange }: BuildingInfoFormProps) {
  const updateField = <K extends keyof BuildingInfo>(
    field: K,
    value: BuildingInfo[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const formId = title.toLowerCase().replace(/\s+/g, '-');

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Floor Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            In welchem Stock befindet sich die Wohnung?
          </Label>
          <Select
            value={data.floor.toString()}
            onValueChange={(val) => updateField('floor', parseInt(val))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Erdgeschoss (EG)</SelectItem>
              <SelectItem value="1">1. Obergeschoss</SelectItem>
              <SelectItem value="2">2. Obergeschoss</SelectItem>
              <SelectItem value="3">3. Obergeschoss</SelectItem>
              <SelectItem value="4">4. Obergeschoss</SelectItem>
              <SelectItem value="5">5. Obergeschoss</SelectItem>
              <SelectItem value="6">6. Obergeschoss</SelectItem>
              <SelectItem value="7">7. Obergeschoss</SelectItem>
              <SelectItem value="8">8. Obergeschoss</SelectItem>
              <SelectItem value="9">9. Obergeschoss</SelectItem>
              <SelectItem value="10">10+ Obergeschoss</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Elevator */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id={`elevator-${formId}`}
              checked={data.hasElevator}
              onCheckedChange={(checked) => {
                updateField('hasElevator', checked as boolean);
                if (!checked) {
                  updateField('elevatorSize', undefined);
                }
              }}
            />
            <Label
              htmlFor={`elevator-${formId}`}
              className="flex items-center gap-2 font-medium cursor-pointer"
            >
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              Aufzug vorhanden
            </Label>
          </div>

          {data.hasElevator && (
            <div className="ml-7 p-4 rounded-lg bg-muted/50 space-y-3">
              <Label className="text-sm">Aufzuggrösse</Label>
              <RadioGroup
                value={data.elevatorSize || 'standard'}
                onValueChange={(val) => updateField('elevatorSize', val as ElevatorSize)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="small" id={`small-${formId}`} />
                  <Label htmlFor={`small-${formId}`} className="font-normal cursor-pointer">
                    Klein (&lt; 4 Personen) - Mehrere Fahrten nötig
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id={`standard-${formId}`} />
                  <Label htmlFor={`standard-${formId}`} className="font-normal cursor-pointer">
                    Standard (4-6 Personen)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="large" id={`large-${formId}`} />
                  <Label htmlFor={`large-${formId}`} className="font-normal cursor-pointer">
                    Gross (Möbellift / Lastenaufzug)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        {/* Parking Distance */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ParkingCircle className="h-4 w-4 text-muted-foreground" />
            Parkdistanz zum Eingang
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="500"
              value={data.parkingDistance}
              onChange={(e) => updateField('parkingDistance', parseInt(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">Meter</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Geschätzte Distanz von der Parkstelle bis zum Gebäudeeingang
          </p>
        </div>

        {/* Stairwell Type (only if no elevator or floor > 0) */}
        {(!data.hasElevator || data.floor > 0) && (
          <div className="space-y-3">
            <Label>Treppenhaus-Breite</Label>
            <RadioGroup
              value={data.stairwellType}
              onValueChange={(val) => updateField('stairwellType', val as StairwellType)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="narrow" id={`narrow-${formId}`} />
                <Label htmlFor={`narrow-${formId}`} className="font-normal cursor-pointer">
                  Eng (&lt; 100cm) - Erschwerte Bedingungen
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standard" id={`standard-stair-${formId}`} />
                <Label htmlFor={`standard-stair-${formId}`} className="font-normal cursor-pointer">
                  Standard (100-140cm)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wide" id={`wide-${formId}`} />
                <Label htmlFor={`wide-${formId}`} className="font-normal cursor-pointer">
                  Breit (&gt; 140cm) - Gute Bedingungen
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Additional Conditions */}
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Zusätzliche Bedingungen</Label>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id={`corners-${formId}`}
                checked={data.hasTightCorners}
                onCheckedChange={(checked) =>
                  updateField('hasTightCorners', checked as boolean)
                }
              />
              <div>
                <Label
                  htmlFor={`corners-${formId}`}
                  className="font-normal cursor-pointer"
                >
                  Enge Kurven / Wendeltreppen vorhanden
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Erschwert den Transport grosser Möbel
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id={`external-${formId}`}
                checked={data.needsExternalLift}
                onCheckedChange={(checked) =>
                  updateField('needsExternalLift', checked as boolean)
                }
              />
              <div>
                <Label
                  htmlFor={`external-${formId}`}
                  className="font-normal cursor-pointer"
                >
                  Aussenlift / Möbellift empfohlen
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bei sehr engen Treppenhäusern oder grossen Möbeln
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
