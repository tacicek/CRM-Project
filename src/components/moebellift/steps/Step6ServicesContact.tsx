import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MoebelliftAnfrage, Salutation, ContactPreference } from "@/types/moebellift";
import { Lightbulb } from "lucide-react";

interface Step6Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const salutations: { value: Salutation; label: string }[] = [
  { value: 'herr', label: 'Herr' },
  { value: 'frau', label: 'Frau' },
  { value: 'firma', label: 'Firma' },
  { value: 'divers', label: 'Divers' },
];

const contactPreferences: { value: ContactPreference; label: string }[] = [
  { value: 'phone', label: 'Telefon' },
  { value: 'email', label: 'E-Mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'any', label: 'Egal' },
];

interface ServiceToggle {
  key: keyof MoebelliftAnfrage['zusatzleistungen'];
  label: string;
  description: string;
  price: string;
  hasCounter?: boolean;
}

const services: ServiceToggle[] = [
  { 
    key: 'halteverbot', 
    label: 'Halteverbotszone', 
    description: 'Wir beantragen das Halteverbot für Sie',
    price: 'CHF 150-250'
  },
  { 
    key: 'helfer', 
    label: 'Umzugshelfer', 
    description: 'Zusätzliche Träger zum Be-/Entladen',
    price: 'CHF 45-60/h pro Person',
    hasCounter: true
  },
  { 
    key: 'verpackung', 
    label: 'Verpackungsmaterial', 
    description: 'Decken, Gurte, Kartons',
    price: 'CHF 50-150'
  },
  { 
    key: 'entsorgung', 
    label: 'Entsorgung Altmöbel', 
    description: 'Wir nehmen alte Möbel mit',
    price: 'Ab CHF 100'
  },
  { 
    key: 'lagerung', 
    label: 'Zwischenlagerung', 
    description: 'Temporäre Lagerung Ihrer Möbel',
    price: 'Ab CHF 100/Tag'
  },
];

export function Step6ServicesContact({ data, updateData }: Step6Props) {
  const updateZusatzleistungen = (key: string, value: boolean | { aktiv: boolean; anzahl: number }) => {
    updateData({
      zusatzleistungen: {
        ...data.zusatzleistungen,
        [key]: value
      }
    });
  };

  const updateKunde = (updates: Partial<typeof data.kunde>) => {
    updateData({ kunde: { ...data.kunde, ...updates } });
  };

  const [hasOnSiteContact, setHasOnSiteContact] = React.useState(!!data.kontakt_vor_ort);

  return (
    <div className="space-y-8">
      {/* Additional Services */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Zusatzleistungen
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Optionale Services für Ihren Lifteinsatz
          </p>
        </div>
        
        <div className="space-y-3">
          {services.map((service) => {
            const isHelfer = service.key === 'helfer';
            const isActive = isHelfer 
              ? data.zusatzleistungen.helfer.aktiv 
              : data.zusatzleistungen[service.key] as boolean;
            
            return (
              <div
                key={service.key}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all",
                  isActive ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "font-medium",
                        isActive ? "text-orange-700" : "text-gray-800"
                      )}>
                        {service.label}
                      </p>
                      <span className="text-xs text-gray-400">{service.price}</span>
                    </div>
                    <p className="text-sm text-gray-500">{service.description}</p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      if (isHelfer) {
                        updateZusatzleistungen('helfer', { 
                          aktiv: checked, 
                          anzahl: data.zusatzleistungen.helfer.anzahl 
                        });
                      } else {
                        updateZusatzleistungen(service.key, checked);
                      }
                    }}
                  />
                </div>
                
                {/* Helper counter */}
                {isHelfer && isActive && (
                  <div className="mt-4 pt-4 border-t border-orange-200">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm text-gray-600">Anzahl Helfer:</Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateZusatzleistungen('helfer', {
                            aktiv: true,
                            anzahl: Math.max(1, data.zusatzleistungen.helfer.anzahl - 1)
                          })}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">
                          {data.zusatzleistungen.helfer.anzahl}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateZusatzleistungen('helfer', {
                            aktiv: true,
                            anzahl: Math.min(4, data.zusatzleistungen.helfer.anzahl + 1)
                          })}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      1 Helfer ist oft im Preis inbegriffen
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Contact Information */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Ihre Kontaktdaten
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wie können wir Sie erreichen?
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Salutation */}
          <div>
            <Label className="text-sm text-gray-600">Anrede *</Label>
            <Select
              value={data.kunde.anrede}
              onValueChange={(value: Salutation) => updateKunde({ anrede: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {salutations.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* First Name */}
          <div>
            <Label className="text-sm text-gray-600">Vorname *</Label>
            <Input
              value={data.kunde.vorname}
              onChange={(e) => updateKunde({ vorname: e.target.value })}
              placeholder="Max"
              className="mt-1"
            />
          </div>
          
          {/* Last Name */}
          <div>
            <Label className="text-sm text-gray-600">Nachname *</Label>
            <Input
              value={data.kunde.nachname}
              onChange={(e) => updateKunde({ nachname: e.target.value })}
              placeholder="Muster"
              className="mt-1"
            />
          </div>
          
          {/* Company (optional) */}
          {data.kunde.anrede === 'firma' && (
            <div>
              <Label className="text-sm text-gray-600">Firma</Label>
              <Input
                value={data.kunde.firma || ''}
                onChange={(e) => updateKunde({ firma: e.target.value })}
                placeholder="Firma GmbH"
                className="mt-1"
              />
            </div>
          )}
          
          {/* Email */}
          <div className="mt-1">
            <EmailField
              label={<span className="text-sm text-gray-600">E-Mail</span>}
              required
              value={data.kunde.email}
              onChange={(v) => updateKunde({ email: v })}
              placeholder="max@example.ch"
            />
          </div>
          
          {/* Phone */}
          <div>
            <Label className="text-sm text-gray-600">Telefon *</Label>
            <Input
              type="tel"
              value={data.kunde.telefon}
              onChange={(e) => updateKunde({ telefon: e.target.value })}
              placeholder="+41 79 123 45 67"
              className="mt-1"
            />
          </div>
        </div>
        
        {/* Contact Preference */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Bevorzugte Kontaktart</Label>
          <div className="flex flex-wrap gap-2">
            {contactPreferences.map((pref) => (
              <button
                key={pref.value}
                type="button"
                onClick={() => updateKunde({ kontakt_art: pref.value })}
                className={cn(
                  "px-4 py-2 rounded-full border-2 transition-all text-sm",
                  data.kunde.kontakt_art === pref.value
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                )}
              >
                {pref.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* On-site Contact */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="onsite"
            checked={hasOnSiteContact}
            onCheckedChange={(checked) => {
              setHasOnSiteContact(checked as boolean);
              if (!checked) {
                updateData({ kontakt_vor_ort: undefined });
              }
            }}
          />
          <Label htmlFor="onsite" className="text-sm font-medium cursor-pointer">
            Andere Person vor Ort beim Einsatz
          </Label>
        </div>
        
        {hasOnSiteContact && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
            <div>
              <Label className="text-sm text-gray-600">Name</Label>
              <Input
                value={data.kontakt_vor_ort?.name || ''}
                onChange={(e) => updateData({ 
                  kontakt_vor_ort: { 
                    ...data.kontakt_vor_ort, 
                    name: e.target.value,
                    telefon: data.kontakt_vor_ort?.telefon || ''
                  } 
                })}
                placeholder="Name der Kontaktperson"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">Telefon</Label>
              <Input
                type="tel"
                value={data.kontakt_vor_ort?.telefon || ''}
                onChange={(e) => updateData({ 
                  kontakt_vor_ort: { 
                    ...data.kontakt_vor_ort,
                    name: data.kontakt_vor_ort?.name || '',
                    telefon: e.target.value 
                  } 
                })}
                placeholder="+41 79 123 45 67"
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import * as React from 'react';


