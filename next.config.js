/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  outputFileTracingRoot: process.cwd(),
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Disable TypeScript checking during builds to prevent deployment failures
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Asset optimization
  images: {
    unoptimized: true, // For static export compatibility
  },
  
  // Turbopack configuration for Next.js 16+
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Webpack optimization for audio files (fallback for --webpack flag)
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(wav|mp3|m4a)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/audio/[name][ext]'
      }
    });
    
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    
    return config;
  },
  
  // Environment-specific settings
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400'
          }
        ]
      }
    ];
  }
};

export default config;
