import type { Config } from "tailwindcss";

export default {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
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
        // Folk design tokens — used by FirmaLayout shell
        folk: {
          bg: "#FBFAF7",
          "bg-warm": "#F7F5EF",
          sidebar: "#F3F1EA",
          "sidebar-hi": "#EBE7DC",
          card: "#FFFFFF",
          ink: "#18181A",
          ink2: "#3C3C3F",
          ink3: "#737073",
          ink4: "#A5A3A1",
          ink5: "#C7C5C0",
          line: "#EBE9E2",
          "line-soft": "#F2F0E8",
          "line-hard": "#DAD7CD",
          coral: "#F87557",
          "coral-lite": "#FCE5DE",
          "coral-bg": "#FFF1EC",
          violet: "#6E5BD8",
          "violet-bg": "#F2EEFD",
          mint: "#42A678",
          "mint-bg": "#EBF6F0",
          lemon: "#D4A50A",
          "lemon-bg": "#FBF4D9",
          sky: "#3A82BA",
          "sky-bg": "#E9F1F8",
          rose: "#C24472",
          "rose-bg": "#F9E9F0",
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
