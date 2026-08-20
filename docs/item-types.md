# Item Types

Reference for the seven system item types. Compiled from `prisma/schema.prisma`, `prisma/seed.ts`, `src/constants/item-types.ts`, `src/lib/db/item-types.ts`, `src/app/globals.css` and the live `development` branch.

> Documentation only — nothing here proposes a code change.

---

## 1. The seven types

All seven ship as **system types**: `isSystem: true`, `userId: null`, one shared row per type reused by every account. Custom types are modelled (`ItemType.userId` is nullable) but are a post-launch feature — the app creates none.

| # | Name | Slug | Route | Icon (lucide) | Color | ContentType | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | Snippet | `snippets` | `/items/snippets` | `Code` | `#3b82f6` 🔵 | `TEXT` | Reusable code, syntax highlighted |
| 2 | Prompt | `prompts` | `/items/prompts` | `Sparkles` | `#8b5cf6` 🟣 | `TEXT` | AI prompts and system messages |
| 3 | Command | `commands` | `/items/commands` | `Terminal` | `#f97316` 🟠 | `TEXT` | Shell / CLI one-liners |
| 4 | Note | `notes` | `/items/notes` | `StickyNote` | `#fde047` 🟡 | `TEXT` | Freeform / markdown notes |
| 5 | File | `files` | `/items/files` | `File` | `#6b7280` ⚪ | `FILE` | Uploaded document — **Pro only** |
| 6 | Image | `images` | `/items/images` | `Image` | `#ec4899` 🩷 | `FILE` | Uploaded image — **Pro only** |
| 7 | Link | `links` | `/items/links` | `Link` | `#10b981` 🟢 | `URL` | External URL / bookmark |

The table order is the **display order**, defined by `TYPE_SLUG_ORDER` in [item-types.ts:23-31](src/lib/db/item-types.ts#L23-L31) and applied through `compareItemTypes`. The schema carries no sort column, so this array is the only thing keeping the sidebar, profile breakdown and any future list in agreement; unknown slugs sort last, then alphabetically.

Verified live on `development`: all seven rows exist with exactly these `slug` / `icon` / `color` values, all `isSystem: true` / `userId: null`.

---

## 2. Per type

### Snippet — `snippets`

- **Route** `/items/snippets` · **Icon** `Code` · **Color** `#3b82f6` (`--type-snippet`) · **ContentType** `TEXT`
- **Purpose** Reusable code fragments — hooks, helpers, config blocks.
- **Fields used** `title`, `description`, `content` (the code), `language` (highlighting hint), `tags`, `isFavorite`, `isPinned`.
- **Unused** `url`, `fileUrl`, `fileName`, `fileSize`.
- `language` matters most here — the seed sets `typescript`, `dockerfile`. Live: 4 items, all 4 carry `language`.

### Prompt — `prompts`

- **Route** `/items/prompts` · **Icon** `Sparkles` · **Color** `#8b5cf6` (`--type-prompt`) · **ContentType** `TEXT`
- **Purpose** AI prompts, system messages, reusable instructions.
- **Fields used** `title`, `description`, `content` (the prompt body), `tags`, flags.
- **Unused** `language` (prose, not code), `url`, file fields.
- Seeded prompts use `{{placeholder}}` markers in `content` — a convention of the text, not a schema feature. Live: 3 items, 0 with `language`, which is the meaningful contrast against snippets.

### Command — `commands`

- **Route** `/items/commands` · **Icon** `Terminal` · **Color** `#f97316` (`--type-command`) · **ContentType** `TEXT`
- **Purpose** Shell/CLI invocations worth not re-deriving.
- **Fields used** `title`, `description`, `content` (the command), `language` (`bash` in every seeded row), `tags`, flags.
- **Unused** `url`, file fields.
- Structurally identical to Snippet — same columns, same `TEXT` shape. The difference is intent and expected length (one line vs. a block), which only presentation can express. Live: 5 items, all 5 with `language`.

### Note — `notes`

- **Route** `/items/notes` · **Icon** `StickyNote` · **Color** `#fde047` (`--type-note`) · **ContentType** `TEXT`
- **Purpose** Freeform / markdown prose.
- **Fields used** `title`, `description`, `content` (markdown), `tags`, flags.
- **Unused** `language`, `url`, file fields.
- **Not represented in the seed or live data** — 0 items. The only `TEXT` type with no working example, so any rendering assumption about it is untested.

### File — `files` *(Pro)*

- **Route** `/items/files` · **Icon** `File` · **Color** `#6b7280` (`--type-file`) · **ContentType** `FILE`
- **Purpose** Uploaded documents — context files, templates, exports.
- **Fields used** `title`, `description`, `fileUrl` (Cloudflare R2), `fileName` (original name), `fileSize` (bytes), `tags`, flags.
- **Unused** `content`, `url`, `language`.
- In `PRO_TYPE_SLUGS`, so the sidebar shows a `PRO` badge. **Nothing is actually gated** — per project overview §8 all users get full access during development, and the links stay clickable.
- **0 items live.** R2 is not wired up, so this type has never been exercised end to end.

### Image — `images` *(Pro)*

- **Route** `/items/images` · **Icon** `Image` · **Color** `#ec4899` (`--type-image`) · **ContentType** `FILE`
- **Purpose** Screenshots, diagrams, design references.
- **Fields used** identical to File: `fileUrl`, `fileName`, `fileSize` + `title`, `description`, `tags`, flags.
- **Unused** `content`, `url`, `language`.
- Also in `PRO_TYPE_SLUGS`. Same schema shape as File — the only distinction is that an image is expected to render as a thumbnail/preview rather than as a download row. **0 items live.**

### Link — `links`

- **Route** `/items/links` · **Icon** `Link` · **Color** `#10b981` (`--type-link`) · **ContentType** `URL`
- **Purpose** Bookmarked external documentation and resources.
- **Fields used** `title`, `description`, `url`, `tags`, flags.
- **Unused** `content`, `language`, file fields.
- The only type where the payload is a single short string rather than a body. Live: 6 items, all 6 with `url`, none with `content` — the mutual-exclusivity invariant holds in the current data.

---

## 3. Classification: text vs. file vs. URL

`ContentType` is a three-value enum on `Item`, and the seven types collapse onto it 4 / 2 / 1:

| ContentType | Types | Payload column | Free tier |
|---|---|---|---|
| `TEXT` | Snippet, Prompt, Command, Note | `content` (`@db.Text`) | ✅ all four |
| `FILE` | File, Image | `fileUrl` + `fileName` + `fileSize` | ❌ Pro only |
| `URL` | Link | `url` | ✅ |

The mapping is derived, not stored. `contentTypeFor(typeSlug)` in [seed.ts:332-336](prisma/seed.ts#L332-L336) is the only place it is written down:

```ts
if (typeSlug === "links") return "URL";
if (typeSlug === "files" || typeSlug === "images") return "FILE";
return "TEXT";
```

Two consequences worth knowing before building item CRUD:

1. **`ItemType` has no `contentType` column.** The type row says nothing about which payload field its items use — an item carries its own `contentType`, and nothing in the database stops a `snippets` item being written as `URL`. The invariant is application-level only.
2. **The seed's mapping is not importable by the app.** It is a private function inside a script the app never loads, so any create/edit path needs its own copy — or, better, one shared module. This is the single most likely place for the two to drift.

**Exclusivity is unenforced.** `content`, `fileUrl` and `url` are all nullable and independent; project overview §10 still lists the decision (app-layer validation vs. a Postgres `CHECK` constraint) as open. Today only `scripts/test-db.ts` asserts it — TEXT items have `content`, URL items have `url`, no item carries both — and it runs against seeded data, not on write.

---

## 4. Shared properties

Every item, regardless of type, has:

| Field | Notes |
|---|---|
| `id` | cuid |
| `title` | required, the only required user input across all types |
| `description` | optional, one line under the title on cards |
| `contentType` | required enum, derived from the type |
| `isFavorite` / `isPinned` | independent booleans, both indexed with `userId` |
| `createdAt` / `updatedAt` | `updatedAt` drives every "recent" ordering (`@@index([userId, updatedAt])`) |
| `userId` | owner, `onDelete: Cascade` |
| `itemTypeId` | **no cascade** — deleting a type in use would be blocked, which is what protects the shared system rows |
| `tags` | implicit m-n to `Tag`, unique per `(userId, name)` |
| `collections` | m-n through `ItemCollection`, so one item can sit in several collections |

`language` sits in a middle ground: it belongs only to the code-ish TEXT types (Snippet, Command) but lives on every row. Prompt and Note leave it null, and live data confirms the split — 9 of 9 snippet+command items have it, 0 of 9 prompt+link items do.

---

## 5. Routes

Every type gets one list route, `/items/[type]`, where the segment is the type's **`slug`** — never its name or id. The sidebar is the only thing building these today, at [sidebar.tsx:65](src/components/layout/sidebar.tsx#L65):

```tsx
const href = `/items/${type.slug}`;
```

The slug's double duty is worth noting: the same string is the URL segment *and* the CSS `data-type` value, which is why [item-types.ts:4](src/lib/db/item-types.ts#L4) documents it as both. One value, two consumers — renaming a slug moves the route and silently drops the color coding together.

**None of these routes exist.** There is no `src/app/items/` directory; the app's only pages are `/`, `/dashboard`, `/profile` and the four `(auth)` ones. All seven sidebar type links 404 today, as does the "View all collections" link. The route is planned as a single dynamic segment — `src/app/(app)/items/[type]/page.tsx` per project overview §7 — not seven static pages.

Three things fall out of that for whoever builds it:

1. **The segment needs resolving to an `ItemType` row.** `slug` is unique per user (`@@unique([userId, slug])`), and for system types `userId` is null — so the lookup is `{ slug, userId: null }`, or `{ slug, OR: [{ userId: null }, { userId }] }` once custom types exist. An unknown slug is a `notFound()`.
2. **Active-state matching is exact.** The sidebar sets `data-active={pathname === href}`, so a future nested route like `/items/snippets/[id]` would drop the parent's highlight. Not a problem while items open in a drawer rather than a page, which is the plan.
3. **Pro types route like any other.** `/items/files` and `/items/images` are ordinary links with no guard — the `PRO` badge is a label, and per project overview §8 nothing is gated during development.

Two related routes are unbuilt but implied: `/collections` (linked from the sidebar, also 404s) and `/collections/[id]`.

---

## 6. Display differences

Everything visual keys off **`slug`**, never off the name or id.

**Color** flows through one CSS mechanism. `globals.css` defines the seven hex values as `--type-*` tokens ([globals.css:90-96](src/app/globals.css#L90-L96)), then a `data-type` map resolves `--type-color` for the whole subtree beneath any element carrying the slug ([globals.css:152-178](src/app/globals.css#L152-L178)). Components set `data-type={slug}` and the rules downstream read `var(--type-color)` — item cards as a 3px left border, icons as foreground, icon chips as `color-mix(... 18%, transparent)`. `.dashboard-shell` sets a `--muted-foreground` fallback, so an unmapped slug degrades to grey rather than breaking. Note the map is scoped under `.dashboard-shell`, so type coloring only works inside the app shell.

**Icons** come from `TYPE_ICONS` in [item-types.ts:16-24](src/constants/item-types.ts#L16-L24), keyed by the `ItemType.icon` string (`"Code"` → `Code`). Lookups are unguarded by type — `const Icon = TYPE_ICONS[item.type.icon]` — and every consumer renders `{Icon && <Icon />}`, so an unknown name renders nothing rather than crashing.

Four consumers use both: [item-card.tsx](src/components/items/item-card.tsx), [collection-card.tsx](src/components/collections/collection-card.tsx) (whose card is colored by its *most common* type and shows an icon row of all types present), [sidebar.tsx](src/components/layout/sidebar.tsx), [profile-usage.tsx](src/components/profile/profile-usage.tsx).

**What does not differ yet.** `ItemCard` renders identically for all seven types — icon, title, flags, description, tags, date. It never touches `content`, `url` or `fileUrl`, so the payload is invisible on the card and nothing type-specific has been built. The differences the spec calls for exist only as intent:

| Type | Expected treatment | Status |
|---|---|---|
| Snippet | syntax-highlighted code block, `language` badge | not built |
| Prompt | monospace/markdown body, copy action | not built |
| Command | single-line code with copy-to-clipboard | not built |
| Note | rendered markdown | not built |
| File | filename + human-readable size, download | not built (no R2) |
| Image | inline thumbnail / preview | not built (no R2) |
| Link | hostname/favicon, opens externally | not built |

The item drawer (`components/items/item-drawer.tsx`) is where these belong per project overview §7, and it is unwritten.

**Pro labelling** is display-only: `PRO_TYPE_SLUGS = new Set(["files", "images"])` drives a badge in the sidebar between label and count. `ItemType` has no `isPro` column — adding one would mean a migration for what is currently a presentation concern.

---

## 7. Live data snapshot

`development` branch, 18 items across the demo account:

| Type | Items | `content` | `url` | `fileUrl` | `language` |
|---|---|---|---|---|---|
| snippets | 4 | 4 | 0 | 0 | 4 |
| commands | 5 | 5 | 0 | 0 | 5 |
| prompts | 3 | 3 | 0 | 0 | 0 |
| links | 6 | 0 | 6 | 0 | 0 |
| notes | 0 | — | — | — | — |
| files | 0 | — | — | — | — |
| images | 0 | — | — | — | — |

Each type's items carry exactly one `contentType`, matching the table in §3. **Three of seven types have never held a row** — Note, File and Image — so any CRUD or rendering work will be the first thing to exercise them.

---

## 8. Gaps worth deciding before building on this

1. **Slug→ContentType mapping has no shared home.** It exists once, privately, in the seed script. Item creation needs it too.
2. **Exclusivity of `content` / `url` / `fileUrl` is unvalidated on write** — project overview §10 has it open; Zod at the API boundary is the standing suggestion.
3. **Display order lives in a hand-maintained array** (`TYPE_SLUG_ORDER`) with no schema backing. A custom type would land at the end by default.
4. **File and Image are fully modelled but entirely unimplemented** — no R2 client, no upload route, no rows.
5. **Pro gating is cosmetic** and deliberately so during development.
6. **`/items/[type]` does not exist**, so all seven sidebar links 404. The slug is already the URL contract; the page resolving it is what's missing.
