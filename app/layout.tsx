import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Carbon Gate",
  description: "CI/CD carbon enforcement for ML teams."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}
    >
      <body className="bg-gate-bg font-display antialiased">{children}</body>
    </html>
  );
}
