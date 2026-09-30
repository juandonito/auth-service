# Workflow

- When implementing an approved plan, stop at the end of each step and wait for review. Never roll into the next step on your own.
- After review, commit only when asked, then proceed to the next step when told to.
- Commit messages are clear and concise, following Conventional Commits (e.g. `feat(auth): add login usecase`, `refactor(auth): extract token issuer`).
- Before presenting a step, read your own diff against `CLAUDE.md` and `.claude/rules/` (naming, structure, testing conventions) and fix any deviation yourself.
- For code in an auth or security path, list what each call can throw or return unexpectedly and say how it is handled, so no input (e.g. an existing vs an unknown email) gets a different response, status or cost.
