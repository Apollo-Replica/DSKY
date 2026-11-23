import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export (out/): server.ts serves it, so the app runs on a plain
  // Node runtime without Next (the Windows installer ships only node.exe).
  output: 'export',
  images: { unoptimized: true },
  reactCompiler: true,
  reactStrictMode: false, // Disable to prevent double WebSocket connections in dev
};

export default nextConfig;
