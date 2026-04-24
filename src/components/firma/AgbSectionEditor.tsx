import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Save, 
  Trash2, 
  Plus, 
  GripVertical, 
  ChevronDown,
  FileText,
  Wand2,
  Eye,
  Copy
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface AgbSection {
  id?: string;
  company_id: string;
  service_type: string;
  title: string;
  content: string;
  display_order: number;
  is_active: boolean;
}

interface AgbSectionEditorProps {
  companyId: string;
  serviceType: string;
  serviceLabel: string;
  allServiceTypes?: { type: string; label: string }[];
}

// Default AGB templates for different services
const getDefaultAgbTemplates = (serviceType: string): Omit<AgbSection, 'id' | 'company_id' | 'service_type'>[] => {
  const commonTemplates = [
    {
      title: "Vorteil",
      content: `Sie bezahlen keine Anfahrt.- und Abfahrkosten, keine Kilometer.- oder Benzinkosten. Keine Spesen und keine verstecken Kosten. Erfahrene Umzugsmitarbeiter mit der Motivation das beste für Unsere Kunden zu bieten, Überdurchschnitliche Leistungen zu erbringen und ein konkurrenzfähiges Preis-Leistungsverhältnis.`,
      display_order: 0,
      is_active: true,
    },
    {
      title: "Versicherung",
      content: `Die Haftpflichtversicherung ist im Preis eingeschlossen. Verlust oder Beschädigung Ihrer Güter gemäss OR (Frachtvertrag). Wir machen darauf aufmerksam, dass der aktuelle Warenwert (Zeitwert) die Basis einer Leistung darstellt.`,
      display_order: 1,
      is_active: true,
    },
    {
      title: "Transportversicherung",
      content: `Axa Winterthur, bis CHF 200'000 pro Fahrt versichert (Police Nr.14.743.223)
Zürich Versicherung, bis CHF 5 Mio. (Police Nr.4.001.099.637)`,
      display_order: 2,
      is_active: true,
    },
    {
      title: "Schaden und Reklamation",
      content: `Bestehende Schäden an Mobiliar sind dem Umzugschef vor dem Umzug anzuzeigen. Für bestehende Kratz-, Schramm-, Druck Scheuer- und Erschütterungsschäden aller Art übernehmen wir keine Haftung.

Gestützt auf die Bestimmungen des OR-Artikel 452 Absatz 1 sind die Schäden am Frachtgut jeglicher Art sofort nach dem Umzug den Umzugs-mitarbeitern mitzuteilen und schriftlich auf der Quittung mit der Unterschrift des Kunden und des Umzugschefs festzuhalten. Die gleiche Frist- und Formvorschrift gilt ebenfalls für Schäden an Boden, Wand, Decke, Tür usw.

In Abänderung von Artikel 452 Absatz 2 und 3 (OR) sind äusserlich nicht erkennbare Schäden am Frachtgut innerhalb von 1 Tag nach dem Umzug schriftlich mitzuteilen.`,
      display_order: 3,
      is_active: true,
    },
    {
      title: "Pause",
      content: `Alle Pausen gehen zu Lasten der Firma.`,
      display_order: 4,
      is_active: true,
    },
    {
      title: "Schlussworte",
      content: `Wir hoffen, dass Sie genug Informationen erhalten haben und wir Ihr Interesse wecken konnten.

Wir sind uns bewusst, dass Sie Angebote vergleichen und das für Sie passende Angebot aussuchen. Daher ist es uns sehr wichtig, dass Sie sich jederzeit bei uns melden können und wir all Ihre Fragen beantworten und gegebenenfalls Unsicherheiten aus dem Weg schaffen können.

Uns ist der Kundenkontakt sehr wichtig und gerne nehmen wir Verbesserungsvorschläge entgegen.

Wir freuen uns sehr Sie als unserer Kunde zählen zu dürfen und garantieren Ihnen eine zuverlässige, speditive und pünktliche Ausführung. Bei Terminänderungen bitten wir Sie es uns schnellstmöglich mitzuteilen.`,
      display_order: 5,
      is_active: true,
    },
  ];

  // Service-specific customizations
  if (serviceType === "reinigung") {
    return [
      {
        title: "Leistungsumfang",
        content: `Die Reinigung umfasst alle im Angebot aufgeführten Räume und Bereiche. Nicht im Preis inbegriffen sind Arbeiten, die über die normale Endreinigung hinausgehen (z.B. Entfernung von Baustaub, Renovierungsschmutz).`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Reinigungsmittel",
        content: `Alle notwendigen Reinigungsmittel und Geräte werden von uns mitgebracht. Spezielle Reinigungsmittel für empfindliche Oberflächen werden nach Absprache verwendet.`,
        display_order: 1,
        is_active: true,
      },
      {
        title: "Abnahme",
        content: `Nach Abschluss der Reinigung empfehlen wir eine gemeinsame Abnahme vor Ort. Reklamationen müssen innerhalb von 24 Stunden schriftlich erfolgen.`,
        display_order: 2,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "entsorgung" || serviceType === "raeumung") {
    return [
      {
        title: "Entsorgung",
        content: `Die Entsorgung erfolgt fachgerecht und umweltfreundlich gemäss den geltenden Vorschriften. Sondermüll (Chemikalien, Farben, Elektronik) wird separat entsorgt und kann zusätzliche Kosten verursachen.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Wertsachen",
        content: `Wertsachen und persönliche Gegenstände sind vor der Räumung zu entfernen. Für nicht gemeldete Wertsachen übernehmen wir keine Haftung.`,
        display_order: 1,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Pause" || t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "lagerung") {
    return [
      {
        title: "Lagerungsbedingungen",
        content: `Die Lagerräume sind trocken, sauber und sicher. Der Zugang erfolgt nur nach vorheriger Anmeldung während der Geschäftszeiten.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Versicherung Lagerung",
        content: `Die eingelagerten Gegenstände sind gegen Feuer, Wasser und Diebstahl versichert. Der Versicherungswert basiert auf dem aktuellen Zeitwert der Gegenstände.`,
        display_order: 1,
        is_active: true,
      },
      {
        title: "Kündigungsfrist",
        content: `Die Lagerung kann mit einer Frist von 30 Tagen zum Monatsende gekündigt werden. Bei kürzerer Kündigungsfrist wird der volle Monat berechnet.`,
        display_order: 2,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "klaviertransport") {
    return [
      {
        title: "Spezialtransport",
        content: `Klaviere und Flügel werden von speziell geschultem Personal mit entsprechenden Hilfsmitteln transportiert. Die Instrumente werden fachgerecht verpackt und gesichert.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Stimmung",
        content: `Nach einem Transport empfehlen wir, das Instrument ca. 2 Wochen akklimatisieren zu lassen, bevor es gestimmt wird. Die Stimmung ist nicht im Transportpreis inbegriffen.`,
        display_order: 1,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Transportversicherung" || t.title === "Schaden und Reklamation" || t.title === "Schlussworte"),
    ];
  }

  // Default: Umzug templates
  return commonTemplates;
};

export const AgbSectionEditor = ({
  companyId,
  serviceType,
  serviceLabel,
  allServiceTypes = [],
}: AgbSectionEditorProps) => {
  const { toast } = useToast();
  const [sections, setSections] = useState<AgbSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // New section form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  // Copy to another service type
  const [isCopying, setIsCopying] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedTargetService, setSelectedTargetService] = useState<string>("");

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("agb_sections")
        .select("*")
        .eq("company_id", companyId)
        .eq("service_type", serviceType)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setSections(data || []);
      
      // Auto-expand first section if exists
      if (data && data.length > 0 && data[0].id) {
        setExpandedSections(new Set([data[0].id]));
      }
    } catch (error) {
      console.error("Error fetching AGB sections:", error);
      toast({
        title: "Fehler",
        description: "AGB-Abschnitte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, serviceType, toast]);

  useEffect(() => {
    fetchSections();
     
  }, [fetchSections]);

  const handleAddSection = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({
        title: "Pflichtfelder",
        description: "Bitte füllen Sie Titel und Inhalt aus.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingNew(true);
    try {
      const maxOrder = sections.length > 0 
        ? Math.max(...sections.map(s => s.display_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("agb_sections")
        .insert({
          company_id: companyId,
          service_type: serviceType,
          title: newTitle.trim(),
          content: newContent.trim(),
          display_order: maxOrder,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setSections([...sections, data]);
      setNewTitle("");
      setNewContent("");
      setExpandedSections(new Set([...expandedSections, data.id]));

      toast({
        title: "Hinzugefügt",
        description: `Abschnitt "${newTitle}" wurde hinzugefügt.`,
      });
    } catch (error) {
      console.error("Error adding section:", error);
      toast({
        title: "Fehler",
        description: "Der Abschnitt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  const handleUpdateSection = async (section: AgbSection) => {
    if (!section.id) return;

    setIsSaving(section.id);
    try {
      const { error } = await supabase
        .from("agb_sections")
        .update({
          title: section.title,
          content: section.content,
          is_active: section.is_active,
        })
        .eq("id", section.id);

      if (error) throw error;

      toast({
        title: "Gespeichert",
        description: `Abschnitt "${section.title}" wurde aktualisiert.`,
      });
    } catch (error) {
      console.error("Error updating section:", error);
      toast({
        title: "Fehler",
        description: "Der Abschnitt konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(null);
    }
  };

  const handleDeleteSection = async (sectionId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("agb_sections")
        .delete()
        .eq("id", sectionId);

      if (error) throw error;

      setSections(sections.filter(s => s.id !== sectionId));
      toast({
        title: "Gelöscht",
        description: `Abschnitt "${title}" wurde gelöscht.`,
      });
    } catch (error) {
      console.error("Error deleting section:", error);
      toast({
        title: "Fehler",
        description: "Der Abschnitt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const newSections = [...sections];
    const [removed] = newSections.splice(sourceIndex, 1);
    newSections.splice(destinationIndex, 0, removed);
    
    // Update display_order for all affected sections
    const updatedSections = newSections.map((section, index) => ({
      ...section,
      display_order: index,
    }));

    setSections(updatedSections);

    // Save order to database
    try {
      await Promise.all(
        updatedSections.map((section) =>
          supabase
            .from("agb_sections")
            .update({ display_order: section.display_order })
            .eq("id", section.id!)
        )
      );
      
      toast({
        title: "Reihenfolge aktualisiert",
        description: "Die Abschnitte wurden neu sortiert.",
      });
    } catch (error) {
      console.error("Error reordering sections:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      // Revert on error
      fetchSections();
    }
  };

  const handleLoadDefaultTemplates = async () => {
    if (sections.length > 0) {
      toast({
        title: "Hinweis",
        description: "Es existieren bereits AGB-Abschnitte. Löschen Sie diese zuerst, um die Vorlagen zu laden.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingDefaults(true);
    try {
      const templates = getDefaultAgbTemplates(serviceType);
      
      const sectionsToInsert = templates.map((template, index) => ({
        company_id: companyId,
        service_type: serviceType,
        title: template.title,
        content: template.content,
        display_order: index,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("agb_sections")
        .insert(sectionsToInsert)
        .select();

      if (error) throw error;

      setSections(data || []);
      
      if (data && data.length > 0) {
        setExpandedSections(new Set([data[0].id]));
      }

      toast({
        title: "Vorlagen geladen",
        description: `${data?.length || 0} Standard-AGB-Abschnitte wurden hinzugefügt.`,
      });
    } catch (error) {
      console.error("Error loading default templates:", error);
      toast({
        title: "Fehler",
        description: "Die Vorlagen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const toggleExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateSectionField = (sectionId: string, field: keyof AgbSection, value: string | boolean) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, [field]: value } : s
    ));
  };

  const handleCopyToServiceType = async () => {
    if (!selectedTargetService) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Ziel-Service aus.",
        variant: "destructive",
      });
      return;
    }

    const activeSections = sections.filter(s => s.is_active);
    if (activeSections.length === 0) {
      toast({
        title: "Keine aktiven Abschnitte",
        description: "Es gibt keine aktiven AGB-Abschnitte zum Kopieren.",
        variant: "destructive",
      });
      return;
    }

    setIsCopying(true);
    try {
      // Check if target already has sections
      const { data: existingSections, error: checkError } = await supabase
        .from("agb_sections")
        .select("id")
        .eq("company_id", companyId)
        .eq("service_type", selectedTargetService);

      if (checkError) throw checkError;

      // Get max display order for target service
      const { data: maxOrderData } = await supabase
        .from("agb_sections")
        .select("display_order")
        .eq("company_id", companyId)
        .eq("service_type", selectedTargetService)
        .order("display_order", { ascending: false })
        .limit(1);

      const startOrder = maxOrderData && maxOrderData.length > 0 
        ? (maxOrderData[0].display_order || 0) + 1 
        : 0;

      // Copy sections to target service type
      const sectionsToInsert = activeSections.map((section, index) => ({
        company_id: companyId,
        service_type: selectedTargetService,
        title: section.title,
        content: section.content,
        display_order: startOrder + index,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from("agb_sections")
        .insert(sectionsToInsert);

      if (insertError) throw insertError;

      const targetLabel = allServiceTypes.find(s => s.type === selectedTargetService)?.label || selectedTargetService;
      
      toast({
        title: "Kopiert",
        description: `${activeSections.length} Abschnitt(e) wurden zu "${targetLabel}" kopiert.${existingSections && existingSections.length > 0 ? " (zu bestehenden hinzugefügt)" : ""}`,
      });

      setCopyDialogOpen(false);
      setSelectedTargetService("");
    } catch (error) {
      console.error("Error copying sections:", error);
      toast({
        title: "Fehler",
        description: "Die Abschnitte konnten nicht kopiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium">AGB für {serviceLabel}</h4>
          <Badge variant="secondary">{sections.filter(s => s.is_active).length} Abschnitte</Badge>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy to another service type */}
          {sections.filter(s => s.is_active).length > 0 && allServiceTypes.length > 1 && (
            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieren
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Copy className="w-5 h-5" />
                    AGB kopieren
                  </DialogTitle>
                  <DialogDescription>
                    Kopieren Sie {sections.filter(s => s.is_active).length} aktive AGB-Abschnitt(e) zu einem anderen Service
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm mb-2 block">Ziel-Service auswählen</Label>
                    <Select value={selectedTargetService} onValueChange={setSelectedTargetService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Service auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allServiceTypes
                          .filter(s => s.type !== serviceType)
                          .map(s => (
                            <SelectItem key={s.type} value={s.type}>
                              {s.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Die aktiven AGB-Abschnitte werden zum ausgewählten Service hinzugefügt. Bestehende Abschnitte bleiben erhalten.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleCopyToServiceType} 
                    disabled={isCopying || !selectedTargetService}
                  >
                    {isCopying ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    Kopieren
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {sections.filter(s => s.is_active).length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  PDF-Vorschau
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    AGB PDF-Vorschau
                  </DialogTitle>
                  <DialogDescription>
                    So werden die AGB im PDF-Anhang der Offerte dargestellt
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="bg-white border rounded-lg p-6 shadow-sm">
                    {/* PDF Header Simulation */}
                    <div className="bg-primary text-primary-foreground rounded-md px-4 py-3 mb-6 text-center">
                      <h2 className="font-bold text-lg">Allgemeine Geschäftsbedingungen</h2>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-6 italic">
                      Die nachfolgenden AGB sind Bestandteil dieser Offerte und werden mit Annahme der Offerte akzeptiert.
                    </p>
                    
                    <div className="space-y-6">
                      {sections.filter(s => s.is_active).map((section, index) => (
                        <div key={section.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                          <h3 className="font-semibold text-primary mb-2">{section.title}</h3>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {section.content}
                          </p>
                          {index < sections.filter(s => s.is_active).length - 1 && (
                            <Separator className="mt-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
          
          {sections.length === 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadDefaultTemplates}
              disabled={isLoadingDefaults}
            >
              {isLoadingDefaults ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Vorlagen laden
            </Button>
          )}
        </div>
      </div>

      {/* Existing Sections */}
      {sections.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="agb-sections">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-3"
              >
                {sections.map((section, index) => (
                  <Draggable 
                    key={section.id} 
                    draggableId={section.id!} 
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <Card className={`${!section.is_active ? "opacity-50" : ""} ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}>
                          <Collapsible 
                            open={expandedSections.has(section.id!)}
                            onOpenChange={() => toggleExpanded(section.id!)}
                          >
                            <CardHeader className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div 
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-muted rounded transition-colors"
                                >
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                </div>

                                <CollapsibleTrigger asChild>
                                  <div className="flex-1 cursor-pointer">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                                          {section.title}
                                        </span>
                                        {!section.is_active && (
                                          <Badge variant="outline" className="text-xs">Inaktiv</Badge>
                                        )}
                                      </div>
                                      <ChevronDown 
                                        className={`w-4 h-4 transition-transform ${
                                          expandedSections.has(section.id!) ? "rotate-180" : ""
                                        }`}
                                      />
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                              </div>
                            </CardHeader>

                            <CollapsibleContent>
                              <CardContent className="pt-0 pb-4 px-4 space-y-4">
                                <Separator />
                                
                                <div>
                                  <Label className="text-sm">Titel</Label>
                                  <Input
                                    value={section.title}
                                    onChange={(e) => updateSectionField(section.id!, "title", e.target.value)}
                                    placeholder="z.B. Versicherung"
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-sm">Inhalt</Label>
                                  <Textarea
                                    value={section.content}
                                    onChange={(e) => updateSectionField(section.id!, "content", e.target.value)}
                                    rows={6}
                                    placeholder="Beschreibung..."
                                    className="mt-1 font-mono text-sm"
                                  />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={section.is_active}
                                      onChange={(e) => updateSectionField(section.id!, "is_active", e.target.checked)}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                    <span className="text-sm">Aktiv</span>
                                  </label>

                                  <div className="flex gap-2">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                          <Trash2 className="w-4 h-4 sm:mr-2" />
                                          <span className="hidden sm:inline">Löschen</span>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Abschnitt löschen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Möchten Sie den Abschnitt "{section.title}" wirklich löschen? 
                                            Diese Aktion kann nicht rückgängig gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteSection(section.id!, section.title)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Löschen
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>

                                    <Button
                                      onClick={() => handleUpdateSection(section)}
                                      disabled={isSaving === section.id}
                                      size="sm"
                                    >
                                      {isSaving === section.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
                                      ) : (
                                        <Save className="w-4 h-4 sm:mr-2" />
                                      )}
                                      <span className="hidden sm:inline">Speichern</span>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Keine AGB-Abschnitte für {serviceLabel}</p>
          <p className="text-sm mb-4">Fügen Sie unten neue Abschnitte hinzu oder laden Sie Vorlagen</p>
          <Button 
            variant="secondary" 
            onClick={handleLoadDefaultTemplates}
            disabled={isLoadingDefaults}
          >
            {isLoadingDefaults ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Standard-Vorlagen laden
          </Button>
        </div>
      )}

      {/* Add New Section */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Neuen Abschnitt hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-sm">Titel *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="z.B. Versicherung, Transport, Pause, etc."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Inhalt *</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                placeholder="Der vollständige Text für diesen Abschnitt..."
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAddSection}
              disabled={isAddingNew || !newTitle.trim() || !newContent.trim()}
            >
              {isAddingNew ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Abschnitt hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
