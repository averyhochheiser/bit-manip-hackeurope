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
          DEFAULT: "#F5F3F0",
          raised: "#EDEAE6"
        },
        ink: {
          DEFAULT: "#3A3A38",
          muted: "#8A8885",
          faint: "#B5B3B0"
        },
        stoneware: {
          turquoise: "#98D2EB",
          pink: "#C4A4A7",
          green: "#69995D",
          bordeaux: "#533745"
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
