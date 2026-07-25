import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      // Edge-function modules that are deliberately pure (no Deno API, no
      // remote imports) so the inbound-email pipeline's decision logic,
      // signature verification and filters are covered like any other unit.
      "supabase/functions/**/__tests__/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/authUtils.ts", "src/lib/adminPermissions.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
