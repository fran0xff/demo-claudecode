/**
 * Estado que devuelven las Server Actions a `useActionState`.
 *
 * Vive fuera de los ficheros "use server" porque esos solo pueden exportar
 * funciones async.
 */
export type FormState = {
  /** Errores por campo, con la ruta del input como clave: "lines.0.quantity". */
  errors: Record<string, string>;
  /** Mensaje general del formulario, cuando el error no es de un campo. */
  message?: string;
};

export const EMPTY_FORM_STATE: FormState = { errors: {} };
