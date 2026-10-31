import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() { return [
    { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Strict-Transport-Security", value: "max-age=15552000" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
    { source: "/auth/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
  ]; },
};
export default config;
