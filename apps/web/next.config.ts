import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { optimizePackageImports: ["leaflet", "react-leaflet"] },
};

export default nextConfig;
