import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-gate-bg antialiased">{children}</body>
    </html>
  );
}
