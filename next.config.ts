import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for on-premise deployment (see Dockerfile).
  output: "standalone",
  // Parsed at runtime on the server; keep them out of the bundler.
  serverExternalPackages: ["mammoth", "unpdf"],
  experimental: {
    // proxy.ts buffers request bodies (default cap 10MB); uploads may be up to 25MB.
    proxyClientMaxBodySize: "26mb",
  },
};

export default nextConfig;
