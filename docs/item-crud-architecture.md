# Item CRUD Architecture

A design for create / read / update / delete across all seven item types, using **one action file**, **`lib/db` queries called straight from server components**, and **one dynamic route** whose components adapt by type.

Compiled against `prisma/schema.prisma`, [docs/item-types.md](docs/item-types.md), and the patterns already established in `src/actions/`, `src/lib/db/`, `src/lib/validations/` and `src/components/`.

> Design documentation only — no code was changed. Nothing here exists yet.

---

## 1. Principles this inherits

The codebase has already settled these; the design follows them rather than reopening them.

| Rule | Where it's established |
|---|---|
| Server components fetch directly through `lib/db`, no API route | `dashboard/page.tsx` → `RecentItemsSection` → `getRecentItems` |
| Queries are `cache()`d per request, keyed on `userId` | `getCollections`, `getCurrentUser` |
| Mutations are server actions in `src/actions/[feature].ts` | `actions/auth.ts`, `actions/profile.ts` |
| Action state shapes live in `src/types/`, **never** exported from a `"use server"` module | `types/auth.ts` — a non-async export there is a runtime error |
| Zod schemas live in `src/lib/validations/[feature].ts` | `validations/auth.ts` |
| Every section owns its query behind its own `<Suspense>` | `dashboard/page.tsx` |
| Markup carries no Tailwind utility strings — semantic classes in `globals.css` | CLAUDE.md, every component |
| API routes only for webhooks, uploads, and pre-session flows | `coding-standards.md` |

The last one is why item CRUD is **actions, not `/api/items`**: every mutation here happens with a session in hand. The one exception is the R2 upload, covered in §10.

---

## 2. File structure

```
src/
├── actions/
│   └── items.ts                      ← NEW. every mutation. "use server"
├── types/
│   └── items.ts                      ← NEW. action state shapes + initial constants
├── lib/
│   ├── item-content.ts               ← NEW. slug → ContentType, pure, no imports
│   ├── validations/
│   │   └── item.ts                   ← NEW. discriminated union on contentType
│   └── db/
│       ├── items.ts                  ← EXTEND. +getItemsByType +getItem
│       └── item-types.ts             ← EXTEND. +getItemType(slug)
├── app/
│   └── items/
│       ├── layout.tsx                ← NEW. 3 lines: <AppShell>, force-dynamic
│       └── [type]/
│           └── page.tsx              ← NEW. the one dynamic route
└── components/
    └── items/
        ├── item-card.tsx             ← EXISTS. becomes a link
        ├── item-list.tsx             ← EXISTS. unchanged
        ├── items-view.tsx            ← NEW. list + header + drawer host
        ├── item-drawer.tsx           ← NEW. create/edit/view shell
        ├── item-form.tsx             ← NEW. client, useActionState
        ├── item-actions.tsx          ← NEW. favorite / pin / delete
        ├── item-skeletons.tsx        ← NEW. Suspense fallbacks
        └── type-fields.tsx           ← NEW. THE type-specific registry
```

Nine new files, two extended. The count is deliberate: type-specific behaviour is concentrated in exactly one of them (`type-fields.tsx`), so the other eight never branch on type.

---

## 3. Routing — `/items/[type]`

### 3.1 Where the route lives

`src/app/items/[type]/page.tsx`, with a three-line `src/app/items/layout.tsx` mirroring [profile/layout.tsx](src/app/profile/layout.tsx) exactly:

```tsx
export const dynamic = "force-dynamic";

export default function ItemsLayout({ children }: LayoutProps<"/items">) {
  return <AppShell>{children}</AppShell>;
}
```

**Not the `(app)` route group** that project overview §7 targets. That group still doesn't exist — `/dashboard` and `/profile` each carry their own three-line layout instead — and adopting it is a route *move* touching typed-route generics for pages that already work. This route should match today's precedent and be absorbed later when the group lands, as a single change. (`ai-interaction.md`: ask before architectural changes.)

### 3.2 The seven routes

One file serves all of them. `[type]` is the type's **`slug`**, so the concrete routes are:

| Route | `params.type` | ContentType | Payload column | `Field` → `View` | Notes |
|---|---|---|---|---|---|
| `/items/snippets` | `snippets` | `TEXT` | `content` + `language` | `CodeField` → `CodeView` | language defaults to `typescript` |
| `/items/prompts` | `prompts` | `TEXT` | `content` | `TextField` → `PromptView` | no `language` |
| `/items/commands` | `commands` | `TEXT` | `content` + `language` | `CodeField` → `CommandView` | language defaults to `bash` |
| `/items/notes` | `notes` | `TEXT` | `content` | `TextField` → `MarkdownView` | needs a markdown lib (§12.6) |
| `/items/files` | `files` | `FILE` | `fileUrl` + `fileName` + `fileSize` | `FileField` → `FileView` | **Pro**; blocked on R2 (§10) |
| `/items/images` | `images` | `FILE` | `fileUrl` + `fileName` + `fileSize` | `FileField` → `ImageView` | **Pro**; blocked on R2 (§10) |
| `/items/links` | `links` | `URL` | `url` | `UrlField` → `LinkView` | only single-string payload |

**Nothing in this table is a routing branch.** The `page.tsx` for all seven is byte-identical — it resolves the slug, and everything downstream reads from the resolved row (`name`, `icon`) or the registry (`Field`, `View`). The columns differ; the route does not.

Each route carries the same three states in its query string, so the drawer is addressable per type:

| URL | Renders |
|---|---|
| `/items/snippets` | the list alone |
| `/items/snippets?item=<id>` | list + drawer showing that item (§9) |
| `/items/snippets?new=1` | list + drawer with an empty create form, `contentType` pre-set to `TEXT` |

`?new=1` is where the slug earns its second job: the page already knows the type, so the create form needs no type picker — it derives `contentType` via `contentTypeForSlug(slug)` (§5.1) and `itemTypeId` from the row it just resolved. A "New Item" from the top bar, which has no type context, is the only case that needs a picker.

Two routes are worth calling out as **reachable but empty on arrival**: `/items/files` and `/items/images` resolve fine — their `ItemType` rows exist — but have zero items and no working create path until R2 lands. They render the empty state, not a 404. `/items/notes` is the third with zero rows, but it has no such blocker; it works the moment step 3 of §11 is done.

### 3.3 Resolving the segment

`[type]` is the **`slug`**, per [docs/item-types.md §5](docs/item-types.md). Resolution needs care in one place:

```ts
// lib/db/item-types.ts
export const getItemType = cache(
  async (slug: string): Promise<ItemTypeSummary | null> =>
    prisma.itemType.findFirst({
      where: { slug, userId: null },   // system types are shared rows
      select: itemTypeSelect,
    }),
);
```

`findFirst`, not `findUnique`: the `@@unique([userId, slug])` index does not cover system types, because Postgres treats NULLs as distinct — the same reason [seed.ts:345](prisma/seed.ts#L345) looks rows up before writing them. When custom types arrive this widens to `{ slug, OR: [{ userId: null }, { userId }] }` and gains the `userId` argument; nothing else in the design moves.

An unresolved slug is `notFound()`. That is the entire guard — there is no allowlist to maintain, because the database is the list.

### 3.4 Page shape

```tsx
export default async function ItemsPage({ params }: PageProps<"/items/[type]">) {
  const { type: slug } = await params;          // params is a Promise in Next 16
  const itemType = await getItemType(slug);

  if (!itemType) notFound();

  return (
    <>
      <div className="dashboard-heading">
        <h1>{itemType.name}s</h1>
        …
      </div>
      <Suspense fallback={<ItemListSkeleton />}>
        <ItemsView itemType={itemType} searchParams={…} />
      </Suspense>
    </>
  );
}
```

`generateMetadata` reads the same cached `getItemType` for the title, so naming the page costs no extra query. No `generateStaticParams` — the data is per user and the layout is `force-dynamic`.

### 3.5 The proxy matcher must be extended

**Currently missed.** [proxy.ts:24](src/proxy.ts#L24) matches only:

```ts
matcher: ["/dashboard", "/dashboard/:path*", "/profile", "/profile/:path*"],
```

`/items/*` needs adding, or the route is unauthenticated at the edge. The page would still render empty (every `lib/db` call short-circuits on a null `userId`), but an anonymous visitor would get a page instead of a redirect. Belt and braces, as `/profile` does it: add the matcher entries **and** redirect to `SIGN_IN_PATH` in the page when `getCurrentUserId()` returns null — the proxy cannot see a JWT whose row is gone or whose password fingerprint has moved.

---

## 4. Data fetching — `lib/db/items.ts`

Two additions, both following the existing `itemSelect` / `toSummary` shape.

### 4.1 List

```ts
export async function getItemsByType(
  userId: string,
  itemTypeId: string,
): Promise<ItemSummary[]>
```

`where: { userId, itemTypeId }`, `orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]`, reusing the existing `itemSelect`. Pinned-first matches how the dashboard already privileges pinned items, and `@@index([userId, updatedAt])` covers the ordering.

### 4.2 Detail — and why it's a *second* select

```ts
export interface ItemDetail extends ItemSummary {
  content: string | null;
  url: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  language: string | null;
  contentType: ContentType;
  collectionIds: string[];
}

export async function getItem(userId, id): Promise<ItemDetail | null>
```

The list select must **not** grow these fields. `content` is `@db.Text` and a snippet is kilobytes; pulling it for every row to render cards that never display it would make the list query scale with total content size rather than row count. One narrow select for lists, one wide one for the single open item — the same split `CollectionSummary` already makes.

`getItem` filters on `{ id, userId }` so a guessed id from another account returns null, not someone else's row.

### 4.3 Free-tier counting

`getItemStats` already returns `total`. Project overview §8 caps free accounts at 50 items, and the enforcement point is `createItem` — see §6.4.

---

## 5. Validation — one discriminated union

`src/lib/validations/item.ts`. This is where [docs/item-types.md §3](docs/item-types.md)'s "exclusivity is unenforced" gap actually closes:

```ts
const baseItem = {
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(500).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  collectionIds: z.array(z.string()).default([]),
};

export const itemSchema = z.discriminatedUnion("contentType", [
  z.object({
    ...baseItem,
    contentType: z.literal("TEXT"),
    content: z.string().min(1, "Content is required."),
    language: z.string().max(40).nullish(),
  }),
  z.object({
    ...baseItem,
    contentType: z.literal("URL"),
    url: z.url("Enter a valid URL."),
  }),
  z.object({
    ...baseItem,
    contentType: z.literal("FILE"),
    fileUrl: z.url(),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive(),
  }),
]);
```

A discriminated union does the exclusivity work structurally: a `TEXT` item cannot carry a `url` because that variant has no such key, and Zod strips unknown keys by default. The action then spreads `parsed.data` into Prisma and the wrong column is unreachable — no hand-written "if link then clear content" logic anywhere.

Zod 4 idioms, matching `validations/auth.ts`: `z.url()` top-level (not `z.string().url()`), and `error:` rather than `message:` in refinements.

### 5.1 The slug→ContentType map needs one home

Today the only copy is `contentTypeFor()`, private inside [seed.ts:332](prisma/seed.ts#L332), which the app cannot import. The design's answer is `src/lib/item-content.ts` — **pure, zero imports**, so the seed script can import it too:

```ts
export function contentTypeForSlug(slug: string): ContentType {
  if (slug === "links") return "URL";
  if (slug === "files" || slug === "images") return "FILE";
  return "TEXT";
}
```

Deliberately *not* `src/constants/item-types.ts`: that module imports `lucide-react`, and pulling React components into a seed script run by `tsx` is a needless hazard. Keeping this file import-free is what lets the seed drop its private copy and lets one definition serve both.

> The alternative — a `contentType` column on `ItemType` — removes the mapping entirely and makes it data. It costs a migration and is the better answer if custom types ever ship. Recorded in §12.

---

## 6. Mutations — `src/actions/items.ts`

One file, `"use server"` at the top, five exports. Every one is async (the `"use server"` constraint that bit `SIGN_IN_INITIAL_STATE`), and every state type lives in `src/types/items.ts`.

```ts
createItem(prevState, formData): Promise<ItemFormState>
updateItem(prevState, formData): Promise<ItemFormState>
deleteItem(id): Promise<ItemActionState>
toggleFavorite(id): Promise<ItemActionState>
togglePin(id): Promise<ItemActionState>
```

### 6.1 The shape every one follows

Lifted directly from [`changePassword`](src/actions/profile.ts#L42):

```ts
export async function createItem(prev: ItemFormState, formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: SIGNED_OUT };

  const parsed = itemSchema.safeParse(fromFormData(formData));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error), values: … };

  // …ownership-scoped write…

  revalidatePath(`/items/${slug}`);
  revalidatePath("/dashboard");
  return ITEM_FORM_INITIAL_STATE;
}
```

`{ success, data, error }` per coding-standards; errors surface as toasts / inline messages. Rejected input returns the submitted values alongside the error, for the same reason `SignInState` carries `email` back — React resets the form once an action settles, and a rejected save must not empty the textarea.

### 6.2 Ownership is a `where` clause, not a read-then-write

The one correctness trap in this design. Prisma's `update`/`delete` accept only unique fields in `where`, so the obvious version is:

```ts
const item = await prisma.item.findUnique({ where: { id } });
if (item.userId !== userId) return { error: NOT_FOUND };   // ← racy, two round trips
await prisma.item.update({ where: { id }, data });
```

Use `updateMany` / `deleteMany` with **both** keys and guard on the returned count instead:

```ts
const { count } = await prisma.item.updateMany({
  where: { id, userId },
  data: parsed.data,
});
if (count === 0) return { error: NOT_FOUND };
```

One atomic statement, no window between check and write, and a foreign id is indistinguishable from a deleted one. This is already the house pattern — [`account.ts`](src/lib/account.ts) and the password-reset flow both switched to `deleteMany` guarded on `count` precisely because `delete` throws `P2025` when the row is gone. Same reasoning, applied on the way in.

### 6.3 Nested writes for tags and collections

Tags are `@@unique([userId, name])`, so `connectOrCreate` per tag inside the item write handles both cases without a pre-pass. Collections use the `ItemCollection` join, `set` on update so removing a collection actually detaches it. Both are type-agnostic — no branching.

### 6.4 Free-tier limits

`createItem` is the only place the 50-item / 3-collection caps can be enforced, and project overview §10 still has hard-block vs. soft-warning open. The hook belongs here (`getItemStats(userId).total >= FREE_ITEM_LIMIT` → refuse), gated on `user.isPro`, but **all users get full access during development** per §8, so the check should ship behind the same kind of flag as `EMAIL_VERIFICATION_ENABLED` rather than being wired live.

### 6.5 Rate limiting

`src/lib/rate-limit.ts` already exists and is keyed however the caller likes; `changePassword` keys on user id. Item mutations are cheap and authenticated, so this is lower priority than the auth endpoints — but `createItem` writes rows and is worth a generous per-user window if abuse ever matters.

---

## 7. Where type-specific logic lives

**Answer: in exactly one component module, and nowhere else.**

The action file never asks what type it's writing. It receives `contentType` as the union discriminant, validates against the matching variant, and spreads the result. Add a custom type later and `actions/items.ts` does not change.

The differences are all about *rendering a payload* — a code block versus a markdown body versus a link versus an image — which is presentation. They live in `src/components/items/type-fields.tsx`, a registry keyed by slug:

```tsx
interface TypeConfig {
  /** the editor for this type's payload */
  Field: (props: FieldProps) => ReactNode;
  /** the read-only view in the drawer */
  View: (props: ViewProps) => ReactNode;
  placeholder: string;
  defaultLanguage?: string;
}

export const TYPE_CONFIG: Record<string, TypeConfig> = {
  snippets: { Field: CodeField, View: CodeView, placeholder: "Paste your code…", defaultLanguage: "typescript" },
  commands: { Field: CodeField, View: CommandView, placeholder: "git reset --soft HEAD~1", defaultLanguage: "bash" },
  prompts:  { Field: TextField, View: PromptView,  placeholder: "Write your prompt…" },
  notes:    { Field: TextField, View: MarkdownView, placeholder: "Write a note…" },
  links:    { Field: UrlField,  View: LinkView,    placeholder: "https://…" },
  files:    { Field: FileField, View: FileView,    placeholder: "" },
  images:   { Field: FileField, View: ImageView,   placeholder: "" },
};
```

This mirrors how `TYPE_ICONS` already works — an unguarded lookup with a falsy-safe consumer, so an unknown slug degrades instead of throwing. Snippet and Command share a `Field` because they are schema-identical ([docs/item-types.md §2](docs/item-types.md)); they differ only in their `View` and default language, which is exactly the distinction the registry is for.

The `.tsx` extension matters — this module holds components, unlike `src/constants/item-types.ts` which holds only the icon map.

---

## 8. Component responsibilities

| Component | Client? | Owns | Never does |
|---|---|---|---|
| `items/[type]/page.tsx` | server | resolves slug → type, `notFound()`, heading, Suspense boundary | fetch items itself |
| `items-view.tsx` | server | calls `getItemsByType`, hosts `ItemList` + drawer | know a payload shape |
| `item-list.tsx` *(exists)* | server | maps to cards, empty message | anything type-aware |
| `item-card.tsx` *(exists)* | server | summary row, `data-type` colour, becomes a `<Link>` to `?item=id` | render payload |
| `item-drawer.tsx` | client | Sheet open/close, routes back on dismiss | validate |
| `item-form.tsx` | client | `useActionState`, shared fields, delegates payload to registry | branch on type inline |
| `type-fields.tsx` | mixed | **all** per-type rendering | touch Prisma or actions |
| `item-actions.tsx` | client | favourite / pin / delete triggers | own the mutation logic |
| `item-skeletons.tsx` | server | fallbacks reusing `.item-card` classes | — |

`ItemCard` needs one change to become interactive: wrap its contents in a `<Link href={`?item=${id}`} scroll={false}>`. It stays a server component that way — no `onClick`, no `"use client"` — which keeps the list cheap.

Skeletons follow the established trick from `dashboard-skeletons.tsx`: reuse the real component's classes for the box model, size only the inner blocks, and give text placeholders `height: 1lh`. Note the bug that file already fixed — **do not nest a Skeleton `div` inside a `<p>`**; it throws hydration errors.

---

## 9. Drawer state: put it in the URL

Project overview §3A requires items to open in a **drawer, not a page**. Two ways to hold that state:

| | Client state (`useState`) | **URL (`?item=id`, `?new=1`)** |
|---|---|---|
| Detail fetch | client round trip, needs an endpoint | server component, already have `getItem` |
| Shareable / refresh-safe | ✗ | ✓ |
| Back button closes it | ✗ | ✓ |
| Cost to open | one fetch | one server navigation |

**Recommend the URL.** It keeps `getItem` a direct server query — no `/api/items/[id]` needed purely to feed a client drawer — and the codebase already reads query state this way (`?status=`, `?reset=1`, with `firstParam` in [search-params.ts](src/lib/search-params.ts) for the array case). The drawer becomes a server component rendered when `searchParams.item` is present, with only the Sheet shell client-side.

The cost is a server round trip per open, which for a drawer over a list is acceptable and buys back the shareable `/items/snippets?item=abc` link.

---

## 10. The one API route that stays

File and Image uploads. `coding-standards.md` lists "file uploads with progress tracking" as an API-route case, and project overview §7 already plans `api/upload/route.ts` for **signed R2 URLs**. The flow:

1. Client asks `/api/upload` for a signed URL.
2. Client `PUT`s the file straight to R2 — never through the Next server.
3. Client calls `createItem` with the resulting `fileUrl` / `fileName` / `fileSize`, which is exactly the `FILE` variant of `itemSchema`.

So the action stays uniform: it receives three strings and a number like any other variant, and knows nothing about R2. Note this is the only part of the design blocked on infrastructure — there is no `lib/r2.ts` yet, and Files and Images have **zero rows** in the database. The other five types can ship complete without it.

---

## 11. Suggested build order

1. `lib/item-content.ts` + `getItemType` + proxy matcher — the route resolves and is protected.
2. `getItemsByType` + `items/[type]/page.tsx` + `ItemsView` — the list renders. **The seven 404s are gone at this point.**
3. `validations/item.ts` + `actions/items.ts` create/update + `item-form.tsx` with a single `TextField` — CRUD works for one type.
4. `type-fields.tsx` registry — the other six types get their real editors and views.
5. `toggleFavorite` / `togglePin` / `deleteItem` + `item-actions.tsx`.
6. R2 + upload route + `FileField` — File and Image.

Steps 1–2 are independently useful and unblock the most visible defect in the app.

---

## 12. Open decisions

1. **`ContentType` as a column on `ItemType`** instead of the slug map. Costs a migration; removes a whole class of drift and is close to required if custom types ship. §5.1.
2. **Free-tier enforcement** — hard block vs. soft warning, still open from project overview §10. §6.4.
3. **The `(app)` route group.** This design adds a third top-level route with its own three-line layout. That's consistent with today, but it's the third one — the group is now worth doing as its own change. §3.1.
4. **A DB `CHECK` constraint** for payload exclusivity, belt-and-braces behind the Zod union. Project overview §10 has it open; the union makes it much less urgent.
5. **Search.** The top bar's field is display-only. `/items/[type]` is the natural place for a per-type filter, and full search (§3C) is a larger feature — worth deciding whether the type page gets a local filter now or waits.
6. **Markdown rendering** for Notes needs a library; none is installed. Affects step 4 only.
