import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Edit, Loader2, Plus, RefreshCw, Star, Trash2, AlertTriangle, Search, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// CONSTANTS
// =============================================================================
const MAX_TOKENS = 100000;
const MAX_PRICE = 50000;
const MAX_NAME_LENGTH = 100;
const MAX_BADGE_LENGTH = 50;
const BASE_PRICE_PER_TOKEN = 0.5; // CHF

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sanitize text input to prevent XSS
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Validate if a value is a valid positive number
 */
function isValidPositiveNumber(value: number, max: number = Infinity): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= 0 && value <= max;
}

/**
 * Validate if a value is a valid positive integer
 */
function isValidPositiveInteger(value: number, max: number = Infinity): boolean {
  return isValidPositiveNumber(value, max) && Number.isInteger(value);
}

/**
 * Type guard to validate TokenPackage from Supabase response
 */
function isValidPackage(data: unknown): data is TokenPackage {
  if (!data || typeof data !== 'object') return false;
  const pkg = data as Record<string, unknown>;
  return (
    typeof pkg.id === 'string' &&
    typeof pkg.name === 'string' &&
    typeof pkg.tokens_included === 'number' &&
    typeof pkg.price_chf === 'number'
  );
}

/**
 * Map user-friendly error messages
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'Ein Paket mit diesem Namen existiert bereits.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
  }
  if (message.includes('permission') || message.includes('policy')) {
    return 'Sie haben keine Berechtigung für diese Aktion.';
  }
  
  return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
}

interface TokenPackage {
  id: string;
  name: string;
  tokens_included: number;
  bonus_tokens: number | null;
  price_chf: number;
  is_featured: boolean | null;
  is_active: boolean | null;
  badge_text: string | null;
  sort_order: number | null;
  created_at: string | null;
}

interface PackageFormData {
  name: string;
  tokens_included: number;
  bonus_tokens: number;
  price_chf: number;
  is_featured: boolean;
  is_active: boolean;
  badge_text: string;
  sort_order: number;
}

const defaultFormData: PackageFormData = {
  name: "",
  tokens_included: 100,
  bonus_tokens: 0,
  price_chf: 50,
  is_featured: false,
  is_active: true,
  badge_text: "",
  sort_order: 0,
};

const AdminTokenPackages = () => {
  // Data state
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TokenPackage | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PackageFormData, string>>>({});
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<TokenPackage | null>(null);

  // Stripe recovery state
  const [recoverySessionId, setRecoverySessionId] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    status: "recovered" | "already_processed" | "error";
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);

  // Refs for async safety
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const { toast } = useToast();
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchPackages = useCallback(async () => {
    // Cancel any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("token_packages")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!isMountedRef.current) return;
      
      if (error) throw error;
      
      // Type-safe filtering
      const validPackages = (data || []).filter(isValidPackage);
      setPackages(validPackages);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') return;
      
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const resetForm = useCallback(() => {
    setFormData(defaultFormData);
    setFormErrors({});
    setEditingPackage(null);
  }, []);

  const handleOpenDialog = useCallback((pkg?: TokenPackage) => {
    setFormErrors({});
    
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        tokens_included: pkg.tokens_included,
        bonus_tokens: pkg.bonus_tokens || 0,
        price_chf: Number(pkg.price_chf),
        is_featured: pkg.is_featured || false,
        is_active: pkg.is_active ?? true,
        badge_text: pkg.badge_text || "",
        sort_order: pkg.sort_order || 0,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    // Small delay to allow animation before resetting
    setTimeout(() => {
      if (isMountedRef.current) {
        resetForm();
      }
    }, 150);
  }, [resetForm]);

  /**
   * Validate form data before submission
   */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PackageFormData, string>> = {};
    
    // Name validation
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = 'Paketname ist erforderlich.';
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.name = `Paketname darf maximal ${MAX_NAME_LENGTH} Zeichen haben.`;
    }
    
    // Tokens validation — must be at least 1
    if (!isValidPositiveInteger(formData.tokens_included, MAX_TOKENS) || formData.tokens_included < 1) {
      errors.tokens_included = `Tokens muss zwischen 1 und ${MAX_TOKENS.toLocaleString()} sein.`;
    }
    
    // Bonus tokens validation
    if (!isValidPositiveInteger(formData.bonus_tokens, MAX_TOKENS)) {
      errors.bonus_tokens = `Bonus Tokens muss zwischen 0 und ${MAX_TOKENS.toLocaleString()} sein.`;
    }
    
    // Price validation
    if (!isValidPositiveNumber(formData.price_chf, MAX_PRICE)) {
      errors.price_chf = `Preis muss zwischen 0 und ${MAX_PRICE.toLocaleString()} CHF sein.`;
    } else if (formData.price_chf <= 0) {
      errors.price_chf = 'Preis muss grösser als 0 sein.';
    }
    
    // Badge text validation
    if (formData.badge_text && formData.badge_text.length > MAX_BADGE_LENGTH) {
      errors.badge_text = `Badge Text darf maximal ${MAX_BADGE_LENGTH} Zeichen haben.`;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Validate form
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      // Sanitize and prepare data
      const packageData = {
        name: sanitizeText(formData.name),
        tokens_included: Math.max(1, Math.floor(formData.tokens_included)),
        bonus_tokens: Math.max(0, Math.floor(formData.bonus_tokens)),
        price_chf: Math.max(0.01, Number(formData.price_chf.toFixed(2))),
        is_featured: formData.is_featured,
        is_active: formData.is_active,
        badge_text: formData.badge_text ? sanitizeText(formData.badge_text) : null,
        sort_order: Math.floor(formData.sort_order),
      };

      if (editingPackage) {
        const { error } = await supabase
          .from("token_packages")
          .update(packageData)
          .eq("id", editingPackage.id);

        if (!isMountedRef.current) return;
        if (error) throw error;
        
        // Optimistic update
        setPackages(prev => prev.map(pkg => 
          pkg.id === editingPackage.id 
            ? { ...pkg, ...packageData } 
            : pkg
        ));
        
        toast({
          title: "Erfolg",
          description: "Token-Paket wurde aktualisiert.",
        });
      } else {
        const { data, error } = await supabase
          .from("token_packages")
          .insert(packageData)
          .select()
          .single();

        if (!isMountedRef.current) return;
        if (error) throw error;
        
        // Add new package to list
        if (data && isValidPackage(data)) {
          setPackages(prev => [...prev, data].sort((a, b) => 
            (a.sort_order || 0) - (b.sort_order || 0)
          ));
        }
        
        toast({
          title: "Erfolg",
          description: "Token-Paket wurde erstellt.",
        });
      }

      handleCloseDialog();
    } catch (error) {
      if (!isMountedRef.current) return;
      
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validateForm, formData, editingPackage, handleCloseDialog, toast]);

  const openDeleteDialog = useCallback((pkg: TokenPackage) => {
    setPackageToDelete(pkg);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setPackageToDelete(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!packageToDelete) return;
    
    // Prevent double delete
    if (deletingPackageId) return;
    
    const pkgId = packageToDelete.id;
    setDeletingPackageId(pkgId);

    try {
      // Optimistic update - remove from list immediately
      const previousPackages = [...packages];
      setPackages(prev => prev.filter(p => p.id !== pkgId));
      
      const { error } = await supabase
        .from("token_packages")
        .delete()
        .eq("id", pkgId);

      if (!isMountedRef.current) return;
      
      if (error) {
        // Rollback on error
        setPackages(previousPackages);
        throw error;
      }
      
      toast({
        title: "Erfolg",
        description: "Token-Paket wurde gelöscht.",
      });
      
      closeDeleteDialog();
    } catch (error) {
      if (!isMountedRef.current) return;
      
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setDeletingPackageId(null);
      }
    }
  }, [packageToDelete, deletingPackageId, packages, closeDeleteDialog, toast]);

  const handleStripeRecovery = useCallback(async () => {
    const sessionId = recoverySessionId.trim();
    if (!sessionId) return;

    setIsRecovering(true);
    setRecoveryResult(null);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("recover-stripe-purchase", {
        body: { checkout_session_id: sessionId },
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });

      if (error) throw error;

      const result = data as {
        status: "recovered" | "already_processed";
        message: string;
        company_name?: string;
        tokens_credited?: number;
        previous_balance?: number;
        new_balance?: number;
        balance_after?: number;
        amount_paid?: number;
        currency?: string;
        transaction_id?: string;
        processed_at?: string;
      };

      setRecoveryResult({
        status: result.status,
        message: result.message,
        details: result as unknown as Record<string, unknown>,
      });

      if (result.status === "recovered") {
        toast({ title: "Token-Wiederherstellung erfolgreich", description: result.message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRecoveryResult({ status: "error", message: msg });
      toast({ title: "Fehler bei Wiederherstellung", description: msg, variant: "destructive" });
    } finally {
      setIsRecovering(false);
    }
  }, [recoverySessionId, toast]);

  const calculateSavings = useCallback((tokens: number, bonus: number, price: number): number => {
    // Guard against invalid inputs
    if (!isValidPositiveNumber(tokens) || !isValidPositiveNumber(bonus) || !isValidPositiveNumber(price)) {
      return 0;
    }
    
    const totalTokens = tokens + bonus;
    
    // Guard against division by zero
    if (totalTokens <= 0 || price <= 0) {
      return 0;
    }
    
    const pricePerToken = price / totalTokens;
    const savings = ((BASE_PRICE_PER_TOKEN - pricePerToken) / BASE_PRICE_PER_TOKEN) * 100;
    
    // Return 0 for negative savings (price is higher than base)
    return savings > 0 ? Math.round(savings) : 0;
  }, []);

  const calculatePricePerToken = useCallback((tokens: number, bonus: number, price: number): string => {
    const totalTokens = tokens + bonus;
    if (totalTokens <= 0 || price <= 0) return '-';
    return formatPrice(price / totalTokens);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(price);
  };

  return (
    <>
      <Helmet>
        <title>Token-Pakete | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Token-Pakete</h2>
              <p className="text-muted-foreground text-sm">Verwalten Sie die verfügbaren Token-Pakete</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchPackages} 
                disabled={isLoading}
                aria-label="Pakete aktualisieren"
                aria-busy={isLoading}
              >
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Aktualisieren</span>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) {
                  handleCloseDialog();
                } else {
                  setIsDialogOpen(true);
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()} aria-label="Neues Token-Paket erstellen">
                    <Plus className="w-4 h-4 mr-2" />
                    Neues Paket
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]" aria-describedby="package-dialog-description">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPackage ? "Paket bearbeiten" : "Neues Token-Paket"}
                    </DialogTitle>
                    <DialogDescription id="package-dialog-description">
                      {editingPackage 
                        ? `Bearbeiten Sie das Token-Paket "${editingPackage.name}".`
                        : "Erstellen Sie ein neues Token-Paket für Ihre Kunden."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Package Name */}
                      <div className="col-span-2">
                        <Label htmlFor="name">Paketname *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="z.B. Starter-Paket"
                          maxLength={MAX_NAME_LENGTH}
                          aria-invalid={!!formErrors.name}
                          aria-describedby={formErrors.name ? "name-error" : undefined}
                        />
                        {formErrors.name && (
                          <p id="name-error" className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors.name}
                          </p>
                        )}
                      </div>
                      
                      {/* Tokens */}
                      <div>
                        <Label htmlFor="tokens">Tokens *</Label>
                        <Input
                          id="tokens"
                          type="number"
                          value={formData.tokens_included}
                          onChange={(e) => setFormData({ ...formData, tokens_included: parseInt(e.target.value) || 0 })}
                          min={1}
                          max={MAX_TOKENS}
                          aria-invalid={!!formErrors.tokens_included}
                          aria-describedby={formErrors.tokens_included ? "tokens-error" : undefined}
                        />
                        {formErrors.tokens_included && (
                          <p id="tokens-error" className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors.tokens_included}
                          </p>
                        )}
                      </div>
                      
                      {/* Bonus Tokens */}
                      <div>
                        <Label htmlFor="bonus">Bonus Tokens</Label>
                        <Input
                          id="bonus"
                          type="number"
                          value={formData.bonus_tokens}
                          onChange={(e) => setFormData({ ...formData, bonus_tokens: parseInt(e.target.value) || 0 })}
                          min={0}
                          max={MAX_TOKENS}
                          aria-invalid={!!formErrors.bonus_tokens}
                          aria-describedby={formErrors.bonus_tokens ? "bonus-error" : undefined}
                        />
                        {formErrors.bonus_tokens && (
                          <p id="bonus-error" className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors.bonus_tokens}
                          </p>
                        )}
                      </div>
                      
                      {/* Price */}
                      <div>
                        <Label htmlFor="price">Preis (CHF) *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price_chf}
                          onChange={(e) => setFormData({ ...formData, price_chf: parseFloat(e.target.value) || 0 })}
                          min={0.01}
                          max={MAX_PRICE}
                          aria-invalid={!!formErrors.price_chf}
                          aria-describedby={formErrors.price_chf ? "price-error" : undefined}
                        />
                        {formErrors.price_chf && (
                          <p id="price-error" className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors.price_chf}
                          </p>
                        )}
                      </div>
                      
                      {/* Sort Order */}
                      <div>
                        <Label htmlFor="sort">Sortierung</Label>
                        <Input
                          id="sort"
                          type="number"
                          value={formData.sort_order}
                          onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                          aria-describedby="sort-hint"
                        />
                        <p id="sort-hint" className="text-xs text-muted-foreground mt-1">
                          Kleinere Zahlen werden zuerst angezeigt
                        </p>
                      </div>
                      
                      {/* Badge Text */}
                      <div className="col-span-2">
                        <Label htmlFor="badge">Badge Text (optional)</Label>
                        <Input
                          id="badge"
                          value={formData.badge_text}
                          onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                          placeholder="z.B. Beliebt, Spare 20%"
                          maxLength={MAX_BADGE_LENGTH}
                          aria-invalid={!!formErrors.badge_text}
                          aria-describedby={formErrors.badge_text ? "badge-error" : "badge-hint"}
                        />
                        {formErrors.badge_text ? (
                          <p id="badge-error" className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors.badge_text}
                          </p>
                        ) : (
                          <p id="badge-hint" className="text-xs text-muted-foreground mt-1">
                            Wird als Abzeichen neben dem Paketnamen angezeigt
                          </p>
                        )}
                      </div>
                      
                      {/* Switches */}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="featured">Hervorgehoben</Label>
                        <Switch
                          id="featured"
                          checked={formData.is_featured}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                          aria-describedby="featured-hint"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="active">Aktiv</Label>
                        <Switch
                          id="active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                          aria-describedby="active-hint"
                        />
                      </div>
                    </div>
                    
                    {/* Preview */}
                    {formData.tokens_included > 0 && formData.price_chf > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="font-medium mb-1">Vorschau:</p>
                        <p>
                          Gesamt: {formData.tokens_included + formData.bonus_tokens} Tokens für {formatPrice(formData.price_chf)}
                        </p>
                        <p className="text-muted-foreground">
                          Preis pro Token: {calculatePricePerToken(formData.tokens_included, formData.bonus_tokens, formData.price_chf)}
                          {calculateSavings(formData.tokens_included, formData.bonus_tokens, formData.price_chf) > 0 && (
                            <span className="text-accent ml-2">
                              ({calculateSavings(formData.tokens_included, formData.bonus_tokens, formData.price_chf)}% Ersparnis)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseDialog}
                        disabled={isSubmitting}
                      >
                        Abbrechen
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                      >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingPackage ? "Speichern" : "Erstellen"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Alle Pakete ({packages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Noch keine Token-Pakete vorhanden
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead className="hidden sm:table-cell">Bonus</TableHead>
                        <TableHead>Preis</TableHead>
                        <TableHead className="hidden md:table-cell">Pro Token</TableHead>
                        <TableHead className="hidden md:table-cell">Ersparnis</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((pkg) => {
                        const savings = calculateSavings(
                          pkg.tokens_included,
                          pkg.bonus_tokens || 0,
                          Number(pkg.price_chf)
                        );
                        const isDeleting = deletingPackageId === pkg.id;
                        
                        return (
                          <TableRow 
                            key={pkg.id} 
                            className={isDeleting ? "opacity-50" : undefined}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span 
                                  className="font-medium max-w-[120px] sm:max-w-[200px] truncate" 
                                  title={pkg.name}
                                >
                                  {pkg.name}
                                </span>
                                {pkg.is_featured && (
                                  <Star 
                                    className="w-4 h-4 text-warning fill-warning flex-shrink-0" 
                                    aria-label="Hervorgehoben"
                                  />
                                )}
                                {pkg.badge_text && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs flex-shrink-0"
                                    title={pkg.badge_text}
                                  >
                                    {pkg.badge_text.length > 15 
                                      ? `${pkg.badge_text.slice(0, 15)}...` 
                                      : pkg.badge_text
                                    }
                                  </Badge>
                                )}
                                {/* Status badge visible only on mobile */}
                                <span className="sm:hidden">
                                  {pkg.is_active ? (
                                    <Badge className="bg-accent/10 text-accent border-accent/30 text-[10px] px-1">Aktiv</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground text-[10px] px-1">Inaktiv</Badge>
                                  )}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{pkg.tokens_included.toLocaleString()}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {pkg.bonus_tokens ? (
                                <span className="text-accent">+{pkg.bonus_tokens.toLocaleString()}</span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatPrice(Number(pkg.price_chf))}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {calculatePricePerToken(
                                pkg.tokens_included,
                                pkg.bonus_tokens || 0,
                                Number(pkg.price_chf)
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {savings > 0 ? (
                                <Badge variant="outline" className="bg-accent/10 text-accent">
                                  {savings}% sparen
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {pkg.is_active ? (
                                <Badge className="bg-accent/10 text-accent border-accent/30">
                                  Aktiv
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Inaktiv
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(pkg)}
                                  disabled={isDeleting}
                                  aria-label={`${pkg.name} bearbeiten`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(pkg)}
                                  disabled={isDeleting}
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`${pkg.name} löschen`}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Stripe Recovery Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Stripe Zahlung Wiederherstellen
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Wenn eine Zahlung erfolgreich war, aber Tokens nicht gutgeschrieben wurden, können Sie die Transaktion hier manuell verarbeiten.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="recovery-session-id">Stripe Checkout Session ID</Label>
                <Input
                  id="recovery-session-id"
                  placeholder="cs_live_... oder cs_test_..."
                  value={recoverySessionId}
                  onChange={(e) => {
                    setRecoverySessionId(e.target.value);
                    setRecoveryResult(null);
                  }}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Die Session ID finden Sie im Stripe Dashboard unter Payments → Checkout Sessions.
                </p>
              </div>
              <Button
                onClick={handleStripeRecovery}
                disabled={!recoverySessionId.trim() || isRecovering}
                className="shrink-0"
              >
                {isRecovering ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Prüfen...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" />Wiederherstellen</>
                )}
              </Button>
            </div>

            {recoveryResult && (
              <div className={`mt-4 p-4 rounded-lg border ${
                recoveryResult.status === "recovered"
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : recoveryResult.status === "already_processed"
                  ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              }`}>
                <div className="flex items-start gap-3">
                  {recoveryResult.status === "recovered" && (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  )}
                  {recoveryResult.status === "already_processed" && (
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  )}
                  {recoveryResult.status === "error" && (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${
                      recoveryResult.status === "recovered" ? "text-emerald-800 dark:text-emerald-200"
                      : recoveryResult.status === "already_processed" ? "text-blue-800 dark:text-blue-200"
                      : "text-red-800 dark:text-red-200"
                    }`}>
                      {recoveryResult.status === "recovered" && "Erfolgreich wiederhergestellt"}
                      {recoveryResult.status === "already_processed" && "Bereits verarbeitet"}
                      {recoveryResult.status === "error" && "Fehler"}
                    </p>
                    <p className="text-sm mt-1 text-muted-foreground">{recoveryResult.message}</p>
                    {recoveryResult.details && recoveryResult.status !== "error" && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {recoveryResult.details.company_name && (
                          <><span className="font-medium">Firma:</span> <span>{String(recoveryResult.details.company_name)}</span></>
                        )}
                        {recoveryResult.details.tokens_credited && (
                          <><span className="font-medium">Tokens:</span> <span>+{String(recoveryResult.details.tokens_credited)}</span></>
                        )}
                        {recoveryResult.details.previous_balance !== undefined && (
                          <><span className="font-medium">Vorher:</span> <span>{String(recoveryResult.details.previous_balance)}</span></>
                        )}
                        {(recoveryResult.details.new_balance ?? recoveryResult.details.balance_after) !== undefined && (
                          <><span className="font-medium">Nachher:</span> <span>{String(recoveryResult.details.new_balance ?? recoveryResult.details.balance_after)}</span></>
                        )}
                        {recoveryResult.details.amount_paid !== undefined && (
                          <><span className="font-medium">Betrag:</span> <span>{String(recoveryResult.details.amount_paid)} {String(recoveryResult.details.currency ?? "CHF")}</span></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Paket löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                {packageToDelete && (
                  <>
                    Sind Sie sicher, dass Sie das Paket <strong>"{packageToDelete.name}"</strong> löschen möchten?
                    <br /><br />
                    <span className="text-destructive">
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeDeleteDialog} disabled={!!deletingPackageId}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={!!deletingPackageId}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingPackageId ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Löschen...
                  </>
                ) : (
                  "Löschen"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </>
  );
};

export default AdminTokenPackages;
