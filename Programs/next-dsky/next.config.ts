import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: false, // Disable to prevent double WebSocket connections in dev
};

export default nextConfig;
