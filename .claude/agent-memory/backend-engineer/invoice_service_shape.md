---
name: invoice-service-shape
description: Exact function signatures exposed by lib/services/invoice-service.ts, for callers that need to check before use rather than re-deriving
metadata:
  type: reference
---

`lib/services/invoice-service.ts` (framework-agnostic, throws typed errors
from `lib/services/errors.ts` on failure, never touches `Request`/`Response`/
`cookies()`):

- `getInvoice(id: string): Promise<InvoiceDTO | null>` — thin passthrough to
  the repository, added 2026-08-20 so `GET /api/invoices/[id]` doesn't import
  the repository directly.
- `listInvoices(): Promise<InvoiceSummary[]>` — same, for `GET /api/invoices`.
- `createInvoice(formData: FormData): Promise<{id: string}>` — throws
  `ValidationError` (has `.errors: Record<string,string>`) or
  `SettingsNotConfiguredError`.
- `issueInvoice(id: string): Promise<{issued: {series, year, number} | null}>`
  — `issued: null` is the normal no-op result for a non-draft/missing
  invoice, not an error. Throws `InvoiceNumberConflictError` after 3 failed
  retries on a unique-constraint collision.
- `setInvoiceStatus(id: string, status: string): Promise<{status, serial?} | null>`
  — `null` is the no-op result (invalid status string, missing invoice, or
  still a draft).
- `updateInvoice(id: string, formData: FormData): Promise<{id, serial?}>` —
  throws `ValidationError` or `NotFoundError`.
- `deleteInvoice(id: string): Promise<{hadNumber: boolean, serial?: string}>`
  — throws `NotFoundError` if the id doesn't exist.

Corresponding REST routes in `app/api/invoices/**` map these errors to HTTP
status (400 for `ValidationError`/`SettingsNotConfiguredError`/update's
`NotFoundError`, 404 for GET/DELETE not-found, 409 for
`InvoiceNumberConflictError`, 500 catch-all). **Known inconsistency**:
update's `NotFoundError` → 400 while GET/DELETE's not-found → 404 for the
same condition — deliberate/tested but flagged as needing a human call, see
[[rest-refactor-phase2]].

All three POST routes wrap `await request.formData()` in its own try/catch
(→ 400 on a malformed/wrong-Content-Type body) before the business-logic
try/catch — see [[nextjs-formdata-try-catch]].

Verify these signatures against the file before relying on them — last
checked 2026-08-20 during an independent audit.
