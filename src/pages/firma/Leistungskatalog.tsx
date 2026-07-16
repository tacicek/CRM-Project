import { useState, useEffect, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Package,
  Sparkles,
  Loader2,
  CheckCircle2,
  Search,
  Layers,
  Tag,
  Check,
  X,
  Languages,
} from "lucide-react";

// Import shared types and constants
import type { ServiceItem, LeistungTemplate } from "@/types/leistungskatalog";
import { ContentTranslationDialog } from "@/components/firma/ContentTranslationDialog";
import { asTranslations } from "@/i18n/localizedField";
import { useI18n } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import {
  SERVICE_TYPES,
  CATEGORIES,
  UNITS,
  PREDEFINED_TEMPLATES,
  VALIDATION,
  getServiceTypeConfig,
  getCategoryLabel,
  getCategoryIcon,
  getServiceTypeLabel,
  getUnitLabel,
  getPackageName,
} from "@/constants/service-catalog";

export default function FirmaLeistungskatalog() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [templates, setTemplates] = useState<LeistungTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState("umzug");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<LeistungTemplate | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditPrice, setInlineEditPrice] = useState<string>("");
  const [inlineEditName, setInlineEditName] = useState<string>("");
  const [inlineSaving, setInlineSaving] = useState(false);
  // Track pending operations to prevent race conditions
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    service_type: "umzug",
    category: "transport",
    name: "",
    description: "",
    unit: "Pauschal",
    default_price: 0,
    is_default_included: false,
    is_optional: true,
  });

  const [templateFormData, setTemplateFormData] = useState({
    service_type: "umzug",
    name: "",
    description: "",
    included_service_ids: [] as string[],
    excluded_services: [] as string[],
    notes: "",
  });

  // FIX: Added isMounted flag to prevent memory leaks on unmount
  // Reference-stable so it can be an honest useEffect dependency below. Its only
  // non-stable closure is `t` (i18n translator, memoized per locale) — state setters
  // and the supabase client are stable — so this reloads on user/locale change, not
  // on every render.
  const loadServices = useCallback(async (companyId: string, isInitialLoad = false) => {
    const [servicesRes, templatesRes] = await Promise.all([
      supabase
        .from("company_service_items")
        .select("*")
        .eq("company_id", companyId)
        .order("service_type")
        .order("category")
        .order("display_order"),
      supabase
        .from("leistungsuebersicht_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("service_type")
        .order("name")
    ]);

    if (servicesRes.error) {
      console.error("Error loading services:", servicesRes.error);
      toast.error(t("catalog.toast.loadServicesFailed"));
      return;
    }

    setServices(servicesRes.data || []);
    setTemplates(templatesRes.data || []);

    // Only expand all categories on initial load — preserve user's collapsed state on reloads
    if (isInitialLoad) {
      const categories = [...new Set((servicesRes.data || []).map(s => s.category))];
      setExpandedCategories(categories);
    } else {
      // Expand any newly added categories that don't yet appear in expandedCategories
      setExpandedCategories(prev => {
        const newCategories = [...new Set((servicesRes.data || []).map(s => s.category))];
        const added = newCategories.filter(c => !prev.includes(c));
        return added.length > 0 ? [...prev, ...added] : prev;
      });
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }
      
      try {
        const company = await fetchSingleCompanyForUser<{ id: string }>({
          userId: user.id,
          userEmail: user.email,
          select: "id",
        });
        
        if (isMounted && company) {
          setCompanyId(company.id);
          await loadServices(company.id, true);
        }
      } catch (error) {
        console.error("Error loading company:", error);
        if (isMounted) {
          toast.error(t("catalog.toast.loadCompanyFailed"));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    loadData();

    return () => {
      isMounted = false;
    };
  }, [user, t, loadServices]);
  
  // FIX: Cancel inline edit when tab changes to prevent editing hidden items
  useEffect(() => {
    cancelInlineEdit();
  }, [selectedServiceType]);

  // Debounce search term to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, VALIDATION.SEARCH_DEBOUNCE_MS);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const openAddModal = () => {
    setEditingService(null);
    // "alle" is a view filter, not a valid DB service_type — fall back to first real type
    const serviceType = selectedServiceType === "alle" 
      ? SERVICE_TYPES[0].value 
      : selectedServiceType;
    setFormData({
      service_type: serviceType,
      category: "transport",
      name: "",
      description: "",
      unit: "Pauschal",
      default_price: 0,
      is_default_included: false,
      is_optional: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setFormData({
      service_type: service.service_type,
      category: service.category,
      name: service.name,
      description: service.description || "",
      unit: service.unit,
      default_price: service.default_price,
      is_default_included: service.is_default_included,
      is_optional: service.is_optional,
    });
    setIsModalOpen(true);
  };

  // Inline editing functions
  const startInlineEdit = (service: ServiceItem) => {
    setInlineEditingId(service.id);
    setInlineEditPrice(service.default_price.toString());
    setInlineEditName(service.name);
  };

  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditPrice("");
    setInlineEditName("");
  };

  const saveInlineEdit = async (serviceId: string) => {
    if (inlineSaving) return;

    // FIX: Ensure price is not negative
    const rawPrice = parseFloat(inlineEditPrice) || 0;
    const price = Math.max(0, rawPrice);
    const name = inlineEditName.trim();
    
    if (!name) {
      toast.error(t("catalog.toast.nameRequired"));
      return;
    }

    // FIX: Warn user if negative price was corrected
    if (rawPrice < 0) {
      toast.warning(t("catalog.toast.negativePrice"));
    }

    setInlineSaving(true);
    try {
      const { error } = await supabase
        .from("company_service_items")
        .update({
          default_price: price,
          name: name,
        })
        .eq("id", serviceId);

      if (error) throw error;
      
      // Update local state without full reload to preserve expanded state
      setServices(prev => prev.map(s => 
        s.id === serviceId 
          ? { ...s, default_price: price, name: name }
          : s
      ));
      
      toast.success(t("catalog.toast.changesSaved"));
      cancelInlineEdit();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error(t("catalog.toast.saveFailed"));
    } finally {
      setInlineSaving(false);
    }
  };

  const handleSave = async () => {
    if (!companyId || !formData.name.trim()) {
      toast.error(t("catalog.toast.enterName"));
      return;
    }

    setSaving(true);
    try {
      if (editingService) {
        const { error } = await supabase
          .from("company_service_items")
          .update({
            service_type: formData.service_type,
            category: formData.category,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            unit: formData.unit,
            default_price: formData.default_price,
            is_default_included: formData.is_default_included,
            is_optional: formData.is_optional,
          })
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success(t("catalog.toast.serviceUpdated"));
      } else {
        const maxOrder = services
          .filter(s => s.service_type === formData.service_type && s.category === formData.category)
          .reduce((max, s) => Math.max(max, s.display_order), -1);

        const { error } = await supabase
          .from("company_service_items")
          .insert({
            company_id: companyId,
            service_type: formData.service_type,
            category: formData.category,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            unit: formData.unit,
            default_price: formData.default_price,
            is_default_included: formData.is_default_included,
            is_optional: formData.is_optional,
            display_order: maxOrder + 1,
          });

        if (error) throw error;
        toast.success(t("catalog.toast.serviceAdded"));
      }

      setIsModalOpen(false);
      await loadServices(companyId);
    } catch (error) {
      console.error("Error saving service:", error);
      toast.error(t("catalog.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    // FIX: Prevent concurrent operations on the same service
    if (saving || pendingOperations.has(serviceId)) return;
    if (!confirm(t("catalog.confirm.deleteService"))) return;

    setPendingOperations(prev => new Set(prev).add(serviceId));
    try {
      const { error } = await supabase
        .from("company_service_items")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      toast.success(t("catalog.toast.serviceDeleted"));
      if (companyId) await loadServices(companyId);
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error(t("catalog.toast.deleteFailed"));
    } finally {
      setPendingOperations(prev => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    }
  };

  const loadTemplate = async (templateKey: string) => {
    if (!companyId) return;

    const template = PREDEFINED_TEMPLATES[templateKey];
    if (!template) {
      toast.error(t("catalog.toast.packageNotFound"));
      return;
    }

    // FIX: Check for existing services to prevent duplicates
    const existingServices = services.filter(s => s.service_type === template.serviceType);

    const confirmMessage = existingServices.length > 0
      ? t("catalog.confirm.loadPackageExisting", {
          existing: existingServices.length,
          service: getServiceTypeLabel(template.serviceType, locale),
          count: template.services.length,
        })
      : t("catalog.confirm.loadPackage", {
          name: getPackageName(templateKey, locale),
          count: template.services.length,
        });

    if (!confirm(confirmMessage)) return;

    setSaving(true);
    try {
      // Calculate display_order starting after existing services
      const maxOrder = existingServices.reduce((max, s) => Math.max(max, s.display_order), -1);
      
      const servicesToInsert = template.services.map((s, index) => ({
        company_id: companyId,
        service_type: template.serviceType,
        category: s.category,
        name: s.name,
        description: s.description,
        unit: s.unit,
        default_price: s.default_price,
        is_default_included: s.is_default_included,
        is_optional: s.is_optional ?? false,
        display_order: maxOrder + 1 + index,
      }));

      const { error } = await supabase
        .from("company_service_items")
        .insert(servicesToInsert);

      if (error) throw error;

      toast.success(t("catalog.toast.servicesAdded", { count: template.services.length }));
      await loadServices(companyId);
      setSelectedServiceType(template.serviceType);
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error(t("catalog.toast.packageLoadFailed"));
    } finally {
      setSaving(false);
    }
  };

  const openAddTemplateModal = () => {
    setEditingTemplate(null);
    // "alle" is a view filter, not a valid DB service_type — fall back to first real type
    const serviceType = selectedServiceType === "alle"
      ? SERVICE_TYPES[0].value
      : selectedServiceType;
    const currentServices = services.filter(s => s.service_type === serviceType);
    const defaultIncluded = currentServices.filter(s => s.is_default_included).map(s => s.id);
    
    setTemplateFormData({
      service_type: serviceType,
      name: "",
      description: "",
      included_service_ids: defaultIncluded,
      excluded_services: [],
      notes: "",
    });
    setIsTemplateModalOpen(true);
  };

  const openEditTemplateModal = (template: LeistungTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      service_type: template.service_type,
      name: template.name,
      description: template.description || "",
      included_service_ids: template.included_service_ids || [],
      excluded_services: template.excluded_services || [],
      notes: template.notes || "",
    });
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!companyId || !templateFormData.name.trim()) {
      toast.error(t("catalog.toast.enterName"));
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("leistungsuebersicht_templates")
          .update({
            name: templateFormData.name.trim(),
            description: templateFormData.description.trim() || null,
            included_service_ids: templateFormData.included_service_ids,
            excluded_services: templateFormData.excluded_services.filter(Boolean),
            notes: templateFormData.notes.trim() || null,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success(t("catalog.toast.templateUpdated"));
      } else {
        const { error } = await supabase
          .from("leistungsuebersicht_templates")
          .insert({
            company_id: companyId,
            service_type: templateFormData.service_type,
            name: templateFormData.name.trim(),
            description: templateFormData.description.trim() || null,
            included_service_ids: templateFormData.included_service_ids,
            excluded_services: templateFormData.excluded_services.filter(Boolean),
            notes: templateFormData.notes.trim() || null,
          });

        if (error) throw error;
        toast.success(t("catalog.toast.templateCreated"));
      }

      setIsTemplateModalOpen(false);
      await loadServices(companyId);
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(t("catalog.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    // FIX: Prevent concurrent operations on the same template
    if (saving || pendingOperations.has(templateId)) return;
    if (!confirm(t("catalog.confirm.deleteTemplate"))) return;

    setPendingOperations(prev => new Set(prev).add(templateId));
    try {
      const { error } = await supabase
        .from("leistungsuebersicht_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
      toast.success(t("catalog.toast.templateDeleted"));
      if (companyId) await loadServices(companyId);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error(t("catalog.toast.deleteFailed"));
    } finally {
      setPendingOperations(prev => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
    }
  };

  const toggleTemplateService = (serviceId: string) => {
    setTemplateFormData(prev => ({
      ...prev,
      included_service_ids: prev.included_service_ids.includes(serviceId)
        ? prev.included_service_ids.filter(id => id !== serviceId)
        : [...prev.included_service_ids, serviceId]
    }));
  };

  const addTemplateExcluded = () => {
    setTemplateFormData(prev => ({
      ...prev,
      excluded_services: [...prev.excluded_services, ""]
    }));
  };

  const updateTemplateExcluded = (index: number, value: string) => {
    setTemplateFormData(prev => {
      const updated = [...prev.excluded_services];
      updated[index] = value;
      return { ...prev, excluded_services: updated };
    });
  };

  const removeTemplateExcluded = (index: number) => {
    setTemplateFormData(prev => ({
      ...prev,
      excluded_services: prev.excluded_services.filter((_, i) => i !== index)
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Memoized filtered services to avoid recalculation on every render
  const filteredServices = useMemo(() => 
    services.filter(s => {
      const matchesType = selectedServiceType === "alle" || s.service_type === selectedServiceType;
      const matchesSearch = !debouncedSearchTerm || 
        s.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        s.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesType && matchesSearch;
    }),
    [services, selectedServiceType, debouncedSearchTerm]
  );

  // Memoized grouped services to avoid recalculation on every render
  const groupedServices = useMemo(() => 
    filteredServices.reduce((acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    }, {} as Record<string, ServiceItem[]>),
    [filteredServices]
  );

  const currentTypeConfig = getServiceTypeConfig(selectedServiceType);
  const totalServices = services.filter(s => selectedServiceType === "alle" || s.service_type === selectedServiceType).length;
  const includedServices = services.filter(s => 
    (selectedServiceType === "alle" || s.service_type === selectedServiceType) && s.is_default_included
  ).length;
  const filteredTemplatesCount = templates.filter(t => 
    selectedServiceType === "alle" || t.service_type === selectedServiceType
  ).length;

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("catalog.pageTitle")}</title>
      </Helmet>

      <div className="space-y-6">
        {/* Folk-style header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">🛠️</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">{t("catalog.title")}</h1>
              <span className="text-[15px] text-folk-ink3">
                <span className="font-mono">{totalServices}</span> {t("catalog.stats.services")} · <span className="font-mono">{includedServices}</span> {t("catalog.stats.included")} · <span className="font-mono">{filteredTemplatesCount}</span> {t("catalog.stats.templates")}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              {t("catalog.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTranslationOpen(true)}
              disabled={saving || services.length === 0}
              className="h-9 gap-1.5 rounded-lg px-3.5 text-[15px] font-semibold"
            >
              <Languages className="h-3.5 w-3.5" />
              {t("catalog.translation.open")}
            </Button>
            <Button
              onClick={openAddModal}
              disabled={saving}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("catalog.addService")}
            </Button>
          </div>
        </div>

        {/* Positionstexte in der Kundensprache. Sie werden beim Erstellen einer Offerte
            als Snapshot übernommen — eine französische Offerte trägt dann französische
            Positionen statt deutscher. */}
        {companyId && (
          <ContentTranslationDialog
            open={translationOpen}
            onOpenChange={setTranslationOpen}
            companyId={companyId}
            table="company_service_items"
            context="Leistungskatalog einer Schweizer Umzugs- und Reinigungsfirma. Die Texte erscheinen als Positionen auf Offerten."
            fields={[
              { key: "name", label: "Bezeichnung" },
              { key: "description", label: "Beschreibung", multiline: true },
            ]}
            records={services.map((s) => ({
              id: s.id,
              source: { name: s.name, description: s.description ?? "" },
              translations: asTranslations(s.translations),
            }))}
            onSaved={() => {
              if (companyId) loadServices(companyId);
            }}
          />
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {[
            { emoji: '⚙️', label: t("catalog.kpi.services"),  value: totalServices },
            { emoji: '✅', label: t("catalog.kpi.included"),  value: includedServices },
            { emoji: '📋', label: t("catalog.kpi.templates"), value: filteredTemplatesCount },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl border border-folk-line bg-folk-card p-4 md:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                <span className="text-xl leading-none">{tile.emoji}</span>
              </div>
              <div className="mt-3 font-sans text-3xl font-bold tracking-tight text-folk-ink">{tile.value}</div>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder={t("catalog.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Service Type Tabs */}
        <Tabs value={selectedServiceType} onValueChange={setSelectedServiceType}>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max sm:flex-wrap sm:w-auto h-auto gap-1 p-1.5 bg-muted/50">
              {SERVICE_TYPES.map((type) => {
                const count = services.filter(s => s.service_type === type.value).length;
                const Icon = type.icon;
                const label = getServiceTypeLabel(type.value, locale);
                return (
                  <TabsTrigger
                    key={type.value}
                    value={type.value}
                    className="gap-2 text-sm px-4 py-2.5 whitespace-nowrap data-[state=active]:shadow-md transition-all"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.slice(0, 3)}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 min-w-5 ml-1">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="alle" className="gap-2 text-sm px-4 py-2.5">
                <Layers className="w-4 h-4" />
                {t("catalog.tab.all")}
                <Badge variant="secondary" className="text-xs h-5 min-w-5 ml-1">
                  {services.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={selectedServiceType} className="mt-6">
            {Object.keys(groupedServices).length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-10">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t("catalog.empty.title")}</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {t("catalog.empty.description")}
                    </p>
                  </div>

                  {/* Quick Template Selection */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                    {Object.entries(PREDEFINED_TEMPLATES).map(([key, template]) => {
                      const typeConfig = getServiceTypeConfig(template.serviceType);
                      const Icon = typeConfig.icon;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          className="h-auto p-4 flex-col items-start gap-3 text-left hover:border-primary/50 hover:shadow-md transition-all group"
                          onClick={() => loadTemplate(key)}
                          disabled={saving}
                        >
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${typeConfig.color} group-hover:scale-110 transition-transform`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm mb-1">{getPackageName(key, locale)}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("catalog.serviceCount", { count: template.services.length })}
                            </p>
                          </div>
                        </Button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 justify-center">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">{t("catalog.or")}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="flex justify-center mt-6">
                    <Button onClick={openAddModal} variant="outline" className="gap-2">
                      <Plus className="w-4 h-4" />
                      {t("catalog.createManually")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedServices).map(([category, items]) => {
                  const CategoryIcon = getCategoryIcon(category);
                  return (
                    <Collapsible
                      key={category}
                      open={expandedCategories.includes(category)}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <Card className="overflow-hidden transition-shadow hover:shadow-md">
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${currentTypeConfig.color}`}>
                                  <CategoryIcon className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {getCategoryLabel(category, locale)}
                                  </CardTitle>
                                  <CardDescription className="text-sm">
                                    {t("catalog.category.summary", {
                                      included: items.filter(i => i.is_default_included).length,
                                      optional: items.filter(i => !i.is_default_included).length,
                                    })}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-medium">
                                  {t("catalog.serviceCount", { count: items.length })}
                                </Badge>
                                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                  expandedCategories.includes(category) ? "" : "-rotate-90"
                                }`} />
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 px-3 sm:px-6 pb-4">
                            <div className="space-y-2">
                              {items.map((service) => {
                                const isInlineEditing = inlineEditingId === service.id;
                                
                                return (
                                  <div
                                    key={service.id}
                                    className={`group flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl border bg-card transition-all duration-200 ${
                                      isInlineEditing 
                                        ? "bg-blue-50 border-blue-300" 
                                        : "hover:bg-muted/30 hover:border-primary/20"
                                    }`}
                                  >
                                    
                                    <div className="flex-1 min-w-0">
                                      {isInlineEditing ? (
                                        <Input
                                          value={inlineEditName}
                                          onChange={(e) => setInlineEditName(e.target.value)}
                                          className="font-medium text-base h-9"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") saveInlineEdit(service.id);
                                            if (e.key === "Escape") cancelInlineEdit();
                                          }}
                                          autoFocus
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-base">{service.name}</span>
                                          {service.is_default_included && (
                                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs gap-1">
                                              <CheckCircle2 className="w-3 h-3" />
                                              {t("catalog.badge.included")}
                                            </Badge>
                                          )}
                                          {service.is_optional && !service.is_default_included && (
                                            <Badge variant="outline" className="text-xs">
                                              <Tag className="w-3 h-3 mr-1" />
                                              {t("catalog.badge.optional")}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                      {service.description && !isInlineEditing && (
                                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                                          {service.description}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                      {isInlineEditing ? (
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <span className="text-sm text-muted-foreground">CHF</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={inlineEditPrice}
                                              onChange={(e) => setInlineEditPrice(e.target.value)}
                                              className="w-24 h-9"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") saveInlineEdit(service.id);
                                                if (e.key === "Escape") cancelInlineEdit();
                                              }}
                                            />
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-100"
                                            onClick={() => saveInlineEdit(service.id)}
                                            disabled={inlineSaving}
                                          >
                                            {inlineSaving ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <Check className="w-4 h-4" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                            onClick={cancelInlineEdit}
                                            disabled={inlineSaving}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <>
                                          <div
                                            className="text-left sm:text-right shrink-0 cursor-pointer hover:bg-white/50 rounded px-2 py-1 transition-colors"
                                            onClick={() => startInlineEdit(service)}
                                            title={t("catalog.item.clickToEdit")}
                                          >
                                            {service.default_price > 0 ? (
                                              <>
                                                <p className="font-bold text-base text-primary flex items-center gap-1">
                                                  {formatCurrency(service.default_price, locale)}
                                                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {getUnitLabel(service.unit, locale)}
                                                </p>
                                              </>
                                            ) : (
                                              <Badge variant="secondary" className="text-xs">
                                                {getUnitLabel(service.unit, locale)}
                                              </Badge>
                                            )}
                                          </div>

                                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
                                              onClick={() => openEditModal(service)}
                                              disabled={saving || pendingOperations.has(service.id)}
                                              aria-label={t("catalog.item.editAria", { name: service.name })}
                                              title={t("catalog.item.editAllDetails")}
                                            >
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              onClick={() => handleDelete(service.id)}
                                              disabled={saving || pendingOperations.has(service.id)}
                                              aria-label={t("catalog.item.deleteAria", { name: service.name })}
                                            >
                                              {pendingOperations.has(service.id) ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-4 h-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Custom Templates Section */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("catalog.templates.title")}</CardTitle>
                  <CardDescription>
                    {t("catalog.templates.description")}
                  </CardDescription>
                </div>
              </div>
              <Button onClick={openAddTemplateModal} className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700">
                <Plus className="w-4 h-4" />
                {t("catalog.templates.new")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {templates.filter(t => t.service_type === selectedServiceType || selectedServiceType === "alle").length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">{t("catalog.templates.empty")}</p>
                <Button variant="outline" onClick={openAddTemplateModal} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("catalog.templates.createFirst")}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates
                  .filter(t => t.service_type === selectedServiceType || selectedServiceType === "alle")
                  .map((template) => {
                    const includedCount = template.included_service_ids?.length || 0;
                    const excludedCount = template.excluded_services?.length || 0;
                    const typeConfig = getServiceTypeConfig(template.service_type);
                    return (
                      <div
                        key={template.id}
                        className="group relative p-5 border rounded-xl hover:border-primary/30 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-muted/20"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${typeConfig.color}`}>
                              <Package className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold truncate">{template.name}</span>
                          </div>
                        </div>
                        
                        <Badge variant="outline" className="mb-3 text-xs">
                          {getServiceTypeLabel(template.service_type, locale)}
                        </Badge>

                        {template.description && (
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {template.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="font-medium">{includedCount}</span> {t("catalog.templates.inclShort")}
                          </span>
                          {excludedCount > 0 && (
                            <span className="flex items-center gap-1.5">
                              <span className="text-red-500 font-bold">✗</span>
                              <span className="font-medium">{excludedCount}</span> {t("catalog.templates.exclShort")}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => openEditTemplateModal(template)}
                            disabled={saving || pendingOperations.has(template.id)}
                            aria-label={t("catalog.templates.editAria", { name: template.name })}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={saving || pendingOperations.has(template.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 h-9 w-9"
                            aria-label={t("catalog.templates.deleteAria", { name: template.name })}
                          >
                            {pendingOperations.has(template.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predefined Templates Section */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("catalog.predefined.title")}</CardTitle>
                <CardDescription>
                  {t("catalog.predefined.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(PREDEFINED_TEMPLATES).map(([key, template]) => {
                const typeConfig = getServiceTypeConfig(template.serviceType);
                const Icon = typeConfig.icon;
                return (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-auto p-4 flex-col items-start gap-3 text-left hover:border-primary/50 hover:shadow-md transition-all group"
                    onClick={() => loadTemplate(key)}
                    disabled={saving}
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${typeConfig.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">{getPackageName(key, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("catalog.serviceCount", { count: template.services.length })}
                      </p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Service Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              {editingService ? (
                <>
                  <Pencil className="w-5 h-5 text-primary" />
                  {t("catalog.dialog.editService")}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-primary" />
                  {t("catalog.dialog.addService")}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.dialog.serviceDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Service-Typ: Visual pill buttons with icons */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                {t("catalog.form.serviceTypeQuestion")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.service_type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, service_type: type.value })}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                        border-2 transition-all cursor-pointer
                        ${isSelected
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {getServiceTypeLabel(type.value, locale)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kategorie: Visual pill buttons with icons */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                {t("common.category")}{" "}
                <span className="text-muted-foreground font-normal">{t("catalog.form.categoryHint")}</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = formData.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                        border-2 transition-all cursor-pointer
                        ${isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Name der Leistung <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Möbeltransport, Endreinigung, Verpackungsmaterial"
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">
                Kurze Beschreibung{" "}
                <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Was ist in dieser Leistung enthalten?"
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Preis + Einheit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Preis (CHF)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                    CHF
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.default_price}
                    onChange={(e) => setFormData({ ...formData, default_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="pl-12"
                  />
                </div>
                <p className="text-xs text-muted-foreground">0 = Preis wird individuell festgelegt</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Abrechnung pro</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Inclusion mode: 3 clear card options */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Wie wird diese Leistung in Offerten verwendet?
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Option 1: Immer inklusive */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_default_included: true, is_optional: false })}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all w-full
                    ${formData.is_default_included
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${formData.is_default_included ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40'}`}>
                    {formData.is_default_included && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${formData.is_default_included ? 'text-emerald-700' : 'text-foreground'}`}>
                      Immer inklusive
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Wird automatisch in jede neue Offerte aufgenommen
                    </p>
                  </div>
                </button>

                {/* Option 2: Optional zubuchbar */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_default_included: false, is_optional: true })}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all w-full
                    ${!formData.is_default_included && formData.is_optional
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${!formData.is_default_included && formData.is_optional ? 'border-blue-500 bg-blue-500' : 'border-muted-foreground/40'}`}>
                    {(!formData.is_default_included && formData.is_optional) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${!formData.is_default_included && formData.is_optional ? 'text-blue-700' : 'text-foreground'}`}>
                      Optional zubuchbar
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kunde kann diese Leistung selbst zur Offerte hinzufügen
                    </p>
                  </div>
                </button>

                {/* Option 3: Nur manuell */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_default_included: false, is_optional: false })}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all w-full
                    ${!formData.is_default_included && !formData.is_optional
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${!formData.is_default_included && !formData.is_optional ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground/40'}`}>
                    {(!formData.is_default_included && !formData.is_optional) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${!formData.is_default_included && !formData.is_optional ? 'text-orange-700' : 'text-foreground'}`}>
                      Nur manuell hinzufügen
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Erscheint im Katalog, wird aber nicht automatisch eingefügt
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingService ? "Aktualisieren" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {editingTemplate ? "Vorlage bearbeiten" : "Neue Vorlage erstellen"}
            </DialogTitle>
            <DialogDescription>
              Definieren Sie eine Leistungsübersicht-Vorlage für schnelle Offerten
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  placeholder="z.B. Premium Umzug"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Service-Typ</Label>
                <Select
                  value={templateFormData.service_type}
                  onValueChange={(value) => setTemplateFormData({ ...templateFormData, service_type: value })}
                  disabled={!!editingTemplate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                placeholder="Kurze Beschreibung..."
              />
            </div>

            {/* Included Services Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Inklusivleistungen ({templateFormData.included_service_ids.length} ausgewählt)
              </Label>
              <div className="border rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                {services
                  .filter(s => s.service_type === templateFormData.service_type)
                  .map((service) => {
                    const isSelected = templateFormData.included_service_ids.includes(service.id);
                    return (
                      <div
                        key={service.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-green-50 border border-green-200" 
                            : "hover:bg-muted border border-transparent"
                        }`}
                        onClick={() => toggleTemplateService(service.id)}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "bg-green-600 border-green-600" : "border-muted-foreground/30"
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="flex-1 text-sm font-medium">{service.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(service.category)}
                        </Badge>
                      </div>
                    );
                  })}
                {services.filter(s => s.service_type === templateFormData.service_type).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    Keine Leistungen für diesen Service-Typ vorhanden
                  </p>
                )}
              </div>
            </div>

            {/* Excluded Services */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-red-600 font-bold">✗</span>
                Nicht inbegriffen
              </Label>
              <div className="space-y-2">
                {templateFormData.excluded_services.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateTemplateExcluded(index, e.target.value)}
                      placeholder="z.B. Reinigung der alten Wohnung"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTemplateExcluded(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTemplateExcluded} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ausschluss hinzufügen
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Besondere Hinweise</Label>
              <Textarea
                value={templateFormData.notes}
                onChange={(e) => setTemplateFormData({ ...templateFormData, notes: e.target.value })}
                placeholder="Zusätzliche Informationen, die bei Verwendung dieser Vorlage eingefügt werden..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTemplate ? "Aktualisieren" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
