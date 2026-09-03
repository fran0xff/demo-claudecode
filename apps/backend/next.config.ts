import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `better-sqlite3` es un módulo nativo: el bundler no puede empaquetarlo y
  // tiene que cargarlo en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
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
