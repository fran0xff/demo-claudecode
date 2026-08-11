import "dotenv/config";
import { prisma } from "../lib/db";
import { computeInvoiceTotals } from "../lib/invoice-math";

/**
 * Datos de arranque: los ajustes del emisor y dos facturas de ejemplo para no
 * empezar con la pantalla vacía. Es idempotente: se puede ejecutar varias veces.
 */

const SETTINGS = {
  issuerName: "Estudio Arévalo S.L.",
  issuerTaxId: "B12345674",
  issuerAddress: "Calle Mayor 12, 3º B\n28013 Madrid",
  defaultSeries: "A",
  defaultVatRate: 21,
};

const SAMPLE_INVOICES = [
  {
    number: 1,
    issueDate: new Date("2026-01-15T00:00:00"),
    dueDate: new Date("2026-02-14T00:00:00"),
    clientName: "Tecnologías Nova S.A.",
    clientTaxId: "A58818501",
    clientAddress: "Avenida Diagonal 400, 5ª\n08008 Barcelona",
    clientEmail: "facturacion@nova.example",
    irpfRate: 15,
    notes: "Pago por transferencia a ES12 3456 7890 1234 5678 9012.",
    lines: [
      { description: "Diseño de identidad corporativa", quantity: 1, unitPrice: 2400, vatRate: 21, discountPct: 0 },
      { description: "Sesión de consultoría (horas)", quantity: 12, unitPrice: 75, vatRate: 21, discountPct: 10 },
    ],
  },
  {
    number: 2,
    issueDate: new Date("2026-02-03T00:00:00"),
    dueDate: null,
    clientName: "Librería del Prado",
    clientTaxId: "12345678Z",
    clientAddress: "Plaza del Prado 3\n28014 Madrid",
    clientEmail: null,
    irpfRate: 0,
    notes: null,
    lines: [
      { description: "Maquetación de catálogo", quantity: 1, unitPrice: 950, vatRate: 21, discountPct: 0 },
      { description: "Impresión de catálogo (unidades)", quantity: 300, unitPrice: 3.2, vatRate: 4, discountPct: 0 },
    ],
  },
];

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
