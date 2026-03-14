import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.0.81:3000",
    "http://192.168.0.81",
    "192.168.0.81:3000",
    "192.168.0.81",
    "http://192.168.219.102:3000",
    "http://192.168.219.102",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
    ],
  },
};

export default nextConfig;
