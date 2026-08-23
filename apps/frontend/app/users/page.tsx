import { ChangePasswordForm } from "@/components/change-password-form";
import { CreateUserForm } from "@/components/create-user-form";
import { DeleteUserButton } from "@/components/delete-user-button";
import { Flash } from "@/components/flash";
import { formatDate } from "@/lib/format";
import { listUsers } from "@/lib/repositories/user-repository";

export const metadata = { title: "Usuarios" };

// El listado sale de la base de datos: se rehace en cada petición en vez de
// quedarse congelado en el build.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="space-y-8">
      <Flash />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Quién puede iniciar sesión en la app y con qué contraseña.
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="eyebrow">Nuevo usuario</h2>
        <CreateUserForm />
      </section>

      {users.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-base font-medium">Todavía no hay usuarios.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="ledger ledger-rows min-w-[52rem] text-sm">
            <thead>
              <tr>
                <th>Email</th>
                <th>Alta</th>
                <th className="num">Contraseña</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td className="tabular text-[var(--muted)]">{formatDate(user.createdAt)}</td>
                  <td className="num">
                    <ChangePasswordForm userId={user.id} />
                  </td>
                  <td className="num">
                    <DeleteUserButton userId={user.id} confirmLabel={`el usuario ${user.email}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
