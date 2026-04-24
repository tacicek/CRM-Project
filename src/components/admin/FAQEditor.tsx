import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Trash2,
  Save,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { SharedContent, FAQItem, FAQContent } from "@/types/landingPage";

const MAX_TITLE_LENGTH = 100;

/**
 * Type guard for FAQContent
 */
function isValidFAQContent(content: unknown): content is FAQContent {
  if (!content || typeof content !== 'object') return false;
  const obj = content as Record<string, unknown>;
  return Array.isArray(obj.items);
}

/**
 * Generate stable key for FAQ items
 */
function generateFaqItemKey(item: FAQItem, index: number): string {
  const questionHash = item.question ? item.question.slice(0, 20).replace(/\s/g, '-') : '';
  return `faq-${index}-${questionHash}-${item.order}`;
}

interface FAQEditorProps {
  item: SharedContent;
  savingId: string | null;
  deletingId: string | null;
  onSave: (item: SharedContent) => void;
  onDelete: (item: SharedContent) => void;
}

export function FAQEditor({ 
  item, 
  savingId, 
  deletingId, 
  onSave, 
  onDelete 
}: FAQEditorProps) {
  const [localItem, setLocalItem] = useState(item);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Sync with parent prop when item changes (e.g., after save from another tab)
  useEffect(() => {
    setLocalItem(item);
    setHasChanges(false);
  }, [item]);
  
  // Safe content access with type guard
  const faqContent: FAQContent = useMemo(() => {
    if (isValidFAQContent(localItem.content)) {
      return localItem.content;
    }
    return { items: [] };
  }, [localItem.content]);

  const updateLocalItem = useCallback((updates: Partial<SharedContent>) => {
    setLocalItem(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  const addFaqQuestion = useCallback(() => {
    const newItems: FAQItem[] = [
      ...faqContent.items,
      {
        question: "",
        answer: "",
        category: "",
        order: faqContent.items.length,
      },
    ];
    updateLocalItem({ content: { ...faqContent, items: newItems } });
  }, [faqContent, updateLocalItem]);

  const updateFaqQuestion = useCallback((index: number, updates: Partial<FAQItem>) => {
    const newItems = [...faqContent.items];
    newItems[index] = { ...newItems[index], ...updates };
    updateLocalItem({ content: { ...faqContent, items: newItems } });
  }, [faqContent, updateLocalItem]);

  const removeFaqQuestion = useCallback((index: number) => {
    const newItems = faqContent.items
      .filter((_, i) => i !== index)
      .map((faqItem, i) => ({ ...faqItem, order: i }));
    updateLocalItem({ content: { ...faqContent, items: newItems } });
  }, [faqContent, updateLocalItem]);
  
  const moveFaqQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    const newItems = [...faqContent.items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    // Update order values
    newItems.forEach((faqItem, i) => { faqItem.order = i; });
    updateLocalItem({ content: { ...faqContent, items: newItems } });
  }, [faqContent, updateLocalItem]);

  const isSaving = savingId === localItem.id;

  return (
    <Card className={deletingId === localItem.id ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
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
              onCheckedChange={(v) => updateLocalItem({ is_active: v })}
              aria-label="FAQ aktivieren/deaktivieren"
            />
            <span className="text-sm text-gray-500">
              {localItem.is_active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`faq-title-${localItem.id}`}>Titel</Label>
          <Input
            id={`faq-title-${localItem.id}`}
            value={localItem.title || ""}
            onChange={(e) => updateLocalItem({ title: e.target.value })}
            placeholder="FAQ Titel"
            maxLength={MAX_TITLE_LENGTH}
            aria-describedby={`faq-title-hint-${localItem.id}`}
          />
          <p id={`faq-title-hint-${localItem.id}`} className="text-xs text-muted-foreground">
            {(localItem.title?.length || 0)}/{MAX_TITLE_LENGTH} Zeichen
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label>FAQ Fragen ({faqContent.items.length})</Label>
          <Button variant="outline" size="sm" onClick={addFaqQuestion}>
            <Plus className="w-4 h-4 mr-1" />
            Frage hinzufügen
          </Button>
        </div>

        {faqContent.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Noch keine Fragen</p>
            <Button variant="link" size="sm" onClick={addFaqQuestion}>
              Erste Frage hinzufügen
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {faqContent.items.map((faq, index) => (
              <AccordionItem key={generateFaqItemKey(faq, index)} value={`faq-${index}`}>
                <div className="flex items-center">
                  {/* Move buttons outside AccordionTrigger to avoid nested button */}
                  <div className="flex flex-col gap-0.5 mr-2">
                    <button
                      type="button"
                      className="h-5 w-5 rounded hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"
                      onClick={() => moveFaqQuestion(index, 'up')}
                      disabled={index === 0}
                      aria-label="Nach oben verschieben"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className="h-5 w-5 rounded hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"
                      onClick={() => moveFaqQuestion(index, 'down')}
                      disabled={index === faqContent.items.length - 1}
                      aria-label="Nach unten verschieben"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <AccordionTrigger className="hover:no-underline flex-1">
                    <span className="text-sm font-medium truncate text-left">
                      {faq.question || `Frage ${index + 1}`}
                    </span>
                  </AccordionTrigger>
                </div>
                <AccordionContent>
                  <div className="space-y-4 p-2">
                    <div className="space-y-2">
                      <Label htmlFor={`faq-q-${localItem.id}-${index}`}>Frage</Label>
                      <Input
                        id={`faq-q-${localItem.id}-${index}`}
                        value={faq.question}
                        onChange={(e) =>
                          updateFaqQuestion(index, { question: e.target.value })
                        }
                        placeholder="Wie funktioniert...?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`faq-a-${localItem.id}-${index}`}>
                        Antwort (HTML)
                      </Label>
                      <Textarea
                        id={`faq-a-${localItem.id}-${index}`}
                        value={faq.answer}
                        onChange={(e) =>
                          updateFaqQuestion(index, { answer: e.target.value })
                        }
                        placeholder="<p>Die Antwort...</p>"
                        rows={4}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Erlaubt: p, strong, em, ul, ol, li, a
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1 mr-4">
                        <Label htmlFor={`faq-cat-${localItem.id}-${index}`} className="text-xs">
                          Kategorie (optional)
                        </Label>
                        <Input
                          id={`faq-cat-${localItem.id}-${index}`}
                          value={faq.category || ""}
                          onChange={(e) =>
                            updateFaqQuestion(index, { category: e.target.value })
                          }
                          placeholder="general"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeFaqQuestion(index)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Entfernen
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(localItem)}
            disabled={isSaving}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Löschen
          </Button>
          <Button 
            onClick={() => onSave(localItem)} 
            disabled={isSaving || !hasChanges}
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
