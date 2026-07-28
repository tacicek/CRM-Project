import type { Config } from "tailwindcss";

export default {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // `dark:`-Varianten haengen am Attribut, nicht an einer Klasse — der
  // ThemeProvider setzt data-theme auf <html>, und zwar nur unter /firma.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Dieselben Zahlen wie src/lib/breakpoints.ts. Getrennt benannt, damit
      // niemand versehentlich `md:` (768px) benutzt: das Layout schaltete dann
      // bei 768 um, waehrend useBreakpoint erst bei 820 `tablet` meldet — im
      // Band dazwischen widersprechen sich Darstellung und Verhalten.
      screens: {
        "shell-tablet": "820px",
        "shell-desktop": "1100px",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Fluid typography using clamp() for better responsiveness
        // Format: clamp(min, preferred, max)
        'xs': ['clamp(0.65rem, 1.5vw, 0.75rem)', { lineHeight: '1rem' }],
        'sm': ['clamp(0.75rem, 1.8vw, 0.875rem)', { lineHeight: '1.25rem' }],
        'base': ['clamp(0.875rem, 2vw, 1rem)', { lineHeight: '1.5rem' }],
        'lg': ['clamp(1rem, 2.2vw, 1.125rem)', { lineHeight: '1.75rem' }],
        'xl': ['clamp(1.125rem, 2.5vw, 1.25rem)', { lineHeight: '1.75rem' }],
        '2xl': ['clamp(1.25rem, 3vw, 1.5rem)', { lineHeight: '2rem' }],
        '3xl': ['clamp(1.5rem, 4vw, 1.875rem)', { lineHeight: '2.25rem' }],
        '4xl': ['clamp(1.875rem, 5vw, 2.25rem)', { lineHeight: '2.5rem' }],
        '5xl': ['clamp(2.25rem, 6vw, 3rem)', { lineHeight: '1' }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Folk design tokens — die Werte stehen als Kanalzahlen in index.css,
        // je einmal fuer hell und einmal unter :root[data-theme="dark"].
        // `<alpha-value>` erhaelt die Deckkraft-Modifikatoren (bg-folk-coral/30);
        // mit einem Hex in der Variable waeren die still wirkungslos.
        folk: {
          bg: "rgb(var(--folk-bg) / <alpha-value>)",
          "bg-warm": "rgb(var(--folk-bg-warm) / <alpha-value>)",
          sidebar: "rgb(var(--folk-sidebar) / <alpha-value>)",
          "sidebar-hi": "rgb(var(--folk-sidebar-hi) / <alpha-value>)",
          card: "rgb(var(--folk-card) / <alpha-value>)",
          ink: "rgb(var(--folk-ink) / <alpha-value>)",
          ink2: "rgb(var(--folk-ink2) / <alpha-value>)",
          ink3: "rgb(var(--folk-ink3) / <alpha-value>)",
          ink4: "rgb(var(--folk-ink4) / <alpha-value>)",
          ink5: "rgb(var(--folk-ink5) / <alpha-value>)",
          line: "rgb(var(--folk-line) / <alpha-value>)",
          "line-soft": "rgb(var(--folk-line-soft) / <alpha-value>)",
          "line-hard": "rgb(var(--folk-line-hard) / <alpha-value>)",
          coral: "rgb(var(--folk-coral) / <alpha-value>)",
          "coral-lite": "rgb(var(--folk-coral-lite) / <alpha-value>)",
          "coral-bg": "rgb(var(--folk-coral-bg) / <alpha-value>)",
          violet: "rgb(var(--folk-violet) / <alpha-value>)",
          "violet-bg": "rgb(var(--folk-violet-bg) / <alpha-value>)",
          mint: "rgb(var(--folk-mint) / <alpha-value>)",
          "mint-bg": "rgb(var(--folk-mint-bg) / <alpha-value>)",
          lemon: "rgb(var(--folk-lemon) / <alpha-value>)",
          "lemon-bg": "rgb(var(--folk-lemon-bg) / <alpha-value>)",
          sky: "rgb(var(--folk-sky) / <alpha-value>)",
          "sky-bg": "rgb(var(--folk-sky-bg) / <alpha-value>)",
          rose: "rgb(var(--folk-rose) / <alpha-value>)",
          "rose-bg": "rgb(var(--folk-rose-bg) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow': '0 0 40px hsl(224 64% 33% / 0.2)',
        'glow-lg': '0 0 60px hsl(224 64% 33% / 0.3)',
        'glow-orange': '0 0 40px hsl(24 86% 51% / 0.25)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [import("tailwindcss-animate")],
} satisfies Config;
