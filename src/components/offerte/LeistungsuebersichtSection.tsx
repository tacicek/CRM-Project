import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  ListChecks,
  Package,
  ChevronDown,
  Sparkles,
  Pencil,
  Check,
  Filter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

// Import shared types and constants
import type { ServiceItem, SelectedService } from "@/types/leistungskatalog";
import {
  CATEGORIES,
  PREDEFINED_TEMPLATES,
  VALIDATION,
  getCategoryLabel,
} from "@/constants/service-catalog";
import { useI18n, useT } from "@/i18n/useI18n";

interface LeistungsuebersichtSectionProps {
  companyId: string;
  serviceType: string;
  selectedServices: SelectedService[];
  excludedServices: string[];
  specialNotes: string;
  onSelectedServicesChange: (services: SelectedService[]) => void;
  onExcludedServicesChange: (excluded: string[]) => void;
  onSpecialNotesChange: (notes: string) => void;
}

interface LeistungTemplate {
  id: string;
  name: string;
  description: string | null;
  included_service_ids: string[] | null;
  excluded_services: string[] | null;
  notes: string | null;
}

export function LeistungsuebersichtSection({
  companyId,
  serviceType,
  selectedServices,
  excludedServices,
  specialNotes,
  onSelectedServicesChange,
  onExcludedServicesChange,
  onSpecialNotesChange,
}: LeistungsuebersichtSectionProps) {
  const t = useT();
  const { locale } = useI18n();
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [templates, setTemplates] = useState<LeistungTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [editingQuantity, setEditingQuantity] = useState<string>("");
  const [selectedCategoriesForLoad, setSelectedCategoriesForLoad] = useState<string[]>([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Quick-create services from predefined template
  const createServicesFromTemplate = async (templateKey: string) => {
    const template = PREDEFINED_TEMPLATES[templateKey];
    if (!template || !companyId) return;

    // Check for existing services with same name/category to prevent duplicates
    const existingNames = new Set(availableServices.map(s => `${s.category}:${s.name}`));
    const wouldBeDuplicates = template.services.filter(
      s => existingNames.has(`${s.category}:${s.name}`)
    );
    if (wouldBeDuplicates.length > 0) {
      toast.warning(t("offer.leistung.toast.duplicatesWarning", { count: wouldBeDuplicates.length }));
    }
    const toInsert = template.services.filter(
      s => !existingNames.has(`${s.category}:${s.name}`)
    );
    if (toInsert.length === 0) {
      toast.info(t("offer.leistung.toast.allExist"));
      return;
    }
    
    setIsCreatingTemplate(true);
    try {
      const servicesToInsert = toInsert.map((s, index) => ({
        company_id: companyId,
        service_type: serviceType,
        category: s.category,
        name: s.name,
        description: s.description,
        unit: s.unit,
        default_price: s.default_price,
        is_default_included: s.is_default_included,
        is_optional: s.is_optional ?? false,
        display_order: availableServices.length + index,
      }));

      const { data: insertedServices, error } = await supabase
        .from("company_service_items")
        .insert(servicesToInsert)
        .select();

      if (error) throw error;
      
      setAvailableServices(prev => [...prev, ...(insertedServices || [])]);
      
      // Merge new default-included services with existing selection (don't replace)
      const newDefaults = (insertedServices || []).filter(s => s.is_default_included);
      const merged = [...selectedServices];
      for (const s of newDefaults) {
        if (!merged.find(m => m.id === s.id)) merged.push(s);
      }
      onSelectedServicesChange(merged);

      toast.success(t("offer.leistung.toast.servicesAdded", { count: insertedServices?.length ?? 0 }));
    } catch (error) {
      console.error("Error creating services:", error);
      toast.error(t("offer.leistung.toast.createFailed"));
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const loadAvailableServicesAndTemplates = useCallback(async () => {
    if (!companyId) return;
    
    try {
      // Load services and templates in parallel
      const [servicesRes, templatesRes] = await Promise.all([
        supabase
          .from("company_service_items")
          .select("*")
          .eq("company_id", companyId)
          .eq("service_type", serviceType)
          .order("category")
          .order("display_order"),
        supabase
          .from("leistungsuebersicht_templates")
          .select("id, name, description, included_service_ids, excluded_services, notes")
          .eq("company_id", companyId)
          .eq("service_type", serviceType)
          .eq("is_active", true)
          .order("name")
      ]);

      if (servicesRes.error) throw servicesRes.error;
      setAvailableServices(servicesRes.data || []);
      
      if (!templatesRes.error) {
        setTemplates(templatesRes.data || []);
      }
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId, serviceType]);

  useEffect(() => {
    loadAvailableServicesAndTemplates();
  }, [loadAvailableServicesAndTemplates]);

  // Auto-load default included services on mount if none selected
  useEffect(() => {
    if (!loading && selectedServices.length === 0 && availableServices.length > 0) {
      const defaultServices = availableServices.filter(s => s.is_default_included);
      if (defaultServices.length > 0) {
        onSelectedServicesChange(defaultServices);
      }
    }
  }, [loading, availableServices, onSelectedServicesChange, selectedServices.length]);

  const applyTemplate = (template: LeistungTemplate) => {
    // Get services by IDs from template
    const templateServiceIds = template.included_service_ids || [];
    const templateServices = availableServices.filter(s => templateServiceIds.includes(s.id));
    
    // FIX: Warn if some services from template are no longer available
    const missingCount = templateServiceIds.length - templateServices.length;
    if (missingCount > 0) {
      toast.warning(t("offer.leistung.toast.templateMissing", { count: missingCount }));
    }

    onSelectedServicesChange(templateServices);
    onExcludedServicesChange(template.excluded_services || []);
    onSpecialNotesChange(template.notes || "");

    toast.success(t("offer.leistung.toast.templateApplied", { name: template.name }));
  };

  const loadDefaultServices = () => {
    const defaultServices = availableServices.filter(s => s.is_default_included);
    onSelectedServicesChange(defaultServices);
    toast.success(t("offer.leistung.toast.defaultsLoaded"));
  };

  const openCategoryPicker = () => {
    // Get all unique categories from available services
    const availableCategories = [...new Set(availableServices.map(s => s.category))];
    setSelectedCategoriesForLoad(availableCategories);
    setIsCategoryPickerOpen(true);
  };

  const loadSelectedCategories = () => {
    const selectedFromCategories = availableServices.filter(
      s => selectedCategoriesForLoad.includes(s.category) && s.is_default_included
    );
    onSelectedServicesChange(selectedFromCategories);
    setIsCategoryPickerOpen(false);
    toast.success(t("offer.leistung.toast.categoriesLoaded", {
      count: selectedFromCategories.length,
      categories: selectedCategoriesForLoad.length,
    }));
  };

  const toggleCategoryForLoad = (category: string) => {
    setSelectedCategoriesForLoad(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const startEditingService = (service: SelectedService) => {
    setEditingServiceId(service.id);
    setEditingPrice((service.customPrice ?? service.default_price).toString());
    setEditingQuantity((service.customQuantity ?? 1).toString());
  };

  const saveServiceEdit = (serviceId: string) => {
    // FIX: Ensure price and quantity are not negative using validation constants
    const price = Math.max(VALIDATION.MIN_PRICE, parseFloat(editingPrice) || 0);
    const quantity = Math.max(VALIDATION.MIN_QUANTITY, parseFloat(editingQuantity) || VALIDATION.DEFAULT_QUANTITY);
    
    onSelectedServicesChange(
      selectedServices.map(s =>
        s.id === serviceId
          ? { ...s, customPrice: price, customQuantity: quantity }
          : s
      )
    );
    setEditingServiceId(null);
    toast.success(t("offer.leistung.toast.editSaved"));
  };

  const cancelEdit = () => {
    setEditingServiceId(null);
    setEditingPrice("");
    setEditingQuantity("");
  };

  const addService = (service: ServiceItem) => {
    if (!selectedServices.find(s => s.id === service.id)) {
      onSelectedServicesChange([...selectedServices, service]);
    }
    setIsSelectorOpen(false);
  };

  const removeService = (serviceId: string) => {
    onSelectedServicesChange(selectedServices.filter(s => s.id !== serviceId));
  };

  const addExcludedService = () => {
    onExcludedServicesChange([...excludedServices, ""]);
  };

  const updateExcludedService = (index: number, value: string) => {
    const updated = [...excludedServices];
    updated[index] = value;
    onExcludedServicesChange(updated);
  };

  const removeExcludedService = (index: number) => {
    onExcludedServicesChange(excludedServices.filter((_, i) => i !== index));
  };

  // Memoized filtered services for selector
  const filteredServices = useMemo(() => 
    availableServices.filter(service => {
      const matchesSearch = !searchTerm || 
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
      const notAlreadySelected = !selectedServices.find(s => s.id === service.id);
      return matchesSearch && matchesCategory && notAlreadySelected;
    }),
    [availableServices, searchTerm, selectedCategory, selectedServices]
  );

  // Memoized grouped services by category
  const groupedServices = useMemo(() => 
    filteredServices.reduce((acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    }, {} as Record<string, ServiceItem[]>),
    [filteredServices]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 sm:py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no services in catalog - with quick-start templates
  if (availableServices.length === 0) {
    // Find matching template for current service type
    const matchingTemplate = Object.entries(PREDEFINED_TEMPLATES).find(
      ([, t]) => t.serviceType === serviceType
    );
    
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            {t("offer.leistung.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="py-4 sm:py-6">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base mb-1">{t("offer.leistung.quickstart.title")}</h3>
              <p className="text-muted-foreground text-xs sm:text-sm max-w-xs mx-auto">
                {t("offer.leistung.quickstart.description")}
              </p>
            </div>
            
            {/* Show matching template first if exists */}
            {matchingTemplate && (() => {
              const MatchingIcon = matchingTemplate[1].icon;
              return (
                <div className="mb-4">
                  <Button
                    onClick={() => createServicesFromTemplate(matchingTemplate[0])}
                    disabled={isCreatingTemplate}
                    className={`w-full h-auto p-4 flex items-center gap-3 text-left bg-gradient-to-br ${matchingTemplate[1].color} hover:opacity-90 text-white`}
                  >
                    {isCreatingTemplate ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <MatchingIcon className="w-6 h-6" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{matchingTemplate[1].name}</p>
                      <p className="text-xs opacity-80">
                        {t("offer.leistung.quickstart.countRecommended", { count: matchingTemplate[1].services.length })}
                      </p>
                    </div>
                    <Badge className="bg-white/20 text-white border-0">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t("offer.leistung.quickstart.recommended")}
                    </Badge>
                  </Button>
                </div>
              );
            })()}
            
            {/* Other templates */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(PREDEFINED_TEMPLATES)
                .filter(([key]) => key !== matchingTemplate?.[0])
                .slice(0, 6)
                .map(([key, template]) => {
                  const Icon = template.icon;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      onClick={() => createServicesFromTemplate(key)}
                      disabled={isCreatingTemplate}
                      className="h-auto p-2.5 sm:p-3 flex-col items-start gap-2 text-left hover:border-primary/50"
                    >
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${template.color}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-[10px] sm:text-xs">{template.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("offer.leistung.quickstart.count", { count: template.services.length })}
                        </p>
                      </div>
                    </Button>
                  );
                })}
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              <div className="flex-1 h-px bg-border" />
              <Link to="/firma/leistungskatalog" className="text-xs text-muted-foreground hover:text-foreground">
                {t("offer.leistung.quickstart.advancedSettings")}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                {t("offer.leistung.title")}
              </CardTitle>
              <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                {t("offer.leistung.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Templates Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs h-8 sm:h-9">
                    <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{t("offer.leistung.template.button")}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 sm:w-64">
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs sm:text-sm">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {t("offer.leistung.template.quickSelect")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={loadDefaultServices} className="text-xs sm:text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-green-600" />
                    {t("offer.leistung.template.loadDefaults")}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={openCategoryPicker} className="text-xs sm:text-sm">
                    <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-blue-600" />
                    {t("offer.leistung.template.pickCategories")}
                  </DropdownMenuItem>

                  {templates.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs sm:text-sm">{t("offer.leistung.template.saved")}</DropdownMenuLabel>
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="text-xs sm:text-sm"
                        >
                          <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{template.name}</p>
                            {template.description && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="text-xs sm:text-sm">
                    <Link to="/firma/leistungskatalog" className="cursor-pointer">
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                      {t("offer.leistung.template.manage")}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectorOpen(true)}
                className="text-xs h-8 sm:h-9"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden xs:inline">{t("offer.leistung.addService")}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6 pb-3 sm:pb-6">
          {/* Included Services */}
          <div>
            <h4 className="font-semibold text-green-700 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              {t("offer.leistung.included.title", { count: selectedServices.length })}
            </h4>

            {selectedServices.length === 0 ? (
              <div className="text-center py-4 sm:py-6 border border-dashed rounded-lg">
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {t("offer.leistung.included.empty")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => setIsSelectorOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t("offer.leistung.included.add")}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {selectedServices.map((service) => {
                  const isEditing = editingServiceId === service.id;
                  const displayPrice = service.customPrice ?? service.default_price;
                  const displayQuantity = service.customQuantity ?? 1;
                  
                  return (
                    <div
                      key={service.id}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg transition-colors ${
                        isEditing 
                          ? "bg-blue-50 border-blue-200" 
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isEditing ? "text-blue-600" : "text-green-600"}`} />
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{service.name}</p>
                        {service.description && (
                          <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                            {service.description}
                          </p>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">CHF</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="w-20 h-7 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveServiceEdit(service.id);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                            </div>
                            {service.unit !== "Pauschal" && service.unit !== "Inklusiv" && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Menge</span>
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={editingQuantity}
                                  onChange={(e) => setEditingQuantity(e.target.value)}
                                  className="w-16 h-7 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveServiceEdit(service.id);
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveServiceEdit(service.id)}
                            className="shrink-0 h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEdit}
                            className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div 
                            className="text-right shrink-0 cursor-pointer hover:bg-white/50 rounded px-2 py-1 transition-colors"
                            onClick={() => startEditingService(service)}
                            title={t("offer.leistung.editHint")}
                          >
                            {displayPrice > 0 ? (
                              <>
                                <p className="font-semibold text-xs sm:text-sm flex items-center gap-1">
                                  CHF {(displayPrice * displayQuantity).toFixed(2)}
                                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {displayQuantity !== 1 ? `${displayQuantity}x ${displayPrice.toFixed(2)} ` : ""}{service.unit}
                                </p>
                              </>
                            ) : (
                              <p className="text-[10px] sm:text-xs text-muted-foreground">{service.unit}</p>
                            )}
                          </div>
                          
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditingService(service)}
                              className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-blue-600"
                              title={t("common.edit")}
                            >
                              <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeService(service.id)}
                              className="h-7 w-7 sm:h-8 sm:w-8"
                            >
                              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Excluded Services */}
          <div>
            <h4 className="font-semibold text-red-700 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              {t("offer.leistung.excluded.title", { count: excludedServices.filter(Boolean).length })}
            </h4>

            <div className="space-y-1.5 sm:space-y-2">
              {excludedServices.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
                  <Input
                    value={item}
                    onChange={(e) => updateExcludedService(index, e.target.value)}
                    placeholder={t("offer.leistung.excluded.placeholder")}
                    className="flex-1 bg-background h-8 sm:h-10 text-xs sm:text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExcludedService(index)}
                    className="shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addExcludedService}
                className="w-full text-xs h-8 sm:h-9"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                {t("offer.leistung.excluded.add")}
              </Button>
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <h4 className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm">{t("offer.leistung.notes.title")}</h4>
            <Textarea
              placeholder={t("offer.leistung.notes.placeholder")}
              rows={2}
              value={specialNotes}
              onChange={(e) => onSpecialNotesChange(e.target.value)}
              className="text-xs sm:text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Selector Dialog */}
      <Dialog open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{t("offer.catalogSelector.title")}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t("offer.leistung.selector.description")}
            </DialogDescription>
          </DialogHeader>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              <Input
                placeholder={t("offer.leistung.selector.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-40 h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder={t("offer.leistung.selector.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs sm:text-sm">{t("offer.leistung.selector.allCategories")}</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs sm:text-sm">
                    {getCategoryLabel(cat.value, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Services List */}
          <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mt-3 sm:mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {Object.keys(groupedServices).length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Search className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-xs sm:text-sm">{t("offer.leistung.selector.noResults")}</p>
              </div>
            ) : (
              Object.entries(groupedServices).map(([category, services]) => (
                <div key={category}>
                  <h4 className="font-semibold text-[10px] sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
                    {getCategoryLabel(category, locale)}
                  </h4>
                  
                  <div className="space-y-1.5 sm:space-y-2">
                    {services.map(service => (
                      <div
                        key={service.id}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => addService(service)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <p className="font-medium text-xs sm:text-sm">{service.name}</p>
                            {service.is_default_included && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                {t("offer.leistung.selector.standardBadge")}
                              </Badge>
                            )}
                          </div>
                          {service.description && (
                            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                              {service.description}
                            </p>
                          )}
                        </div>
                        
                        {service.default_price > 0 && (
                          <div className="text-right shrink-0 hidden xs:block">
                            <p className="font-semibold text-xs sm:text-sm">
                              CHF {service.default_price.toFixed(2)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{service.unit}</p>
                          </div>
                        )}
                        
                        <Button size="sm" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="border-t pt-3 sm:pt-4">
            <Button variant="outline" onClick={() => setIsSelectorOpen(false)} size="sm" className="text-xs sm:text-sm">
              {t("offer.leistung.selector.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Picker Dialog */}
      <Dialog open={isCategoryPickerOpen} onOpenChange={setIsCategoryPickerOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              {t("offer.leistung.categoryPicker.title")}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t("offer.leistung.categoryPicker.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {CATEGORIES.map((cat) => {
              const categoryServices = availableServices.filter(s => s.category === cat.value);
              const defaultCount = categoryServices.filter(s => s.is_default_included).length;
              
              if (categoryServices.length === 0) return null;
              
              return (
                <div
                  key={cat.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCategoriesForLoad.includes(cat.value)
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleCategoryForLoad(cat.value)}
                >
                  <Checkbox
                    checked={selectedCategoriesForLoad.includes(cat.value)}
                    onCheckedChange={() => toggleCategoryForLoad(cat.value)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getCategoryLabel(cat.value, locale)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("offer.leistung.categoryPicker.counts", { defaultCount, total: categoryServices.length })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full gap-2">
              <Badge variant="secondary" className="text-xs">
                {t("offer.leistung.categoryPicker.categoriesBadge", { count: selectedCategoriesForLoad.length })}
              </Badge>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCategoryPickerOpen(false)}
                  className="text-xs sm:text-sm"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={loadSelectedCategories}
                  disabled={selectedCategoriesForLoad.length === 0}
                  className="text-xs sm:text-sm"
                >
                  {t("offer.leistung.categoryPicker.loadAction")}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}