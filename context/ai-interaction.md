# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
4. **Test** - Verify it works in the browser. Write unit tests for any server actions or utilities the feature adds (see Testing below). Run `npm test` and `npm run build`, and fix any errors
5. **Iterate** - Iterate and change things if needed
6. **Commit** - Only after the build passes, the tests pass, and everything works
7. **Merge** - Merge to main
8. **Delete Branch** - Delete branch after merge
9. **Review** - Review AI-generated code periodically and on demand.
10. Mark as completed in @context/current-feature.md and add to history

Do NOT commit without permission and until the build and the tests pass. If either fails, fix the issues first.

## Testing

Vitest, run with `npm test` (`npm run test:watch` while working). Config is in [vitest.config.mts](../vitest.config.mts).

**Scope is server actions and utilities — not components.** The `include` pattern only picks up `src/lib/**/*.test.ts` and `src/actions/**/*.test.ts`, so a test file anywhere else is silently not run. That is deliberate: it keeps the suite about logic and stops component tests appearing by accident.

- Tests sit next to what they test — `src/lib/utils.ts` → `src/lib/utils.test.ts`.
- Don't write tests just to write them. A function with a branch, a rule or an edge case worth naming is worth testing; a one-line pass-through is not.
- **Nothing may reach the network or the database.** `src/lib/prisma.ts` throws at import time when `DATABASE_URL` is unset, so any test touching a `lib/db/` module must `vi.mock("@/lib/prisma", …)`. Mock `@/auth` the same way for actions, and never point a test at the Neon dev branch.
- Vitest does not load `.env`. Modules that read `process.env` are exercised with `vi.stubEnv`, which the config restores after each test.
- `npm test` is **not** `npm run db:test` — the latter runs `scripts/test-db.ts`, a seeded-data integrity check against a live database, and is not part of the suite.

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
