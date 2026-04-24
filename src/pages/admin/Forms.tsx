import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getServiceLabel, SERVICE_CATEGORIES } from "@/lib/serviceLabels";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Code,
  FileText,
  Users,
  Smartphone,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import LeadFormWizard from "@/components/forms/LeadFormWizard";

// =============================================================================
// CONSTANTS
// =============================================================================

const LEADS_PAGE_SIZE = 10;

// Valid hex color pattern
const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

// Safe slug pattern (alphanumeric and hyphens only)
const SAFE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Reserved slugs that should not be used
const RESERVED_SLUGS = ["admin", "api", "auth", "embed", "static", "assets", "public", "private"];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate hex color format
 */
const isValidHexColor = (color: string): boolean => {
  return HEX_COLOR_PATTERN.test(color);
};

/**
 * Sanitize hex color - returns valid color or default
 */
const sanitizeHexColor = (color: string | null | undefined, defaultColor = "#6366f1"): string => {
  if (!color) return defaultColor;
  const trimmed = color.trim();
  return isValidHexColor(trimmed) ? trimmed : defaultColor;
};

/**
 * Validate slug format
 */
const isValidSlug = (slug: string): { valid: boolean; error?: string } => {
  if (!slug || slug.trim().length === 0) {
    return { valid: false, error: "Slug ist erforderlich" };
  }
  
  const trimmed = slug.trim().toLowerCase();
  
  if (trimmed.length < 3) {
    return { valid: false, error: "Slug muss mindestens 3 Zeichen lang sein" };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: "Slug darf maximal 50 Zeichen lang sein" };
  }
  
  if (!SAFE_SLUG_PATTERN.test(trimmed)) {
    return { valid: false, error: "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten" };
  }
  
  if (RESERVED_SLUGS.includes(trimmed)) {
    return { valid: false, error: "Dieser Slug ist reserviert und kann nicht verwendet werden" };
  }
  
  return { valid: true };
};

/**
 * Escape HTML special characters for safe embedding
 */
const escapeHtml = (str: string): string => {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => htmlEscapes[char] || char);
};

/**
 * Safe date formatting with error handling
 */
const formatDateSafe = (dateString: string | null | undefined, formatStr = "dd.MM.yyyy"): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatStr, { locale: de });
  } catch {
    return '-';
  }
};

/**
 * Safe date-time formatting
 */
const formatDateTimeSafe = (dateString: string | null | undefined): string => {
  return formatDateSafe(dateString, "dd.MM.yyyy HH:mm");
};

/**
 * Safe clipboard copy with fallback
 */
const copyToClipboardSafe = async (text: string): Promise<boolean> => {
  // Check if Clipboard API is available and we're in a secure context
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback for older browsers or non-secure contexts
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
};

interface Lead {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  from_city: string;
  from_plz: string;
  status: string | null;
  created_at: string | null;
}

interface LeadForm {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  service_types: string[] | null;
  primary_color: string | null;
  show_header: boolean | null;
  header_title: string | null;
  header_subtitle: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  lead_count?: number;
}

// Use centralized service categories
const serviceCategories = SERVICE_CATEGORIES;

const getCategoryForService = (serviceId: string) => {
  return serviceCategories.find(cat => cat.services.some(s => s.id === serviceId));
};

const AdminForms = () => {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
  const [isLeadsDialogOpen, setIsLeadsDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [formLeads, setFormLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    service_types: [] as string[],
    primary_color: "#6366f1",
    show_header: true,
    header_title: "",
    header_subtitle: "",
    is_active: true,
  });
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<LeadForm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Leads pagination
  const [leadsPage, setLeadsPage] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  
  // Slug validation error
  const [slugError, setSlugError] = useState<string | null>(null);
  
  // AbortController refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const leadsAbortRef = useRef<AbortController | null>(null);

  // Track whether the user has manually edited the slug field.
  // While false, slug is auto-generated from the name on every keystroke.
  const slugManuallyEditedRef = useRef(false);

  // Safe base URL (with SSR fallback)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Fetch forms with cleanup
  const fetchForms = useCallback(async (signal?: AbortSignal) => {
    try {
      // Fetch forms
      const { data: formsData, error: formsError } = await supabase
        .from("lead_forms")
        .select("*")
        .order("created_at", { ascending: false });

      if (signal?.aborted) return;
      if (formsError) throw formsError;

      // Count leads by service_type overlap (source_form_id is not set for hardcoded /anfrage routes)
      const countMap: Record<string, number> = {};
      if (Array.isArray(formsData) && formsData.length > 0) {
        const countResults = await Promise.all(
          formsData.map(async (form) => {
            if (signal?.aborted) return null;
            const serviceTypes: string[] = form.service_types ?? [];
            if (serviceTypes.length === 0) return { id: form.id, count: 0 };
            const { count } = await supabase
              .from("leads")
              .select("id", { head: true, count: "exact" })
              .in("service_type", serviceTypes);
            return { id: form.id, count: count ?? 0 };
          })
        );
        if (signal?.aborted) return;
        countResults.forEach((result) => {
          if (result) countMap[result.id] = result.count;
        });
      }

      // Merge counts into forms - type-safe
      if (Array.isArray(formsData)) {
        const formsWithCounts: LeadForm[] = formsData.map((form) => ({
          id: form.id,
          name: form.name,
          slug: form.slug,
          description: form.description,
          service_types: form.service_types,
          primary_color: form.primary_color,
          show_header: form.show_header,
          header_title: form.header_title,
          header_subtitle: form.header_subtitle,
          is_active: form.is_active,
          created_at: form.created_at,
          updated_at: form.updated_at,
          lead_count: countMap[form.id] || 0,
        }));
        setForms(formsWithCounts);
      } else {
        setForms([]);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching forms:", error);
      toast.error("Fehler beim Laden der Formulare");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch with cleanup
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    fetchForms(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [fetchForms]);

  // Fetch form leads with pagination — filters by service_type (source_form_id often not set)
  const fetchFormLeads = useCallback(async (serviceTypes: string[], page = 1) => {
    if (leadsAbortRef.current) {
      leadsAbortRef.current.abort();
    }
    
    const controller = new AbortController();
    leadsAbortRef.current = controller;
    
    setIsLoadingLeads(true);
    try {
      if (serviceTypes.length === 0) {
        setTotalLeadsCount(0);
        setFormLeads([]);
        return;
      }

      const { count, error: countError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("service_type", serviceTypes);
      
      if (controller.signal.aborted) return;
      if (countError) throw countError;
      
      setTotalLeadsCount(count || 0);
      
      const from = (page - 1) * LEADS_PAGE_SIZE;
      const to = from + LEADS_PAGE_SIZE - 1;
      
      const { data, error } = await supabase
        .from("leads")
        .select("id, customer_first_name, customer_last_name, customer_email, customer_phone, service_type, from_city, from_plz, status, created_at")
        .in("service_type", serviceTypes)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (controller.signal.aborted) return;
      if (error) throw error;
      
      if (Array.isArray(data)) {
        setFormLeads(data as Lead[]);
      } else {
        setFormLeads([]);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Error fetching form leads:", error);
      toast.error("Fehler beim Laden der Leads");
      setFormLeads([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingLeads(false);
      }
    }
  }, []);

  // Open leads dialog
  const openLeadsDialog = useCallback((form: LeadForm) => {
    setSelectedForm(form);
    setFormLeads([]);
    setLeadsPage(1);
    setTotalLeadsCount(0);
    setIsLeadsDialogOpen(true);
    fetchFormLeads(form.service_types ?? [], 1);
  }, [fetchFormLeads]);

  // Handle leads page change
  const handleLeadsPageChange = useCallback((newPage: number) => {
    if (selectedForm) {
      setLeadsPage(newPage);
      fetchFormLeads(selectedForm.service_types ?? [], newPage);
    }
  }, [selectedForm, fetchFormLeads]);

  const generateSlug = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[äöüß]/g, (match) => {
        const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
        return map[match] || match;
      })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50); // Limit length
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormData(prev => {
      // Only auto-generate slug if the user hasn't manually edited it
      if (slugManuallyEditedRef.current) {
        return { ...prev, name };
      }
      const newSlug = generateSlug(name);
      const validation = isValidSlug(newSlug);
      setSlugError(validation.valid ? null : validation.error || null);
      return { ...prev, name, slug: newSlug };
    });
  }, [generateSlug]);

  const handleSlugChange = useCallback((slug: string) => {
    const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    slugManuallyEditedRef.current = normalized.length > 0;
    const validation = isValidSlug(normalized);
    setSlugError(validation.valid ? null : validation.error || null);
    setFormData(prev => ({ ...prev, slug: normalized }));
  }, []);

  const handleColorChange = useCallback((color: string, fromPicker = false) => {
    if (fromPicker) {
      // Color picker always produces valid hex — sanitize and apply immediately
      setFormData(prev => ({ ...prev, primary_color: sanitizeHexColor(color) }));
    } else {
      // Text input: allow partial typing without snapping back to default.
      // Final validation happens in handleSubmit.
      setFormData(prev => ({ ...prev, primary_color: color }));
    }
  }, []);

  const resetFormData = useCallback(() => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      service_types: [],
      primary_color: "#6366f1",
      show_header: true,
      header_title: "",
      header_subtitle: "",
      is_active: true,
    });
    setSelectedForm(null);
    setSlugError(null);
    slugManuallyEditedRef.current = false;
  }, []);

  const openEditDialog = useCallback((form: LeadForm) => {
    setSelectedForm(form);
    setSlugError(null);
    slugManuallyEditedRef.current = true; // Preserve existing slug when editing
    setFormData({
      name: form.name,
      slug: form.slug,
      description: form.description || "",
      service_types: form.service_types || [],
      primary_color: sanitizeHexColor(form.primary_color),
      show_header: form.show_header ?? true,
      header_title: form.header_title || "",
      header_subtitle: form.header_subtitle || "",
      is_active: form.is_active ?? true,
    });
    setIsDialogOpen(true);
  }, []);

  const openEmbedDialog = useCallback((form: LeadForm) => {
    setSelectedForm(form);
    setIsEmbedDialogOpen(true);
  }, []);

  const openPreviewDialog = useCallback((form: LeadForm) => {
    setSelectedForm(form);
    setIsPreviewDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate name
    if (!formData.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    
    // Validate slug
    const slugValidation = isValidSlug(formData.slug);
    if (!slugValidation.valid) {
      setSlugError(slugValidation.error || "Ungültiger Slug");
      toast.error(slugValidation.error || "Ungültiger Slug");
      return;
    }
    
    // Validate color
    if (!isValidHexColor(formData.primary_color)) {
      toast.error("Ungültige Farbe. Bitte verwenden Sie ein gültiges Hex-Format (z.B. #6366f1)");
      return;
    }

    setIsSaving(true);
    try {
      // Prepare data with sanitized values
      const dataToSave = {
        ...formData,
        slug: formData.slug.toLowerCase().trim(),
        primary_color: sanitizeHexColor(formData.primary_color),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        header_title: formData.header_title.trim() || null,
        header_subtitle: formData.header_subtitle.trim() || null,
      };
      
      if (selectedForm) {
        const { error } = await supabase
          .from("lead_forms")
          .update(dataToSave)
          .eq("id", selectedForm.id);

        if (error) throw error;
        toast.success("Formular aktualisiert");
      } else {
        const { error } = await supabase
          .from("lead_forms")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Formular erstellt");
      }

      setIsDialogOpen(false);
      resetFormData();
      fetchForms();
    } catch (error: unknown) {
      console.error("Error saving form:", error);
      const isUniqueViolation = error instanceof Error && 'code' in error && (error as { code: string }).code === "23505";
      if (isUniqueViolation) {
        setSlugError("Ein Formular mit diesem Slug existiert bereits");
        toast.error("Ein Formular mit diesem Slug existiert bereits");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } finally {
      setIsSaving(false);
    }
  }, [formData, selectedForm, resetFormData, fetchForms]);

  // Open delete confirmation dialog
  const openDeleteDialog = useCallback((form: LeadForm) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!formToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("lead_forms")
        .delete()
        .eq("id", formToDelete.id);

      if (error) throw error;
      toast.success("Formular gelöscht");
      setDeleteDialogOpen(false);
      setFormToDelete(null);
      fetchForms();
    } catch (error) {
      console.error("Error deleting form:", error);
      toast.error("Fehler beim Löschen. Möglicherweise sind noch Leads mit diesem Formular verknüpft.");
    } finally {
      setIsDeleting(false);
    }
  }, [formToDelete, fetchForms]);

  // Safe clipboard copy with user feedback
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    const success = await copyToClipboardSafe(text);
    if (success) {
      toast.success(`${label} kopiert`);
    } else {
      toast.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
    }
  }, []);

  const getEmbedUrl = useCallback((form: LeadForm): string => {
    // Encode slug to prevent URL injection
    const safeSlug = encodeURIComponent(form.slug);
    return `${baseUrl}/embed/${safeSlug}`;
  }, [baseUrl]);
  
  const getIframeCode = useCallback((form: LeadForm): string => {
    const url = getEmbedUrl(form);
    const escapedUrl = escapeHtml(url);
    return `<iframe src="${escapedUrl}" width="100%" height="800" frameborder="0" style="border: none; border-radius: 8px;"></iframe>

<!-- URL Parameter Options:
  ?color=ff6600     - Custom primary color (hex without #)
  ?lang=de|en|fr|it - Language (de=German, en=English, fr=French, it=Italian)
  ?hideHeader=true  - Hide form header
  
  Example: ${escapedUrl}?color=ff6600&lang=en
-->`;
  }, [getEmbedUrl]);

  const getReactCode = useCallback((form: LeadForm): string => {
    const url = getEmbedUrl(form);
    return `// React/Next.js Component
import React from 'react';

interface LeadFormProps {
  color?: string;      // Hex color without # (e.g., "ff6600")
  lang?: 'de' | 'en' | 'fr' | 'it';
  hideHeader?: boolean;
}

const LeadForm = ({ color, lang = 'de', hideHeader = false }: LeadFormProps) => {
  const params = new URLSearchParams();
  if (color) params.set('color', color);
  if (lang !== 'de') params.set('lang', lang);
  if (hideHeader) params.set('hideHeader', 'true');
  
  const queryString = params.toString();
  const src = "${url}" + (queryString ? "?" + queryString : "");

  return (
    <iframe
      src={src}
      width="100%"
      height="800"
      frameBorder="0"
      style={{ border: 'none', borderRadius: '8px' }}
      title="Anfrage Formular"
    />
  );
};

export default LeadForm;

// Usage:
// <LeadForm />
// <LeadForm color="ff6600" lang="en" />
// <LeadForm hideHeader />`;
  }, [getEmbedUrl]);

  const getJsWidgetCode = useCallback((form: LeadForm): string => {
    const url = getEmbedUrl(form);
    // Escape for JavaScript string
    const escapedUrl = url.replace(/'/g, "\\'");
    return `<!-- WordPress / Django / CMS - JavaScript Widget -->
<div id="leadform-container" 
     data-color=""
     data-lang="de"
     data-hide-header="false">
</div>
<script>
(function() {
  var container = document.getElementById('leadform-container');
  var baseUrl = '${escapedUrl}';
  
  // Read configuration from data attributes
  var color = container.getAttribute('data-color');
  var lang = container.getAttribute('data-lang') || 'de';
  var hideHeader = container.getAttribute('data-hide-header') === 'true';
  
  // Build URL with parameters
  var params = [];
  if (color) params.push('color=' + encodeURIComponent(color));
  if (lang !== 'de') params.push('lang=' + encodeURIComponent(lang));
  if (hideHeader) params.push('hideHeader=true');
  
  var src = baseUrl + (params.length ? '?' + params.join('&') : '');
  
  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.width = '100%';
  iframe.height = '800';
  iframe.frameBorder = '0';
  iframe.style.cssText = 'border: none; border-radius: 8px; min-height: 800px;';
  iframe.title = 'Anfrage Formular';
  
  // Auto-resize based on content
  window.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'leadform-resize' || e.data.type === 'offerio-resize')) {
      iframe.style.height = e.data.height + 'px';
    }

    if (e.data && e.data.type === 'leadform-step-change') {
      iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  container.appendChild(iframe);
})();
</script>

<!-- Configuration Options:
  data-color="ff6600"      - Custom primary color (hex without #)
  data-lang="de|en|fr|it"  - Language
  data-hide-header="true"  - Hide form header
-->`;
  }, [getEmbedUrl]);

  const getWordPressShortcode = useCallback((form: LeadForm): string => {
    const url = getEmbedUrl(form);
    // Escape for PHP string
    const escapedUrl = url.replace(/'/g, "\\'");
    return `<!-- WordPress Shortcode (add to functions.php) -->
// In functions.php:
function leadform_shortcode($atts) {
  $atts = shortcode_atts(array(
    'color' => '',
    'lang' => 'de',
    'hideheader' => 'false'
  ), $atts, 'leadform');
  
  $base_url = '${escapedUrl}';
  $params = array();
  
  if (!empty($atts['color'])) {
    $params[] = 'color=' . esc_attr($atts['color']);
  }
  if ($atts['lang'] !== 'de') {
    $params[] = 'lang=' . esc_attr($atts['lang']);
  }
  if ($atts['hideheader'] === 'true') {
    $params[] = 'hideHeader=true';
  }
  
  $url = $base_url . (!empty($params) ? '?' . implode('&', $params) : '');
  
  return '<iframe 
    src="' . esc_url($url) . '" 
    width="100%" 
    height="800" 
    frameborder="0" 
    style="border: none; border-radius: 8px;">
  </iframe>';
}
add_shortcode('leadform', 'leadform_shortcode');

// Usage in WordPress pages/posts:
[leadform]
[leadform color="ff6600" lang="en"]
[leadform hideheader="true"]`;
  }, [getEmbedUrl]);

  const getDjangoCode = useCallback((form: LeadForm): string => {
    const url = getEmbedUrl(form);
    // Escape for Python string
    const escapedUrl = url.replace(/'/g, "\\'");
    return `<!-- Django Template -->
{% load static %}

<div class="leadform-wrapper">
  <iframe 
    src="${escapeHtml(url)}?lang=de"
    width="100%" 
    height="800" 
    frameborder="0"
    style="border: none; border-radius: 8px;"
    title="Anfrage Formular">
  </iframe>
</div>

<!-- Or as a Django template tag in templatetags/leadform.py: -->
from django import template
from django.utils.safestring import mark_safe
from django.utils.html import escape
from urllib.parse import urlencode

register = template.Library()

@register.simple_tag
def leadform(color=None, lang='de', hide_header=False):
    base_url = '${escapedUrl}'
    params = {}
    if color:
        params['color'] = color
    if lang != 'de':
        params['lang'] = lang
    if hide_header:
        params['hideHeader'] = 'true'
    
    url = base_url + ('?' + urlencode(params) if params else '')
    
    return mark_safe(f'''
        <iframe 
            src="{escape(url)}"
            width="100%" 
            height="800" 
            frameborder="0"
            style="border: none; border-radius: 8px;">
        </iframe>
    ''')

<!-- Usage: 
  {% load leadform %} 
  {% leadform %}
  {% leadform color="ff6600" lang="en" %}
  {% leadform hide_header=True %}
-->`;
  }, [getEmbedUrl]);

  return (
    <>
      <Helmet>
        <title>Formulare | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Anfrage-Formulare</h2>
              <p className="text-muted-foreground">
                Erstellen und verwalten Sie einbettbare Formulare
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetFormData();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Neues Formular
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedForm ? "Formular bearbeiten" : "Neues Formular erstellen"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="z.B. Homepage Formular"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug (URL) *</Label>
                      <Input
                        id="slug"
                        placeholder="z.B. homepage-formular"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className={slugError ? "border-destructive" : ""}
                        aria-describedby={slugError ? "slug-error" : undefined}
                        aria-invalid={!!slugError}
                      />
                      {slugError && (
                        <p id="slug-error" className="text-sm text-destructive">{slugError}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Beschreibung</Label>
                    <Textarea
                      id="description"
                      placeholder="Interne Notizen zum Formular..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Service-Kategorie</Label>
                    <p className="text-sm text-muted-foreground">
                      Wählen Sie eine Kategorie. Im Formular kann der Kunde den genauen Service-Typ auswählen.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {serviceCategories.map((category) => (
                        <div
                          key={category.id}
                          onClick={() => {
                            // Set all services of this category
                            setFormData(prev => ({
                              ...prev,
                              service_types: category.services.map(s => s.id)
                            }));
                          }}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50 ${
                            category.services.every(s => formData.service_types.includes(s.id)) && 
                            formData.service_types.length === category.services.length
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="font-medium">{category.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{category.description}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {category.services.map(s => s.label).join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Primärfarbe</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary_color"
                          type="color"
                          value={isValidHexColor(formData.primary_color) ? formData.primary_color : "#6366f1"}
                          onChange={(e) => handleColorChange(e.target.value, true)}
                          className="w-12 h-10 p-1"
                          aria-label="Farbwähler"
                        />
                        <Input
                          value={formData.primary_color}
                          onChange={(e) => handleColorChange(e.target.value, false)}
                          className={`flex-1 ${!isValidHexColor(formData.primary_color) ? 'border-destructive' : ''}`}
                          placeholder="#6366f1"
                          pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                          aria-label="Hex-Farbwert"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Format: #RRGGBB (z.B. #6366f1)</p>
                    </div>
                    <div className="space-y-2 flex flex-col justify-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="show_header"
                          checked={formData.show_header}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_header: checked }))}
                        />
                        <Label htmlFor="show_header">Header anzeigen</Label>
                      </div>
                    </div>
                  </div>

                  {formData.show_header && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="header_title">Header Titel</Label>
                        <Input
                          id="header_title"
                          placeholder="Offerte anfragen"
                          value={formData.header_title}
                          onChange={(e) => setFormData(prev => ({ ...prev, header_title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="header_subtitle">Header Untertitel</Label>
                        <Textarea
                          id="header_subtitle"
                          placeholder="Füllen Sie das Formular aus..."
                          value={formData.header_subtitle}
                          onChange={(e) => setFormData(prev => ({ ...prev, header_subtitle: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Formular aktiv</Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving || !!slugError}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Speichern...
                        </>
                      ) : (
                        selectedForm ? "Speichern" : "Erstellen"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Embed Code Dialog */}
          <Dialog open={isEmbedDialogOpen} onOpenChange={setIsEmbedDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  <Code className="w-5 h-5 inline mr-2" />
                  Embed-Code: {selectedForm?.name}
                </DialogTitle>
              </DialogHeader>
              {selectedForm && (
                <div className="space-y-6 py-4">
                  {/* Direct Link */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Direkt-Link
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={getEmbedUrl(selectedForm)}
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(getEmbedUrl(selectedForm), "Link")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(getEmbedUrl(selectedForm), "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Basic iFrame */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">HTML</Badge>
                      iFrame-Code (Universal)
                    </Label>
                    <div className="relative">
                      <Textarea
                        readOnly
                        value={getIframeCode(selectedForm)}
                        className="font-mono text-xs min-h-[80px]"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getIframeCode(selectedForm), "iFrame-Code")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopieren
                      </Button>
                    </div>
                  </div>

                  {/* React Component */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">React</Badge>
                      React / Next.js Component
                    </Label>
                    <div className="relative">
                      <Textarea
                        readOnly
                        value={getReactCode(selectedForm)}
                        className="font-mono text-xs min-h-[180px]"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getReactCode(selectedForm), "React-Code")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopieren
                      </Button>
                    </div>
                  </div>

                  {/* JavaScript Widget */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">JS</Badge>
                      JavaScript Widget (CMS / WordPress)
                    </Label>
                    <div className="relative">
                      <Textarea
                        readOnly
                        value={getJsWidgetCode(selectedForm)}
                        className="font-mono text-xs min-h-[200px]"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getJsWidgetCode(selectedForm), "JS-Widget-Code")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopieren
                      </Button>
                    </div>
                  </div>

                  {/* WordPress Shortcode */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-[#21759b]/10 text-[#21759b] border-[#21759b]/30">WordPress</Badge>
                      WordPress Shortcode
                    </Label>
                    <div className="relative">
                      <Textarea
                        readOnly
                        value={getWordPressShortcode(selectedForm)}
                        className="font-mono text-xs min-h-[180px]"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getWordPressShortcode(selectedForm), "WordPress-Code")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopieren
                      </Button>
                    </div>
                  </div>

                  {/* Django Template */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">Django</Badge>
                      Django Template
                    </Label>
                    <div className="relative">
                      <Textarea
                        readOnly
                        value={getDjangoCode(selectedForm)}
                        className="font-mono text-xs min-h-[200px]"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getDjangoCode(selectedForm), "Django-Code")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopieren
                      </Button>
                    </div>
                  </div>

                  {/* Usage Tips */}
                  <div className="p-4 bg-muted/50 rounded-lg text-sm">
                    <p className="font-medium mb-2">Verwendung:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>HTML/iFrame:</strong> Für statische Websites</li>
                      <li><strong>React:</strong> Für React/Next.js Projekte</li>
                      <li><strong>JS Widget:</strong> Für WordPress, Wix, Squarespace, etc.</li>
                      <li><strong>WordPress:</strong> Shortcode für einfache Integration</li>
                      <li><strong>Django:</strong> Template-Tag für Python-Projekte</li>
                    </ul>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Preview Dialog */}
          <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Formular-Vorschau: {selectedForm?.name}
                </DialogTitle>
              </DialogHeader>
              {selectedForm && (
                <div className="py-4">
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Kategorie:</span>{" "}
                      {getCategoryForService(selectedForm.service_types?.[0] || "")?.label || "Alle Services"}
                    </div>
                    <Badge variant="outline">
                      {selectedForm.service_types?.length || 0} Service(s)
                    </Badge>
                  </div>
                  
                  {/* Form Header Preview */}
                  {selectedForm.show_header && (
                    <div 
                      className="mb-6 p-6 rounded-xl text-center"
                      style={{ 
                        backgroundColor: isValidHexColor(selectedForm.primary_color || '') 
                          ? `${selectedForm.primary_color}15` 
                          : '#6366f115' 
                      }}
                    >
                      <h2 
                        className="text-2xl font-bold mb-2"
                        style={{ 
                          color: isValidHexColor(selectedForm.primary_color || '') 
                            ? selectedForm.primary_color || undefined 
                            : '#6366f1' 
                        }}
                      >
                        {selectedForm.header_title || "Offerte anfragen"}
                      </h2>
                      {selectedForm.header_subtitle && (
                        <p className="text-muted-foreground">{selectedForm.header_subtitle}</p>
                      )}
                    </div>
                  )}
                  
                  {/* LeadFormWizard Preview */}
                  <div 
                    className="border rounded-xl p-4"
                    style={{ 
                      ['--form-primary' as string]: sanitizeHexColor(selectedForm.primary_color)
                    }}
                  >
                    <LeadFormWizard
                      allowedServices={selectedForm.service_types || []}
                      formId={selectedForm.id}
                      formSlug={selectedForm.slug}
                    />
                  </div>
                  
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Hinweis:</strong> Dies ist eine Vorschau. Eingereichte Anfragen werden als Test-Daten gespeichert.
                    </p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Leads Detail Dialog */}
          <Dialog open={isLeadsDialogOpen} onOpenChange={setIsLeadsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Leads: {selectedForm?.name}
                </DialogTitle>
              </DialogHeader>
              {selectedForm && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {totalLeadsCount} Lead{totalLeadsCount !== 1 ? "s" : ""} über dieses Formular
                    </p>
                    <Badge variant="outline">
                      Slug: {selectedForm.slug}
                    </Badge>
                  </div>

                  {isLoadingLeads ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Lade Leads...</span>
                    </div>
                  ) : formLeads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Noch keine Leads über dieses Formular eingegangen.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Kontakt</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Standort</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTimeSafe(lead.created_at)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {[lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(' ') || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{lead.customer_email || '-'}</div>
                                <div className="text-muted-foreground">{lead.customer_phone || '-'}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {getServiceLabel(lead.service_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {[lead.from_plz, lead.from_city].filter(Boolean).join(' ') || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={lead.status === "matched" ? "default" : "outline"}>
                                {lead.status || "pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  
                  {/* Leads Pagination */}
                  {totalLeadsCount > LEADS_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        {((leadsPage - 1) * LEADS_PAGE_SIZE) + 1}-{Math.min(leadsPage * LEADS_PAGE_SIZE, totalLeadsCount)} von {totalLeadsCount}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLeadsPageChange(leadsPage - 1)}
                          disabled={leadsPage === 1 || isLoadingLeads}
                          aria-label="Vorherige Seite"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">
                          Seite {leadsPage} von {Math.ceil(totalLeadsCount / LEADS_PAGE_SIZE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLeadsPageChange(leadsPage + 1)}
                          disabled={leadsPage >= Math.ceil(totalLeadsCount / LEADS_PAGE_SIZE) || isLoadingLeads}
                          aria-label="Nächste Seite"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Formular löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchten Sie das Formular <strong>"{formToDelete?.name}"</strong> wirklich löschen?
                  <br /><br />
                  Diese Aktion kann nicht rückgängig gemacht werden.
                  {(formToDelete?.lead_count || 0) > 0 && (
                    <span className="block mt-2 text-amber-600">
                      Hinweis: {formToDelete?.lead_count} Lead(s) sind mit diesem Formular verknüpft.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Löschen...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Forms Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Alle Formulare
              </CardTitle>
              <CardDescription>
                {forms.length} Formular{forms.length !== 1 ? "e" : ""} erstellt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Lade Formulare...
                </div>
              ) : forms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Noch keine Formulare erstellt. Klicken Sie auf "Neues Formular" um zu beginnen.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((form) => (
                      <TableRow key={form.id}>
                        <TableCell className="font-medium">{form.name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {form.slug}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={form.is_active ? "default" : "secondary"}>
                            {form.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-mono h-auto py-1 px-2"
                            onClick={() => openLeadsDialog(form)}
                            disabled={!form.lead_count}
                          >
                            <Users className="w-3 h-3 mr-1" />
                            {form.lead_count || 0}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {form.service_types && form.service_types.length > 0 ? (
                            <Badge variant="outline">
                              {getCategoryForService(form.service_types[0])?.label || form.service_types.length + " Services"}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Alle</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateSafe(form.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPreviewDialog(form)}
                              title="Vorschau im Admin"
                            >
                              <Smartphone className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(getEmbedUrl(form), "_blank")}
                              title="In neuem Tab öffnen"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEmbedDialog(form)}
                              title="Embed-Code"
                            >
                              <Code className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(form)}
                              title="Bearbeiten"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(form)}
                              title="Löschen"
                              className="text-destructive hover:text-destructive"
                              aria-label={`Formular ${form.name} löschen`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminForms;
