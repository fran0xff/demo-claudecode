import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` hace requires dinámicos (p. ej. de `pg-native`, que ni siquiera está
  // instalado) que el bundler no sabe resolver en build: hay que cargarlo en
  // tiempo de ejecución en vez de empaquetarlo.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
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
