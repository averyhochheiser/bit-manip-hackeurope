import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        crusoe: "#98D2EB",
        sage: "#69995D",
        mauve: "#533745",
        floral: "#FFF8F0",
        gate: {
          bg: "#23282E",
          panel: "#2A3038"
        }
      },
      boxShadow: {
        insetGlow: "inset 0 0.5px 0 0 rgba(255,248,240,0.1)",
        panel: "0 24px 60px rgba(0,0,0,0.35)"
      },
      backgroundImage: {
        noise:
          "radial-gradient(circle at 20% 20%, rgba(152,210,235,0.06), transparent 35%), radial-gradient(circle at 80% 0%, rgba(105,153,93,0.04), transparent 25%)"
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif"
        ],
        serif: [
          "var(--font-serif)",
          "Playfair Display",
          "Georgia",
          "Cambria",
          "serif"
        ],
        monoData: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      }
    }
  },
  plugins: []
};

export default config;
