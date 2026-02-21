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
        crusoe: "#2B8CFF",
        gate: {
          bg: "#05070C",
          panel: "#0B1020"
        }
      },
      boxShadow: {
        insetGlow: "inset 0 0 0 0.5px rgba(255,255,255,0.16)",
        panel: "0 24px 60px rgba(0,0,0,0.35)"
      },
      backgroundImage: {
        noise:
          "radial-gradient(circle at 20% 20%, rgba(43,140,255,0.12), transparent 35%), radial-gradient(circle at 80% 0%, rgba(8,242,160,0.08), transparent 25%)"
      },
      fontFamily: {
        monoData: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
