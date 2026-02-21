import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/ui/inverted-cursor";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400"]
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400"]
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
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans font-light antialiased">
        <CustomCursor />
        {/* The Substrate Background */}
        <div className="fixed inset-0 -z-10 h-full w-full bg-ink">
          <img
            src="/design-bg.jpg"
            alt="Substrate Texture"
            className="h-full w-full object-cover object-center grayscale opacity-15 mix-blend-screen"
          />
        </div>
        {children}
      </body>
    </html>
  );
}
