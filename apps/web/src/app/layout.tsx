import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { Toaster } from "@/components/ui/toast";
import { ConditionalScrollToTop } from "@/components/layout/ConditionalScrollToTop";
import { ConditionalAIAssistantFab } from "@/components/ai/ConditionalAIAssistantFab";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Determine the base URL for metadata
const getMetadataBase = () => {
  // Always prefer the canonical domain
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // Production on Vercel — use canonical domain, not deployment URL
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://bechays.com';
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // For local development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // Fallback
  return 'https://bechays.com';
};

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBase()),
  title: {
    default: "PropGroup - Smart Real Estate Investment Platform",
    template: "%s | PropGroup"
  },
  description: "Your gateway to international real estate investment opportunities with data-driven insights and expert guidance",
  keywords: ["real estate", "investment", "property", "international", "golden visa", "ROI", "portfolio"],
  authors: [{ name: "PropGroup" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.bechays.com",
    title: "PropGroup - Smart Real Estate Investment Platform",
    description: "Your gateway to international real estate investment opportunities",
    siteName: "PropGroup",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropGroup",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropGroup - Smart Real Estate Investment Platform",
    description: "Your gateway to international real estate investment opportunities",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} overflow-x-hidden`}>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
      </head>
      <body className="font-plus-jakarta antialiased min-h-screen flex flex-col bg-stone-50 overflow-x-hidden">
        <AuthProvider>
          <ConditionalNavbar />
          <div className="flex-1">
            {children}
          </div>
          <ConditionalFooter />
          <ConditionalScrollToTop />
          <ConditionalAIAssistantFab />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
