import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let userConfig = undefined
try {
  // try to import ESM first
  userConfig = await import('./v0-user-next.config.mjs')
} catch (e) {
  try {
    // fallback to CJS import
    userConfig = await import("./v0-user-next.config");
  } catch (innerError) {
    // ignore error
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Light throttle for DB-backed static routes (helps /brands, blog, marketing pages during build).
  experimental: {
    staticGenerationMaxConcurrency: 4,
    staticGenerationMinPagesPerWorker: 25,
    staticGenerationRetryCount: 3,
  },
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'scontent.cdninstagram.com' },
      { protocol: 'https', hostname: 'graph.instagram.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    // The 'net', 'http', and other Node.js modules are needed by googleapis
    // but are not available in the browser, so we need to provide empty equivalents
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      http: false,
      https: false,
      url: false,
      stream: false,
      zlib: false,
      fs: false,
      path: false,
      os: false,
      assert: false,
      tls: false,
      crypto: false
    };

    // Optimize TipTap/ProseMirror packages to prevent duplication in production
    // This prevents "Duplicate use of selection JSON ID gapcursor" errors
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Bundle all TipTap and ProseMirror packages together
            tiptap: {
              test: /[\\/]node_modules[\\/](@tiptap|prosemirror-|novel)[\\/]/,
              name: 'tiptap',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },
}

if (userConfig) {
  // ESM imports will have a "default" property
  const config = userConfig.default || userConfig

  for (const key in config) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...config[key],
      }
    } else {
      nextConfig[key] = config[key]
    }
  }
}

export default nextConfig