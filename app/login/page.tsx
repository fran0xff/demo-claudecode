import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Accede con tu email y contraseña.</p>
      </div>

      <LoginForm />
    </div>
  );
}
