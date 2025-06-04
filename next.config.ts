import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds if environment variable is set
  eslint: {
    ignoreDuringBuilds: process.env.DISABLE_ESLINT_PLUGIN === 'true' || process.env.NODE_ENV === 'production',
  },
  
  // Disable TypeScript checks during builds for faster production builds
  typescript: {
    ignoreBuildErrors: process.env.DISABLE_TYPE_CHECK === 'true' || process.env.NODE_ENV === 'production',
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.b-cdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.bunnycdn.com',
      },
      {
        protocol: 'https',
        hostname: 'vz-*.b-cdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      }
    ]
  },
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
  webpack: (config, { isServer, dev }) => {
    // Ignore Node.js modules when bundling for the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
      };
    }

    // In production, completely ignore FFmpeg related files
    if (!dev) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('fluent-ffmpeg');
        config.externals.push('@ffmpeg-installer/ffmpeg');
      }

      // Ignore the FFmpeg wrapper file in production
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/videoService.ffmpeg': false,
        './videoService.ffmpeg': false
      };
    }

    // Ignore ffmpeg warnings
    config.ignoreWarnings = [
      { module: /@ffmpeg-installer/ },
      { module: /fluent-ffmpeg/ },
      { file: /videoService\.ffmpeg/ },
      /Critical dependency/,
      /Module not found.*videoService\.ffmpeg/,
      /Cannot resolve.*fluent-ffmpeg/,
      /Cannot resolve.*@ffmpeg-installer/
    ];

    // More aggressive exclusion of problematic directories
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/C:/**',
        '**/Users/**',
        '**/Application Data/**',
        '**/AppData/**',
        '**/Cookies/**',
        '**/Windows/**',
        '**/System32/**',
        '**/Program Files/**',
        '**/Program Files (x86)/**',
        '**/*.log',
        '**/*.tmp',
        '**/*.temp'
      ]
    };

    // Override default resolve modules to avoid scanning system directories
    config.resolve.modules = ['node_modules'];
    
    // Disable symlinks to avoid scanning external directories
    config.resolve.symlinks = false;

    return config;
  }
};

export default nextConfig;
