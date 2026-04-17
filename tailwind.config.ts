import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ── DEF-0005 — WCAG 2.1 AA contrast palette overrides ──────────────
        //
        // The Tailwind defaults for these shades fail axe-core's
        // `color-contrast` rule (impact: serious) when used as label text on
        // either `bg-white` or any `bg-*-50` tile background — both common
        // patterns in this app. Each override below shifts the offending
        // shade to a hex value that meets or exceeds the 4.5:1 AA threshold
        // on the lightest surfaces we render.
        //
        // The override is applied at the palette level (instead of class-by-
        // class swaps across ~100 files) because:
        //   1. It fixes every existing usage *and* every future usage in one
        //      place.
        //   2. It cannot be silently reverted by individual contributors —
        //      changing `tailwind.config.ts` triggers PR review.
        //   3. It does not weaken or exclude any axe rule (anti-weakening
        //      §4.2 of `docs/qa/STANDARD.md`).
        //
        // Verified contrast ratios (https://webaim.org/resources/contrastchecker/):
        //   gray-400  #4b5563 on #ffffff = 7.59:1   (was 2.84:1 ❌)
        //   gray-400  #4b5563 on #eff6ff = 7.07:1   (bg-blue-50)
        //   gray-500  #374151 on #ffffff = 12.6:1   (was 4.83:1, only borderline)
        //   gray-500  #374151 on #eff6ff = 11.7:1   (was 4.44:1 ❌ on *-50)
        //   yellow-600 #a16207 on #fefce8 = 4.76:1  (was 3.40:1 ❌)
        //   amber-600  #b45309 on #fffbeb = 4.84:1  (was 3.36:1 ❌)
        //   orange-600 #c2410c on #fff7ed = 4.88:1  (was 3.79:1 ❌)
        //   green-600  #15803d on #f0fdf4 = 4.79:1  (was 3.63:1 ❌)
        //   red-600    #b91c1c on #fef2f2 = 5.94:1  (was 4.41:1 ❌)
        //   rose-600   #be123c on #fff1f2 = 5.46:1  (was 4.28:1 ❌)
        //
        // Visual impact: gray text drops one tier in lightness; pill text
        // for warning / pending / success states is one tier deeper. Brand
        // hierarchy preserved (gray-300, 600, 700 etc. unchanged).
        gray: {
          400: "#4b5563",
          500: "#374151",
        },
        yellow: { 600: "#a16207" },
        amber:  { 600: "#b45309" },
        orange: { 600: "#c2410c" },
        green:  { 600: "#15803d" },
        red:    { 600: "#b91c1c" },
        rose:   { 600: "#be123c" },
        // ── End DEF-0005 overrides ─────────────────────────────────────────
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
