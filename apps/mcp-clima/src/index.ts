#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { obtenerClimaCiudad } from "./clima-service.js";
import { recomendarVestimenta } from "./vestimenta-service.js";

/**
 * Servidor MCP standalone (proceso Node aparte, sin Next.js) que expone dos
 * herramientas de tiempo/clima por ciudad. Usa Open-Meteo, que no requiere
 * API key, por lo que no hace falta ninguna variable de entorno para
 * levantarlo.
 */

const server = new McpServer({ name: "mcp-clima", version: "0.1.0" });

server.registerTool(
  "obtener_clima",
  {
    title: "Obtener hora y clima de una ciudad",
    description:
      "Devuelve la hora local y el clima actual (temperatura, sensación térmica, humedad, viento y condición) de una ciudad.",
    inputSchema: {
      ciudad: z.string().min(1).describe("Nombre de la ciudad, por ejemplo 'Madrid' o 'Buenos Aires'"),
    },
  },
  async ({ ciudad }) => {
    try {
      const clima = await obtenerClimaCiudad(ciudad);
      return {
        content: [{ type: "text", text: JSON.stringify(clima, null, 2) }],
        structuredContent: clima,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido al consultar el clima.";
      return { content: [{ type: "text", text: mensaje }], isError: true };
    }
  },
);

server.registerTool(
  "recomendar_vestimenta",
  {
    title: "Recomendar vestimenta según el clima",
    description:
      "Consulta el clima actual de una ciudad y recomienda qué ropa llevar según la sensación térmica, la lluvia, la nieve y el viento.",
    inputSchema: {
      ciudad: z.string().min(1).describe("Nombre de la ciudad, por ejemplo 'Madrid' o 'Buenos Aires'"),
    },
  },
  async ({ ciudad }) => {
    try {
      const clima = await obtenerClimaCiudad(ciudad);
      const recomendacion = recomendarVestimenta(clima);
      return {
        content: [{ type: "text", text: recomendacion.resumen }],
        structuredContent: { clima, ...recomendacion },
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido al recomendar vestimenta.";
      return { content: [{ type: "text", text: mensaje }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
