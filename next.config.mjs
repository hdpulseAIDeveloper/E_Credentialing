/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tanstack/react-query",
    ],
  },
  async headers() {
    return [
      {
        // Long-lived caching for immutable hashed assets produced by Next.js.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // HTML and API responses must not be cached by intermediaries.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
