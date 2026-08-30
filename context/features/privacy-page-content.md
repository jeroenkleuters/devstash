# Privacy page — content

> Copy for `/privacy`, rewritten on 2026-08-30 to match what DevStash actually
> does. Every claim below was checked against the code rather than assumed.
>
> **This is a draft in `context/`, not the published page.** Resolve the four
> items below before it ships.

## Before publishing

1. **Decide the contact address.** `privacy@…` below is a placeholder. Publishing
   an address is a decision about what appears on a public page — pick one
   deliberately rather than inheriting a personal one.
2. **Verify the OpenAI retention and training claims** against their current
   data-usage terms at the moment of writing. It is the only part of this page
   describing someone else's policy, and it is the part that dates. Do not copy
   the sentence from here or from `docs/ai-integration-plan.md`.
3. **Fix account deletion first, or change §7.** `deleteAccount` in
   `src/lib/account.ts` deletes the user row and lets Prisma cascade the items,
   collections and tag links — but it **does not delete the uploaded files from
   Cloudflare R2**. `deleteItem` deletes an item's object; deleting the whole
   account does not. Files are therefore orphaned in the bucket after an account
   is gone. That is a real defect, not a wording problem: it is a right-to-erasure
   gap and an unbounded storage cost. §7 is written honestly about it below,
   **but the better fix is the code.** Worth its own feature before this page is
   linked publicly.
4. **Have someone qualified read it.** This is written to be accurate and
   understandable, not to be a legal instrument. DevStash has EU users, so GDPR
   applies, and the wording of a rights section is not something to take from an
   AI-assisted draft unreviewed.

---

# Privacy Policy

*Last updated: [DATE]*

DevStash stores the notes, snippets, prompts and files you save, and — if you
turn them on — sends some of that content to OpenAI when you ask an AI feature
for help. This page says exactly what is stored, what is sent, and how to stop
it.

It is written to be read rather than to be comprehensive. If something here is
unclear, ask.

---

## 1. What we store

**Your account.** Your email address and display name. If you sign up with a
password, we store a bcrypt hash of it and never the password itself. If you sign
in with GitHub instead, we store what GitHub gives us: your name, email, avatar
URL and the tokens that keep the connection working.

**What you save.** The items you create — their titles, descriptions, content,
links, tags and language hints — and the collections you organise them into.

**Files you upload.** Files, images and book covers are stored in Cloudflare R2.
They are served back to you through DevStash rather than from a public URL, so a
file is reachable only by the account that owns it.

**Technical data.** Your IP address is read from the request when you sign in,
register, reset a password or upload a file, and is counted against a short
rate-limit window to stop abuse. Those counters live in Upstash Redis and expire
within hours. We do **not** run analytics: no page-view tracking, no session
recording, no advertising or third-party trackers, and no record of which
features you click.

**Cookies.** One session cookie, so you stay signed in. It is not used for
tracking, and there are no advertising cookies.

---

## 2. AI features

AI features are part of DevStash Pro. They are **off unless you use them**, and
this section is the reason this page exists.

### Nothing is sent in the background

**Content is only ever sent when you click an AI button, and only for the one
item that button belongs to.** Browsing, searching, saving, editing and uploading
send nothing. There is no background processing, no indexing of your stash, and
nothing that runs on a schedule.

### What each feature does

- **Tag suggestions** — suggests tags for an item you are editing.
- **Summaries** — writes a short description of an item.
- **Explain this code** — explains a snippet or command.
- **Prompt optimizer** — rewrites a saved prompt.

Every one of them **suggests**. Nothing is saved until you accept it and press
Save yourself.

### What is sent

For the item you clicked on: its **title, description and content**, shortened if
it is very long.

### What is not sent

- Your email address, name or account details
- Any other item, or the names of your collections
- **Your uploaded files and images.** These are never sent to OpenAI. For a book,
  only the text you typed — title, author, summary — could be; the cover image is
  not.

### Where it goes

To **OpenAI**, using their `gpt-5-nano` model, for the length of the request.
OpenAI processes the text and returns a suggestion.

**[VERIFY BEFORE PUBLISHING — see the note at the top of this file]** OpenAI does
not use content sent through their API to train their models. They retain API
content for a limited period for abuse monitoring, after which it is deleted.

### Turning it off

**Settings → AI features.** One switch turns off all four. With it off, the AI
buttons do not appear anywhere in the app and nothing is sent to OpenAI at all.

---

## 3. Who else processes your data

DevStash is built on services that each handle one part of it:

| Service | What it handles |
|---|---|
| **Vercel** | Hosting and serving the application |
| **Neon** | The database — your account and everything you save |
| **Cloudflare R2** | Files, images and book covers |
| **Resend** | Verification and password-reset emails |
| **Stripe** | Subscription payments |
| **Upstash** | Short-lived rate-limit counters |
| **OpenAI** | AI features only, and only as described in §2 |
| **GitHub** | Only if you choose to sign in with it |

---

## 4. Payments

Subscriptions are handled by Stripe. **Card details never reach DevStash** — you
enter them on Stripe's own checkout page. We store only the identifiers Stripe
gives us for your customer and subscription records, which is what lets us know
whether your account is on Pro.

---

## 5. Security

- Passwords are hashed with bcrypt and never stored or logged in readable form.
- Email verification and password-reset links are stored only as SHA-256
  digests — a copy of our database does not let anyone use them.
- Changing your password signs out every other session.
- All traffic is over HTTPS.
- We do not log the content of your items.

---

## 6. Your choices

- **Turn off AI features** — Settings, at any time. Nothing is sent afterwards.
- **Edit or delete anything you have saved** — from within the app.
- **Delete your account** — Settings → Delete Account. It is immediate and it is
  yours to do; you do not have to ask us.
- **Ask us what we hold about you**, or ask for it to be corrected, using the
  contact address below.

---

## 7. How long we keep things

Your account and everything in it stay until you delete them.

Deleting your account immediately removes your account record and everything
linked to it — items, collections, tags and sessions — from our database.

**[REWRITE THIS PARAGRAPH ONCE THE CODE IS FIXED — see the note at the top of
this file]** Files you uploaded may remain in file storage for a period after
account deletion before they are removed.

Verification links expire after 24 hours and password-reset links after one hour.
Rate-limit counters expire within hours.

---

## 8. Contact

Questions about this policy, or about the data we hold:

**[privacy@example.com — decide this before publishing]**
