import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, ImageOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

const BlogSection = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchLatestPosts = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, category_name, published_at, featured_image_url")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3);

      if (!isMountedRef.current) return;
      if (error) throw error;
      
      // Type-safe filtering
      const validPosts = (data || []).filter(isValidBlogPost);
      setPosts(validPosts);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error("Error fetching homepage blog posts:", error);
      setPosts([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLatestPosts();
  }, [fetchLatestPosts]);

  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  }, []);

  // Show skeleton while loading
  if (isLoading) {
    return (
      <section className="py-16 bg-gray-50" id="blog" aria-labelledby="blog-heading">
        <div className="container mx-auto px-4">
          <div className="mb-10">
            <Skeleton className="h-8 w-48 mb-3" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={`skeleton-${i}`} className="h-full flex flex-col overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </CardHeader>
                <CardContent className="flex-1">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Don't render section if no posts
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gray-50" id="blog" aria-labelledby="blog-heading">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
          <div className="max-w-2xl">
            <h2 id="blog-heading" className="text-3xl font-bold text-gray-900 mb-3">Ratgeber & Tipps</h2>
            <p className="text-gray-600">
              Nützliche Artikel rund um Umzug, Reinigung und Räumung in der Schweiz. 
              Erfahren Sie, wie Sie Kosten sparen und den besten Service finden.
            </p>
          </div>
          <Link 
            to="/blog" 
            className="inline-flex items-center font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
          >
            Alle Artikel ansehen <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="group h-full">
              <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-shadow border-gray-100">
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  {isValidImageUrl(post.featured_image_url) && !imageErrors.has(post.id) ? (
                    <img 
                      src={post.featured_image_url!} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={() => handleImageError(post.id)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      {imageErrors.has(post.id) ? (
                        <ImageOff className="w-8 h-8" />
                      ) : (
                        <span className="text-4xl">📝</span>
                      )}
                    </div>
                  )}
                  <Badge className="absolute top-3 left-3 bg-white/90 text-primary hover:bg-white border-0 shadow-sm backdrop-blur-sm">
                    {post.category_name}
                  </Badge>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateSafe(post.published_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      5 Min.
                    </span>
                  </div>
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-gray-600 text-sm line-clamp-3">
                    {post.excerpt}
                  </p>
                  <span className="inline-flex items-center text-sm font-medium text-primary mt-4 group-hover:underline">
                    Weiterlesen <ArrowRight className="ml-1 w-3 h-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogSection;
