import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Absolute base for resolving OG/Twitter image URLs. Prefers an explicit
// override, then Vercel's production domain, then the known deployment.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://sunpath-beige.vercel.app");

const title = "SunPath Solar — Meet Sunny, your AI solar guide";
const description =
  "Sunny is SunPath Solar's AI consultant: get a right-sized system, real numbers, and a booked survey — in one conversation.";

export const viewport: Viewport = {
  // Tint mobile browser chrome to the dusk canvas.
  themeColor: "#07080c",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  // app/opengraph-image.tsx is picked up automatically for og:image / twitter:image.
  openGraph: {
    type: "website",
    siteName: "SunPath Solar",
    url: "/",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
