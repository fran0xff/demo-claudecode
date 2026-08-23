import type { ReactNode } from "react";

type Props = {
  /** Id del control que envuelve, para enlazar la etiqueta. */
  htmlFor: string;
  label: string;
  /** Texto secundario junto a la etiqueta, p. ej. "(opcional)". */
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Etiqueta, control y mensaje de error de un campo. Existe para que el error de
 * Zod se pinte siempre igual y en el mismo sitio, sin repetir el condicional en
 * cada uno de los campos del formulario.
 */
export function FormField({ htmlFor, label, hint, error, className, children }: Props) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {hint && <span className="font-normal"> {hint}</span>}
      </label>
      {children}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
