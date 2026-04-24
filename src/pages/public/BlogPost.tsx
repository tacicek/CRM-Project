import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Share2,
  ChevronRight,
  Loader2,
  MessageSquare,
  Facebook,
  Twitter,
  Linkedin,
  FileText,
  ImageOff,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import DOMPurify from "dompurify";

// =============================================================================
// CONSTANTS
// =============================================================================

const WORDS_PER_MINUTE = 200;
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://offerio.ch';

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
    typeof obj.title === 'string'
  );
}

/**
 * Safe date formatting
 */
function formatDateSafe(dateString: string | null | undefined, formatStr: string = "dd. MMMM yyyy"): string {
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
 * Calculate reading time from content
 */
function calculateReadingTime(content: string): number {
  if (!content) return 1;
  // Strip HTML tags and count words
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(' ').filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Escape special characters for JSON-LD to prevent XSS
 */
function escapeJsonLd(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}

/**
 * Validate image URL - only allow http/https
 */
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Generate stable key for FAQ items
 */
function generateFaqKey(faq: FAQItem, index: number): string {
  const questionHash = faq.question ? faq.question.slice(0, 20).replace(/\s/g, '-') : '';
  return `faq-${index}-${questionHash}`;
}

interface BlogPost {
  id: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  category_name: string;
  published_at: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  faq_schema: unknown;
  gallery_images: unknown;
  author_name: string;
  slug?: string;
  status?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface GalleryImage {
  placeholder?: string;
  description?: string;
  url?: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [readProgress, setReadProgress] = useState(0);
  const [imageError, setImageError] = useState(false);
  
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
  
  // Reading progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      setReadProgress(progress);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Calculate reading time
  const readingTime = useMemo(() => {
    return post?.content ? calculateReadingTime(post.content) : 5;
  }, [post]);

  const hasCustomStyles = useMemo(() => {
    return /<style[\s>]/i.test(post?.content || "");
  }, [post]);

  const renderContent = (content: string | null) => {
    if (!content) return { __html: '<p class="text-muted-foreground italic">Kein Inhalt vorhanden.</p>' };
    let finalContent = content;
    
    // Escape a string for safe use inside an HTML attribute value (double-quoted).
    // Prevents attribute break-out even before DOMPurify sees the assembled fragment.
    const escapeAttr = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Replace image placeholders with descriptions or actual images if URLs were provided
    if (post?.gallery_images && Array.isArray(post.gallery_images)) {
      (post.gallery_images as GalleryImage[]).forEach((img) => {
        const placeholder = img.placeholder;
        // Sanitize description and URL to prevent XSS
        const description = DOMPurify.sanitize(img.description || "");
        const imageUrl = img.url ? DOMPurify.sanitize(img.url) : null;
        
        // Validate URL protocol (only allow http/https)
        const isValidUrl = imageUrl && /^https?:\/\//i.test(imageUrl);

        let replacement = "";
        
        if (isValidUrl) {
          // Escape values for attribute context to prevent break-out via embedded quotes
          const attrSrc = escapeAttr(imageUrl);
          const attrAlt = escapeAttr(DOMPurify.sanitize(description || post.title));
          replacement = `
            <figure class="my-10 space-y-3">
              <div class="rounded-3xl overflow-hidden shadow-lg border border-slate-100">
                <img src="${attrSrc}" alt="${attrAlt}" class="w-full h-auto object-cover max-h-[600px] hover:scale-105 transition-transform duration-700" />
              </div>
              ${description ? `<figcaption class="text-center text-sm text-slate-500 italic font-medium mt-3">${description}</figcaption>` : ""}
            </figure>
          `;
        } else {
          // Fallback to placeholder box
          replacement = `
            <div class="my-8 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <div class="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image text-slate-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-500">Bild-Platzhalter: ${description || "Bild im Artikel"}</p>
              <p class="text-xs text-slate-400 mt-2">Hier kann im Admin-Panel ein passendes Foto eingefügt werden.</p>
            </div>
          `;
        }
        
        finalContent = finalContent.replace(placeholder, replacement);
      });
    }
    
    // SECURITY: Sanitize all HTML content to prevent XSS attacks
    const sanitizedContent = DOMPurify.sanitize(finalContent, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u', 'mark', 'sub', 'sup', 'blockquote', 'code', 'pre', 'img', 'figure', 'figcaption', 'div', 'span', 'nav', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'svg', 'path', 'rect', 'circle', 'style', 'hr', 'section', 'article', 'aside', 'header', 'footer', 'details', 'summary', 'video', 'source', 'iframe', 'cite'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target', 'rel', 'width', 'height', 'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'id', 'name', 'data-align', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'title', 'type', 'controls', 'autoplay', 'loop', 'muted', 'poster'],
      ALLOW_DATA_ATTR: false,
      FORCE_BODY: true,
    });
    
    return { __html: sanitizedContent };
  };

  const fetchPost = useCallback(async () => {
    if (!slug) return;
    
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setImageError(false);
    
    try {
      // Use maybeSingle() instead of single() to avoid throwing on 0 rows
      let query = supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug);
      
      if (!isPreview) {
        query = query.eq("status", "published");
      }
      
      const { data, error } = await query.maybeSingle();

      if (!isMountedRef.current) return;
      
      if (error) {
        console.error("Supabase query error:", error.message, error.code, error.details);
        throw error;
      }
      
      if (!data) {
        console.warn("Blog post not found for slug:", slug, "isPreview:", isPreview);
        setNotFound(true);
        return;
      }
      
      if (!isValidBlogPost(data)) {
        console.warn("Invalid blog post data:", Object.keys(data));
        setNotFound(true);
        return;
      }
      
      setPost(data);

      // Increment view count (fire and forget) - skip in preview mode
      if (!isPreview) {
        supabase.rpc("increment_blog_view_count", { post_id: data.id }).then(() => {
          // View count incremented
        });
      }

      // Fetch related posts
      const { data: related } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, category_name, featured_image_url")
        .eq("status", "published")
        .eq("category_name", data.category_name || '')
        .neq("id", data.id)
        .limit(3);
      
      if (isMountedRef.current) {
        const validRelated = (related || []).filter(isValidBlogPost);
        setRelatedPosts(validRelated);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching post:", error, "slug:", slug, "isPreview:", isPreview);
      setNotFound(true);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [slug, isPreview]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        text: post?.excerpt || "",
        url: window.location.href,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FileText className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Artikel nicht gefunden</h1>
          <p className="text-muted-foreground">
            Der gewünschte Artikel existiert nicht oder wurde entfernt.
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono">
            slug: {slug} | preview: {String(isPreview)}
          </p>
          <Button asChild>
            <Link to="/blog">Zurück zum Blog</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white ${!hasCustomStyles ? "dark:bg-slate-900" : ""}`}>
      <Helmet>
        <title>{post.title} | Offerio.ch Blog</title>
        <meta name="description" content={post.meta_description || post.excerpt || ""} />
        <link rel="canonical" href={`${BASE_URL}/blog/${post.slug || slug}`} />
        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.meta_description || post.excerpt || ""} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${BASE_URL}/blog/${post.slug || slug}`} />
        {isValidImageUrl(post.featured_image_url) && (
          <meta property="og:image" content={post.featured_image_url!} />
        )}
        {/* Schema.org for Article - XSS safe */}
        <script type="application/ld+json">
          {`{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": "${escapeJsonLd(post.title)}",
            "image": "${escapeJsonLd(post.featured_image_url)}",
            "datePublished": "${escapeJsonLd(post.published_at)}",
            "url": "${BASE_URL}/blog/${escapeJsonLd(post.slug || slug)}",
            "author": {
              "@type": "Person",
              "name": "${escapeJsonLd(post.author_name || 'Offerio Redaktion')}",
              "jobTitle": "Experte für Umzugslogistik",
              "worksFor": {
                "@type": "Organization",
                "name": "Offerio.ch",
                "url": "https://offerio.ch"
              }
            },
            "publisher": {
              "@type": "Organization",
              "name": "Offerio.ch",
              "url": "https://offerio.ch",
              "logo": {
                "@type": "ImageObject",
                "url": "${BASE_URL}/logo.png"
              },
              "sameAs": [
                "https://www.linkedin.com/company/offerio",
                "https://www.instagram.com/offerio.ch"
              ]
            },
            "description": "${escapeJsonLd(post.meta_description || post.excerpt)}",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": "${BASE_URL}/blog/${escapeJsonLd(post.slug || slug)}"
            }
          }`}
        </script>
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://offerio.ch/blog"},{"@type":"ListItem","position":3,"name":"${escapeJsonLd(post.title)}","item":"${BASE_URL}/blog/${escapeJsonLd(post.slug || slug)}"}]}`}</script>
        {post.faq_schema && Array.isArray(post.faq_schema) && (post.faq_schema as FAQItem[]).length > 0 && (
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: (post.faq_schema as FAQItem[]).map(faq => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer }
            }))
          })}</script>
        )}
      </Helmet>

      {/* Preview Banner for Admins */}
      {isPreview && (
        <div className="fixed top-0 left-0 w-full bg-amber-500 text-white text-center text-sm font-medium py-1.5 z-[60]">
          Vorschau-Modus — Dieser Artikel ist noch nicht veröffentlicht
        </div>
      )}

      {/* Progress Bar */}
      <div className={`fixed ${isPreview ? 'top-8' : 'top-0'} left-0 w-full h-1 bg-muted z-50`}>
        <div 
          className="h-full bg-secondary transition-all duration-150" 
          style={{ width: `${readProgress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(readProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lesefortschritt"
        />
      </div>

      {/* Navigation */}
      <nav className={`border-b sticky ${isPreview ? 'top-8' : 'top-0'} bg-white/80 ${!hasCustomStyles ? "dark:bg-slate-900/80" : ""} backdrop-blur-md z-40`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/blog" className="flex items-center gap-2 text-sm font-medium hover:text-secondary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Alle Artikel</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button size="sm" asChild>
              <Link to="/anfrage">Offerte einholen</Link>
            </Button>
          </div>
        </div>
      </nav>

      <article className={hasCustomStyles ? "py-0" : "max-w-4xl mx-auto px-4 py-12 md:py-20"}>
        {/* Header — hidden when content has its own hero/layout */}
        {!hasCustomStyles && (
          <header className="space-y-6 mb-12 text-center md:text-left">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
              <Badge className="bg-secondary text-white px-3 py-1">{post.category_name}</Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateSafe(post.published_at)}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {readingTime} Min. Lesezeit
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-xl text-muted-foreground leading-relaxed italic max-w-3xl">
                {post.excerpt}
              </p>
            )}

            <div className="flex items-center justify-center md:justify-start gap-4 pt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-secondary font-bold text-lg">
                  {(post.author_name || "O").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{post.author_name || "Offerio Redaktion"}</p>
                <p className="text-xs text-muted-foreground">Experte für Umzugslogistik & Schweizer Immobilienmarkt</p>
                <p className="text-xs text-secondary mt-0.5 font-medium">✓ Geprüfter Offerio-Redakteur</p>
              </div>
            </div>
          </header>
        )}

        {/* Featured Image — hidden when content has its own layout */}
        {!hasCustomStyles && isValidImageUrl(post.featured_image_url) && !imageError && (
          <div className="rounded-2xl overflow-hidden mb-12 shadow-2xl">
            <img 
              src={post.featured_image_url!} 
              alt={post.featured_image_alt || post.title} 
              className="w-full h-auto object-cover max-h-[500px]"
              loading="eager"
              onError={() => setImageError(true)}
            />
          </div>
        )}
        {!hasCustomStyles && imageError && (
          <div className="rounded-2xl overflow-hidden mb-12 bg-slate-100 flex items-center justify-center h-64">
            <div className="text-center text-slate-400">
              <ImageOff className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Bild konnte nicht geladen werden</p>
            </div>
          </div>
        )}

        {/* Social Sidebar (Floating on Desktop) — hidden when content has its own layout */}
        <div className="relative">
          {!hasCustomStyles && (
            <div className="hidden lg:flex flex-col gap-4 absolute -left-20 top-0">
              <Button variant="outline" size="icon" className="rounded-full"><Facebook className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="rounded-full"><Twitter className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="rounded-full"><Linkedin className="w-4 h-4" /></Button>
            </div>
          )}

          {/* Content */}
          <div 
            className={hasCustomStyles
              ? "max-w-none"
              : "prose prose-lg md:prose-xl prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-secondary prose-img:rounded-xl prose-strong:text-slate-900 dark:prose-strong:text-slate-100"
            }
            dangerouslySetInnerHTML={renderContent(post.content)}
          />
        </div>

        {/* FAQs — hidden when content has its own FAQ section */}
        {!hasCustomStyles && post.faq_schema && Array.isArray(post.faq_schema) && post.faq_schema.length > 0 && (
          <section className="mt-20 p-8 md:p-12 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 dark:text-slate-100">
              <MessageSquare className="w-8 h-8 text-secondary" />
              Häufig gestellte Fragen
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {(post.faq_schema as FAQItem[]).map((faq, i) => (
                <AccordionItem key={generateFaqKey(faq, i)} value={`faq-${i}`} className="border-slate-200">
                  <AccordionTrigger className="text-left font-bold text-lg py-4 hover:no-underline hover:text-secondary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 leading-relaxed text-base pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* E-E-A-T Author Box — hidden when content has its own layout */}
        {!hasCustomStyles && (
          <div className="mt-12 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-14 h-14 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-secondary font-bold text-xl">
                {(post.author_name || "O").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">{post.author_name || "Offerio Redaktion"}</p>
                <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">✓ Geprüfter Redakteur</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Experte für Umzugslogistik, Schweizer Immobilienmarkt und Wohnungsübergaben</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Alle Artikel auf Offerio.ch werden von Fachexperten verfasst und redaktionell geprüft.
                Unsere Autoren verfügen über langjährige Erfahrung in der Schweizer Umzugs- und Reinigungsbranche.
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span>🇨🇭 Schweizer Expertise</span>
                <span>⭐ 4.8/5 Kundenbewertung</span>
                <span>🛡️ 500+ Partnerfirmen</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA Banner — hidden when content has its own CTA */}
        {!hasCustomStyles && (
          <section className="mt-20 relative overflow-hidden bg-secondary rounded-3xl p-8 md:p-16 text-center text-white shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
                Planen Sie Ihren nächsten {post.category_name}?
              </h2>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
                Erhalten Sie bis zu 5 unverbindliche Offerten von geprüften Firmen aus Ihrer Region.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" variant="hero" className="px-8 py-6 text-lg h-auto" asChild>
                  <Link to="/anfrage">Jetzt Offerten anfragen</Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 px-8 py-6 text-lg h-auto text-white">
                  Mehr Informationen
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Related Posts — hidden when content has its own layout */}
        {!hasCustomStyles && relatedPosts.length > 0 && (
          <section className="mt-24">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Das könnte Sie auch interessieren</h3>
              <Button variant="ghost" asChild>
                <Link to="/blog" className="flex items-center gap-2">
                  Alle Artikel <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedPosts.map((related) => (
                <Link key={related.id} to={`/blog/${related.slug}`} className="group space-y-4">
                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden">
                    {/* Related post would have images in real case */}
                    <div className="w-full h-full flex items-center justify-center text-slate-300 group-hover:scale-105 transition-transform duration-500">
                      <FileText className="w-12 h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs">{related.category_name}</Badge>
                    <h4 className="font-bold text-xl leading-snug group-hover:text-secondary transition-colors line-clamp-2">
                      {related.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* Footer CTA */}
      <footer className={`py-12 text-center border-t ${!hasCustomStyles ? "bg-slate-50 dark:bg-slate-800 dark:border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="max-w-4xl mx-auto px-4">
          <p className={`text-sm mb-4 ${!hasCustomStyles ? "text-slate-500 dark:text-slate-400" : "text-slate-500"}`}>© {new Date().getFullYear()} Offerio.ch - Alle Rechte vorbehalten.</p>
          <div className={`flex justify-center gap-6 text-sm font-medium ${!hasCustomStyles ? "text-slate-600 dark:text-slate-400" : "text-slate-600"}`}>
            <Link to="/impressum" className="hover:text-secondary">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-secondary">Datenschutz</Link>
            <Link to="/agb" className="hover:text-secondary">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogPost;

