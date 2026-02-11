import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable in dev for faster startup
  // Use webpack for production builds (Turbopack is only for dev in Next.js 16)
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Use memory cache instead of filesystem to avoid allocation errors
      // but still get some caching benefits
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      config.cache = {
        type: "memory",
        maxGenerations: 1
      };
      // Reduce memory pressure
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false
      };
    }
    return config;
  },
  // Add empty turbopack config to silence the warning in production builds
  turbopack: {}
};

export default nextConfig;
