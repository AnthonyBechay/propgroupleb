import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ComparatorProvider } from "@/contexts/ComparatorContext";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { Toaster } from "@/components/ui/toast";
import { ConditionalScrollToTop } from "@/components/layout/ConditionalScrollToTop";
import { ConditionalAIAssistantFab } from "@/components/ai/ConditionalAIAssistantFab";
import { ComparatorBar } from "@/components/ComparatorBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Omitting `weight` makes next/font load the variable font file (one WOFF2
// covering every weight) instead of six separate static files. Saves ~60–90
// kB on first paint while preserving every Tailwind weight class (300–800).
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const DEFAULT_TITLE = "Invest in Batumi & Georgia Real Estate | PropGroup";
const DEFAULT_DESCRIPTION =
  "PropGroup — Georgia and Batumi's trusted real-estate investment platform. Hand-picked off-plan & new-build projects, transparent ROI, flexible payment plans, and expert investor support.";
const DEFAULT_KEYWORDS = [
  "Batumi real estate investment",
  "Georgia property investment",
  "invest in Batumi",
  "invest in Georgia",
  "Batumi apartments for sale",
  "Tbilisi investment properties",
  "Georgia off-plan property",
  "Black Sea real estate",
  "Batumi rental yield",
  "Georgia golden visa",
  "Batumi property ROI",
  "Georgia new build apartments",
  "Batumi sea view apartments",
  "Adjara real estate",
  "Georgia residency by investment",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | PropGroup — Georgia Real Estate",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  applicationName: "PropGroup",
  authors: [{ name: "PropGroup", url: SITE_URL }],
  creator: "PropGroup",
  publisher: "PropGroup",
  category: "real estate",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    siteName: "PropGroup",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropGroup — Batumi & Georgia Real Estate Investment",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    // fill in when available
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
        {/* Organization + WebSite JSON-LD — helps Google surface brand panel + sitelinks search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "RealEstateAgent",
                  "@id": `${SITE_URL}#organization`,
                  name: "PropGroup",
                  url: SITE_URL,
                  logo: `${SITE_URL}/logo.png`,
                  image: `${SITE_URL}/og-image.png`,
                  description: DEFAULT_DESCRIPTION,
                  areaServed: [
                    { "@type": "Country", name: "Georgia" },
                    { "@type": "City", name: "Batumi" },
                    { "@type": "City", name: "Tbilisi" },
                  ],
                  knowsAbout: [
                    "Real estate investment",
                    "Batumi property market",
                    "Georgia property market",
                    "Off-plan property",
                    "Rental yield analysis",
                    "Residency by investment",
                  ],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}#website`,
                  url: SITE_URL,
                  name: "PropGroup",
                  description: DEFAULT_DESCRIPTION,
                  publisher: { "@id": `${SITE_URL}#organization` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: `${SITE_URL}/properties?q={search_term_string}`,
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="font-plus-jakarta antialiased min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
        <AuthProvider>
          <ComparatorProvider>
            <ConditionalNavbar />
            <div className="flex-1">
              {children}
            </div>
            <ConditionalFooter />
            <ConditionalScrollToTop />
            <ConditionalAIAssistantFab />
            <ComparatorBar />
            <Toaster />
          </ComparatorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
