# Fix — exposed Context7 API key in `.mcp.json`

> Parked on 2026-08-19 without being implemented, so the profile spec could be loaded.
> The key is **still live in the working tree** (`.mcp.json:11`) and still in public history.

## Goals

- **Rotate the leaked Context7 key first.** `ctx7sk-1f96107a-…` is committed and pushed to a public GitHub repo, so it is compromised regardless of what the code does next. Revoke it in the Context7 dashboard and issue a replacement before touching the file.
- Get the secret out of the tracked `.mcp.json` — replace the literal bearer token with an environment placeholder (`${CONTEXT7_API_KEY}`) so the file stays committed and usable by anyone cloning, but carries no credential.
- Store the new key somewhere untracked (`.claude/settings.local.json` is already gitignored via `/.claude`, or a machine-level env var) and verify the Context7 MCP server still authenticates after the change.
- Document the variable in `.env.example` or the README so the setup path is discoverable, and decide whether `.mcp.json` needs a `.gitignore` entry (it should **not** — the point is that it becomes safe to track).
- Decide on git history: whether to leave commit `31eed5c` alone (rotation makes the old key inert) or rewrite history to purge it.

## Notes

**What was found.** `.mcp.json:11` holds `"Authorization": "Bearer ctx7sk-1f96107a-dd21-4966-8901-a6944e678082"` in plaintext. The file is **tracked** and the key entered history in commit `31eed5c` ("added neon,context7 and playwright mcp", 2026-08-18), which is contained in `origin/master`. `git rev-list --left-right --count origin/master...master` is `0 0`, so local and remote are identical — it is pushed. The GitHub API reports `github.com/jeroenkleuters/devstash` as **`visibility=public`, `private=false`** (0 forks). Treat the key as public knowledge.

A repo-wide grep for `ctx7sk` finds exactly one hit — `.mcp.json` — so there is no second copy to clean up in `src/`, `.env*`, or docs.

**Why rotation is the actual fix.** Removing the line from the working tree does nothing about a value already in a public commit; GitHub also keeps unreachable objects reachable via the commit SHA for a while even after a force-push, and forks/caches/scrapers may already have it. Rewriting history is optional hardening on top of rotation, never a substitute for it.

**Implementation direction.** Claude Code expands `${VAR}` inside `.mcp.json` values (including `headers`), so `"Bearer ${CONTEXT7_API_KEY}"` keeps the server config committed while the secret lives outside the repo. Worth confirming during implementation where the variable has to be set for the expansion to see it — the project `.env` is loaded by Next/Prisma, **not** by the Claude Code process, so `.env` alone is likely not enough; `.claude/settings.local.json`'s `env` block or a real shell/system environment variable are the candidates to test.

Note the other two servers need nothing: `neon` and `playwright` carry no credentials in this file (Neon MCP authenticates out-of-band, Playwright is a local stdio process).

**Out of scope.** Auditing the other secrets in this project (`.env` / `.env.production` hold `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `RESEND_API_KEY`) — those files are gitignored and were not part of this request. If the fix uncovers one of them in history too, flag it rather than silently widening the change.
