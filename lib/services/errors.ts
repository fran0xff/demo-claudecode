/**
 * Errores tipados de la capa de servicio.
 *
 * El servicio no sabe qué es un status HTTP; solo nombra qué salió mal. Son
 * las rutas (`app/api/**\/route.ts`) las que traducen cada clase a un código
 * de respuesta concreto.
 */

/** La factura (u otro recurso) pedida no existe. */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "No encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Los datos del emisor no están configurados en Ajustes: no se puede facturar. */
export class SettingsNotConfiguredError extends Error {
  readonly code = "SETTINGS_NOT_CONFIGURED";

  constructor(message = "Configura primero los datos del emisor en Ajustes.") {
    super(message);
    this.name = "SettingsNotConfiguredError";
  }
}

/**
 * El `FormData` recibido no pasa `invoiceSchema`. Lleva los errores por campo
 * con la misma forma que espera el formulario (`fieldErrors` de
 * `lib/validation.ts`), para que la ruta los reenvíe tal cual.
 */
export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(readonly errors: Record<string, string>) {
    super("Error de validación");
    this.name = "ValidationError";
  }
}

/**
 * Tras varios intentos, seguimos chocando con la restricción única del
 * correlativo. No debería pasar salvo bajo concurrencia sostenida.
 */
export class InvoiceNumberConflictError extends Error {
  readonly code = "INVOICE_NUMBER_CONFLICT";

  constructor(message = "No se pudo asignar el correlativo tras varios intentos.") {
    super(message);
    this.name = "InvoiceNumberConflictError";
  }
}

/**
 * Email o contraseña incorrectos al iniciar sesión. Mismo mensaje tanto si el
 * email no existe como si la contraseña es la que no coincide, para no dar
 * pistas de qué email sí tiene cuenta (enumeración de usuarios).
 */
export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor(message = "Email o contraseña incorrectos.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}
