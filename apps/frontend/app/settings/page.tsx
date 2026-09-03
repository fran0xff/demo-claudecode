import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/backend";

export const metadata = { title: "Ajustes" };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Datos del emisor y valores que se proponen al crear una factura.
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
