import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Calendar, Clock, ArrowRight, Filter, ImageOff } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useDebouncedCallback } from "use-debounce";

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEMS_PER_PAGE = 12;

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
 * Safe date formatting
 */
function formatDateSafe(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, "dd. MMM yyyy", { locale: de });
  } catch {
    return '-';
  }
}

/**
 * Validate image URL
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

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category_name: string;
  published_at: string;
  featured_image_url: string | null;
}

const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState(searchParams.get('q') || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get('category') || null);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
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

  // Debounced search
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('q', value);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  }, 300);

  const fetchBlogs = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, category_name, published_at, featured_image_url")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validBlogs = (data || []).filter(isValidBlogPost);
      setBlogs(validBlogs);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching blogs:", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  // Sync category with URL params
  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    
    const newParams = new URLSearchParams(searchParams);
    if (category) {
      newParams.set('category', category);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const filteredBlogs = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return blogs.filter(blog => {
      const matchesSearch = !query || 
        blog.title.toLowerCase().includes(query) || 
        (blog.excerpt?.toLowerCase().includes(query) ?? false);
      const matchesCategory = !selectedCategory || blog.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [blogs, searchQuery, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredBlogs.length / ITEMS_PER_PAGE);
  const paginatedBlogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBlogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBlogs, currentPage]);

  const categories = useMemo(() => 
    Array.from(new Set(blogs.map(b => b.category_name))).sort(),
    [blogs]
  );

  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInputValue("");
    setSearchQuery("");
    setSelectedCategory(null);
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <Helmet>
        <title>Blog | Offerio.ch - Tipps zu Umzug & Reinigung</title>
        <meta name="description" content="Nützliche Tipps, Guides und Informationen rund um Umzug, Reinigung und Entrümpelung in der Schweiz." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://offerio.ch/blog"}]}`}</script>
      </Helmet>

      {/* Hero Section */}
      <div className="bg-secondary/90 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">Unser Blog</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Ihr Ratgeber für einen stressfreien Umzug und eine perfekte Reinigung in der Schweiz.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Suche
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Thema suchen..."
                  value={searchInputValue}
                  onChange={(e) => {
                    setSearchInputValue(e.target.value);
                    debouncedSetSearch(e.target.value);
                  }}
                  aria-label="Blog-Artikel suchen"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Kategorien
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button 
                  variant={selectedCategory === null ? "default" : "outline"} 
                  size="sm"
                  onClick={() => handleCategoryChange(null)}
                  aria-pressed={selectedCategory === null}
                >
                  Alle
                </Button>
                {categories.map(cat => (
                  <Button 
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handleCategoryChange(cat)}
                    aria-pressed={selectedCategory === cat}
                  >
                    {cat}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Blog Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={`skeleton-${i}`} className="overflow-hidden">
                    <Skeleton className="aspect-video w-full" />
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <div className="flex gap-4 pt-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredBlogs.length === 0 ? (
              <Card className="py-20 text-center">
                <CardContent>
                  <p className="text-muted-foreground">Keine Artikel gefunden.</p>
                  <Button variant="link" onClick={resetFilters}>
                    Filter zurücksetzen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedBlogs.map((blog) => (
                    <Card key={blog.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
                      <div className="aspect-video bg-muted relative">
                        {isValidImageUrl(blog.featured_image_url) && !imageErrors.has(blog.id) ? (
                          <img 
                            src={blog.featured_image_url!} 
                            alt={blog.title} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => handleImageError(blog.id)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                            {imageErrors.has(blog.id) ? (
                              <ImageOff className="w-12 h-12" />
                            ) : (
                              <Search className="w-12 h-12" />
                            )}
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-secondary">{blog.category_name}</Badge>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="text-xl line-clamp-2 hover:text-secondary transition-colors">
                          <Link to={`/blog/${blog.slug}`}>{blog.title}</Link>
                        </CardTitle>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateSafe(blog.published_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            5 Min.
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-muted-foreground text-sm line-clamp-3">
                          {blog.excerpt}
                        </p>
                      </CardContent>
                      <div className="p-6 pt-0 mt-auto">
                        <Button variant="link" className="p-0 text-secondary flex items-center gap-2 group" asChild>
                          <Link to={`/blog/${blog.slug}`}>
                            Weiterlesen
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Zurück
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            aria-current={currentPage === pageNum ? "page" : undefined}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Weiter
                    </Button>
                  </div>
                )}
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  {filteredBlogs.length} Artikel gefunden
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogList;

