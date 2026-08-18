-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series" TEXT NOT NULL DEFAULT 'A',
    "number" INTEGER,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "issuerName" TEXT NOT NULL,
    "issuerTaxId" TEXT NOT NULL,
    "issuerAddress" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientTaxId" TEXT NOT NULL,
    "clientAddress" TEXT NOT NULL,
    "clientEmail" TEXT,
    "irpfRate" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "subtotal" DECIMAL NOT NULL,
    "taxTotal" DECIMAL NOT NULL,
    "irpfTotal" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- Las facturas que ya existían tienen número, así que están emitidas: el valor
-- por defecto de la columna ('BORRADOR') solo vale para las nuevas.
INSERT INTO "new_Invoice" ("clientAddress", "clientEmail", "clientName", "clientTaxId", "createdAt", "currency", "dueDate", "id", "irpfRate", "irpfTotal", "issueDate", "issuerAddress", "issuerName", "issuerTaxId", "notes", "number", "series", "status", "subtotal", "taxTotal", "total", "updatedAt", "year") SELECT "clientAddress", "clientEmail", "clientName", "clientTaxId", "createdAt", "currency", "dueDate", "id", "irpfRate", "irpfTotal", "issueDate", "issuerAddress", "issuerName", "issuerTaxId", "notes", "number", "series", 'EMITIDA', "subtotal", "taxTotal", "total", "updatedAt", "year" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_year_series_number_idx" ON "Invoice"("year", "series", "number");
CREATE UNIQUE INDEX "Invoice_series_year_number_key" ON "Invoice"("series", "year", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
