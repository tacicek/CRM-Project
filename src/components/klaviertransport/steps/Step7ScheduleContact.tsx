import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { 
  KlaviertransportAnfrage, 
  Flexibility,
  TimeSlot,
  Salutation
} from "@/types/klaviertransport";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";

interface Step7Props {
  data: Partial<KlaviertransportAnfrage>;
  updateData: (field: keyof KlaviertransportAnfrage, value: unknown) => void;
  errors: Record<string, string>;
}

const flexibilityOptions: { value: Flexibility; label: string }[] = [
  { value: 'fixed', label: 'Festes Datum' },
  { value: 'flex_3_days', label: '± 3 Tage flexibel' },
  { value: 'flex_1_week', label: '± 1 Woche flexibel' },
  { value: 'fully_flexible', label: 'Komplett flexibel' }
];

const timeSlotOptions: { value: TimeSlot; label: string; time: string }[] = [
  { value: 'morning', label: 'Vormittags', time: '08:00-12:00' },
  { value: 'afternoon', label: 'Nachmittags', time: '12:00-17:00' },
  { value: 'flexible', label: 'Flexibel', time: 'Jederzeit' }
];

const contactTimeOptions = [
  'Jederzeit',
  'Vormittags (08:00-12:00)',
  'Nachmittags (12:00-17:00)',
  'Abends (17:00-20:00)'
];

export function Step7ScheduleContact({ data, updateData, errors }: Step7Props) {
  const minDate = addDays(new Date(), 3);
  const selectedDate = data.wunschdatum ? new Date(data.wunschdatum) : undefined;
  
  return (
    <div className="space-y-8">
      {/* Schedule Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">📅 Terminwunsch</h3>
          <p className="text-sm text-gray-500">Wann soll der Transport stattfinden?</p>
        </div>
        
        {/* Date Selection */}
        <div className="space-y-2">
          <Label>Wunschdatum *</Label>
          <div className="flex flex-col md:flex-row gap-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => updateData('wunschdatum', date ? format(date, 'yyyy-MM-dd') : '')}
              disabled={(date) => date < minDate}
              locale={de}
              className="rounded-md border"
            />
            {selectedDate && (
              <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">Gewähltes Datum</div>
                <div className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                  {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
                </div>
              </div>
            )}
          </div>
          {errors.wunschdatum && (
            <p className="text-sm text-red-500">{errors.wunschdatum}</p>
          )}
          <p className="text-xs text-gray-500">
            Hinweis: Klaviertransporte benötigen Vorlaufzeit. Mindestens 3 Tage im Voraus.
          </p>
        </div>
        
        {/* Flexibility */}
        <div className="space-y-2">
          <Label>Flexibilität</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {flexibilityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateData('flexibilitaet', option.value)}
                className={cn(
                  "p-3 rounded-lg border-2 text-sm transition-all",
                  data.flexibilitaet === option.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Time Slot */}
        <div className="space-y-2">
          <Label>Bevorzugte Uhrzeit</Label>
          <div className="grid grid-cols-3 gap-3">
            {timeSlotOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateData('uhrzeit', option.value)}
                className={cn(
                  "p-4 rounded-lg border-2 text-center transition-all",
                  data.uhrzeit === option.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                )}
              >
                <div className="font-semibold">{option.label}</div>
                <div className="text-xs text-gray-500">{option.time}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Contact Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">👤 Kontaktdaten</h3>
          <p className="text-sm text-gray-500">Wie können wir Sie erreichen?</p>
        </div>
        
        {/* Salutation */}
        <div className="space-y-2">
          <Label>Anrede *</Label>
          <div className="flex gap-2">
            {(['herr', 'frau', 'divers'] as Salutation[]).map((sal) => (
              <button
                key={sal}
                type="button"
                onClick={() => updateData('anrede', sal)}
                className={cn(
                  "px-4 py-2 rounded-lg border-2 transition-all",
                  data.anrede === sal
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                )}
              >
                {sal === 'herr' ? 'Herr' : sal === 'frau' ? 'Frau' : 'Divers'}
              </button>
            ))}
          </div>
        </div>
        
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vorname *</Label>
            <Input
              placeholder="Vorname"
              value={data.vorname || ''}
              onChange={(e) => updateData('vorname', e.target.value)}
              className={errors.vorname ? 'border-red-500' : ''}
            />
            {errors.vorname && <p className="text-sm text-red-500">{errors.vorname}</p>}
          </div>
          <div className="space-y-2">
            <Label>Nachname *</Label>
            <Input
              placeholder="Nachname"
              value={data.nachname || ''}
              onChange={(e) => updateData('nachname', e.target.value)}
              className={errors.nachname ? 'border-red-500' : ''}
            />
            {errors.nachname && <p className="text-sm text-red-500">{errors.nachname}</p>}
          </div>
        </div>
        
        {/* Contact Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <EmailField
              label="E-Mail"
              required
              value={data.email || ''}
              onChange={(v) => updateData('email', v)}
              placeholder="ihre@email.ch"
              inputClassName={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label>Telefon *</Label>
            <Input
              type="tel"
              placeholder="+41 79 123 45 67"
              value={data.telefon || ''}
              onChange={(e) => updateData('telefon', e.target.value)}
              className={errors.telefon ? 'border-red-500' : ''}
            />
            {errors.telefon && <p className="text-sm text-red-500">{errors.telefon}</p>}
          </div>
        </div>
        
        {/* Preferred Contact Time */}
        <div className="space-y-2">
          <Label>Bevorzugte Kontaktzeit (optional)</Label>
          <Select
            value={data.kontaktzeit || ''}
            onValueChange={(value) => updateData('kontaktzeit', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Wann dürfen wir Sie kontaktieren?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Keine Präferenz --</SelectItem>
              {contactTimeOptions.map((time) => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Different contact person */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Andere Kontaktperson vor Ort</Label>
              <p className="text-sm text-gray-500">Falls jemand anderes vor Ort sein wird</p>
            </div>
            <Switch
              checked={data.andere_kontaktperson || false}
              onCheckedChange={(checked) => updateData('andere_kontaktperson', checked)}
            />
          </div>
          
          {data.andere_kontaktperson && (
            <div className="pl-4 border-l-2 border-blue-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name der Kontaktperson</Label>
                  <Input
                    placeholder="Name"
                    value={data.kontakt_vor_ort?.name || ''}
                    onChange={(e) => updateData('kontakt_vor_ort', {
                      ...data.kontakt_vor_ort,
                      name: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon der Kontaktperson</Label>
                  <Input
                    type="tel"
                    placeholder="+41 79 xxx xx xx"
                    value={data.kontakt_vor_ort?.telefon || ''}
                    onChange={(e) => updateData('kontakt_vor_ort', {
                      ...data.kontakt_vor_ort,
                      telefon: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


