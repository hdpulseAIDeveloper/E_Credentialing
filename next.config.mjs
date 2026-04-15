/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: { typedRoutes: false },
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
