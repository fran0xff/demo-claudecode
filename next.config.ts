import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `better-sqlite3` es un módulo nativo: el bundler no puede empaquetarlo y
  // tiene que cargarlo en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
