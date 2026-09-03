# Project Refactoring Audit

**Date:** 2026-09-03
**Scope:** `src/actions`, `src/components`, `src/lib`, `src/app`, `src/app/api`, `prisma`, `scripts`
**Method:** File-size sweep, outline reads of every file over ~250 lines, targeted greps for repeated
strings and repeated control-flow shapes. `src/generated/prisma` excluded — it is generated output.

Nothing in here is a behaviour change. Every item is either a file worth splitting or code that
exists more than once. One genuine performance bug turned up while reading and is recorded at the
end.

---

## A. Files worth splitting

### A1. `src/lib/db/items.ts` — 774 lines, five concerns

The largest hand-written file in the repo. It holds:

| Concern | Lines |
|---|---|
| Listings (`getPinnedItems` … `getFileItemsByType`) | 59–257 |
| Detail (`itemDetailSelect`, `getItemDetail`, `toDetail`) | 258–302, 603–639 |
| File access (`getItemFile`, `getUserFileKeys`) | 303–370 |
| Writes (`createItem`, `updateItem`, `writeFlags`, `deleteItem`) | 371–602 |
| Search (`searchItemSelect`, `searchItems`, `itemMatch`, `toPreview`) | 677–774 |

**Search is the cleanest lift.** It already has its own `select`, its own preview helper and its own
test file (`src/lib/db/search.test.ts`), so it moves as a unit into `src/lib/db/item-search.ts` with
no shared state to untangle.

**Writes are the next one** (`src/lib/db/item-write.ts`), which would also put `createItem` and
`updateItem` beside each other without ~250 lines of read queries in between.

One caveat: `toDetail` and `toSummary` are shared across the groups, so a split wants a small
`item-mappers.ts` rather than duplicating them — which would defeat the point.

### A2. `src/actions/ai.ts` — 663 lines, roughly 250 of them not actions

Two blocks in this file are pure logic sitting inside a `"use server"` module:

- **The gate machinery** — `Guarded`, `guard`, `authorize`, `allowSpend` (lines 483–620).
- **The prompt-input builders** — `describeCode` (line 474) and `describeItem` (line 635).

`describeItem` is the function that keeps the privacy page's claim — that only the title, description
and content are sent — true. It belongs in `src/lib/ai/` beside `prompts.ts` and `truncate.ts`.

**There is a test-coverage payoff attached.** `vitest.config.mts` collects `src/lib/**` and
`src/actions/**`, so these are reachable today only *through* the actions. Moved to `src/lib/ai/`
they can be imported and asserted directly, which matters most for `describeItem`, where the rule
being tested is a privacy guarantee rather than a behaviour.

Remember that a `"use server"` module may only export async functions — this move is in the same
direction the codebase already went for `savePreferences` and `withSession`.

### A3. `src/components/items/image-lightbox.tsx` — 564 lines

Already three components in one file: `ImageLightbox` (line 53), `LightboxStage` (line 113) and
`Minimap` (line 445).

`LightboxStage` alone is roughly 330 lines carrying six `useState`s and three `useRef`s, and most of
that is the gesture layer — pointer down/move/up, pinch, non-passive wheel, drag clamping. That is a
`use-zoom-pan.ts` hook, and unlike the component it would be **testable**: the pure geometry already
lives in `src/lib/image-zoom.ts` with 32 tests, and the state machine driving it does not.

### A4. `src/components/items/item-drop-zone.tsx` — 425 lines

Two separable concerns:

- The drag-depth counter and the overlay (presentation).
- The sequential upload-and-create batch loop, lines ~140–230 — which carries real logic: the
  per-file status machine, the rate-limit stop that halts the whole batch, and the single
  `router.refresh()` at the end.

Lifting the loop into a `useUploadBatch` hook separates the two and puts the interesting half
somewhere it can be reasoned about on its own.

### A5. Six identical `AppShell` layouts

`src/app/{items,profile,dashboard,collections,favorites,settings}/layout.tsx` are the same three
lines, differing only in the function name and the route generic.

This is the `(app)` route group that `context/project-overview.md` §7 targets and that the history
has deferred since the profile page landed. It is now **six** files rather than the three it was
when the deferral was first recorded. Still a route move touching typed-route generics, so still its
own change — but the case is stronger than it has ever been.

---

## B. Duplicated code

### B1. `"Could not reach the server. Try again."` — 17 declarations

`src/constants/messages.ts` already exports `UNREACHABLE`, and its own doc comment describes exactly
this situation. The string is still declared locally in:

```
src/components/auth/forgot-password-form.tsx:18      (as NETWORK_ERROR)
src/components/auth/register-form.tsx:21             (as NETWORK_ERROR)
src/components/auth/reset-password-form.tsx:23       (as NETWORK_ERROR)
src/components/auth/verify-status.tsx:73             (as NETWORK_ERROR)
src/components/billing/upgrade-dialog.tsx:21
src/components/collections/collection-delete-dialog.tsx:20
src/components/collections/collection-form.tsx:20
src/components/editor/editor-preferences-provider.tsx:43
src/components/items/item-create-form.tsx:34
src/components/items/item-delete-dialog.tsx:21
src/components/items/item-drawer-edit.tsx:19
src/components/items/item-drop-zone.tsx:31           (as CREATE_UNREACHABLE)
src/components/settings/settings-ai.tsx:12
src/components/settings/settings-billing.tsx:12
src/components/settings/settings-upload.tsx:18
src/hooks/use-flag-toggle.ts:11
src/lib/upload-file.ts:17                            (as UPLOAD_UNREACHABLE, exported)
```

Mechanical and zero-risk. The doc comment on `UNREACHABLE` should lose its "currently declared in
seventeen separate files" paragraph once it is done. Note `upload-file.ts` **exports** its copy, so
that one has callers to check.

### B2. Four identical AI request state machines

`src/components/ai/ai-tag-suggestions.tsx`, `ai-summary-suggestion.tsx`, `ai-explainable-code.tsx`
and `ai-optimizable-prompt.tsx` each carry the same sequence in the same order:

1. `const [busy, setBusy] = useState(false)` + `const [error, setError] = useState<string | null>(null)`
2. `setBusy(true); setError(null)`
3. `await <action>(...).catch(() => null)`
4. `if (result && "budgetExceeded" in result && result.budgetExceeded)` — latch the session flag
5. `setError(message); toast.error(message)`
6. `finally { setBusy(false) }`

One `useAiSuggestion` hook takes all six steps and leaves each component with only what it does with
the answer — which is the part that genuinely differs (merge chips, replace a field, show a tab,
show a comparison).

### B3. Two delete dialogs, identical down to the comments

`src/components/items/item-delete-dialog.tsx:44-88` and
`src/components/collections/collection-delete-dialog.tsx:49-95` share:

- `handleOpenChange` with its in-flight guard and its "a dismissed dialog should not come back
  carrying the last failure" reset.
- The same five-line comment about the rejection trap, **verbatim**.
- `await <action>(id).catch(() => null)`, then the same failure branch — `setDeleting(false)`,
  `setError(message)`, `toast.error(message)`.

Either a `useConfirmedDelete` hook or a `ConfirmDeleteDialog` component taking the action and the
copy. The comment being duplicated word for word is the tell: it is one idea written twice.

`src/components/settings/delete-account-dialog.tsx` uses `useActionState` instead and is **not**
part of this cluster — do not fold it in.

### B4. Four auth forms share a fetch pipeline

`forgot-password-form`, `register-form`, `reset-password-form` and `verify-status` each run:

```
validate with a Zod schema
  → firstIssueMessage on failure
  → POST JSON to /api/auth/*
  → parse the body
  → toastIfRateLimited(status, error)
  → setError(body.error ?? UNKNOWN_ERROR)
  → catch { setError(NETWORK_ERROR) }
```

A `postJson(url, body)` in `src/lib/` returning a discriminated result would absorb the middle of it.
The forms differ in what they do on success (a notice, a `router.replace`, a status swap), which is
what should stay in each component.

### B5. Four API routes duplicate parse-JSON-or-400

`src/app/api/auth/{forgot-password,register,resend-verification,reset-password}/route.ts` all carry
the same try/catch around `await request.json()` answering `"Request body must be JSON."` with a 400.

Two of them — `register/route.ts:35` and `reset-password/route.ts:26` — additionally declare their
own **identical** `error(message, status)` helper.

`forgot-password` and `resend-verification` also share the whole two-window rate-limit shape
(`rateLimit` per IP + per email → `tooManyAttemptsResponse`) and the same generic-200 result.

A `readJson(request, schema)` helper returning either the parsed data or a ready `NextResponse` would
take the preamble from all four.

### B6. HEIC-convert-then-validate duplicated across the two upload paths

`src/components/items/file-upload.tsx:70-101` and `src/components/items/item-drop-zone.tsx:170-194`
both do: detect HEIC → convert to JPEG → handle a conversion failure → `validateUpload` → upload.

**They have already drifted, which is the reason this one matters more than its size suggests:**

- `file-upload` validates **every** file after the conversion step.
- `item-drop-zone` validates **only on the HEIC branch**, relying on its earlier `describe()` call
  having checked the original.

That is defensible (a non-HEIC file was already checked) but it is a divergence nobody chose, and it
means the two paths enforce the rules at different moments. A `prepareUpload(kind, file)` in
`src/lib/` returning `{ file } | { error }` would collapse them and force the question of which
behaviour is intended to be answered once.

### B7. Six pages repeat the auth preamble

```
const user = await getCurrentUser();

// The proxy already turns an anonymous request away, so this covers what it
// cannot: a token that still verifies against an account that is gone.
if (!user) {
  redirect(SIGN_IN_PATH);
}
```

In `collections/page.tsx`, `collections/[id]/page.tsx`, `favorites/page.tsx`, `items/[type]/page.tsx`,
`profile/page.tsx` and `settings/page.tsx` — comment included.

A `requireUser()` in `src/lib/db/user.ts` collapses it. One caveat: `collections/page.tsx` folds the
call into a `Promise.all` alongside `searchParams`, so the helper has to stay awaitable in that
position rather than becoming a wrapper.

---

## C. One bug found while reading

**`src/actions/ai.ts:591` — `allowSpend` looks parallel and is not.**

```ts
const [perFeature, combined] = [
  await rateLimit(`ai:${feature}:${userId}`, limit, HOUR),
  await rateLimit(`ai:all:${userId}`, COMBINED_LIMIT, HOUR),
];
```

Array literals evaluate left to right, so this is **two sequential Redis round trips**, not one pair
in flight together. `Promise.all` halves the latency.

Not a correctness bug — the two checks are independent and the result is the same either way — but it
sits on the hot path of all six AI actions, every one of which pays for it before the model is even
called. The AI latency work in `docs/ai-latency-improvements.md` did not cover it.

---

## Suggested order

1. **B1** and **C** — both trivial, both zero-risk, and C is a measurable win.
2. **A2** — moving `describeItem` and `describeCode` into `src/lib/ai/` is the one refactor with a
   test-coverage payoff attached, and it is a pure move, so a green suite over untouched tests is
   what covers it.
3. **B2** and **B3** — the two hook extractions. Both are four-and-two copies of one state machine
   and both are components, so neither is testable either before or after; the win is that a fix
   lands once rather than four times.
4. **B6** — worth doing for the drift, not for the line count.
5. **A1**, **A3**, **A4** — file splits, each its own change.
6. **A5** — the `(app)` route group, which is a route move and wants to be its own feature.

**B4**, **B5** and **B7** are real but lower value: they touch auth and page-entry code, which is
where a mistake is most expensive, and the duplication is preamble rather than logic.
