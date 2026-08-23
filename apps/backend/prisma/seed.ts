import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/db";
import { computeInvoiceTotals } from "../lib/invoice-math";

/**
 * Datos de arranque: los ajustes del emisor y veinte facturas de ejemplo para
 * no empezar con la pantalla vacía. Es idempotente: se puede ejecutar varias
 * veces.
 *
 * Las facturas de ejemplo viven en `seed-data/invoices.json` en vez de aquí
 * hardcodeadas: son datos, no lógica, y así se pueden ampliar sin tocar este
 * fichero. Las fechas llegan como string ISO (JSON no tiene tipo `Date`) y se
 * convierten al leer.
 */

const SETTINGS = {
  issuerName: "Estudio Arévalo S.L.",
  issuerTaxId: "B12345674",
  issuerAddress: "Calle Mayor 12, 3º B\n28013 Madrid",
  defaultSeries: "A",
  defaultVatRate: 21,
};

type SampleInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPct: number;
};

type RawSampleInvoice = {
  number: number;
  issueDate: string;
  dueDate: string | null;
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientEmail: string | null;
  irpfRate: number;
  notes: string | null;
  lines: SampleInvoiceLine[];
};

type SampleInvoice = Omit<RawSampleInvoice, "issueDate" | "dueDate"> & {
  issueDate: Date;
  dueDate: Date | null;
};

function loadSampleInvoices(): SampleInvoice[] {
  const path = join(__dirname, "seed-data", "invoices.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as RawSampleInvoice[];

  return raw.map((invoice) => ({
    ...invoice,
    issueDate: new Date(invoice.issueDate),
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
  }));
}

const SAMPLE_INVOICES = loadSampleInvoices();

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: SETTINGS,
    create: { id: 1, ...SETTINGS },
  });

  for (const sample of SAMPLE_INVOICES) {
    const year = sample.issueDate.getFullYear();
    const existing = await prisma.invoice.findUnique({
      where: {
        series_year_number: { series: SETTINGS.defaultSeries, year, number: sample.number },
      },
    });
    if (existing) continue;

    const totals = computeInvoiceTotals(sample.lines, sample.irpfRate);

    await prisma.invoice.create({
      data: {
        series: SETTINGS.defaultSeries,
        number: sample.number,
        year,
        // Los ejemplos vienen ya emitidos: tienen número.
        status: "EMITIDA",
        issueDate: sample.issueDate,
        dueDate: sample.dueDate,
        issuerName: SETTINGS.issuerName,
        issuerTaxId: SETTINGS.issuerTaxId,
        issuerAddress: SETTINGS.issuerAddress,
        clientName: sample.clientName,
        clientTaxId: sample.clientTaxId,
        clientAddress: sample.clientAddress,
        clientEmail: sample.clientEmail,
        irpfRate: sample.irpfRate,
        notes: sample.notes,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        irpfTotal: totals.irpfTotal,
        total: totals.total,
        lines: {
          create: sample.lines.map((line, index) => ({
            position: index,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            discountPct: line.discountPct,
            lineTotal: totals.lineTotals[index],
          })),
        },
      },
    });
  }

  const count = await prisma.invoice.count();
  console.log(`Seed completado. Facturas en la base de datos: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
