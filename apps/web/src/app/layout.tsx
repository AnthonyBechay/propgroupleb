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
  // In production on Vercel, use VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // For local development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // Fallback
  return 'https://localhost:3000';
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
    url: "https://propgroup.com",
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} overflow-x-hidden`}>
      <body className="font-plus-jakarta antialiased min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
        <AuthProvider>
          <ConditionalNavbar />
          <main className="flex-1">
            {children}
          </main>
          <ConditionalFooter />
          <ConditionalScrollToTop />
          <ConditionalAIAssistantFab />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
