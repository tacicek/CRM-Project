import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://offerio.ch";

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

// Service types for SEO landing pages
const SERVICE_SLUGS = [
  "umzugsfirma",
  "umzugsunternehmen", 
  "moebeltransport",
  "privatumzug",
  "firmenumzug",
  "bueroumzug",
  "umzugshelfer",
  "entrumpelung",
];

// Swiss cantons with their cities
const SWISS_CANTONS = [
  {
    slug: "zuerich",
    cities: ["zuerich", "winterthur", "uster", "duebendorf", "dietikon", "wetzikon", "horgen", "bulach", "adliswil", "schlieren", "regensdorf", "kloten", "opfikon", "wallisellen", "thalwil"]
  },
  {
    slug: "bern",
    cities: ["bern", "biel", "thun", "koeniz", "burgdorf", "langenthal", "interlaken", "muri-bei-bern", "ostermundigen", "spiez"]
  },
  {
    slug: "luzern",
    cities: ["luzern", "emmen", "kriens", "horw", "ebikon", "sursee", "hochdorf"]
  },
  {
    slug: "aargau",
    cities: ["aarau", "baden", "wettingen", "wohlen", "brugg", "oftringen", "zofingen", "rheinfelden", "lenzburg"]
  },
  {
    slug: "st-gallen",
    cities: ["st-gallen", "rapperswil-jona", "wil", "gossau", "herisau", "uzwil", "buchs"]
  },
  {
    slug: "basel-stadt",
    cities: ["basel", "riehen", "bettingen"]
  },
  {
    slug: "basel-landschaft",
    cities: ["allschwil", "reinach", "muttenz", "pratteln", "binningen", "liestal", "bottmingen"]
  },
  {
    slug: "graubuenden",
    cities: ["chur", "davos", "st-moritz", "ilanz", "thusis"]
  },
  {
    slug: "wallis",
    cities: ["sion", "sierre", "monthey", "martigny", "brig-glis", "visp", "zermatt"]
  },
  {
    slug: "genf",
    cities: ["geneve", "vernier", "lancy", "meyrin", "carouge", "onex", "thonex"]
  },
  {
    slug: "waadt",
    cities: ["lausanne", "yverdon-les-bains", "montreux", "nyon", "renens", "vevey", "morges", "pully", "ecublens"]
  },
  {
    slug: "tessin",
    cities: ["lugano", "bellinzona", "locarno", "mendrisio", "chiasso", "ascona"]
  },
  {
    slug: "solothurn",
    cities: ["solothurn", "olten", "grenchen", "zuchwil"]
  },
  {
    slug: "thurgau",
    cities: ["frauenfeld", "kreuzlingen", "arbon", "amriswil", "weinfelden", "romanshorn"]
  },
  {
    slug: "schwyz",
    cities: ["schwyz", "freienbach", "einsiedeln", "kuesnacht"]
  },
  {
    slug: "zug",
    cities: ["zug", "baar", "cham", "steinhausen", "rotkreuz"]
  },
  {
    slug: "schaffhausen",
    cities: ["schaffhausen", "neuhausen-am-rheinfall"]
  },
  {
    slug: "neuenburg",
    cities: ["neuchatel", "la-chaux-de-fonds", "le-locle"]
  },
  {
    slug: "freiburg",
    cities: ["freiburg", "bulle", "villars-sur-glane", "murten"]
  },
  {
    slug: "jura",
    cities: ["delemont", "porrentruy"]
  },
  {
    slug: "appenzell-ausserrhoden",
    cities: ["herisau", "teufen"]
  },
  {
    slug: "appenzell-innerrhoden",
    cities: ["appenzell"]
  },
  {
    slug: "glarus",
    cities: ["glarus", "naefels"]
  },
  {
    slug: "nidwalden",
    cities: ["stans", "hergiswil"]
  },
  {
    slug: "obwalden",
    cities: ["sarnen", "alpnach"]
  },
  {
    slug: "uri",
    cities: ["altdorf", "erstfeld"]
  },
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const urls: SitemapUrl[] = [];

    // 1. Static public pages (NO dashboards!)
    const staticPages = [
      { loc: "/", priority: 1.0, changefreq: "weekly" },
      { loc: "/anfrage", priority: 0.9, changefreq: "monthly" },
      { loc: "/so-funktioniert-es", priority: 0.8, changefreq: "monthly" },
      { loc: "/fuer-firmen", priority: 0.8, changefreq: "monthly" },
      { loc: "/preise", priority: 0.7, changefreq: "monthly" },
      { loc: "/partner-werden", priority: 0.7, changefreq: "monthly" },
      { loc: "/blog", priority: 0.8, changefreq: "daily" },
      { loc: "/impressum", priority: 0.3, changefreq: "yearly" },
      { loc: "/datenschutz", priority: 0.3, changefreq: "yearly" },
      { loc: "/agb", priority: 0.3, changefreq: "yearly" },
    ];

    staticPages.forEach((page) => {
      urls.push({
        loc: `${BASE_URL}${page.loc}`,
        lastmod: today,
        changefreq: page.changefreq,
        priority: page.priority,
      });
    });

    // 2. Blog posts from database
    const { data: blogPosts, error: blogError } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (!blogError && blogPosts) {
      blogPosts.forEach((post) => {
        const lastmod = post.updated_at?.split("T")[0] || 
                       post.published_at?.split("T")[0] || 
                       today;
        urls.push({
          loc: `${BASE_URL}/blog/${post.slug}`,
          lastmod,
          changefreq: "weekly",
          priority: 0.7,
        });
      });
    }

    // 3. SEO Landing Pages (service + canton + city combinations)
    // This generates thousands of pages for local SEO
    SERVICE_SLUGS.forEach((serviceSlug) => {
      SWISS_CANTONS.forEach((canton) => {
        canton.cities.forEach((citySlug) => {
          urls.push({
            loc: `${BASE_URL}/${serviceSlug}/${canton.slug}/${citySlug}`,
            lastmod: today,
            changefreq: "monthly",
            priority: 0.6,
          });
        });
      });
    });

    // Generate XML
    const urlEntries = urls
      .map(
        (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`
      )
      .join("\n");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;

    console.log(`Sitemap generated with ${urls.length} URLs`);

    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate sitemap" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

serve(handler);
