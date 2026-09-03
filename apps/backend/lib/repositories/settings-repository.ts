import "server-only";
import type { SettingsDTO } from "@facturas/shared/dto";
import { prisma } from "@/lib/db";
import { num } from "@/lib/repositories/decimal";

/**
 * Acceso a datos de los ajustes del emisor.
 *
 * Fila única (id = 1). Igual que en el resto de repositorios, aquí es donde
 * los `Decimal` de Prisma se convierten a `number` plano.
 */

export type { SettingsDTO };

/** Ajustes usados cuando aún no se ha configurado el emisor. */
export const DEFAULT_SETTINGS: SettingsDTO = {
  issuerName: "",
  issuerTaxId: "",
  issuerAddress: "",
  defaultSeries: "A",
  defaultVatRate: 21,
};

export async function getSettings(): Promise<SettingsDTO> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_SETTINGS;

  return {
    issuerName: settings.issuerName,
    issuerTaxId: settings.issuerTaxId,
    issuerAddress: settings.issuerAddress,
    defaultSeries: settings.defaultSeries,
    defaultVatRate: num(settings.defaultVatRate),
  };
}

/** Crea o reemplaza la fila única de ajustes (id = 1). */
export async function upsertSettings(data: SettingsDTO): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}
