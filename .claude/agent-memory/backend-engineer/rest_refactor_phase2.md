---
name: rest-refactor-phase2
description: Status of the invoices Server Actions -> REST migration, updated after an independent audit of the finished three-phase hand-off
metadata:
  type: project
---

The invoicing app (`E:\ClaudeCode\demo-claudecode`) was migrated from Server
Actions to a layered REST API: routes → services → repositories, in a
three-phase hand-off between agents (database-engineer → backend-engineer →
frontend-engineer). As of 2026-08-20 all three phases are done:

1. `lib/repositories/invoice-repository.ts` + `settings-repository.ts` exist.
2. `lib/services/invoice-service.ts` + `lib/services/errors.ts` and the REST
   routes under `app/api/invoices/**` exist.
3. `app/invoices/actions.ts` is deleted. The client components
   (`components/delete-invoice-button.tsx`,
   `components/invoice-status-control.tsx`, `components/invoice-form.tsx`,
   `app/invoices/new/page.tsx`, `app/invoices/[id]/edit/page.tsx`) now call
   `lib/api/invoice-client.ts`, which `fetch`es the REST routes directly.

**A follow-up backend-engineer audit (2026-08-20) found and fixed, within its
own layer:**
- `GET /api/invoices` and `GET /api/invoices/[id]` were importing
  `listInvoices`/`getInvoice` straight from `lib/repositories/invoice-repository.ts`,
  bypassing the service. Fixed by adding thin passthrough
  `getInvoice`/`listInvoices` in `lib/services/invoice-service.ts` and
  pointing the routes at those instead. No contract change (same DTOs).
- The three POST routes (`app/api/invoices/route.ts`,
  `app/api/invoices/[id]/route.ts`, `app/api/invoices/[id]/status/route.ts`)
  called `request.formData()` *outside* their `try/catch`, so a body with the
  wrong `Content-Type` threw an unhandled `TypeError` that surfaced as an
  unshaped 500. Fixed by wrapping the `formData()` call in its own
  try/catch → shaped 400. See [[nextjs-formdata-try-catch]].

**Found but NOT fixed (reported for approval, out of the audit's
no-status-code-changes mandate):** `POST /api/invoices/[id]` (update) returns
400 for a not-found invoice, while `GET`/`DELETE` on the same resource return
404 for the identical condition. This was a deliberate, tested choice from
the original phase-2 build (see the "responde 400 si la factura ya no
existe" test in `tests/invoice-routes.test.ts`), not a slip — but it's a real
REST-semantics inconsistency. `lib/api/invoice-client.ts` only checks
`response.ok`, so today's frontend doesn't care either way; changing it to
404 would be safe frontend-wise but is still a status-code contract change
that needs a human decision, not an agent's.

**Also found, out of scope for backend-engineer:**
`app/settings/actions.ts` still calls `prisma.settings.upsert` directly
instead of going through a repository. `database-engineer` already added
`upsertSettings()` to `lib/repositories/settings-repository.ts` with a
comment flagging this, but hasn't wired `actions.ts` to use it — that's
frontend/settings territory, not `app/api/invoices/**`.

**How to apply:** treat this migration as closed unless new work surfaces.
The two open items (400/404 inconsistency, settings.ts boundary) are
someone-else's-call items, not TODOs for backend-engineer to silently pick up.
