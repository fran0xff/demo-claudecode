---
name: rest-refactor-phase2
description: Status of the invoices Server Actions -> REST migration after the backend-engineer phase (services + routes)
metadata:
  type: project
---

The invoicing app (`E:\ClaudeCode\demo-claudecode`) is being migrated from
Server Actions to a layered REST API: routes → services → repositories. It's
a three-phase hand-off between agents:

1. `database-engineer` built `lib/repositories/invoice-repository.ts` and
   `lib/repositories/settings-repository.ts` (done, prior phase).
2. `backend-engineer` (this phase, done) built `lib/services/invoice-service.ts`
   + `lib/services/errors.ts`, and the REST routes under `app/api/invoices/**`
   (`GET,POST /api/invoices`, `GET,POST,DELETE /api/invoices/[id]`,
   `POST /api/invoices/[id]/issue`, `POST /api/invoices/[id]/status`).
3. `frontend-engineer` (next phase, not started) needs to switch the client
   components that still call the old Server Actions
   (`components/delete-invoice-button.tsx`, `components/invoice-status-control.tsx`,
   `app/invoices/new/page.tsx` `action={createInvoice}`,
   `app/invoices/[id]/edit/page.tsx` `action={updateInvoice.bind(...)}`) to
   `fetch` against the new routes instead.

**Why `app/invoices/actions.ts` still exists**: it could not be deleted yet
because those four client usages still import from it, and deleting it would
break the build. Decision made: instead of leaving the old business logic in
place, `actions.ts` was rewritten to be a thin translator — it now calls
`lib/services/invoice-service.ts` for all business logic and only adds the
Server Action glue (`FormState` shape, `redirect`, `revalidatePath`). No
business logic duplication between `actions.ts` and the service. It's
intended to be deleted entirely once `frontend-engineer` finishes migrating
those four call sites to `fetch`.

**How to apply**: when picking up the `frontend-engineer` phase, check
whether `app/invoices/actions.ts` still exists before assuming it's gone —
its presence/absence is the signal for whether phase 3 is done. Once no
component imports from `@/app/invoices/actions` anymore, delete the file.

See also [[invoice-service-shape]] for the service's exact function
signatures.
