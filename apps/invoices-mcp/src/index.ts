#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPool } from "./db.js";
import { getInvoiceSummary, findInvoicesByClientName, getSummaryTotals } from "./invoice-repository.js";

/**
 * Servidor MCP standalone (proceso Node aparte, sin Next.js) que expone
 * consultas de solo lectura sobre las facturas guardadas en Postgres
 * (Supabase), conectando directamente vía DATABASE_URL (sin Prisma, sin el
 * MCP oficial de Supabase).
 */

const server = new McpServer({ name: "invoices-mcp", version: "0.1.0" });

server.registerTool(
  "get_invoice_summary",
  {
    title: "Resumen de una factura",
    description:
      "Dado el id de una factura, devuelve el nombre del cliente, sus líneas " +
      "(descripción, cantidad, precio unitario y subtotal por línea) y el total de la factura.",
    inputSchema: {
      invoice_id: z.string().min(1).describe("Id de la factura (campo Invoice.id)"),
    },
  },
  async ({ invoice_id }) => {
    try {
      const resumen = await getInvoiceSummary(getPool(), invoice_id);
      if (!resumen) {
        return {
          content: [{ type: "text", text: `No se encontró ninguna factura con id "${invoice_id}".` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(resumen, null, 2) }],
        structuredContent: resumen,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido al consultar la factura.";
      return { content: [{ type: "text", text: mensaje }], isError: true };
    }
  },
);

server.registerTool(
  "get_client_invoice",
  {
    title: "Facturas de un cliente",
    description:
      "Busca facturas por nombre de cliente (coincidencia parcial, sin distinguir mayúsculas/minúsculas) " +
      "y devuelve el JSON completo de cada factura encontrada, incluidas sus líneas.",
    inputSchema: {
      client_name: z.string().min(1).describe("Nombre (o parte del nombre) del cliente a buscar"),
    },
  },
  async ({ client_name }) => {
    try {
      const facturas = await findInvoicesByClientName(getPool(), client_name);
      if (facturas.length === 0) {
        return {
          content: [
            { type: "text", text: `No se encontraron facturas para un cliente que contenga "${client_name}".` },
          ],
          structuredContent: { invoices: [] },
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(facturas, null, 2) }],
        structuredContent: { invoices: facturas },
      };
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error desconocido al buscar facturas del cliente.";
      return { content: [{ type: "text", text: mensaje }], isError: true };
    }
  },
);

server.registerTool(
  "get_summary_totals",
  {
    title: "Totales de facturación",
    description: "Devuelve el total emitido, el total ya cobrado y el total pendiente de cobro.",
    inputSchema: {},
  },
  async () => {
    try {
      const totales = await getSummaryTotals(getPool());
      return {
        content: [{ type: "text", text: JSON.stringify(totales, null, 2) }],
        structuredContent: totales,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido al calcular los totales.";
      return { content: [{ type: "text", text: mensaje }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
