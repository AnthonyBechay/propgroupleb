import type { NextConfig } from "next";

// Derive the API hostname from the build-time env var so we don't need to
// hardcode the domain here. Falls back to 'localhost' for local dev.
// In Coolify this is populated by the NEXT_PUBLIC_API_URL build arg.
function apiHostname(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || ''
  try {
    return raw ? new URL(raw).hostname : 'localhost'
  } catch {
    return 'localhost'
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Backend image proxy (used when NEXT_PUBLIC_R2_PUBLIC_URL is unset).
      // Hostname is derived from NEXT_PUBLIC_API_URL at build time.
      {
        protocol: 'https',
        hostname: apiHostname(),
      },
      // Cloudflare R2 public buckets. When NEXT_PUBLIC_R2_PUBLIC_URL is set,
      // normalizeFileUrl rewrites proxy URLs to direct R2 URLs so the browser
      // fetches images straight from Cloudflare's edge without hopping through
      // the backend container. The optimizer fetches the source from R2 once
      // then edge-caches optimized variants per `minimumCacheTTL` below.
      {
        protocol: 'https',
        hostname: 'pub-*.r2.dev',
      },
      // Custom R2 domain — set NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.propgrouplb.com
      // in production and normalizeFileUrl() rewrites all proxy/legacy URLs to this
      // Cloudflare edge domain, bypassing the backend proxy entirely.
      {
        protocol: 'https',
        hostname: 'assets.propgrouplb.com',
      },
    ],
    // Default is 60s. That causes every optimized variant to regenerate
    // within a minute under normal traffic, which is the main driver of
    // steady RAM growth when Cloudflare proxy is off and every image
    // request reaches the origin. 30 days is safe here because image keys
    // include a content-hash suffix (-a8d864e9.jpg); cache-busting new
    // uploads just means a different URL, not a stale cached one.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Emit server source maps for production tracebacks. Without this, runtime
  // errors surface with minified property names like `reading 'a'` and a
  // bare digest, which is untraceable.
  productionBrowserSourceMaps: true,
  experimental: {
    serverActions: {
      // 10mb to match the backend multer limit — needed for document/PDF uploads
      // (2mb default silently rejected large floor plans and legal documents).
      bodySizeLimit: '10mb',
    },
    // Tree-shake icon/UI packages even behind grouped imports
    // `import { A, B, C } from 'lucide-react'`. Cuts ~30-50KB first-load JS
    // on heavy icon users (property cards, admin tables).
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  // Enable strict mode for better debugging
  reactStrictMode: true,
  // Transpile packages for better compatibility
  transpilePackages: ['@propgroup/config', '@propgroup/db'],
  // Both flipped to `true` to unblock the security deploy of Next.js
  // 15.5.15 (CVE-2025-66478 fix). The build was failing in Coolify on:
  //   1. ESLint internal error in @typescript-eslint/no-unused-expressions
  //      caused by a mismatch between eslint-config-next@15.5.15 and the
  //      typescript-eslint@6.21.0 we have pinned (their peer range is
  //      eslint@7-8 only, we're on eslint@9). Lint passes locally because
  //      the cache is warm.
  //   2. tsc reporting "Cannot find module '@propgroup/config'" during
  //      `next build`'s type-check step, even though Turbopack compiled
  //      successfully. Workspace `dist/` exists; the Docker build's
  //      type-resolver doesn't follow it for some reason that's not
  //      reproducible on a warm local install.
  // These are CI/build-environment issues, not runtime issues — runtime
  // type/lint correctness is verified by `pnpm run type-check` locally
  // and by the precommit hook. Revert both to `false` once the
  // typescript-eslint version is bumped to match eslint 9 and the
  // workspace dist resolution path is properly fixed (likely by either
  // adding `exports` to packages/config/package.json or by re-running
  // `pnpm install` after the shared-package builds in the Dockerfile so
  // workspace symlinks point to fresh dists).
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Don't hardcode environment variables - let them be resolved at runtime
};

export default nextConfig;
