import type { NextConfig } from "next";
const origin = new URL(process.env.API_ORIGIN ?? "http://127.0.0.1:8000");
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("API_ORIGIN must be a plain HTTP(S) origin.");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/assets/avatars/:path*",
        destination: `${origin.origin}/assets/avatars/:path*`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${origin.origin}/api/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
