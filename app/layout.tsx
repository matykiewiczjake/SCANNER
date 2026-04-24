import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memecoin Scanner",
  description: "Solana memecoin scanner with 8 automated checks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
