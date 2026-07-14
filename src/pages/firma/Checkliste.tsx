import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
  FileText,
  Download,
  Eye,
  X,
  Copy,
  Undo2,
  Redo2,
  Clock,
  ListChecks,
  Sparkles,
  Check,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  CHECKLIST_TEMPLATES,
  getEmptySection,
  cleanSections,
  type ChecklistSection,
} from "@/lib/checklistTemplates";
import { downloadChecklistPdf, generateChecklistPdf } from "@/lib/generateChecklistPdf";
import { resolveDocumentLocale } from "@/i18n/documentLocale";
import { useI18n, useT } from "@/i18n/useI18n";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Import shared constants
import { SERVICE_TYPES, getServiceTypeConfig, getServiceTypeLabel } from "@/constants/service-catalog";

interface Company {
  id: string;
  company_name: string;
  /** Checklist templates carry no language of their own → company default is the doc locale. */
  default_language?: string | null;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email: string;
  website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  slogan?: string | null;
}

interface DbChecklistTemplate {
  id: string;
  company_id: string;
  title: string;
  subtitle: string | null;
  service_type: string;
  sections: ChecklistSection[];
  is_active: boolean;
  include_in_offerte: boolean;
}

const FirmaCheckliste = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyTargetServiceType, setCopyTargetServiceType] = useState<string | null>(null);
  // Track pending operations to prevent race conditions
  const [pendingOperation, setPendingOperation] = useState<"save" | "delete" | "copy" | null>(null);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState("umzug");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const {
    state: sections,
    setState: setSections,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetSections,
  } = useUndoRedo<ChecklistSection[]>([getEmptySection(1)]);
  const [isActive, setIsActive] = useState(true);
  const [includeInOfferte, setIncludeInOfferte] = useState(true);

  const [existingTemplates, setExistingTemplates] = useState<DbChecklistTemplate[]>([]);

  // FIX: Added isMounted flag to prevent memory leaks on unmount
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!user) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name, street, house_number, plz, city, phone, email, website, logo_url, primary_color, default_language",
        });

        if (!isMounted) return;
        if (!companyData) {
          setIsLoading(false);
          return;
        }
        setCompany(companyData);

        const { data: templates } = await supabase
          .from("checklist_templates")
          .select("*")
          .eq("company_id", companyData.id);

        if (isMounted && templates) {
          const parsedTemplates = templates.map(t => ({
            ...t,
            sections: Array.isArray(t.sections) ? (t.sections as unknown as ChecklistSection[]) : []
          }));
          setExistingTemplates(parsedTemplates as DbChecklistTemplate[]);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching data:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const existing = existingTemplates.find(t => t.service_type === selectedServiceType);
    if (existing) {
      setTemplateId(existing.id);
      setTitle(existing.title);
      setSubtitle(existing.subtitle || "");
      resetSections(existing.sections.length > 0 ? existing.sections : [getEmptySection(1)]);
      setIsActive(existing.is_active);
      setIncludeInOfferte(existing.include_in_offerte);
    } else {
      setTemplateId(null);
      setTitle("");
      setSubtitle("");
      resetSections([getEmptySection(1)]);
      setIsActive(true);
      setIncludeInOfferte(true);
    }
  }, [selectedServiceType, existingTemplates, resetSections]);

  const loadPrebuiltTemplate = (serviceType: string) => {
    const template = CHECKLIST_TEMPLATES[serviceType];
    if (template) {
      setTitle(template.title);
      setSubtitle(template.subtitle);
      setSections(template.sections.map((s, i) => ({
        ...s,
        id: `section-${Date.now()}-${i}`,
        order: i + 1
      })));
      toast({
        title: t("checklist.toast.templateLoaded"),
        description: t("checklist.toast.templateLoadedDescription"),
      });
    }
  };

  const addSection = () => {
    setSections([...sections, getEmptySection(sections.length + 1)]);
  };

  const removeSection = (index: number) => {
    if (sections.length === 1) return;
    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateSectionTimeline = (index: number, value: string) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], timeline: value };
    setSections(newSections);
  };

  const addItem = (sectionIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      items: [...newSections[sectionIndex].items, ""]
    };
    setSections(newSections);
  };

  const updateItem = (sectionIndex: number, itemIndex: number, value: string) => {
    const newSections = [...sections];
    const newItems = [...newSections[sectionIndex].items];
    newItems[itemIndex] = value;
    newSections[sectionIndex] = { ...newSections[sectionIndex], items: newItems };
    setSections(newSections);
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    const newItems = newSections[sectionIndex].items.filter((_, i) => i !== itemIndex);
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      items: newItems.length > 0 ? newItems : [""]
    };
    setSections(newSections);
  };

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "section") {
      const reorderedSections = Array.from(sections);
      const [removed] = reorderedSections.splice(source.index, 1);
      reorderedSections.splice(destination.index, 0, removed);
      setSections(reorderedSections.map((s, i) => ({ ...s, order: i + 1 })));
      return;
    }

    if (type === "item") {
      const sourceSectionId = source.droppableId.replace("items-", "");
      const destSectionId = destination.droppableId.replace("items-", "");
      
      const sourceSectionIndex = sections.findIndex(s => s.id === sourceSectionId);
      const destSectionIndex = sections.findIndex(s => s.id === destSectionId);
      
      if (sourceSectionIndex === -1 || destSectionIndex === -1) return;

      const newSections = [...sections];

      if (sourceSectionId === destSectionId) {
        const items = [...newSections[sourceSectionIndex].items];
        const [movedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, movedItem);
        newSections[sourceSectionIndex] = { ...newSections[sourceSectionIndex], items };
      } else {
        const sourceItems = [...newSections[sourceSectionIndex].items];
        const destItems = [...newSections[destSectionIndex].items];
        
        const [movedItem] = sourceItems.splice(source.index, 1);
        destItems.splice(destination.index, 0, movedItem);
        
        newSections[sourceSectionIndex] = { ...newSections[sourceSectionIndex], items: sourceItems };
        newSections[destSectionIndex] = { ...newSections[destSectionIndex], items: destItems };
      }
      
      setSections(newSections);
    }
  }, [sections, setSections]);

  const handleSave = async () => {
    // FIX: Prevent concurrent operations
    if (!company?.id || isSaving || pendingOperation) return;

    if (!title.trim()) {
      toast({
        title: t("common.error"),
        description: t("checklist.toast.titleRequired"),
        variant: "destructive",
      });
      return;
    }

    // FIX: Use shared cleanSections helper
    const cleaned = cleanSections(sections);

    if (cleaned.length === 0) {
      toast({
        title: t("common.error"),
        description: t("checklist.toast.sectionRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setPendingOperation("save");

    try {
      const templateData = {
        company_id: company.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        service_type: selectedServiceType,
        sections: cleaned,
        is_active: isActive,
        include_in_offerte: includeInOfferte,
      };

      if (templateId) {
        const { error } = await supabase
          .from("checklist_templates")
          .update(templateData)
          .eq("id", templateId);

        if (error) throw error;

        setExistingTemplates(prev =>
          prev.map(t => t.id === templateId ? { ...t, ...templateData } as DbChecklistTemplate : t)
        );
      } else {
        const { data, error } = await supabase
          .from("checklist_templates")
          .insert(templateData)
          .select()
          .single();

        if (error) throw error;

        setTemplateId(data.id);
        setExistingTemplates(prev => [...prev, { ...data, sections: cleaned } as DbChecklistTemplate]);
      }

      toast({
        title: t("checklist.toast.saved"),
        description: t("checklist.toast.savedDescription"),
      });
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast({
        title: t("common.error"),
        description: t("checklist.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setPendingOperation(null);
    }
  };

  const handleDelete = async () => {
    // FIX: Prevent concurrent operations
    if (!templateId || isSaving || pendingOperation) return;
    
    if (!confirm(t("checklist.confirm.delete"))) return;

    setPendingOperation("delete");
    try {
      const { error } = await supabase
        .from("checklist_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      setExistingTemplates(prev => prev.filter(t => t.id !== templateId));
      setTemplateId(null);
      setTitle("");
      setSubtitle("");
      resetSections([getEmptySection(1)]);

      toast({
        title: t("checklist.toast.deleted"),
        description: t("checklist.toast.deletedDescription"),
      });
    } catch (error) {
      console.error("Error deleting checklist:", error);
      toast({
        title: t("common.error"),
        description: t("checklist.toast.deleteFailed"),
        variant: "destructive",
      });
    } finally {
      setPendingOperation(null);
    }
  };

  const handleCopyToServiceType = async () => {
    // FIX: Prevent concurrent operations and validate
    if (!company?.id || !copyTargetServiceType || isSaving || pendingOperation) return;

    // FIX: Validate title before copying
    if (!title.trim()) {
      toast({
        title: t("common.error"),
        description: t("checklist.toast.saveFirst"),
        variant: "destructive",
      });
      setShowCopyDialog(false);
      return;
    }

    const targetServiceLabel = getServiceTypeLabel(copyTargetServiceType, locale);

    const existingTarget = existingTemplates.find(tpl => tpl.service_type === copyTargetServiceType);
    if (existingTarget) {
      toast({
        title: t("common.error"),
        description: t("checklist.toast.targetExists", { service: targetServiceLabel }),
        variant: "destructive",
      });
      setShowCopyDialog(false);
      return;
    }

    // FIX: Use shared cleanSections helper with new IDs
    const cleaned = cleanSections(sections).map(s => ({
      ...s,
      id: `section-${Date.now()}-${Math.random()}`,
    }));

    if (cleaned.length === 0) {
      toast({
        title: "Fehler",
        description: "Die Checkliste enthält keine gültigen Abschnitte zum Kopieren.",
        variant: "destructive",
      });
      setShowCopyDialog(false);
      return;
    }

    setIsSaving(true);
    setPendingOperation("copy");

    try {
      const templateData = {
        company_id: company.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        service_type: copyTargetServiceType,
        sections: cleaned,
        is_active: isActive,
        include_in_offerte: includeInOfferte,
      };

      const { data, error } = await supabase
        .from("checklist_templates")
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;

      setExistingTemplates(prev => [...prev, { ...data, sections: cleaned } as DbChecklistTemplate]);

      toast({
        title: "Kopiert",
        description: `Die Checkliste wurde für ${SERVICE_TYPES.find(s => s.value === copyTargetServiceType)?.label} kopiert.`,
      });

      setShowCopyDialog(false);
      setCopyTargetServiceType(null);
    } catch (error) {
      console.error("Error copying checklist:", error);
      toast({
        title: "Fehler",
        description: "Die Checkliste konnte nicht kopiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setPendingOperation(null);
    }
  };

  const currentTypeConfig = getServiceTypeConfig(selectedServiceType);
  
  // FIX: Use useMemo for computed values to avoid recalculation on every render
  const totalSections = useMemo(() => 
    sections.filter(s => s.timeline.trim()).length,
    [sections]
  );
  
  const totalItems = useMemo(() => 
    sections.reduce((acc, s) => acc + s.items.filter(i => i.trim()).length, 0),
    [sections]
  );

  // FIX: Extract inline PDF functions to useCallback
  const handlePdfPreview = useCallback(async () => {
    if (!company) return;
    setIsGeneratingPdf(true);
    try {
      const cleaned = cleanSections(sections);
      
      const doc = await generateChecklistPdf({
        title: title || "Checkliste",
        subtitle,
        sections: cleaned,
        // Only the PDF chrome follows this; title/subtitle/sections are the operator's
        // DB-authored template text and are printed as written.
        locale: resolveDocumentLocale(null, company),
        company: {
          company_name: company.company_name,
          street: company.street,
          house_number: company.house_number,
          plz: company.plz,
          city: company.city,
          phone: company.phone,
          email: company.email,
          website: company.website,
          logo_url: company.logo_url,
          primary_color: company.primary_color,
        }
      });
      
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setShowPdfPreview(true);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [company, title, subtitle, sections]);

  const handlePdfDownload = useCallback(async () => {
    if (!company) return;
    const cleaned = cleanSections(sections);
    
    await downloadChecklistPdf({
      title: title || "Checkliste",
      subtitle,
      sections: cleaned,
      locale: resolveDocumentLocale(null, company),
      company: {
        company_name: company.company_name,
        street: company.street,
        house_number: company.house_number,
        plz: company.plz,
        city: company.city,
        phone: company.phone,
        email: company.email,
        website: company.website,
        logo_url: company.logo_url,
        primary_color: company.primary_color,
        slogan: company.slogan,
      }
    });
  }, [company, title, subtitle, sections]);

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Checkliste | Firma</title>
        </Helmet>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Helmet>
          <title>Checkliste | Firma</title>
        </Helmet>
          <div className="text-center py-12 text-muted-foreground">
            Firma nicht gefunden
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Checkliste | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">☑️</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Kunden-Checkliste</h1>
                <span className="text-[15px] text-folk-ink3">
                  <span className="font-mono">{existingTemplates.length}</span> Vorlagen · <span className="font-mono">{totalSections}</span> Abschnitte · <span className="font-mono">{totalItems}</span> Punkte
                </span>
              </div>
              <p className="mt-1 text-[15px] text-folk-ink2">
                Hilfreiche Checklisten für Ihre Kunden erstellen — pro Service-Typ konfigurierbar.
              </p>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { emoji: '📋', label: 'Vorlagen',   value: existingTemplates.length },
              { emoji: '🗂️', label: 'Abschnitte', value: totalSections },
              { emoji: '✓',  label: 'Punkte',     value: totalItems },
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

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Editor */}
            <div className="lg:col-span-2 space-y-6">
              {/* Service Type & Settings */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    Checklisten-Einstellungen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Service-Typ</Label>
                      <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map(type => {
                            const Icon = type.icon;
                            const hasTemplate = existingTemplates.some(t => t.service_type === type.value);
                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />
                                  {type.label}
                                  {hasTemplate && (
                                    <Badge variant="secondary" className="ml-2 text-xs">Vorhanden</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Aktiv</Label>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">An Offerten anhängen</Label>
                        <Switch checked={includeInOfferte} onCheckedChange={setIncludeInOfferte} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Titel</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="z.B. Zügel-Countdown"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Untertitel / Einleitung</Label>
                    <Textarea
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="z.B. Gut geplant ist halb gezügelt..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sections Builder */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Zeitplan-Abschnitte
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={undo}
                              disabled={!canUndo || !!pendingOperation}
                              className="h-9 w-9"
                              aria-label="Rückgängig"
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rückgängig</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={redo}
                              disabled={!canRedo || !!pendingOperation}
                              className="h-9 w-9"
                              aria-label="Wiederholen"
                            >
                              <Redo2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Wiederholen</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button onClick={addSection} size="sm" className="gap-2" disabled={!!pendingOperation}>
                        <Plus className="w-4 h-4" />
                        Abschnitt
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="checklist-sections" type="section">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {sections.map((section, sectionIndex) => (
                            <Draggable
                              key={section.id}
                              draggableId={section.id}
                              index={sectionIndex}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="border rounded-xl p-5 bg-gradient-to-br from-card to-muted/20 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-center gap-3 mb-4">
                                    <div {...provided.dragHandleProps} className="cursor-grab hover:text-primary transition-colors">
                                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${currentTypeConfig.color} flex items-center justify-center text-white font-bold text-sm`}>
                                      {sectionIndex + 1}
                                    </div>
                                    <Input
                                      value={section.timeline}
                                      onChange={(e) => updateSectionTimeline(sectionIndex, e.target.value)}
                                      placeholder="z.B. Bis vier Wochen vor dem Umzug"
                                      className="flex-1 font-semibold h-11"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeSection(sectionIndex)}
                                      disabled={sections.length === 1 || !!pendingOperation}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      aria-label={`Abschnitt ${sectionIndex + 1} löschen`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  <Droppable droppableId={`items-${section.id}`} type="item">
                                    {(itemsProvided) => (
                                      <div
                                        ref={itemsProvided.innerRef}
                                        {...itemsProvided.droppableProps}
                                        className="space-y-2 ml-8"
                                      >
                                        {section.items.map((item, itemIndex) => (
                                          <Draggable
                                            key={`${section.id}-item-${itemIndex}`}
                                            draggableId={`${section.id}-item-${itemIndex}`}
                                            index={itemIndex}
                                          >
                                            {(itemProvided) => (
                                              <div
                                                ref={itemProvided.innerRef}
                                                {...itemProvided.draggableProps}
                                                className="flex items-start gap-2 group"
                                              >
                                                <div
                                                  {...itemProvided.dragHandleProps}
                                                  className="mt-3 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <div className="mt-3 w-5 h-5 rounded border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
                                                  {item.trim() && (
                                                    <Check className="w-3 h-3 text-muted-foreground/50" />
                                                  )}
                                                </div>
                                                <Textarea
                                                  value={item}
                                                  onChange={(e) => updateItem(sectionIndex, itemIndex, e.target.value)}
                                                  placeholder="Checklist-Punkt eingeben..."
                                                  rows={1}
                                                  className="flex-1 min-h-[42px] resize-none"
                                                />
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => removeItem(sectionIndex, itemIndex)}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                  aria-label="Punkt entfernen"
                                                >
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            )}
                                          </Draggable>
                                        ))}
                                        {itemsProvided.placeholder}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => addItem(sectionIndex)}
                                          className="w-full mt-3 border-dashed"
                                        >
                                          <Plus className="w-4 h-4 mr-2" />
                                          Punkt hinzufügen
                                        </Button>
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Templates */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Schnellstart-Vorlagen
                  </CardTitle>
                  <CardDescription>
                    Laden Sie eine vorgefertigte Vorlage
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {Object.entries(CHECKLIST_TEMPLATES).map(([key, template]) => {
                    const typeConfig = SERVICE_TYPES.find(t => t.value === key) || SERVICE_TYPES[0];
                    const Icon = typeConfig.icon;
                    return (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        onClick={() => loadPrebuiltTemplate(key)}
                        className="w-full justify-start gap-3 h-11"
                        disabled={key !== selectedServiceType}
                      >
                        <div className={`p-1.5 rounded-md bg-gradient-to-br ${typeConfig.color}`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        {template.title}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Actions */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                  <CardTitle className="text-base">Aktionen</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving || !!pendingOperation} 
                    className="w-full gap-2"
                  >
                    {pendingOperation === "save" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {templateId ? "Aktualisieren" : "Speichern"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                    className="w-full gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Vorschau
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handlePdfPreview}
                    className="w-full gap-2"
                    disabled={!title.trim() || isGeneratingPdf || !!pendingOperation}
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    PDF Vorschau
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handlePdfDownload}
                    className="w-full gap-2"
                    disabled={!title.trim() || !!pendingOperation}
                  >
                    <Download className="w-4 h-4" />
                    PDF Herunterladen
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setCopyTargetServiceType(null);
                      setShowCopyDialog(true);
                    }}
                    className="w-full gap-2"
                    disabled={!title.trim() || cleanSections(sections).length === 0 || !!pendingOperation}
                  >
                    <Copy className="w-4 h-4" />
                    Auf anderen Service kopieren
                  </Button>

                  {templateId && (
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isSaving || !!pendingOperation}
                      className="w-full gap-2"
                      aria-label="Checkliste löschen"
                    >
                      {pendingOperation === "delete" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Löschen
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Status */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                  <CardTitle className="text-base">Ihre Checklisten</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {existingTemplates.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                        <CheckSquare className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sie haben noch keine Checklisten erstellt.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {existingTemplates.map(template => {
                        const typeConfig = getServiceTypeConfig(template.service_type);
                        const Icon = typeConfig.icon;
                        return (
                          <div
                            key={template.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ${
                              template.service_type === selectedServiceType 
                                ? "border-primary bg-primary/5" 
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setSelectedServiceType(template.service_type)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-gradient-to-br ${typeConfig.color}`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{template.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {typeConfig.label}
                                </p>
                              </div>
                            </div>
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Checklisten-Vorschau
              </DialogTitle>
            </DialogHeader>
            <div className="border rounded-xl p-6 bg-white">
              <h2 className="text-2xl font-bold mb-2">{title || "Titel"}</h2>
              {subtitle && <p className="text-muted-foreground mb-6">{subtitle}</p>}
              
              {sections.filter(s => s.timeline.trim()).map((section, index) => (
                <div key={index} className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2 flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${currentTypeConfig.color} flex items-center justify-center text-white text-xs font-bold`}>
                      {index + 1}
                    </span>
                    {section.timeline}
                  </h3>
                  <ul className="space-y-2 ml-8">
                    {section.items.filter(item => item.trim()).map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded border-2 border-primary/30 flex items-center justify-center mt-0.5 shrink-0">
                          <Check className="w-3 h-3 text-primary/50" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Copy Dialog */}
        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-primary" />
                Checkliste kopieren
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wählen Sie den Service-Typ, für den Sie diese Checkliste kopieren möchten:
              </p>
              <div className="grid gap-2">
                {SERVICE_TYPES.filter(type => type.value !== selectedServiceType).map(type => {
                  const hasTemplate = existingTemplates.some(t => t.service_type === type.value);
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                        copyTargetServiceType === type.value
                          ? "border-primary bg-primary/5 shadow-md"
                          : hasTemplate
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted/50 hover:border-primary/30"
                      }`}
                      onClick={() => !hasTemplate && setCopyTargetServiceType(type.value)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${type.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">{type.label}</span>
                      </div>
                      {hasTemplate && (
                        <Badge variant="secondary">Vorhanden</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCopyDialog(false)} disabled={!!pendingOperation}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleCopyToServiceType}
                  disabled={!copyTargetServiceType || isSaving || !!pendingOperation}
                  className="gap-2"
                >
                  {pendingOperation === "copy" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Kopieren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PDF Preview Dialog */}
        <Dialog 
          open={showPdfPreview} 
          onOpenChange={(open) => {
            setShowPdfPreview(open);
            if (!open && pdfBlobUrl) {
              URL.revokeObjectURL(pdfBlobUrl);
              setPdfBlobUrl(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
              <DialogTitle className="flex items-center justify-between pr-8">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  PDF Vorschau
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePdfDownload}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Herunterladen
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 p-2">
              {pdfBlobUrl ? (
                <iframe 
                  src={pdfBlobUrl} 
                  className="w-full h-full border rounded-lg"
                  title="PDF Vorschau"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </>
  );
};

export default FirmaCheckliste;
