import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

// dash.offerio.ch is the dashboard/inquiry SPA.
// Public content (blog, landing pages) lives at offerio.ch (Next.js).
// Only the homepage is indexed here to avoid duplicate content.
const BASE_URL = "https://dash.offerio.ch";
const TODAY = new Date().toISOString().split("T")[0];

const STATIC_PAGES = [
  { loc: "/", changefreq: "weekly", priority: 1.0 },
];

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");

function normalizeEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function loadEnvFiles() {
  const envFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
  for (const filename of envFiles) {
    const filePath = path.resolve(process.cwd(), filename);
    try {
      const content = await readFile(filePath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = normalizeEnvValue(trimmed.slice(separatorIndex + 1));
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // File may not exist in every environment.
    }
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getDatePart(value) {
  if (!value) return TODAY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return TODAY;
  return parsed.toISOString().split("T")[0];
}

async function fetchSupabaseRows(endpointPath) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[sitemap] Missing SUPABASE env vars. Generating sitemap with static pages only."
    );
    return [];
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpointPath}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase REST error ${response.status} for ${endpointPath}: ${errorText.substring(
        0,
        200
      )}`
    );
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function buildXml(urls) {
  const rows = urls
    .map((url) => {
      return `  <url>
    <loc>${escapeXml(BASE_URL + url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${Number(url.priority).toFixed(1)}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${rows}
</urlset>
`;
}

async function generateSitemap() {
  await loadEnvFiles();

  const urls = STATIC_PAGES.map((page) => ({
    ...page,
    lastmod: TODAY,
  }));

  // Blog posts and landing pages are served from offerio.ch (Next.js).
  // They must NOT appear in this sitemap to avoid duplicate content penalties.

  // Remove duplicates by loc (keep latest lastmod)
  const deduped = new Map();
  for (const url of urls) {
    const current = deduped.get(url.loc);
    if (!current || current.lastmod < url.lastmod) {
      deduped.set(url.loc, url);
    }
  }

  const finalUrls = Array.from(deduped.values());
  const xml = buildXml(finalUrls);

  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(SITEMAP_PATH, xml, "utf8");
  console.log(`[sitemap] Generated ${finalUrls.length} URLs at public/sitemap.xml`);
}

generateSitemap().catch((error) => {
  console.error("[sitemap] Fatal error:", error);
  process.exitCode = 1;
});
