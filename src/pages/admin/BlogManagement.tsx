import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import DOMPurify from "dompurify";
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
  DialogFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  Loader2,
  Sparkles,
  PenTool,
  MoreVertical,
  Search,
  CheckCircle,
  FileText,
  AlertCircle,
  Trash2,
  Globe,
  TrendingUp,
  Clock,
  Image as ImageIcon,
  Save,
  Upload,
  Brain,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { convertToWebP } from "@/lib/image-utils";
import { LLM_MODELS, PROVIDER_COLORS, type LLMModel } from "@/types/llmModels";

// =============================================================================
// CONSTANTS
// =============================================================================

const BLOG_CATEGORIES = [
  "Umzug",
  "Reinigung",
  "Entrümpelung",
  "Lagerung",
  "Klaviertransport",
  "Büroumzug",
  "Möbellift",
  "Recht & Versicherung",
  "Checklisten",
  "Finanzen & Kosten",
  "Immobilien",
  "Nachhaltigkeit",
  "Technologie",
  "Community",
  "Allgemein",
  "Tipps & Tricks",
] as const;

const _MAX_TITLE_LENGTH = 100;
const MAX_SLUG_LENGTH = 100;
const MAX_EXCERPT_LENGTH = 300;
const MAX_META_DESC_LENGTH = 160;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for BlogPost
 */
function isValidBlogPost(item: unknown): item is BlogPost {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.slug === 'string'
  );
}

/**
 * Validate image URL - only allow http/https
 */
function isValidImageUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (optional)
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Generate slug from title with German character support
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Validate slug format
 */
function isValidSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: 'Slug ist erforderlich' };
  if (slug.length > MAX_SLUG_LENGTH) return { valid: false, error: `Max. ${MAX_SLUG_LENGTH} Zeichen` };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, error: 'Nur a-z, 0-9 und Bindestriche' };
  }
  return { valid: true };
}

/**
 * Safe date formatting
 */
function formatDateSafe(dateString: string | null | undefined, formatStr: string = "dd.MM.yyyy"): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatStr, { locale: de });
  } catch {
    return '-';
  }
}

/**
 * User-friendly error message
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';

  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23505') return 'Ein Blog mit diesem Slug existiert bereits.';
    if (error.code === '42501') return 'Keine Berechtigung. Bitte erneut anmelden.';
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'Ein Blog mit diesem Slug existiert bereits.';
  }

  return 'Fehler bei der Aktion. Bitte versuchen Sie es erneut.';
}

interface GalleryImage {
  placeholder: string;
  url?: string;
  description?: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category_name: string;
  status: string;
  view_count: number;
  published_at: string | null;
  created_at: string;
  seo_title: string | null;
  focus_keyword: string | null;
  meta_description: string | null;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  gallery_images: GalleryImage[] | null;
}

const BlogManagement = () => {
  const { toast } = useToast();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Partial<BlogPost> | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<BlogPost | null>(null);
  const [isDeletingBlog, setIsDeletingBlog] = useState(false);

  // Publishing states
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Refs for async safety
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const featuredImageRef = useRef<HTMLInputElement>(null);
  const galleryImage1Ref = useRef<HTMLInputElement>(null);
  const galleryImage2Ref = useRef<HTMLInputElement>(null);

  const [aiStep, setAiStep] = useState(1);
  const [aiConfig, setAiConfig] = useState({
    topic: "",
    category: "",
    target_city: "",
    keywords: "",
    style: "informative",
    model_id: "claude-sonnet-4-5",
  });
  const [generatedBlog, setGeneratedBlog] = useState<Partial<BlogPost> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    drafts: 0,
    views: 0,
  });

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchBlogs = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isMountedRef.current) return;
      if (error) throw error;

      // Type-safe filtering
      const validBlogs = (data || []).filter(isValidBlogPost);
      setBlogs(validBlogs);

      // Calculate stats
      const total = validBlogs.length;
      const published = validBlogs.filter(b => b.status === "published").length;
      const drafts = validBlogs.filter(b => b.status === "draft").length;
      const views = validBlogs.reduce((sum, b) => sum + (b.view_count || 0), 0);

      setStats({ total, published, drafts, views });
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;

      console.error("Error fetching blogs:", error);
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
    fetchBlogs();
  }, [fetchBlogs]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file || !editingBlog) return;

    setIsUploadingImg(type);
    try {
      // 1. Convert to WebP
      const webpFile = await convertToWebP(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200
      });

      // 2. Upload to storage
      const fileName = `blog-${Date.now()}-${type}.webp`;
      const { data, error: uploadError } = await supabase.storage
        .from("blog-content")
        .upload(fileName, webpFile);

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("blog-content")
        .getPublicUrl(data.path);

      // 4. Update editingBlog state
      if (type === "featured") {
        setEditingBlog({ ...editingBlog, featured_image_url: publicUrl });
      } else if (type.startsWith("gallery-")) {
        const num = type.split("-")[1];
        const placeholder = `[IMAGE_PLACEHOLDER_${num}]`;
        const gallery = Array.isArray(editingBlog.gallery_images) ? [...editingBlog.gallery_images] : [];
        const index = gallery.findIndex((g: GalleryImage) => g.placeholder === placeholder);

        if (index > -1) {
          gallery[index] = { ...gallery[index], url: publicUrl };
        } else {
          gallery.push({ placeholder, url: publicUrl, description: "" });
        }
        setEditingBlog({ ...editingBlog, gallery_images: gallery });
      }

      toast({
        title: "Bild hochgeladen",
        description: "Das Bild wurde optimiert (WebP) und erfolgreich hochgeladen.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload-Fehler",
        description: "Beim Hochladen des Bildes ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImg(null);
      if (event.target) event.target.value = "";
    }
  };

  const handleGenerateAi = async () => {
    if (!aiConfig.topic || !aiConfig.category) {
      toast({
        title: "Fehler",
        description: "Bitte Thema und Kategorie angeben.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setAiStep(2);

    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-ai", {
        body: {
          topic: aiConfig.topic,
          category: aiConfig.category,
          target_city: aiConfig.target_city,
          keywords: aiConfig.keywords.split(",").map(k => k.trim()),
          style: aiConfig.style,
          model_id: aiConfig.model_id,
        },
      });

      if (error) {
        // Detailed error parsing for Supabase Functions
        let errorMessage = "Fehler bei der AI-Generierung";
        try {
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'object' && error !== null) {
            // @ts-expect-error - Handle Supabase error object details
            const details = await error.context?.json?.();
            if (details?.error) errorMessage = details.error;
          }
        } catch (_e) {
          errorMessage = "Edge Function hat einen Fehler gemeldet.";
        }
        throw new Error(errorMessage);
      }

      if (data && data.blog) {
        setGeneratedBlog(data.blog);
        setAiStep(3);
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Keine Daten von AI erhalten");
      }
    } catch (error: unknown) {
      console.error("AI Generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Fehler bei der AI-Generierung.";
      toast({
        title: "AI Fehler",
        description: errorMessage,
        variant: "destructive",
      });
      setAiStep(1);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveGeneratedBlog = async (publish = false) => {
    if (!generatedBlog) return;

    try {
      const { error } = await supabase.from("blog_posts").insert({
        title: generatedBlog.title,
        slug: generatedBlog.slug,
        meta_description: generatedBlog.meta_description,
        content: generatedBlog.content,
        excerpt: generatedBlog.excerpt,
        focus_keyword: generatedBlog.focus_keyword,
        seo_title: generatedBlog.seo_title,
        seo_description: generatedBlog.meta_description,
        category_name: aiConfig.category,
        tags: generatedBlog.tags,
        faq_schema: generatedBlog.faq_schema,
        gallery_images: generatedBlog.gallery_images,
        status: publish ? "published" : "draft",
        published_at: publish ? new Date().toISOString() : null,
        generated_by_ai: true,
        ai_model_used: "claude-3-5-sonnet",
        generation_prompt: aiConfig.topic,
      });

      if (error) throw error;

      toast({
        title: "Blog gespeichert",
        description: publish ? "Der Blog wurde veröffentlicht." : "Der Blog wurde als Entwurf gespeichert.",
      });

      setShowAiModal(false);
      fetchBlogs();
    } catch (error: unknown) {
      console.error("Error saving blog:", error);

      let errorMessage = "Blog konnte nicht gespeichert werden.";
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === "23505") {
          errorMessage = "Ein Blog mit diesem Slug existiert bereits.";
        } else if (error.code === "42501") {
          errorMessage = "Keine Berechtigung. Bitte erneut anmelden.";
        }
      }
      if (error instanceof Error && error.message) {
        errorMessage = `Fehler: ${error.message}`;
      }

      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditBlog = (blog: BlogPost) => {
    // Ensure all fields are handled to avoid null pointer crashes in the Dialog
    setEditingBlog({
      ...blog,
      category_name: blog.category_name || "Umzug",
      gallery_images: Array.isArray(blog.gallery_images) ? blog.gallery_images : [],
      title: blog.title || "",
      slug: blog.slug || "",
      content: blog.content || "",
      excerpt: blog.excerpt || "",
      meta_description: blog.meta_description || "",
      focus_keyword: blog.focus_keyword || "",
      seo_title: blog.seo_title || "",
      featured_image_url: blog.featured_image_url || "",
      featured_image_alt: blog.featured_image_alt || ""
    });
    setShowEditModal(true);
  };

  const handleCreateManual = () => {
    setEditingBlog({
      title: "",
      slug: "",
      content: "<h2>Überschrift</h2><p>Schreiben Sie hier Ihren Inhalt...</p>",
      excerpt: "",
      meta_description: "",
      focus_keyword: "",
      seo_title: "",
      featured_image_url: "",
      featured_image_alt: "",
      category_name: "Umzug",
      status: "draft",
      gallery_images: []
    });
    setShowEditModal(true);
  };

  const saveEditedBlog = useCallback(async () => {
    // Double-submit protection
    if (!editingBlog || isSavingEdit) return;

    // Validation
    if (!editingBlog.title?.trim()) {
      toast({
        title: "Validierung",
        description: "Titel ist erforderlich.",
        variant: "destructive",
      });
      return;
    }

    // Generate slug if empty
    const slug = editingBlog.slug?.trim() || generateSlug(editingBlog.title);

    // Validate slug
    const slugValidation = isValidSlug(slug);
    if (!slugValidation.valid) {
      toast({
        title: "Validierung",
        description: slugValidation.error || "Ungültiger Slug.",
        variant: "destructive",
      });
      return;
    }

    // Validate image URLs
    if (editingBlog.featured_image_url && !isValidImageUrl(editingBlog.featured_image_url)) {
      toast({
        title: "Validierung",
        description: "Ungültige Bild-URL (nur http/https erlaubt).",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      const blogData = {
        title: editingBlog.title.trim(),
        slug,
        content: editingBlog.content,
        excerpt: editingBlog.excerpt?.slice(0, MAX_EXCERPT_LENGTH),
        meta_description: editingBlog.meta_description?.slice(0, MAX_META_DESC_LENGTH),
        focus_keyword: editingBlog.focus_keyword,
        seo_title: editingBlog.seo_title,
        featured_image_url: editingBlog.featured_image_url,
        featured_image_alt: editingBlog.featured_image_alt,
        gallery_images: editingBlog.gallery_images,
        category_name: editingBlog.category_name,
        updated_at: new Date().toISOString(),
      };

      let error;

      if (editingBlog.id) {
        const { error: updateError } = await supabase
          .from("blog_posts")
          .update(blogData)
          .eq("id", editingBlog.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("blog_posts")
          .insert([{
            ...blogData,
            status: "draft",
            author_name: "Offerio Team"
          }]);
        error = insertError;
      }

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: editingBlog.id ? "Die Änderungen wurden gespeichert." : "Der Blog-Artikel wurde erstellt.",
      });
      setShowEditModal(false);
      setEditingBlog(null);
      fetchBlogs();
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      console.error("Error saving blog:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSavingEdit(false);
      }
    }
  }, [editingBlog, isSavingEdit, toast, fetchBlogs]);

  const openDeleteDialog = useCallback((blog: BlogPost) => {
    setBlogToDelete(blog);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setBlogToDelete(null);
  }, []);

  const deleteBlog = useCallback(async () => {
    if (!blogToDelete || isDeletingBlog) return;

    setIsDeletingBlog(true);

    // Optimistic update
    const previousBlogs = [...blogs];
    setBlogs(prev => prev.filter(b => b.id !== blogToDelete.id));
    setDeleteDialogOpen(false);

    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", blogToDelete.id);

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Gelöscht",
        description: "Der Blog wurde erfolgreich gelöscht.",
      });

      // Update stats
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        published: blogToDelete.status === 'published' ? prev.published - 1 : prev.published,
        drafts: blogToDelete.status === 'draft' ? prev.drafts - 1 : prev.drafts,
        views: prev.views - (blogToDelete.view_count || 0),
      }));
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback on error
      setBlogs(previousBlogs);
      console.error("Error deleting blog:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsDeletingBlog(false);
        setBlogToDelete(null);
      }
    }
  }, [blogToDelete, isDeletingBlog, blogs, toast]);

  const publishBlog = useCallback(async (id: string) => {
    if (publishingId) return;

    setPublishingId(id);

    // Optimistic update
    const previousBlogs = [...blogs];
    setBlogs(prev => prev.map(b =>
      b.id === id ? { ...b, status: "published", published_at: new Date().toISOString() } : b
    ));

    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", id);

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Veröffentlicht",
        description: "Der Blog ist jetzt live.",
      });

      // Update stats
      setStats(prev => ({
        ...prev,
        published: prev.published + 1,
        drafts: prev.drafts - 1,
      }));
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback
      setBlogs(previousBlogs);
      console.error("Error publishing blog:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setPublishingId(null);
      }
    }
  }, [publishingId, blogs, toast]);

  const unpublishBlog = useCallback(async (id: string) => {
    if (publishingId) return;

    setPublishingId(id);

    // Optimistic update
    const previousBlogs = [...blogs];
    setBlogs(prev => prev.map(b =>
      b.id === id ? { ...b, status: "draft" } : b
    ));

    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "draft" })
        .eq("id", id);

      if (!isMountedRef.current) return;
      if (error) throw error;

      toast({
        title: "Entwurf",
        description: "Der Blog wurde auf Entwurf gesetzt.",
      });

      // Update stats
      setStats(prev => ({
        ...prev,
        published: prev.published - 1,
        drafts: prev.drafts + 1,
      }));
    } catch (error) {
      if (!isMountedRef.current) return;

      // Rollback
      setBlogs(previousBlogs);
      console.error("Error unpublishing blog:", error);
      toast({
        title: "Fehler",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setPublishingId(null);
      }
    }
  }, [publishingId, blogs, toast]);

  const filteredBlogs = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return blogs.filter(blog => {
      const matchesSearch = !query ||
        blog.title.toLowerCase().includes(query) ||
        blog.slug.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || blog.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || blog.category_name === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [blogs, searchQuery, statusFilter, categoryFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-500">Live</Badge>;
      case "draft":
        return <Badge variant="outline">Entwurf</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500">Geplant</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Blog Management | Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Blog Management</h1>
            <p className="text-muted-foreground text-sm">SEO-optimierte Inhalte für offerio.ch</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" onClick={handleCreateManual} className="flex-1 sm:flex-none">
              <PenTool className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Manuell Erstellen</span>
              <span className="sm:hidden">Manuell</span>
            </Button>
            <Button onClick={() => { setShowAiModal(true); setAiStep(1); }} className="flex-1 sm:flex-none">
              <Sparkles className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">AI Generieren</span>
              <span className="sm:hidden">AI</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Gesamt Artikel</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.published}</div>
              <p className="text-xs text-muted-foreground">Live</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.drafts}</div>
              <p className="text-xs text-muted-foreground">Entwürfe</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-secondary" />
                {stats.views}
              </div>
              <p className="text-xs text-muted-foreground">Seitenaufrufe</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Titel, Slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="published">Live</SelectItem>
                  <SelectItem value="draft">Entwurf</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  <SelectItem value="Umzug">Umzug</SelectItem>
                  <SelectItem value="Reinigung">Reinigung</SelectItem>
                  <SelectItem value="Entrümpelung">Entrümpelung</SelectItem>
                  <SelectItem value="Tipps & Tricks">Tipps & Tricks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Blog Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Views</TableHead>
                  <TableHead className="hidden md:table-cell">Erstellt am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : filteredBlogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Keine Blogs gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBlogs.map((blog) => (
                    <TableRow key={blog.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium line-clamp-1">{blog.title}</span>
                          <span className="text-xs text-muted-foreground truncate">/{blog.slug}</span>
                          {/* Kategorie & datum only on mobile */}
                          <div className="flex items-center gap-2 mt-1 sm:hidden">
                            {blog.category_name && <Badge variant="outline" className="text-[10px] px-1 py-0">{blog.category_name}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{blog.category_name}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(blog.status)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          {blog.view_count || 0}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {formatDateSafe(blog.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Blog Optionen">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/blog/${blog.slug}?preview=true`, "_blank")}>
                              <Globe className="w-4 h-4 mr-2" /> Vorschau
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditBlog(blog)}>
                              <PenTool className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {blog.status === "draft" ? (
                              <DropdownMenuItem onClick={() => publishBlog(blog.id)}>
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Veröffentlichen
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => unpublishBlog(blog.id)}>
                                <Clock className="w-4 h-4 mr-2" /> Als Entwurf setzen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteDialog(blog)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* AI Generation Modal */}
        <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                AI Blog Generator
              </DialogTitle>
              <DialogDescription>
                Erstellen Sie in Sekunden einen hochwertigen, SEO-optimierten Blog-Artikel.
              </DialogDescription>
            </DialogHeader>

            {aiStep === 1 && (
              <div className="space-y-4 py-4">
                {/* AI Model Selection */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    KI-Modell auswählen
                  </Label>
                  <Select value={aiConfig.model_id} onValueChange={(v) => setAiConfig({ ...aiConfig, model_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Modell auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(
                        LLM_MODELS.reduce((acc, model) => {
                          if (!acc[model.provider]) acc[model.provider] = [];
                          acc[model.provider].push(model);
                          return acc;
                        }, {} as Record<string, LLMModel[]>)
                      ).map(([provider, models]) => (
                        <div key={provider}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS]}`} />
                            {provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google"}
                          </div>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                                {model.isLatest && (
                                  <Badge variant="secondary" className="text-xs">Neu</Badge>
                                )}
                                {model.isRecommended && (
                                  <Badge className="text-xs bg-yellow-100 text-yellow-800">⭐ Empfohlen</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Model Info */}
                  {LLM_MODELS.find(m => m.id === aiConfig.model_id) && (
                    <p className="text-xs text-muted-foreground">
                      {LLM_MODELS.find(m => m.id === aiConfig.model_id)?.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="topic">Thema / Hauptkeyword</Label>
                  <Input
                    id="topic"
                    placeholder="z.B. Umzug Zürich Kosten Guide"
                    value={aiConfig.topic}
                    onChange={(e) => setAiConfig({ ...aiConfig, topic: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ai-category">Kategorie</Label>
                    <Select value={aiConfig.category || ""} onValueChange={(v) => setAiConfig({ ...aiConfig, category: v })}>
                      <SelectTrigger id="ai-category">
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOG_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Zielstadt (Optional)</Label>
                    <Input
                      placeholder="z.B. Zürich"
                      value={aiConfig.target_city}
                      onChange={(e) => setAiConfig({ ...aiConfig, target_city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Keywords (mit Komma getrennt)</Label>
                  <Input
                    placeholder="umzug, kosten, checkliste, schweiz"
                    value={aiConfig.keywords}
                    onChange={(e) => setAiConfig({ ...aiConfig, keywords: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Schreibstil</Label>
                  <Select value={aiConfig.style} onValueChange={(v) => setAiConfig({ ...aiConfig, style: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informative">Informativ & Sachlich</SelectItem>
                      <SelectItem value="guide">Schritt-für-Schritt Guide</SelectItem>
                      <SelectItem value="listicle">Top 10 Liste</SelectItem>
                      <SelectItem value="personal">Persönlich & Beratend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full mt-2" onClick={handleGenerateAi} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Blog-Artikel generieren
                </Button>
              </div>
            )}

            {aiStep === 2 && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <div className="text-center">
                  <p className="font-semibold">AI erstellt Ihren Artikel...</p>
                  <p className="text-sm text-muted-foreground">Dies kann bis zu 60 Sekunden dauern.</p>
                </div>
                <div className="w-64">
                  <Progress value={45} className="h-2" />
                </div>
              </div>
            )}

            {aiStep === 3 && generatedBlog && (
              <div className="space-y-6 py-4">
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Artikel erfolgreich generiert!</p>
                    <p className="text-xs text-green-700">Bitte überprüfen Sie den Inhalt vor der Veröffentlichung.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Titel</Label>
                    <Input value={generatedBlog.title} readOnly className="bg-muted" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Meta Description</Label>
                    <Textarea value={generatedBlog.meta_description} readOnly className="bg-muted text-xs" rows={2} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Inhalt Preview</Label>
                    <div className="prose prose-sm max-w-none border p-4 rounded-md bg-muted/30 h-64 overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedBlog.content) }} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => saveGeneratedBlog(false)}>
                    Als Entwurf speichern
                  </Button>
                  <Button className="flex-1" variant="secondary" onClick={() => saveGeneratedBlog(true)}>
                    Direkt Veröffentlichen
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Blog Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBlog?.id ? "Blog-Artikel bearbeiten" : "Neuen Blog-Artikel erstellen"}</DialogTitle>
              <DialogDescription>
                Passen Sie den Inhalt, die SEO-Metadaten und die Bilder an.
              </DialogDescription>
            </DialogHeader>

            {editingBlog && (
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Inhalt</TabsTrigger>
                  <TabsTrigger value="seo">SEO & Info</TabsTrigger>
                  <TabsTrigger value="images">Bilder</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>Titel</Label>
                    <Input
                      value={editingBlog.title}
                      onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Slug (URL)</Label>
                    <Input
                      value={editingBlog.slug}
                      onChange={(e) => setEditingBlog({ ...editingBlog, slug: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Auszug (Excerpt)</Label>
                    <Textarea
                      value={editingBlog.excerpt || ""}
                      onChange={(e) => setEditingBlog({ ...editingBlog, excerpt: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Inhalt</Label>
                    <TiptapEditor
                      content={editingBlog.content || ""}
                      onChange={(html) => setEditingBlog({ ...editingBlog, content: html })}
                      placeholder="Schreiben Sie hier Ihren Blog-Inhalt..."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="seo" className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>Fokus Keyword</Label>
                    <Input
                      value={editingBlog.focus_keyword || ""}
                      onChange={(e) => setEditingBlog({ ...editingBlog, focus_keyword: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>SEO Titel</Label>
                    <Input
                      value={editingBlog.seo_title || ""}
                      onChange={(e) => setEditingBlog({ ...editingBlog, seo_title: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Meta Description</Label>
                    <Textarea
                      value={editingBlog.meta_description || ""}
                      onChange={(e) => setEditingBlog({ ...editingBlog, meta_description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-category">Kategorie</Label>
                    <Select
                      value={editingBlog.category_name || ""}
                      onValueChange={(v) => setEditingBlog({ ...editingBlog, category_name: v })}
                    >
                      <SelectTrigger id="edit-category">
                        <SelectValue placeholder="Kategorie wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOG_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="images" className="space-y-6 py-4">
                  <div className="grid gap-4 p-4 border rounded-xl bg-slate-50/30">
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="w-5 h-5 text-secondary" />
                      <Label className="font-bold text-lg">Hauptbild (Banner)</Label>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold">Bildquelle</Label>
                      <div className="flex gap-2">
                        <Input
                          value={editingBlog.featured_image_url || ""}
                          onChange={(e) => setEditingBlog({ ...editingBlog, featured_image_url: e.target.value })}
                          placeholder="https://..."
                          className="bg-white flex-1"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={featuredImageRef}
                          onChange={(e) => handleImageUpload(e, "featured")}
                        />
                        <Button
                          variant="outline"
                          onClick={() => featuredImageRef.current?.click()}
                          disabled={isUploadingImg === "featured"}
                          className="shrink-0"
                        >
                          {isUploadingImg === "featured" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Hochladen (WebP)
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold text-secondary">SEO-Alt-Text (Hauptbild)</Label>
                      <Input
                        value={editingBlog.featured_image_alt || ""}
                        onChange={(e) => setEditingBlog({ ...editingBlog, featured_image_alt: e.target.value })}
                        placeholder="z.B. Laechelnde Familie mit Umzugskisten in Zuerich"
                        className="bg-white border-secondary/30 focus-visible:ring-secondary"
                      />
                      <p className="text-[10px] text-muted-foreground italic">Google nutzt diesen Text, um das Bild korrekt zu indexieren.</p>
                    </div>

                    {editingBlog.featured_image_url && (
                      <div className="mt-2 rounded-lg overflow-hidden border bg-white flex items-center justify-center p-2">
                        <img src={editingBlog.featured_image_url} alt="Preview" className="max-h-40 object-contain" />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-secondary" />
                      <Label className="font-bold text-lg">Bilder im Artikel</Label>
                    </div>

                    {[1, 2].map((num) => {
                      const placeholder = `[IMAGE_PLACEHOLDER_${num}]`;
                      const gallery = Array.isArray(editingBlog?.gallery_images) ? editingBlog.gallery_images : [];
                      const galleryImg = gallery.find((g: GalleryImage) => g.placeholder === placeholder);
                      const url = galleryImg?.url || "";
                      const description = galleryImg?.description || "";
                      const type = `gallery-${num}`;
                      const ref = num === 1 ? galleryImage1Ref : galleryImage2Ref;

                      return (
                        <div key={num} className="p-4 border rounded-xl bg-slate-50/50 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between border-b pb-2">
                            <Badge variant="secondary" className="font-mono text-[10px]">Platzhalter {num}</Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">{placeholder}</span>
                          </div>

                          <div className="grid gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-[11px] font-bold">Bildquelle</Label>
                              <div className="flex gap-2">
                                <Input
                                  value={url}
                                  onChange={(e) => {
                                    if (!editingBlog) return;
                                    const newGallery = [...gallery];
                                    const index = newGallery.findIndex((g: GalleryImage) => g.placeholder === placeholder);
                                    if (index > -1) {
                                      newGallery[index] = { ...newGallery[index], url: e.target.value };
                                    } else {
                                      newGallery.push({ placeholder, url: e.target.value, description: "" });
                                    }
                                    setEditingBlog({ ...editingBlog, gallery_images: newGallery });
                                  }}
                                  placeholder="Bild-URL..."
                                  className="bg-white h-8 flex-1"
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  ref={ref}
                                  onChange={(e) => handleImageUpload(e, type)}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => ref.current?.click()}
                                  disabled={isUploadingImg === type}
                                  className="h-8 shrink-0"
                                >
                                  {isUploadingImg === type ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Upload className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-1.5">
                              <Label className="text-[11px] font-bold text-secondary">SEO-Alt-Text & Bildunterschrift</Label>
                              <Input
                                value={description}
                                onChange={(e) => {
                                  if (!editingBlog) return;
                                  const newGallery = [...gallery];
                                  const index = newGallery.findIndex((g: GalleryImage) => g.placeholder === placeholder);
                                  if (index > -1) {
                                    newGallery[index] = { ...newGallery[index], description: e.target.value };
                                  } else {
                                    newGallery.push({ placeholder, url: "", description: e.target.value });
                                  }
                                  setEditingBlog({ ...editingBlog, gallery_images: newGallery });
                                }}
                                placeholder="SEO-orientierte Bildbeschreibung..."
                                className="bg-white h-8 border-secondary/20"
                              />
                            </div>
                          </div>

                          {url && (
                            <div className="rounded-md overflow-hidden border bg-white flex items-center justify-center h-24 p-1">
                              <img src={url} alt={`Preview ${num}`} className="max-h-full object-contain" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Hinweis zur Bildplatzierung
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Im Inhaltsbereich können Sie die Platzhaltertexte <code>[IMAGE_PLACEHOLDER_1]</code> und <code>[IMAGE_PLACEHOLDER_2]</code> an die gewünschte Stelle verschieben, um die Position der Bilder festzulegen.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSavingEdit}>
                Abbrechen
              </Button>
              <Button onClick={saveEditedBlog} disabled={isSavingEdit} aria-busy={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Änderungen speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Blog löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie den Blog-Artikel "{blogToDelete?.title}" wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeDeleteDialog} disabled={isDeletingBlog}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteBlog}
                disabled={isDeletingBlog}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingBlog ? (
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
      </div>
    </AdminLayout>
  );
};

export default BlogManagement;

