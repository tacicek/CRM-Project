import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Save,
  Megaphone,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { SharedContent } from "@/types/landingPage";

// CTA content type
type CTAContentType = {
  headline: string;
  subheadline?: string;
  cta_text: string;
  cta_link: string;
  background_color?: string;
};

/**
 * Validate hex color format
 */
function isValidHexColor(color: string): boolean {
  if (!color) return true; // Empty is valid (optional)
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Sanitize hex color input
 */
function sanitizeHexColor(input: string): string {
  // Allow partial input while typing
  if (!input) return '';
  if (input === '#') return '#';
  // Remove invalid characters, keep # at start
  const cleaned = input.replace(/[^#A-Fa-f0-9]/g, '');
  if (!cleaned.startsWith('#')) return '#' + cleaned.slice(0, 6);
  return cleaned.slice(0, 7);
}

interface CTAEditorProps {
  item: SharedContent;
  savingId: string | null;
  deletingId: string | null;
  onSave: (item: SharedContent) => void;
}

export function CTAEditor({ 
  item, 
  savingId, 
  deletingId, 
  onSave 
}: CTAEditorProps) {
  const [localItem, setLocalItem] = useState(item);
  const [hasChanges, setHasChanges] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  
  // Sync with parent prop
  useEffect(() => {
    setLocalItem(item);
    setHasChanges(false);
    setColorError(null);
  }, [item]);
  
  // Safe content access
  const ctaContent: CTAContentType = useMemo(() => {
    const content = localItem.content as Record<string, unknown> | null;
    return {
      headline: (content?.headline as string) || '',
      subheadline: (content?.subheadline as string) || '',
      cta_text: (content?.cta_text as string) || '',
      cta_link: (content?.cta_link as string) || '',
      background_color: (content?.background_color as string) || '#2563eb',
    };
  }, [localItem.content]);

  const updateCta = useCallback((updates: Partial<CTAContentType>) => {
    // Validate hex color if being updated
    if (updates.background_color !== undefined) {
      const sanitized = sanitizeHexColor(updates.background_color);
      updates.background_color = sanitized;
      
      if (sanitized && sanitized.length === 7 && !isValidHexColor(sanitized)) {
        setColorError('Ungültiges Farbformat (#XXXXXX)');
      } else {
        setColorError(null);
      }
    }
    
    setLocalItem(prev => ({
      ...prev,
      content: { ...ctaContent, ...updates },
    }));
    setHasChanges(true);
  }, [ctaContent]);

  const isSaving = savingId === localItem.id;
  
  // Use a safe background color for preview
  const previewBgColor = isValidHexColor(ctaContent.background_color) 
    ? ctaContent.background_color 
    : '#2563eb';

  return (
    <Card className={deletingId === localItem.id ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              {localItem.title || localItem.component_key}
              {hasChanges && (
                <span className="text-xs text-amber-600 font-normal">(ungespeichert)</span>
              )}
            </CardTitle>
            <CardDescription>
              Key: <code className="bg-gray-100 px-2 py-0.5 rounded">{localItem.component_key}</code>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={localItem.is_active}
              onCheckedChange={(v) => {
                setLocalItem(prev => ({ ...prev, is_active: v }));
                setHasChanges(true);
              }}
              aria-label="CTA aktivieren/deaktivieren"
            />
            <span className="text-sm text-gray-500">
              {localItem.is_active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`cta-headline-${localItem.id}`}>Überschrift</Label>
            <Input
              id={`cta-headline-${localItem.id}`}
              value={ctaContent.headline}
              onChange={(e) => updateCta({ headline: e.target.value })}
              placeholder="Bereit für Ihr Projekt?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cta-subheadline-${localItem.id}`}>Unterüberschrift</Label>
            <Input
              id={`cta-subheadline-${localItem.id}`}
              value={ctaContent.subheadline}
              onChange={(e) => updateCta({ subheadline: e.target.value })}
              placeholder="Kostenlose Offerte in 2 Minuten"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`cta-text-${localItem.id}`}>Button Text</Label>
            <Input
              id={`cta-text-${localItem.id}`}
              value={ctaContent.cta_text}
              onChange={(e) => updateCta({ cta_text: e.target.value })}
              placeholder="Jetzt Anfrage stellen"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cta-link-${localItem.id}`}>Button Link</Label>
            <Input
              id={`cta-link-${localItem.id}`}
              value={ctaContent.cta_link}
              onChange={(e) => updateCta({ cta_link: e.target.value })}
              placeholder="/anfrage"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`cta-color-${localItem.id}`}>Hintergrundfarbe</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id={`cta-color-${localItem.id}`}
                value={ctaContent.background_color}
                onChange={(e) => updateCta({ background_color: e.target.value })}
                placeholder="#2563eb"
                maxLength={7}
                aria-invalid={!!colorError}
                aria-describedby={colorError ? `cta-color-error-${localItem.id}` : undefined}
              />
              {colorError && (
                <p id={`cta-color-error-${localItem.id}`} className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  {colorError}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {["#2563eb", "#059669", "#dc2626", "#7c3aed", "#0891b2"].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      ctaContent.background_color === color 
                        ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateCta({ background_color: color })}
                    aria-label={`Farbe ${color} wählen`}
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4">
          <Label className="mb-2 block">Vorschau</Label>
          <div
            className="py-8 px-4 rounded-lg text-white text-center"
            style={{ backgroundColor: previewBgColor }}
          >
            <h3 className="text-2xl font-bold mb-2">{ctaContent.headline || 'Überschrift'}</h3>
            {ctaContent.subheadline && (
              <p className="text-lg opacity-90 mb-4">{ctaContent.subheadline}</p>
            )}
            <span className="inline-block bg-white text-gray-900 px-6 py-2 rounded-lg font-semibold">
              {ctaContent.cta_text || "Button"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            onClick={() => onSave(localItem)} 
            disabled={isSaving || !hasChanges || !!colorError}
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
