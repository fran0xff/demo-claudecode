import { Fragment } from "react";
import { invoiceNumberParts } from "@/lib/invoice-math";

type Props = {
  series: string;
  year: number;
  number: number;
  className?: string;
};

/**
 * El número de factura, compuesto como el serial que es.
 *
 * Un correlativo no puede tener huecos y no cambia una vez emitida la factura:
 * es lo que identifica el documento. Aquí se atenúan los guiones para que el
 * ojo separe serie, año y correlativo, pero la cadena sigue siendo la canónica
 * —"A-2026-0001"— tanto al copiarla como al leerla un lector de pantalla.
 */
export function InvoiceNumber({ series, year, number, className = "" }: Props) {
  const parts = invoiceNumberParts(series, year, number);

  return (
    <span className={`serial ${className}`}>
      {parts.map((part, index) => (
        <Fragment key={part + index}>
          {index > 0 && <span className="serial-sep">-</span>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
