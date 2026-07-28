import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/** Remove files from the build output that should not be served in production. */
const removeProductionFiles = (filenames: string[]) => ({
  name: "remove-production-files",
  closeBundle() {
    for (const file of filenames) {
      const target = path.resolve(__dirname, "dist", file);
      if (fs.existsSync(target)) {
        fs.rmSync(target);
        console.log(`[security] Removed from dist: ${file}`);
      }
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Ensure the frontend always gets the required VITE_* vars even if only non-VITE vars exist
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env = { ...fileEnv, ...(process.env as Record<string, string | undefined>) };

  const resolvedSupabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    (env.VITE_SUPABASE_PROJECT_ID
      ? `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
      : undefined);

  // In der PRODUKTION spricht der Browser nie direkt mit Supabase: nginx.conf
  // leitet `^/(rest|auth|storage|functions|realtime)/` an Kong weiter, und
  // VITE_SUPABASE_URL ist die eigene Domain. Der Dev-Server hatte diese
  // Weiterleitung nicht — dort ging der Browser direkt an den Kong-Host.
  //
  // Das ist nicht nur eine Abweichung, es ist eine, die als Raetsel auftritt:
  // der Kong-Host laeuft nur ueber http (er hat kein Zertifikat). Ein Browser
  // mit "Nur-HTTPS"-Modus hebt den Aufruf still auf https, dort antwortet
  // niemand, und die Konsole meldet "CORS request did not succeed" mit
  // Statuscode null — obwohl es weder an CORS noch am Server liegt.
  //
  // Deshalb spiegelt der Dev-Server jetzt nginx: der Browser ruft
  // ausschliesslich seinen eigenen Ursprung auf, Vite reicht weiter.
  // `http://localhost` ist von der HTTPS-Anhebung ausgenommen.
  //
  // ⚠️ Diese localhost-Adresse ist NUR die Adresse des Dev-Servers, nicht die
  // des Ziels. Sie ist KEIN Beleg dafuer, dass man auf einer Testdatenbank
  // arbeitet — dafuer gibt es src/test/env-guard.ts, der zusaetzlich
  // CRM_TEST_ENV und den DB-Host verlangt.
  const supabaseProxyPfade = "^/(rest|auth|storage|functions|realtime)/";
  const istDevServer = command === "serve" && Boolean(resolvedSupabaseUrl);

  const resolvedSupabaseKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    undefined;

  return {
    server: {
      host: "::",
      port: 8080,
      // Spiegelt nginx.conf. `ws` fuer realtime, `changeOrigin` entspricht dem
      // dortigen `proxy_set_header Host`.
      proxy: resolvedSupabaseUrl
        ? {
            [supabaseProxyPfade]: {
              target: resolvedSupabaseUrl,
              changeOrigin: true,
              ws: true,
            },
          }
        : undefined,
      // Increase limit for large dev cookies (431 fix)
      hmr: true,
      headers: {
        // Dev-only: allow same-origin framing for the embed test page
        "Content-Security-Policy": "frame-ancestors 'self' localhost",
        "Access-Control-Allow-Origin": "*",
      },
      cors: true,
    },
    preview: {
      headers: {
        "Content-Security-Policy": "frame-ancestors 'self'",
        "Access-Control-Allow-Origin": "*",
      },
      cors: true,
    },
    // Needed for pdfjs-dist v4 (top-level await)
    build: {
      target: "es2022",
      // Enable CSS code splitting for parallel loading
      cssCodeSplit: true,
      // The PDF renderer chunk is intentionally large and lazy-loaded
      chunkSizeWarningLimit: 1200,
      // Skip per-file gzip size computation — saves memory & time in CI
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          // Ensure CSS is loaded in parallel with JS, not chained
          assetFileNames: (assetInfo) => {
            // Keep CSS in assets folder with hash for caching
            if (assetInfo.name?.endsWith('.css')) {
              return 'assets/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          manualChunks: (id) => {
            // Vite's __vitePreload helper is used by every lazy route import()
            // in the entry. If it lands in a heavy lazy vendor chunk (e.g.
            // vendor-pdf), that whole chunk gets modulepreloaded on first paint.
            // Pin it to the always-eager React chunk so it costs nothing extra.
            if (id.includes('vite/preload-helper')) {
              return 'vendor-react';
            }
            // Wiki: one chunk per LOCALE for the help search index, so a session
            // downloads only its own language (~6 KB gz) instead of all three.
            //
            // Article BODIES deliberately get NO entry here. They are reached only
            // through import() in wikiContent.ts, so Rollup already emits one chunk
            // each. Naming them as a group would fuse every article in every language
            // into a single chunk, and opening one guide would download the whole
            // manual — the exact opposite of the intent.
            if (id.includes('/src/features/wiki/content/searchIndex.de')) return 'wiki-index-de';
            if (id.includes('/src/features/wiki/content/searchIndex.fr')) return 'wiki-index-fr';
            if (id.includes('/src/features/wiki/content/searchIndex.en')) return 'wiki-index-en';
            // The Buffer polyfill is imported eagerly by main.tsx (needed as a
            // global for the lazy qrcode/@react-pdf code). Keep it and its
            // transitive deps (base64-js, ieee754) in a small dedicated chunk so
            // they don't ride along inside the 500 KB lazy vendor-qr chunk and
            // drag it into the initial modulepreload set.
            if (id.includes('node_modules/buffer/') ||
                id.includes('node_modules/base64-js') ||
                id.includes('node_modules/ieee754')) {
              return 'vendor-polyfill';
            }
            // Core React - loaded first, cached long-term
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') || 
                id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            // Router - separate for better caching
            if (id.includes('node_modules/react-router') || 
                id.includes('node_modules/@remix-run/router')) {
              return 'vendor-router';
            }
            // Radix UI Components - loaded on demand
            if (id.includes('node_modules/@radix-ui/')) {
              return 'vendor-ui';
            }
            // Supabase - separate chunk
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            // PDF generation libraries
            if (id.includes('node_modules/jspdf') || 
                id.includes('node_modules/html2canvas')) {
              return 'vendor-pdf';
            }
            // PDF rendering and parsing are heavy; keep them isolated
            if (id.includes('node_modules/@react-pdf/')) {
              return 'vendor-react-pdf';
            }
            if (id.includes('node_modules/pdfjs-dist/')) {
              return 'vendor-pdfjs';
            }
            // QR related dependencies can become very large
            if (id.includes('node_modules/qrcode') ||
                id.includes('node_modules/yoga-layout') ||
                id.includes('node_modules/restructure') ||
                id.includes('node_modules/fontkit') ||
                id.includes('node_modules/png-js')) {
              return 'vendor-qr';
            }
            // Date utilities
            if (id.includes('node_modules/date-fns')) {
              return 'vendor-date';
            }
            // Form handling
            if (id.includes('node_modules/react-hook-form') || 
                id.includes('node_modules/@hookform/') ||
                id.includes('node_modules/zod')) {
              return 'vendor-form';
            }
            // TanStack Query
            if (id.includes('node_modules/@tanstack/')) {
              return 'vendor-query';
            }
            // Lucide icons
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
          },
        },
      },
    },
    esbuild: {
      target: "es2022",
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "es2022",
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode !== "development" && removeProductionFiles(["embed-test.html"]),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Im Dev-Server der EIGENE Ursprung, als Ausdruck statt als Zeichenkette:
      // `define` ersetzt Text, also landet hier wirklich `window.location.origin`
      // im Bundle. Ein fest verdrahtetes "http://localhost:8080" waere falsch,
      // sobald Vite auf einen freien Port ausweicht — dann riefe die Anwendung
      // einen anderen Ursprung auf als den, unter dem sie laeuft.
      ...(istDevServer
        ? { "import.meta.env.VITE_SUPABASE_URL": "window.location.origin" }
        : resolvedSupabaseUrl
          ? { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(resolvedSupabaseUrl) }
          : {}),
      ...(resolvedSupabaseKey
        ? {
            "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(resolvedSupabaseKey),
            "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(resolvedSupabaseKey),
          }
        : {}),
    },
  };
});
