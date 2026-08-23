import "server-only";
import { getSettings as getSettingsRow, upsertSettings } from "@/lib/repositories/settings-repository";
import type { SettingsDTO } from "@/lib/repositories/settings-repository";
import { fieldErrors, settingsSchema } from "@/lib/validation";
import { ValidationError } from "@/lib/services/errors";

/**
 * Lógica de ajustes, separada de la ruta igual que `invoice-service.ts`. No
 * conoce `Request`/`Response`.
 */

export async function getSettings(): Promise<SettingsDTO> {
  return getSettingsRow();
}

export async function saveSettings(formData: FormData): Promise<SettingsDTO> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  await upsertSettings(parsed.data);
  return parsed.data;
}
