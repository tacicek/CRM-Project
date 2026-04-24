import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://offerio.ch";
const TODAY = new Date().toISOString().split("T")[0];

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

// Static pages configuration - NO dashboard pages!
const STATIC_PAGES: SitemapUrl[] = [
  { loc: "/", lastmod: TODAY, changefreq: "weekly", priority: 1.0 },
  { loc: "/anfrage", lastmod: TODAY, changefreq: "monthly", priority: 0.9 },
  { loc: "/so-funktioniert-es", lastmod: TODAY, changefreq: "monthly", priority: 0.8 },
  { loc: "/fuer-firmen", lastmod: TODAY, changefreq: "monthly", priority: 0.8 },
  { loc: "/preise", lastmod: TODAY, changefreq: "monthly", priority: 0.7 },
  { loc: "/partner-werden", lastmod: TODAY, changefreq: "monthly", priority: 0.7 },
  { loc: "/blog", lastmod: TODAY, changefreq: "daily", priority: 0.8 },
  { loc: "/impressum", lastmod: TODAY, changefreq: "yearly", priority: 0.3 },
  { loc: "/datenschutz", lastmod: TODAY, changefreq: "yearly", priority: 0.3 },
  { loc: "/agb", lastmod: TODAY, changefreq: "yearly", priority: 0.3 },
];

const Sitemap = () => {
  const [sitemapXml, setSitemapXml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [urlCount, setUrlCount] = useState(0);

  const escapeXml = useCallback((str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }, []);

  const generateXml = useCallback((urls: SitemapUrl[]): string => {
    const urlEntries = urls
      .map(
        (url) => `  <url>
    <loc>${escapeXml(BASE_URL + url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
  }, [escapeXml]);

  const generateSitemap = useCallback(async () => {
    const urls: SitemapUrl[] = [...STATIC_PAGES];

    // Add blog posts from database
    try {
      const { data: blogPosts } = await supabase
        .from("blog_posts")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (blogPosts) {
        blogPosts.forEach((post) => {
          urls.push({
            loc: `/blog/${post.slug}`,
            lastmod: post.updated_at?.split("T")[0] || post.published_at?.split("T")[0] || TODAY,
            changefreq: "weekly",
            priority: 0.7,
          });
        });
      }
    } catch (error) {
      console.error("Error fetching blog posts for sitemap:", error);
    }

    // Add landing pages from database
    try {
      const { data: landingPages } = await supabase
        .from("landing_pages")
        .select("slug, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false });

      if (landingPages) {
        landingPages.forEach((page) => {
          urls.push({
            loc: `/${page.slug}`,
            lastmod: page.updated_at?.split("T")[0] || TODAY,
            changefreq: "weekly",
            priority: 0.8,
          });
        });
      }
    } catch (error) {
      console.error("Error fetching landing pages for sitemap:", error);
    }

    // Generate XML
    const xml = generateXml(urls);
    setSitemapXml(xml);
    setUrlCount(urls.length);
    setLoading(false);
  }, [generateXml]);

  useEffect(() => {
    generateSitemap();
     
  }, [generateSitemap]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Sitemap wird generiert...</p>
        </div>
      </div>
    );
  }

  // Display sitemap as formatted XML
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-white text-xl font-mono">sitemap.xml</h1>
          <div className="text-slate-400 text-sm">
            {urlCount} URLs
          </div>
        </div>
        <pre className="bg-slate-800 text-green-400 p-4 rounded-lg overflow-auto text-xs font-mono whitespace-pre-wrap">
          {sitemapXml}
        </pre>
      </div>
    </div>
  );
};

export default Sitemap;
