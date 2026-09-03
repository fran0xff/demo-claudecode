"use client";

import { useRef, useState } from "react";
import type { InvoiceLineDTO } from "@facturas/shared/dto";

/** Una línea del formulario. Todo son strings: es lo que teclea el usuario. */
export type LineState = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  discountPct: string;
};

function emptyLine(key: string, vatRate: number): LineState {
  return {
    key,
    description: "",
    quantity: "1",
    unitPrice: "",
    vatRate: String(vatRate),
    discountPct: "0",
  };
}

function fromInvoice(lines: InvoiceLineDTO[]): LineState[] {
  return lines.map((line, index) => ({
    key: `line-${index}`,
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    vatRate: String(line.vatRate),
    discountPct: String(line.discountPct),
  }));
}

/**
 * Estado de las líneas del formulario de factura.
 *
 * Vive aparte del componente porque es la única lógica con estado que este
 * tiene; lo demás es marcado. Ninguna operación muta: todas devuelven un array
 * nuevo.
 */
export function useInvoiceLines(
  existing: InvoiceLineDTO[] | undefined,
  defaultVatRate: number,
) {
  const [lines, setLines] = useState<LineState[]>(() =>
    existing ? fromInvoice(existing) : [emptyLine("line-0", defaultVatRate)],
  );

  // Contador para las claves de React de las líneas nuevas. Arranca detrás de
  // las que ya existen y solo se incrementa al añadir, nunca durante el render.
  const nextKey = useRef(lines.length);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      emptyLine(`line-${nextKey.current++}`, defaultVatRate),
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  return { lines, updateLine, addLine, removeLine };
}
