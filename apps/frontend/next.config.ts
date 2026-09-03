import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@facturas/shared` vive en el workspace como TypeScript sin compilar:
  // Next lo transpila él mismo en vez de exigir un paso de build aparte.
  transpilePackages: ["@facturas/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
