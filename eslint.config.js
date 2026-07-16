import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { 
    ignores: [
      "dist/**", 
      "build/**",
      "servers/**", 
      "node_modules/**",
      ".next/**",
      ".turbo/**",
      "coverage/**",
      "public/**",
      ".git/**",
      "*.config.js",
      "*.config.ts",
      "supabase/functions/**", // Deno runtime - different lint rules
      // Independent vendored dev-tool package (own repo vibeeval/vibecosystem, own
      // toolchain). Not part of the CRM runtime/build/test — 0 imports from src/.
      // Its quality control belongs upstream, not this CRM lint gate.
      "vibecosystem/**",
    ]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // === REACT SPECIFIC ===
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { 
        allowConstantExport: true,
        allowExportNames: [
          "buttonVariants", 
          "badgeVariants", 
          "toggleVariants",
          "DEFAULT_OFFER_DETAILS", 
          "useTracking", 
          "useAuth",
          "useFormField",
          "generateServiceSchema",
          "generateLocalBusinessSchema",
          "generateFAQSchema",
          "generateBreadcrumbSchema",
          "hasConsentFor", 
          "openCookieSettings",
          "toast",
          "Toaster",
          // Virtual Besichtigung exports
          "ROOM_TYPES",
          "getRoomName",
          "getRoomIcon",
          "getStatusLabel",
          "getStatusColor",
          "firmaImports",
        ]
      }],
      "react-hooks/exhaustive-deps": "warn",
      
      // === TYPE SAFETY ===
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/ban-types": "off",
      
      // === BEST PRACTICES ===
      "no-console": ["warn", { 
        allow: ["log", "warn", "error", "info"] 
      }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "no-unused-expressions": "error",
      "no-duplicate-imports": "error",
    },
  },
);
