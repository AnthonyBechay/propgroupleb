import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'propgroup-assets.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'api.bechays.com',
      }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Tree-shake icon/UI packages even behind grouped imports
    // `import { A, B, C } from 'lucide-react'`. Cuts ~30-50KB first-load JS
    // on heavy icon users (property cards, admin tables).
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  // Enable strict mode for better debugging
  reactStrictMode: true,
  // Transpile packages for better compatibility
  transpilePackages: ['@propgroup/config', '@propgroup/db', '@propgroup/supabase', '@propgroup/ui'],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Don't hardcode environment variables - let them be resolved at runtime
};

export default nextConfig;
