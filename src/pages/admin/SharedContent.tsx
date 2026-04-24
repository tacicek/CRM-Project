import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  HelpCircle,
  Megaphone,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { SharedContent } from "@/types/landingPage";
import { FAQEditor } from "@/components/admin/FAQEditor";
import { CTAEditor } from "@/components/admin/CTAEditor";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FAQ_KEY_LENGTH = 50;
const MAX_TITLE_LENGTH = 100;
const RESERVED_KEYS = ['global_faq', 'default', 'system', 'admin'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for SharedContent
 */
function isValidSharedContent(item: unknown): item is SharedContent {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.component_type === 'string' &&
    typeof obj.component_key === 'string'
  );
}

/**
 * Validate FAQ key format
 */
function isValidFaqKey(key: string): { valid: boolean; error?: string } {
  if (!key) return { valid: false, error: 'Key ist erforderlich' };
  if (key.length > MAX_FAQ_KEY_LENGTH) return { valid: false, error: `Max. ${MAX_FAQ_KEY_LENGTH} Zeichen` };
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return { valid: false, error: 'Nur a-z, 0-9, _ (beginnt mit Buchstabe)' };
  if (RESERVED_KEYS.includes(key)) return { valid: false, error: 'Dieser Key ist reserviert' };
  return { valid: true };
}

/**
 * User-friendly error message
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23505') return 'Dieser Key existiert bereits.';
  }
  
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'Dieser Key existiert bereits.';
  }
  if (message.includes('permission') || message.includes('policy')) {
    return 'Sie haben keine Berechtigung für diese Aktion.';
  }
  
  return 'Fehler bei der Aktion. Bitte versuchen Sie es erneut.';
}

export default function SharedContentManager() {
  const [content, setContent] = useState<SharedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("faq");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SharedContent | null>(null);
  const [newFaqDialogOpen, setNewFaqDialogOpen] = useState(false);
  const [newFaqKey, setNewFaqKey] = useState("");
  const [newFaqTitle, setNewFaqTitle] = useState("");
  
  // Granular loading/saving states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Validation errors for new FAQ dialog
  const [newFaqKeyError, setNewFaqKeyError] = useState<string | null>(null);
  
  // Refs for async safety
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchContent = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shared_content")
        .select("*")
        .order("display_order", { ascending: true });

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validContent = (data || []).filter(isValidSharedContent);
      setContent(validContent);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching shared content:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = useCallback(async (item: SharedContent) => {
    // Prevent double save
    if (savingId) return;
    
    setSavingId(item.id);
    try {
      const { error } = await supabase
        .from("shared_content")
        .update({
          title: item.title,
          content: item.content,
          is_active: item.is_active,
        })
        .eq("id", item.id);

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Update local state optimistically
      setContent(prev => prev.map(c => c.id === item.id ? item : c));
      toast.success("Änderungen gespeichert");
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error saving content:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setSavingId(null);
      }
    }
  }, [savingId]);

  const handleDelete = useCallback(async () => {
    if (!itemToDelete || deletingId) return;

    setDeletingId(itemToDelete.id);
    
    // Optimistic update
    const previousContent = [...content];
    setContent(prev => prev.filter(c => c.id !== itemToDelete.id));
    setDeleteDialogOpen(false);
    
    try {
      const { error } = await supabase
        .from("shared_content")
        .delete()
        .eq("id", itemToDelete.id);

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      toast.success("Inhalt gelöscht");
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Rollback on error
      setContent(previousContent);
      console.error("Error deleting content:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setDeletingId(null);
        setItemToDelete(null);
      }
    }
  }, [itemToDelete, deletingId, content]);

  const handleDeleteRequest = useCallback((item: SharedContent) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  }, []);

  const handleCreateFaq = useCallback(async () => {
    if (isCreating) return;
    
    // Validate key
    const key = newFaqKey
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, ''); // Trim underscores
    
    const validation = isValidFaqKey(key);
    if (!validation.valid) {
      setNewFaqKeyError(validation.error || 'Ungültiger Key');
      return;
    }
    
    if (!newFaqTitle || newFaqTitle.length > MAX_TITLE_LENGTH) {
      toast.error(`Titel ist erforderlich (max. ${MAX_TITLE_LENGTH} Zeichen)`);
      return;
    }
    
    setIsCreating(true);
    
    try {
      const { data, error } = await supabase.from("shared_content").insert({
        component_type: "faq",
        component_key: key,
        title: newFaqTitle.trim(),
        content: { items: [] },
        is_active: true,
        display_order: content.filter((c) => c.component_type === "faq").length,
      }).select().single();

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Add to local state without refetch
      if (data && isValidSharedContent(data)) {
        setContent(prev => [...prev, data]);
      }
      
      toast.success("Neue FAQ erstellt");
      setNewFaqDialogOpen(false);
      setNewFaqKey("");
      setNewFaqTitle("");
      setNewFaqKeyError(null);
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      
      console.error("Error creating FAQ:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
      }
    }
  }, [isCreating, newFaqKey, newFaqTitle, content]);

  // Memoized filtered lists
  const faqItems = useMemo(() => 
    content.filter((c) => c.component_type === "faq"),
    [content]
  );
  const ctaItems = useMemo(() => 
    content.filter((c) => c.component_type === "cta_section"),
    [content]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Geteilte Inhalte</h1>
            <p className="text-gray-600 mt-1">
              Verwalten Sie FAQ, CTA-Abschnitte und andere wiederverwendbare Komponenten
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ ({faqItems.length})
            </TabsTrigger>
            <TabsTrigger value="cta" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              CTA Abschnitte ({ctaItems.length})
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNewFaqDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Neue FAQ erstellen
              </Button>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={`skeleton-faq-${i}`}>
                    <div className="p-6">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32 mt-2" />
                    </div>
                    <CardContent>
                      <Skeleton className="h-10 w-full mb-4" />
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : faqItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <HelpCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Keine FAQ vorhanden</p>
                  <Button
                    variant="link"
                    onClick={() => setNewFaqDialogOpen(true)}
                  >
                    Erste FAQ erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {faqItems.map((item) => (
                  <FAQEditor 
                    key={item.id} 
                    item={item} 
                    savingId={savingId}
                    deletingId={deletingId}
                    onSave={handleSave}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* CTA Tab */}
          <TabsContent value="cta" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={`skeleton-cta-${i}`}>
                    <div className="p-6">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32 mt-2" />
                    </div>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : ctaItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Keine CTA-Abschnitte vorhanden</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {ctaItems.map((item) => (
                  <CTAEditor 
                    key={item.id} 
                    item={item}
                    savingId={savingId}
                    deletingId={deletingId}
                    onSave={handleSave}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* New FAQ Dialog */}
        <Dialog 
          open={newFaqDialogOpen} 
          onOpenChange={(open) => {
            setNewFaqDialogOpen(open);
            if (!open) {
              // Reset form when closing
              setNewFaqKey("");
              setNewFaqTitle("");
              setNewFaqKeyError(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue FAQ erstellen</DialogTitle>
              <DialogDescription>
                Erstellen Sie eine neue FAQ-Sammlung für Ihre Landing Pages
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-faq-key">FAQ Key *</Label>
                <Input
                  id="new-faq-key"
                  value={newFaqKey}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    setNewFaqKey(value);
                    // Validate on change
                    const validation = isValidFaqKey(value);
                    setNewFaqKeyError(validation.valid ? null : validation.error || null);
                  }}
                  placeholder="z.B. transport_faq"
                  maxLength={MAX_FAQ_KEY_LENGTH}
                  aria-invalid={!!newFaqKeyError}
                  aria-describedby={newFaqKeyError ? "new-faq-key-error" : "new-faq-key-hint"}
                />
                {newFaqKeyError ? (
                  <p id="new-faq-key-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {newFaqKeyError}
                  </p>
                ) : (
                  <p id="new-faq-key-hint" className="text-xs text-muted-foreground">
                    Technischer Identifier (a-z, 0-9, _) - max. {MAX_FAQ_KEY_LENGTH} Zeichen
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-faq-title">Titel *</Label>
                <Input
                  id="new-faq-title"
                  value={newFaqTitle}
                  onChange={(e) => setNewFaqTitle(e.target.value)}
                  placeholder="z.B. Transport FAQ"
                  maxLength={MAX_TITLE_LENGTH}
                />
                <p className="text-xs text-muted-foreground">
                  {newFaqTitle.length}/{MAX_TITLE_LENGTH} Zeichen
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setNewFaqDialogOpen(false)}
                disabled={isCreating}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleCreateFaq}
                disabled={!newFaqKey || !newFaqTitle || !!newFaqKeyError || isCreating}
                aria-busy={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Erstellen'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Inhalt löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie &quot;{itemToDelete?.title || itemToDelete?.component_key}&quot;
                wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
