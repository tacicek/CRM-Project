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
export default defineConfig(({ mode }) => {
  // Ensure the frontend always gets the required VITE_* vars even if only non-VITE vars exist
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env = { ...fileEnv, ...(process.env as Record<string, string | undefined>) };

  const resolvedSupabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    (env.VITE_SUPABASE_PROJECT_ID
      ? `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
      : undefined);

  const resolvedSupabaseKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    undefined;

  return {
    server: {
      host: "::",
      port: 8080,
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
      ...(resolvedSupabaseUrl
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
