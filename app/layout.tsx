import type { Metadata } from "next";
import Link from "next/link";
import { NavToggle } from "@/components/nav-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_INIT_SCRIPT } from "@/lib/nav";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturas",
  description: "Emisión de facturas con desglose de IVA e IRPF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // `suppressHydrationWarning`: los scripts del <head> escriben `data-theme` y
  // `data-nav` antes de que React hidrate, así que el <html> del servidor y el
  // del cliente difieren a propósito.
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: `${THEME_INIT_SCRIPT};${NAV_INIT_SCRIPT}` }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        {/* La cabecera no es una superficie: es una franja del propio papel con
            un filete. Lo único blanco de la pantalla son los documentos. */}
        <header id="menu-principal" className="app-header border-b border-[var(--border)]">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link
              href="/invoices"
              className="text-base font-semibold tracking-tight hover:text-[var(--accent)]"
            >
              Facturas
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm text-[var(--muted)]">
              <Link href="/invoices" className="transition hover:text-[var(--foreground)]">
                Listado
              </Link>
              <Link href="/settings" className="transition hover:text-[var(--foreground)]">
                Ajustes
              </Link>
              <ThemeToggle />
              <NavToggle variant="inline" />
            </div>
          </nav>
        </header>

        {/* Vive fuera del <header> porque tiene que sobrevivir a que este se
            oculte; el CSS solo lo muestra en ese caso. */}
        <NavToggle variant="floating" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
