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
        canvas: {
          DEFAULT: "#FFF8F0", // Floral White
          raised: "#F7EFE4"
        },
        ink: {
          DEFAULT: "#002A32", // Jet Black
          muted: "#2F5157",
          faint: "#5D767A"
        },
        stoneware: {
          turquoise: "#98D2EB", // Sky Blue Light
          pink: "#C4A4A7",
          green: "#69995D",     // Sage Green
          bordeaux: "#533745"   // Mauve Shadow
        },
        border: {
          subtle: "#E0DDD9",
          DEFAULT: "#D6D3CF"
        }
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif"
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem"
      }
    }
  },
  plugins: []
};

export default config;
