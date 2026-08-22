import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `better-sqlite3` es un módulo nativo: el bundler no puede empaquetarlo y
  // tiene que cargarlo en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
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
