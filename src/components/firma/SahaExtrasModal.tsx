// =============================================================================
// SahaExtrasModal - Field Extras Modal for Team Leaders
// Mobile-friendly interface for adding extras during job execution
// =============================================================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Loader2,
  Package,
  Clock,
  Truck,
  Trash,
  Weight,
  Wrench,
  Armchair,
  Save,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCHF } from '@/lib/utils';
import { validateExtraServices } from '@/lib/auftragSnapshot';

// =============================================================================
// Types
// =============================================================================

interface ExtraService {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface Auftrag {
  id: string;
  auftrag_nummer: string;
  title: string;
  customer_name: string;
  extra_services: ExtraService[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: string;
}

interface SahaExtrasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auftragId: string;
  onSaved?: () => void;
}

// =============================================================================
// Preset Extras - Common field extras for quick add
// =============================================================================

const PRESET_EXTRAS = [
  { 
    icon: Clock, 
    label: 'Zusätzliche Stunde', 
    description: 'Zusätzliche Arbeitszeit',
    unit: 'Std.',
    unit_price: 60,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  { 
    icon: Trash, 
    label: 'Entsorgung', 
    description: 'Entsorgung/Sperrmüll',
    unit: 'Pausch.',
    unit_price: 80,
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  },
  { 
    icon: Weight, 
    label: 'Schwerlast', 
    description: 'Schwerlastzuschlag (>100kg)',
    unit: 'Stk.',
    unit_price: 50,
    color: 'bg-red-100 text-red-700 border-red-200'
  },
  { 
    icon: Wrench, 
    label: 'Montage', 
    description: 'Möbelmontage/-demontage',
    unit: 'Std.',
    unit_price: 45,
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  { 
    icon: Armchair, 
    label: 'Spezialmöbel', 
    description: 'Spezialmöbel Transport',
    unit: 'Stk.',
    unit_price: 100,
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  { 
    icon: Truck, 
    label: 'Zusatzfahrt', 
    description: 'Zusätzliche Fahrt',
    unit: 'Pausch.',
    unit_price: 120,
    color: 'bg-amber-100 text-amber-700 border-amber-200'
  },
];

// =============================================================================
// Component
// =============================================================================

// Minimum time between save requests (ms)
const SAVE_DEBOUNCE_MS = 1000;

export function SahaExtrasModal({ 
  open, 
  onOpenChange, 
  auftragId,
  onSaved 
}: SahaExtrasModalProps) {
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [extras, setExtras] = useState<ExtraService[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customExtra, setCustomExtra] = useState<Partial<ExtraService>>({
    description: '',
    quantity: 1,
    unit: 'Stk.',
    unit_price: 0,
  });
  
  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialExtras, setInitialExtras] = useState<ExtraService[]>([]);
  
  // AbortController ref for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Last save timestamp for debouncing
  const lastSaveRef = useRef<number>(0);

  // Load auftrag data with AbortController
  const loadAuftrag = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('auftraege')
        .select('id, auftrag_nummer, title, customer_name, extra_services, subtotal, vat_rate, vat_amount, total, status')
        .eq('id', auftragId)
        .single();

      // Check if aborted before updating state
      if (signal.aborted) return;

      if (error) throw error;

      // Fail closed: validate the extra_services JSON at the load boundary. Malformed
      // data must not open the modal with a wrong/empty list the user could then save
      // over the real (corrupt) data. null/undefined is a valid "no extras" → [].
      const parsedExtras = validateExtraServices(data.extra_services);
      if (!parsedExtras.ok) {
        toast({
          title: 'Fehler',
          description: 'Die Saha-Extras enthalten ungültige Daten und wurden nicht geladen.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      setAuftrag({ ...data, extra_services: parsedExtras.value });
      setExtras(parsedExtras.value);
      setInitialExtras(structuredClone(parsedExtras.value)); // Deep clone for comparison
      setHasUnsavedChanges(false);
    } catch (error) {
      if (signal.aborted) return;
      console.error('Error loading auftrag:', error);
      toast({
        title: 'Fehler',
        description: 'Auftrag konnte nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [auftragId, toast]);

  // Effect to load data with cleanup
  useEffect(() => {
    if (open && auftragId) {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      loadAuftrag(controller.signal);
      
      return () => {
        controller.abort();
      };
    }
  }, [open, auftragId, loadAuftrag]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow animations
      const timeout = setTimeout(() => {
        setAuftrag(null);
        setExtras([]);
        setInitialExtras([]);
        setShowCustomForm(false);
        setCustomExtra({ description: '', quantity: 1, unit: 'Stk.', unit_price: 0 });
        setHasUnsavedChanges(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Track unsaved changes
  useEffect(() => {
    const currentJson = JSON.stringify(extras);
    const initialJson = JSON.stringify(initialExtras);
    setHasUnsavedChanges(currentJson !== initialJson);
  }, [extras, initialExtras]);

  // Warn before closing with unsaved changes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Sie haben ungespeicherte Änderungen. Möchten Sie wirklich schließen?'
      );
      if (!confirmed) return;
    }
    onOpenChange(newOpen);
  }, [hasUnsavedChanges, onOpenChange]);

  // Calculate new totals with safety checks
  const calculations = useMemo(() => {
    if (!auftrag) return { extrasTotal: 0, newSubtotal: 0, newVat: 0, newTotal: 0, baseSubtotal: 0 };

    // Safe number parsing with fallbacks
    const safeSubtotal = auftrag.subtotal ?? 0;
    const safeVatRate = auftrag.vat_rate ?? 8.1; // Swiss default VAT

    const extrasTotal = extras.reduce((sum, e) => {
      const qty = Math.max(0, e.quantity || 0);
      const price = Math.max(0, e.unit_price || 0);
      return sum + (qty * price);
    }, 0);
    
    // Original subtotal from offer items (without old extras)
    const originalExtrasTotal = (auftrag.extra_services || []).reduce(
      (sum, e) => {
        const qty = Math.max(0, e.quantity || 0);
        const price = Math.max(0, e.unit_price || 0);
        return sum + (qty * price);
      }, 0
    );
    
    // CRITICAL: Prevent negative baseSubtotal
    const baseSubtotal = Math.max(0, safeSubtotal - originalExtrasTotal);
    
    const newSubtotal = baseSubtotal + extrasTotal;
    // CRITICAL: Prevent division issues with invalid vat_rate
    const newVat = safeVatRate > 0 ? newSubtotal * (safeVatRate / 100) : 0;
    const newTotal = newSubtotal + newVat;

    return { extrasTotal, newSubtotal, newVat, newTotal, baseSubtotal };
  }, [auftrag, extras]);

  // Helper: Validate and clamp number values
  const safeParseNumber = (value: string | number, min: number, max: number, defaultVal: number): number => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(num)) return defaultVal;
    return Math.max(min, Math.min(max, num));
  };

  const safeParseInt = (value: string | number, min: number, max: number, defaultVal: number): number => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!Number.isFinite(num)) return defaultVal;
    return Math.max(min, Math.min(max, Math.floor(num)));
  };

  // Add preset extra
  const addPresetExtra = (preset: typeof PRESET_EXTRAS[0]) => {
    const newExtra: ExtraService = {
      id: crypto.randomUUID(),
      description: preset.description,
      quantity: 1,
      unit: preset.unit,
      unit_price: Math.max(0, preset.unit_price),
    };
    setExtras([...extras, newExtra]);
  };

  // Add custom extra with validation
  const addCustomExtra = () => {
    const trimmedDescription = customExtra.description?.trim() || '';
    
    if (!trimmedDescription) {
      toast({
        title: 'Beschreibung fehlt',
        description: 'Bitte geben Sie eine Beschreibung ein.',
        variant: 'destructive',
      });
      return;
    }

    // Validate and clamp values
    const validQuantity = safeParseInt(customExtra.quantity || 1, 1, 9999, 1);
    const validPrice = safeParseNumber(customExtra.unit_price || 0, 0, 999999, 0);

    const newExtra: ExtraService = {
      id: crypto.randomUUID(),
      description: trimmedDescription.slice(0, 200), // Limit description length
      quantity: validQuantity,
      unit: customExtra.unit || 'Stk.',
      unit_price: validPrice,
    };

    setExtras([...extras, newExtra]);
    setCustomExtra({ description: '', quantity: 1, unit: 'Stk.', unit_price: 0 });
    setShowCustomForm(false);
  };

  // Update extra with validation
  const _updateExtra = (id: string, field: keyof ExtraService, value: string | number) => {
    setExtras(extras.map(e => {
      if (e.id !== id) return e;
      
      // Validate based on field type
      if (field === 'quantity') {
        return { ...e, quantity: safeParseInt(value, 1, 9999, e.quantity) };
      }
      if (field === 'unit_price') {
        return { ...e, unit_price: safeParseNumber(value, 0, 999999, e.unit_price) };
      }
      if (field === 'description' && typeof value === 'string') {
        return { ...e, description: value.slice(0, 200) };
      }
      
      return { ...e, [field]: value };
    }));
  };

  // Remove extra
  const removeExtra = (id: string) => {
    setExtras(extras.filter(e => e.id !== id));
  };

  // Save extras with debounce protection
  const handleSave = async () => {
    if (!auftrag) return;

    // Debounce: prevent rapid successive saves
    const now = Date.now();
    if (now - lastSaveRef.current < SAVE_DEBOUNCE_MS) {
      toast({
        title: 'Bitte warten',
        description: 'Speichern ist in Kürze wieder möglich.',
      });
      return;
    }
    lastSaveRef.current = now;

    setIsSaving(true);
    try {
      // Validate all extras before saving
      const validatedExtras = extras.map(e => ({
        ...e,
        quantity: Math.max(1, e.quantity || 1),
        unit_price: Math.max(0, e.unit_price || 0),
        description: (e.description || '').slice(0, 200),
      }));

      const { error } = await supabase
        .from('auftraege')
        .update({
          extra_services: validatedExtras,
          subtotal: Math.max(0, calculations.newSubtotal),
          vat_amount: Math.max(0, calculations.newVat),
          total: Math.max(0, calculations.newTotal),
        })
        .eq('id', auftragId);

      if (error) throw error;

      // Update initial extras to match saved state
      setInitialExtras(JSON.parse(JSON.stringify(validatedExtras)));
      setHasUnsavedChanges(false);

      toast({
        title: 'Gespeichert',
        description: `${validatedExtras.length} Extra${validatedExtras.length !== 1 ? 's' : ''} wurden gespeichert.`,
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving extras:', error);
      toast({
        title: 'Fehler',
        description: 'Extras konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-purple-600" />
            Saha Extras
          </DialogTitle>
          {auftrag && (
            <DialogDescription className="text-sm">
              <span className="font-medium">{auftrag.auftrag_nummer}</span>
              <span className="mx-2">•</span>
              <span>{auftrag.customer_name}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 sm:px-6">
              <div className="space-y-4 pb-4">
                {/* Quick Add Presets */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Schnell hinzufügen
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_EXTRAS.map((preset, idx) => {
                      const Icon = preset.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => addPresetExtra(preset)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 ${preset.color}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium text-center leading-tight">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Extra Button */}
                {!showCustomForm && (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setShowCustomForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Eigene Position hinzufügen
                  </Button>
                )}

                {/* Custom Extra Form */}
                {showCustomForm && (
                  <div className="p-3 rounded-lg border-2 border-dashed bg-muted/30 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Beschreibung *</Label>
                      <Input
                        placeholder="z.B. Zusätzliche Kartons"
                        value={customExtra.description}
                        onChange={(e) => setCustomExtra({ ...customExtra, description: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Menge</Label>
                        <Input
                          type="number"
                          min={1}
                          value={customExtra.quantity}
                          onChange={(e) => setCustomExtra({ ...customExtra, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Einheit</Label>
                        <Select
                          value={customExtra.unit}
                          onValueChange={(v) => setCustomExtra({ ...customExtra, unit: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Stk.">Stk.</SelectItem>
                            <SelectItem value="Std.">Std.</SelectItem>
                            <SelectItem value="Pausch.">Pausch.</SelectItem>
                            <SelectItem value="m³">m³</SelectItem>
                            <SelectItem value="km">km</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preis (CHF)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={customExtra.unit_price || ''}
                          onChange={(e) => setCustomExtra({ ...customExtra, unit_price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setShowCustomForm(false);
                          setCustomExtra({ description: '', quantity: 1, unit: 'Stk.', unit_price: 0 });
                        }}
                      >
                        Abbrechen
                      </Button>
                      <Button size="sm" className="flex-1" onClick={addCustomExtra}>
                        <Plus className="h-4 w-4 mr-1" />
                        Hinzufügen
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Current Extras List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">
                      Hinzugefügte Extras ({extras.length})
                    </Label>
                    {extras.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {formatCHF(calculations.extrasTotal)}
                      </Badge>
                    )}
                  </div>

                  {extras.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Noch keine Extras hinzugefügt</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extras.map((extra) => (
                        <div 
                          key={extra.id} 
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{extra.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {extra.quantity} {extra.unit} × {formatCHF(extra.unit_price)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">
                              {formatCHF(extra.quantity * extra.unit_price)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeExtra(extra.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals Summary */}
                {auftrag && (
                  <>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Extras Total:</span>
                        <span className="font-medium text-purple-600">
                          + {formatCHF(calculations.extrasTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Zwischensumme (neu):</span>
                        <span>{formatCHF(calculations.newSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>MwSt. ({auftrag.vat_rate}%):</span>
                        <span>{formatCHF(calculations.newVat)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Neues Total:</span>
                        <span className="text-primary">{formatCHF(calculations.newTotal)}</span>
                      </div>
                      {calculations.newTotal !== auftrag.total && (
                        <p className="text-xs text-muted-foreground text-right">
                          Differenz: {formatCHF(calculations.newTotal - auftrag.total)}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="px-4 py-3 sm:px-6 border-t bg-muted/30">
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Abbrechen
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Speichern
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SahaExtrasModal;
