/**
 * Tailwind is configured to expose the design tokens from `src/index.css` and
 * nothing else. There are no ad-hoc colours here: if a component needs a
 * colour, it either already exists as a token or the token is missing and
 * should be added to index.css (and mirrored in src/lib/brand.ts).
 *
 * See docs/DESIGN_SYSTEM.md.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Baloo 2", "Tajawal", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /* Raised/sunken surfaces, for when `.surface` is too opinionated. */
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          sunken: "hsl(var(--surface-sunken))",
        },

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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* Brand hues, addressable directly for game-specific accents. */
        coral: "hsl(var(--coral))",
        /* The darker coral. Small text on a coral tint fails contrast at the
           base hue — see the note above `.chip-hot` in index.css. */
        "coral-dim": "hsl(var(--coral-dim))",
        mint: "hsl(var(--mint))",
        gold: "hsl(var(--gold))",
        ruby: "hsl(var(--ruby))",
        violet: "hsl(var(--violet))",
        sky: "hsl(var(--sky))",
        cream: "hsl(var(--cream))",
        sand: "hsl(var(--sand))",
        /* Semantic alias: realtime state. Prefer this over `mint` when the
           meaning is "connected / live / your turn". */
        live: "hsl(var(--live))",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
        coral: "var(--shadow-coral)",
        mint: "var(--shadow-mint)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
      keyframes: {
        "bubble-in": {
          "0%": { opacity: "0", transform: "scale(0.85) translateY(6px)" },
          "60%": { opacity: "1", transform: "scale(1.03) translateY(0)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "20%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-18px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--coral) / 0.45)" },
          "50%": { boxShadow: "0 0 0 8px hsl(var(--coral) / 0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "blob-float": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(4%, -6%) scale(1.1)" },
          "66%": { transform: "translate(-3%, 5%) scale(0.94)" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(320px) rotate(360deg)", opacity: "0" },
        },
        "marquee-x": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "bubble-in": "bubble-in 0.35s var(--ease-spring)",
        "float-up": "float-up 1.6s ease-out forwards",
        "pulse-glow": "pulse-glow 1.8s ease-out infinite",
        "pop-in": "pop-in 0.25s var(--ease-out)",
        "blob-float": "blob-float 20s ease-in-out infinite",
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "marquee-x": "marquee-x 30s linear infinite",
      },
    },
  },
  plugins: [],
};
