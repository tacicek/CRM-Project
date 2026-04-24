export const COLORS = {
  primary: "#0891B2",
  primaryLight: "#E0F2F7",
  success: "#10B981",
  danger: "#DC2626",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    500: "#6B7280",
    700: "#374151",
    900: "#111827",
  },
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    white: "#FFFFFF",
  },
} as const;

export const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
} as const;

export const FONT_SIZES = {
  xs: 8,
  sm: 9,
  base: 10,
  lg: 12,
  xl: 14,
  "2xl": 16,
  "3xl": 20,
  "4xl": 22,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  base: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
} as const;
