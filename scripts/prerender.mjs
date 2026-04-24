/**
 * Post-build prerender script
 *
 * Generates static HTML files for public pages (blog posts, landing pages)
 * so that search engines can index full content without executing JavaScript.
 *
 * Usage: node scripts/prerender.mjs   (run after vite build)
 *
 * Output: dist/blog/[slug]/index.html
 *         dist/[landing-slug]/index.html
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const BASE_URL = "https://offerio.ch";

// ─── Env loader (same logic as generate-sitemap.mjs) ─────────────────────────

function normalizeEnvValue(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

async function loadEnvFiles() {
  const files = [".env", ".env.local", ".env.production", ".env.production.local"];
  for (const filename of files) {
    const filePath = path.resolve(process.cwd(), filename);
    try {
      const content = await readFile(filePath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const sep = trimmed.indexOf("=");
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        const value = normalizeEnvValue(trimmed.slice(sep + 1));
        if (key && !process.env[key]) process.env[key] = value;
      }
    } catch {
      // file may not exist
    }
  }
}

// ─── Supabase REST helper ─────────────────────────────────────────────────────

async function fetchRows(endpointPath) {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[prerender] Missing SUPABASE env vars — skipping dynamic pages.",
      "\n  Checked: VITE_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY",
      "\n  Available env keys:", Object.keys(process.env).filter(k => k.toLowerCase().includes("supa")).join(", ") || "(none)"
    );
    return [];
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/${endpointPath}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase REST ${res.status} for ${endpointPath}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove script tags and inline event handlers from HTML content */
function sanitize(html) {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

/**
 * Replace <title>, meta description, og:* tags and canonical in base HTML.
 */
function injectMeta(baseHtml, { title, description, canonical, ogTitle, ogImage, ogDescription }) {
  let html = baseHtml;

  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
    html = html.replace(
      /(<meta property="og:title" content=")[^"]*(")/,
      `$1${esc(ogTitle || title)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:title" content=")[^"]*(")/,
      `$1${esc(ogTitle || title)}$2`
    );
  }

  if (description) {
    html = html.replace(
      /(<meta name="description" content=")[^"]*(")/,
      `$1${esc(description)}$2`
    );
    html = html.replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${esc(ogDescription || description)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:description" content=")[^"]*(")/,
      `$1${esc(ogDescription || description)}$2`
    );
  }

  if (canonical) {
    html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(canonical)}" />`);
    html = html.replace(
      /(<meta property="og:url" content=")[^"]*(")/,
      `$1${esc(canonical)}$2`
    );
  }

  if (ogImage) {
    html = html.replace(
      /(<meta property="og:image" content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`
    );
  }

  return html;
}

/**
 * Replace the #root div content with prerendered HTML.
 * React will take over on the client, but bots see the full content.
 */
function injectContent(baseHtml, innerHtml) {
  // Replace <div id="root">...</div> (handles the init-loader inside)
  return baseHtml.replace(
    /(<div id="root">)[\s\S]*?(<\/div>)/,
    `$1${innerHtml}$2`
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// ─── Blog post HTML ───────────────────────────────────────────────────────────

function buildBlogHtml(baseHtml, post) {
  const title = post.seo_title || post.title || "Blog | Offerio.ch";
  const description = post.meta_description || post.excerpt || "";
  const canonical = `${BASE_URL}/blog/${post.slug}`;
  const ogImage = post.featured_image_url || "";

  const faqHtml =
    Array.isArray(post.faq_schema) && post.faq_schema.length > 0
      ? `<section style="margin-top:3rem">
          <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Häufig gestellte Fragen</h2>
          ${post.faq_schema
            .map(
              (faq) => `
            <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:1rem;overflow:hidden">
              <div style="padding:1rem 1.5rem;font-weight:700;background:#f8fafc">${esc(faq.question || "")}</div>
              <div style="padding:1rem 1.5rem;border-top:1px solid #e2e8f0;color:#374151">${esc(faq.answer || "")}</div>
            </div>`
            )
            .join("")}
        </section>`
      : "";

  const contentHtml = `
    <article style="max-width:860px;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif">
      <div style="margin-bottom:1.5rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        ${post.category_name ? `<span style="background:#e2e8f0;border-radius:4px;padding:3px 10px;font-size:13px;font-weight:600">${esc(post.category_name)}</span>` : ""}
        ${post.published_at ? `<span style="color:#64748b;font-size:13px">${formatDate(post.published_at)}</span>` : ""}
      </div>
      <h1 style="font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;line-height:1.2;margin:0 0 1.5rem;color:#0f172a">${esc(post.title || "")}</h1>
      ${post.excerpt ? `<p style="font-size:1.15rem;color:#475569;margin-bottom:2rem;line-height:1.7;font-style:italic">${esc(post.excerpt)}</p>` : ""}
      ${
        post.featured_image_url
          ? `<img src="${esc(post.featured_image_url)}" alt="${esc(post.featured_image_alt || post.title)}" loading="eager" style="width:100%;max-height:500px;object-fit:cover;border-radius:12px;margin-bottom:2rem">`
          : ""
      }
      <div style="line-height:1.8;color:#374151;font-size:1rem">${sanitize(post.content || "")}</div>
      ${faqHtml}
    </article>`;

  let html = injectMeta(baseHtml, { title, description, canonical, ogImage });
  html = injectContent(html, contentHtml);
  html = addNoIndex(html);
  return html;
}

// ─── Static page HTML ─────────────────────────────────────────────────────────

function addNoIndex(html) {
  // Insert noindex after <head> opening tag so crawlers skip these pages.
  // dash.offerio.ch is the dashboard — only / is indexable.
  return html.replace(
    /(<head[^>]*>)/i,
    '$1\n  <meta name="robots" content="noindex, nofollow" />'
  );
}

function buildStaticPageHtml(baseHtml, { route, title, description }) {
  const canonical = `${BASE_URL}${route}`;
  return addNoIndex(injectMeta(baseHtml, { title, description, canonical }));
}

// ─── Homepage HTML (injects into dist/index.html itself) ─────────────────────

function buildHomepageHtml(baseHtml) {
  const SERVICES = [
    { title: "Umzug", desc: "Stressfreier Umzug in der Schweiz. Von der 1-Zimmer-Wohnung bis zum kompletten Firmenumzug. Inklusive Verpackung, Transport und Montage auf Wunsch.", link: "/anfrage/umzug", features: ["Privatumzug", "Firmenumzug", "Internationaler Umzug", "Seniorenumzug"] },
    { title: "Reinigung", desc: "Professionelle Endreinigung und Grundreinigung mit Abnahmegarantie. Für eine stressfreie Wohnungsübergabe in der ganzen Schweiz.", link: "/anfrage/reinigung", features: ["Endreinigung / Umzugsreinigung", "Grundreinigung", "Fensterreinigung", "Teppichreinigung"] },
    { title: "Räumung", desc: "Professionelle Entrümpelung und Haushaltsauflösung. Diskret und zuverlässig, auch bei Todesfall oder Messie-Situationen.", link: "/anfrage/raeumung", features: ["Haushaltsauflösung", "Entrümpelung", "Nachlassräumung", "Kellerräumung"] },
    { title: "Klaviertransport", desc: "Sicherer Transport von Klavieren und Flügeln durch spezialisierte Fachfirmen. Mit Versicherung und professionellem Equipment.", link: "/anfrage/klaviertransport", features: ["Klaviertransport", "Flügeltransport", "Instrumententransport", "Tresortransport"] },
    { title: "Möbellift", desc: "Möbellift mieten für einen einfachen und schnellen Umzug. Ideal für höhere Stockwerke und sperrige Möbelstücke.", link: "/anfrage/moebellift", features: ["Möbellift mieten", "Fassadenlift", "Bauaufzug", "Inkl. Bedienpersonal"] },
    { title: "Lagerung", desc: "Sichere und trockene Lagerräume für Ihre Möbel und Kartons. Flexibel mietbar für kurze oder lange Zeiträume.", link: "/anfrage/lagerung", features: ["Möbellagerung", "Self-Storage", "Zwischenlagerung", "Aktenlagerung"] },
  ];

  const serviceCards = SERVICES.map((s) => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;background:#fff">
      <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem;color:#1e293b">${esc(s.title)}</h3>
      <p style="font-size:0.9rem;color:#64748b;margin:0 0 1rem;line-height:1.6">${esc(s.desc)}</p>
      <ul style="list-style:none;padding:0;margin:0 0 1rem;display:flex;flex-direction:column;gap:4px">
        ${s.features.map((f) => `<li style="font-size:0.85rem;color:#374151;padding-left:1.2rem;position:relative"><span style="position:absolute;left:0;color:#EF6A17">✓</span>${esc(f)}</li>`).join("")}
      </ul>
      <a href="${esc(s.link)}" style="display:inline-block;background:#EF6A17;color:#fff;font-size:0.85rem;font-weight:600;padding:8px 16px;border-radius:6px;text-decoration:none">Offerte anfragen</a>
    </div>`).join("");

  const contentHtml = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1e293b">

      <!-- Header -->
      <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between">
        <a href="/" style="font-size:1.25rem;font-weight:800;color:#1e293b;text-decoration:none">
          <span style="color:#EF6A17">offer</span>io
        </a>
        <nav style="display:flex;gap:1.5rem;font-size:0.9rem">
          <a href="/so-funktioniert-es" style="color:#64748b;text-decoration:none">So funktioniert's</a>
          <a href="/preise" style="color:#64748b;text-decoration:none">Preise</a>
          <a href="/blog" style="color:#64748b;text-decoration:none">Blog</a>
        </nav>
      </header>

      <!-- Hero -->
      <section style="background:linear-gradient(135deg,#1e3a5f 0%,#2d6a9f 60%,#4a90d9 100%);color:#fff;padding:5rem 1.5rem 4rem;text-align:center" aria-labelledby="hero-heading">
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:50px;padding:6px 16px;font-size:0.8rem;font-weight:600;margin-bottom:1.5rem;letter-spacing:0.03em">
          🇨🇭 Der einzige Schweizer Marktplatz für Umzug UND Reinigung
        </div>
        <h1 id="hero-heading" style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;line-height:1.15;margin:0 auto 1.25rem;max-width:760px">
          Umzugsofferten einholen ist zeitraubend —
          <span style="color:#FCD34D"> wir erledigen das für Sie</span>
        </h1>
        <p style="font-size:1.1rem;opacity:0.9;max-width:580px;margin:0 auto 2rem;line-height:1.6">
          Bis zu 5 verifizierte Umzugs- und Reinigungsunternehmen melden sich innerhalb von 24h.
          Kostenlos, unverbindlich, ohne Telefonstress.
        </p>
        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem">
          <a href="/anfrage" style="display:inline-block;background:#EF6A17;color:#fff;font-weight:700;font-size:1rem;padding:0.9rem 2rem;border-radius:50px;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.2)">
            Jetzt kostenlos anfragen →
          </a>
          <a href="/so-funktioniert-es" style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:1rem;padding:0.9rem 2rem;border-radius:50px;text-decoration:none;border:1px solid rgba(255,255,255,0.4)">
            Wie funktioniert's?
          </a>
        </div>
        <div style="display:flex;gap:2rem;justify-content:center;flex-wrap:wrap;font-size:0.85rem;opacity:0.85">
          <span>✓ 100% kostenlos</span>
          <span>✓ Unverbindlich</span>
          <span>✓ In 24h Angebote</span>
          <span>✓ 500+ geprüfte Partner</span>
        </div>
      </section>

      <!-- Services -->
      <section style="padding:4rem 1.5rem;background:#f8fafc" aria-labelledby="services-heading">
        <div style="max-width:1200px;margin:0 auto">
          <header style="text-align:center;margin-bottom:3rem">
            <h2 id="services-heading" style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:800;margin:0 0 1rem;color:#1e293b">
              Alle Dienstleistungen, <span style="color:#EF6A17">eine Plattform</span>
            </h2>
            <p style="font-size:1rem;color:#64748b;max-width:600px;margin:0 auto;line-height:1.6">
              Von der Planung bis zur Ausführung – finden Sie den perfekten Dienstleister für Ihren Bedarf.
              Alle Partner sind verifiziert und versichert.
            </p>
          </header>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem">
            ${serviceCards}
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section style="padding:4rem 1.5rem;background:#fff" aria-labelledby="how-heading">
        <div style="max-width:900px;margin:0 auto;text-align:center">
          <h2 id="how-heading" style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:800;margin:0 0 0.75rem;color:#1e293b">
            In 3 Schritten zu Ihrer <span style="color:#EF6A17">Offerte</span>
          </h2>
          <p style="font-size:1rem;color:#64748b;margin:0 0 3rem;line-height:1.6">Einfach, schnell und kostenlos – so funktioniert Offerio</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2rem;text-align:left">
            <div>
              <div style="width:48px;height:48px;border-radius:50%;background:#EF6A17;color:#fff;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">1</div>
              <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem;color:#1e293b">Anfrage stellen</h3>
              <p style="font-size:0.9rem;color:#64748b;margin:0;line-height:1.6">Beschreiben Sie Ihr Anliegen in wenigen Minuten. Unser Formular führt Sie Schritt für Schritt durch den Prozess.</p>
            </div>
            <div>
              <div style="width:48px;height:48px;border-radius:50%;background:#EF6A17;color:#fff;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">2</div>
              <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem;color:#1e293b">Offerten erhalten</h3>
              <p style="font-size:0.9rem;color:#64748b;margin:0;line-height:1.6">Bis zu 5 geprüfte Umzugs- oder Reinigungsfirmen aus Ihrer Region melden sich innerhalb von 24 Stunden.</p>
            </div>
            <div>
              <div style="width:48px;height:48px;border-radius:50%;background:#EF6A17;color:#fff;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">3</div>
              <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem;color:#1e293b">Vergleichen &amp; sparen</h3>
              <p style="font-size:0.9rem;color:#64748b;margin:0;line-height:1.6">Vergleichen Sie die Angebote direkt und wählen Sie den besten Dienstleister. Bis zu 40% Ersparnis möglich.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Trust signals -->
      <section style="padding:3rem 1.5rem;background:#f8fafc;border-top:1px solid #e2e8f0">
        <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.5rem;text-align:center">
          <div><div style="font-size:2rem;font-weight:800;color:#EF6A17">500+</div><div style="font-size:0.9rem;color:#64748b;margin-top:4px">geprüfte Partner</div></div>
          <div><div style="font-size:2rem;font-weight:800;color:#EF6A17">50'000+</div><div style="font-size:0.9rem;color:#64748b;margin-top:4px">zufriedene Kunden</div></div>
          <div><div style="font-size:2rem;font-weight:800;color:#EF6A17">24h</div><div style="font-size:0.9rem;color:#64748b;margin-top:4px">Antwortzeit</div></div>
          <div><div style="font-size:2rem;font-weight:800;color:#EF6A17">4.8★</div><div style="font-size:0.9rem;color:#64748b;margin-top:4px">Durchschnittsbewertung</div></div>
          <div><div style="font-size:2rem;font-weight:800;color:#EF6A17">100%</div><div style="font-size:0.9rem;color:#64748b;margin-top:4px">kostenlos für Kunden</div></div>
        </div>
      </section>

      <!-- FAQ (crawlable text version of structured data) -->
      <section style="padding:4rem 1.5rem;background:#fff" aria-labelledby="faq-heading">
        <div style="max-width:760px;margin:0 auto">
          <h2 id="faq-heading" style="font-size:clamp(1.25rem,2.5vw,2rem);font-weight:800;margin:0 0 2rem;text-align:center;color:#1e293b">Häufig gestellte Fragen</h2>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
              <div style="padding:1rem 1.25rem;font-weight:700;background:#f8fafc;color:#1e293b">Ist der Service von Offerio kostenlos?</div>
              <div style="padding:1rem 1.25rem;border-top:1px solid #e2e8f0;color:#374151;font-size:0.95rem;line-height:1.6">Ja, für Privatpersonen ist unser Service 100% kostenlos und unverbindlich. Sie erhalten bis zu 5 Offerten von verifizierten Anbietern ohne jegliche Kosten.</div>
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
              <div style="padding:1rem 1.25rem;font-weight:700;background:#f8fafc;color:#1e293b">Wie lange dauert es, bis ich Offerten erhalte?</div>
              <div style="padding:1rem 1.25rem;border-top:1px solid #e2e8f0;color:#374151;font-size:0.95rem;line-height:1.6">In der Regel erhalten Sie innerhalb von 24 Stunden bis zu 5 Offerten von qualifizierten Umzugs- oder Reinigungsfirmen in Ihrer Region.</div>
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
              <div style="padding:1rem 1.25rem;font-weight:700;background:#f8fafc;color:#1e293b">Sind die Partner-Firmen verifiziert?</div>
              <div style="padding:1rem 1.25rem;border-top:1px solid #e2e8f0;color:#374151;font-size:0.95rem;line-height:1.6">Ja, alle unsere Partner werden auf Zuverlässigkeit, Versicherungsschutz und Servicequalität geprüft. Nur Firmen, die unsere strengen Kriterien erfüllen, werden aufgenommen.</div>
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
              <div style="padding:1rem 1.25px;font-weight:700;background:#f8fafc;color:#1e293b">In welchen Regionen der Schweiz ist Offerio verfügbar?</div>
              <div style="padding:1rem 1.25rem;border-top:1px solid #e2e8f0;color:#374151;font-size:0.95rem;line-height:1.6">Offerio ist in der gesamten Deutschschweiz verfügbar, mit Schwerpunkten in Zürich, Bern, Basel, Luzern, St. Gallen, Winterthur, Zug und weiteren Kantonen.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="background:#1e293b;color:#94a3b8;padding:2.5rem 1.5rem;font-size:0.875rem">
        <div style="max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:0.5rem"><span style="color:#EF6A17">offer</span>io</div>
            <div>Der Schweizer Marktplatz für Umzug &amp; Reinigung</div>
          </div>
          <nav style="display:flex;flex-wrap:wrap;gap:1.5rem">
            <a href="/anfrage" style="color:#94a3b8;text-decoration:none">Anfrage stellen</a>
            <a href="/so-funktioniert-es" style="color:#94a3b8;text-decoration:none">So funktioniert's</a>
            <a href="/fuer-firmen" style="color:#94a3b8;text-decoration:none">Für Firmen</a>
            <a href="/blog" style="color:#94a3b8;text-decoration:none">Blog</a>
            <a href="/impressum" style="color:#94a3b8;text-decoration:none">Impressum</a>
            <a href="/datenschutz" style="color:#94a3b8;text-decoration:none">Datenschutz</a>
          </nav>
        </div>
      </footer>

    </div>`;

  return injectContent(baseHtml, contentHtml);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STATIC_PUBLIC_PAGES = [
  {
    route: "/blog",
    title: "Blog | Offerio.ch – Tipps zu Umzug & Reinigung",
    description: "Ratgeber, Tipps und aktuelle Infos rund um Umzug, Reinigung und Wohnungswechsel in der Schweiz.",
  },
  {
    route: "/so-funktioniert-es",
    title: "So funktioniert Offerio | Umzugsofferten vergleichen",
    description: "In 3 einfachen Schritten zu Ihrer Offerte: Anfrage stellen, Offerten erhalten, vergleichen und sparen.",
  },
  {
    route: "/fuer-firmen",
    title: "Für Umzugs- & Reinigungsfirmen | Partner werden bei Offerio",
    description: "Neue Kunden gewinnen ohne Risiko. Erhalten Sie qualifizierte Kundenanfragen direkt in Ihr Dashboard.",
  },
  {
    route: "/preise",
    title: "Preise & Token-Pakete | Offerio.ch",
    description: "Faire und transparente Preise für Umzugs- und Reinigungsfirmen. Keine Grundgebühren, zahlen Sie nur für angenommene Leads.",
  },
  {
    route: "/partner-werden",
    title: "Partner werden | Offerio.ch",
    description: "Werden Sie Partner bei Offerio und erhalten Sie qualifizierte Kundenanfragen für Umzug und Reinigung in der Schweiz.",
  },
];

async function prerender() {
  await loadEnvFiles();

  // Load base HTML template
  let baseHtml;
  try {
    baseHtml = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  } catch {
    console.error("[prerender] dist/index.html not found. Run `vite build` first.");
    process.exitCode = 1;
    return;
  }

  let count = 0;

  // ── Homepage ─────────────────────────────────────────────────────────────
  // dash.offerio.ch is a dashboard SPA — index.html must stay as the bare app
  // shell so the React router can boot cleanly without a homepage HTML flash.
  // The public homepage lives on offerio.ch (Next.js) and is NOT prerendered here.
  console.log("[prerender] ℹ  / (homepage) — skipped: dash subdomain serves app shell only");

  // ── Static pages ────────────────────────────────────────────────────────────
  for (const page of STATIC_PUBLIC_PAGES) {
    const html = buildStaticPageHtml(baseHtml, page);
    const dir = path.join(DIST_DIR, page.route.slice(1)); // strip leading /
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), html, "utf8");
    count++;
    console.log(`[prerender] ✓ ${page.route}`);
  }

  // ── Blog posts ───────────────────────────────────────────────────────────────
  try {
    const posts = await fetchRows(
      "blog_posts?select=id,slug,title,content,excerpt,seo_title,meta_description,featured_image_url,featured_image_alt,published_at,updated_at,author_name,category_name,faq_schema&status=eq.published&order=published_at.desc"
    );

    console.log(`\n[prerender] Found ${posts.length} published blog posts`);

    for (const post of posts) {
      if (!post?.slug) continue;
      const html = buildBlogHtml(baseHtml, post);
      const dir = path.join(DIST_DIR, "blog", post.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "index.html"), html, "utf8");
      count++;
      console.log(`[prerender] ✓ /blog/${post.slug}`);
    }
  } catch (err) {
    console.warn("[prerender] Blog posts failed:", err.message);
  }

  // Landing pages have been removed from dash.offerio.ch.
  // They will be rebuilt in the offerio.ch Next.js project.

  console.log(`\n[prerender] Done! Generated ${count} static HTML files.\n`);
}

prerender().catch((err) => {
  console.error("[prerender] Fatal:", err);
  process.exitCode = 1;
});
