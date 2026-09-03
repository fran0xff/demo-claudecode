import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// Sin `eslint-config-next/core-web-vitals`: esta app no tiene JSX ni
// componentes, solo rutas API — esas reglas no aplican aquí.
const eslintConfig = defineConfig([
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
