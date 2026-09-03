import "server-only";
import { cookies } from "next/headers";
import type {
  InvoiceDTO,
  InvoicePage,
  SettingsDTO,
  UserDTO,
} from "@facturas/shared/dto";

/**
 * Lecturas de las páginas (Server Component) hacia el backend, ahora que ya
 * no comparten proceso: antes estas funciones llamaban al repositorio
 * directamente; ahora cruzan la red igual que ya cruzaban las mutaciones.
 *
 * `backendFetch` reenvía la cookie de sesión de la petición entrante: un
 * `fetch` de servidor a servidor no lleva "las cookies del navegador" por su
 * cuenta, así que hay que leerlas explícitamente (`cookies()`) y adjuntarlas
 * a la petición saliente. Esto funciona porque backend y frontend comparten
 * dominio raíz en producción — la cookie de sesión ya lleva
 * `Domain=.tudominio.com` (ver `lib/security/auth-cookie.ts` del backend).
 * `proxy.ts` de este frontend ya comprobó que la cookie es válida antes de
 * llegar aquí; esta llamada solo pide los datos.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function backendFetch(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${BACKEND_URL}${path}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
}

async function backendJson<T>(path: string): Promise<T> {
  const response = await backendFetch(path);
  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status} en ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function getSettings(): Promise<SettingsDTO> {
  return backendJson<SettingsDTO>("/api/settings");
}

export type InvoiceListFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minTotal?: string;
  maxTotal?: string;
  statuses?: string[];
};

export async function listInvoices(page: number, filters: InvoiceListFilters = {}): Promise<InvoicePage> {
  const query = new URLSearchParams({ page: String(page) });
  if (filters.search) query.set("q", filters.search);
  if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) query.set("dateTo", filters.dateTo);
  if (filters.minTotal) query.set("minTotal", filters.minTotal);
  if (filters.maxTotal) query.set("maxTotal", filters.maxTotal);
  for (const status of filters.statuses ?? []) query.append("status", status);
  return backendJson<InvoicePage>(`/api/invoices?${query}`);
}

export async function getInvoice(id: string): Promise<InvoiceDTO | null> {
  const response = await backendFetch(`/api/invoices/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status} en /api/invoices/${id}`);
  }
  return response.json() as Promise<InvoiceDTO>;
}

export async function nextInvoiceNumber(series: string, year: number): Promise<number> {
  const query = new URLSearchParams({ series, year: String(year) });
  const { number } = await backendJson<{ number: number }>(`/api/invoices/next-number?${query}`);
  return number;
}

export async function listUsers(): Promise<UserDTO[]> {
  return backendJson<UserDTO[]>("/api/users");
}
