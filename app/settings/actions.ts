"use server";

import { revalidatePath } from "next/cache";
import { upsertSettings } from "@/lib/repositories/settings-repository";
import { fieldErrors, settingsSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

export async function saveSettings(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  await upsertSettings(parsed.data);

  revalidatePath("/settings");
  revalidatePath("/invoices");

  return { errors: {}, message: "Ajustes guardados." };
}
