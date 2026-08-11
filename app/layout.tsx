import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturas",
  description: "Emisión de facturas con desglose de IVA e IRPF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/invoices" className="text-base font-semibold">
              Facturas
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm text-[var(--muted)]">
              <Link href="/invoices" className="transition hover:text-[var(--foreground)]">
                Listado
              </Link>
              <Link href="/settings" className="transition hover:text-[var(--foreground)]">
                Ajustes
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
