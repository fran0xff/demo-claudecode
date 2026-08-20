---
name: nextjs-formdata-try-catch
description: request.formData() must be wrapped in its own try/catch in Next.js route handlers in this repo, separate from the business-logic try/catch
metadata:
  type: feedback
---

In `app/api/**/route.ts` POST handlers, `await request.formData()` throws a
raw `TypeError` when the request's `Content-Type` isn't
`multipart/form-data` or `application/x-www-form-urlencoded` (e.g. a JSON
body, or no body at all). If that call sits before/outside the route's
try/catch — which is the natural place to put it, since you need the parsed
`FormData` before you can call the service — the exception escapes as an
unshaped 500 (Next.js's default error page, leaking a stack trace in dev)
instead of the safe generic response the route is designed to return.

**Why**: found during an independent audit of `app/api/invoices/**`
(2026-08-20) by testing with `curl -H "Content-Type: application/json"`
against a real dev server, not just by reading the code — all three POST
routes (`route.ts`, `[id]/route.ts`, `[id]/status/route.ts`) had this bug.
Confirmed via the dev server log (`TypeError: Content-Type was not one of
"multipart/form-data" or "application/x-www-form-urlencoded"`).

**How to apply**: give `formData()` parsing its own try/catch that returns a
400 with the route's normal error shape, separate from the try/catch around
the service call:

```ts
let formData: FormData;
try {
  formData = await request.formData();
} catch {
  return Response.json({ message: "Cuerpo de la petición no válido." }, { status: 400 });
}

try {
  // service call
} catch (error) {
  // typed-error mapping
}
```

Check for this pattern in any new or existing `POST`/`PUT`/`PATCH` route
handler that reads `request.formData()` in this codebase.
