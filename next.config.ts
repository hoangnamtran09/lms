import type { NextConfig } from "next";

const API_URL = process.env.API_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${API_URL}/api/:path*`,
    },
  ],
};

export default nextConfig;
