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
    const isDev = process.env.NODE_ENV !== "production";

    // In dev, chunk URLs are stable (no content hash) so `immutable` causes
    // stale code to stick around for the entire 1y cache life. Always revalidate
    // dev assets so HMR / restarts actually pick up new builds.
    //
    // In prod, JS/CSS still need to be revalidated per the workspace
    // static-asset-cache-busting standard — only hashed media files are truly
    // immutable. Next.js content-hashes JS chunks in production so a 7-day
    // must-revalidate window is safe and matches the standard.
    const jsCssCacheControl = isDev
      ? "no-store, must-revalidate"
      : "public, max-age=604800, must-revalidate";

    const mediaCacheControl = isDev
      ? "no-store, must-revalidate"
      : "public, max-age=31536000, immutable";

    return [
      {
        source: "/_next/static/:path*.(js|css|map)",
        headers: [{ key: "Cache-Control", value: jsCssCacheControl }],
      },
      {
        source:
          "/_next/static/:path*.(png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)",
        headers: [{ key: "Cache-Control", value: mediaCacheControl }],
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
