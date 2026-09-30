# spec: Login User

## Goal

A user can log into their account with their credentials.

## In scope

- `POST /auth/login` - `{ email: string, password: string }` -> validate credentials -> returns `200 { accessToken }`
- Email input is normalized (trim + lowercase), same as register
- `LoginDto` validates only that `email` is an email and `password` is a non-empty string of at most 128 characters. It does not reuse register's strength rules.
- The password is never trimmed (surrounding whitespace can be part of it)
- Malformed input (missing/invalid email, missing/non-string/empty/too-long password) returns 400
- Unknown extra fields (e.g. a client-chosen `role`) return 400, through the global `ValidationPipe` (`forbidNonWhitelisted`)
- Wrong email or wrong password returns a normalized 401 `{ statusCode, error, message: "invalid credentials" }`, raised as `InvalidCredentialsError` and mapped in `DomainExceptionFilter`
- When the email is unknown, `PasswordHasherService.verifyDummy` still runs an argon2 verification against a dummy hash built by the hasher itself (same parameters as real hashes), so both 401 paths cost the same
- If the dummy hash cannot be built, the application fails to start (`onModuleInit`) instead of failing on the first login
- JWT payload contains

```
{
    sub: string,
    role: Role,
}
```

(same payload register already issues, produced by the shared `TokenIssuerService`; `Role` is the Prisma enum)

## Out of scope

- Refresh token handling and delivery
- RBAC guards (separate spec)
- OAuth2 / social login
- Rate limiting (separate spec)

## Success criteria

- [x] Correct credentials return 200 with a JWT whose payload is `{ sub, role }`
- [x] Wrong email returns 401 `invalid credentials`
- [x] Existing email with wrong password returns 401 `invalid credentials`
- [x] Wrong-email and wrong-password 401 responses are byte-identical (status and body)
- [x] Unknown email still calls `PasswordHasherService.verifyDummy` with the login password, and `verifyDummy` verifies against an argon2id hash (unit tests; no wall-clock assertions)
- [x] A failure to build the dummy hash makes `onModuleInit` reject (the application refuses to start)
- [x] JWT verifies with the configured `JWT_SECRET`
- [x] JWT expires after the configured `JWT_EXPIRES_IN`
- [x] Malformed input returns 400, including an empty password and an extra field such as `role`
- [x] Email matching is case-insensitive and trimmed (register `foo@x.com`, log in as `Foo@X.com`)
- [x] The password is not trimmed
- [x] No response body contains `passwordHash`

## Recap

Shipped on `feature/002-login-user`: 14 commits before this recap, unit tests 76/76, e2e tests 30/30 (Postgres via Docker Compose), coverage 100% statements / 100% functions / 100% lines / 78.75% branches (threshold 75%). Lint, Prettier and build are clean. All 12 success criteria are met and covered by a passing unit or e2e test.

**What we did**

- **Reviewed the spec before planning.** The first draft contradicted the code: it asked for `{ id, role, email }` while register already signed `{ sub, role }`. It also left timing, input handling and HTTP details implicit. After the review the payload matched register, and the spec gained the dummy-hash requirement, email normalization, the 400 cases, the 200 status and the reused error body.
- **Planned in plan mode, then implemented in small TDD steps**, with a stop for review after every step (this became a project rule in `.claude/rules/workflow.md`). Each step was committed on request with a Conventional Commits message.
- **Preparatory refactors first**, so login would not copy register's code: `TokenIssuerService` (the only place that knows the JWT payload) and the `@NormalizeEmail()` decorator (shared by `RegisterDto` and `LoginDto`).
- **Then the feature itself**: `InvalidCredentialsError` mapped to 401 in `DomainExceptionFilter`, `UserRepository.findByEmailWithPasswordHash`, `LoginDto`, `PasswordHasherService.verifyDummy` and `LoginUserUseCase`, then `POST /auth/login` (`@HttpCode(200)`), then a 30-test e2e suite.
- **Then a review pass over the whole branch**, which produced: helper classes renamed to `*Service`, a fail-fast dummy hash, one redundant test removed, and `CLAUDE.md` / `README.md` brought back in line with the code (see below).

**What we learned**

- **Read the previous feature's code before finalizing a spec.** The payload contradiction was only visible by reading `RegisterUserUseCase`.
- **When a review says "extract the shared piece", carry it into the plan.** The first plan re-signed the JWT inside the login usecase, duplicating register, and was rejected as not DRY. The extraction had already been suggested in the spec review.
- **Put security-relevant parameters with the class that owns them.** The dummy hash first lived in the usecase behind `onModuleInit`. Nest's `compile()` does not run lifecycle hooks, so forgetting the hook in a test means `verify(undefined, ...)` and a 500. Moving the dummy hash into the hasher (`verifyDummy`) removed the hook, the gotcha and the risk of the dummy drifting from the real argon2 parameters.
- **Fail fast, don't retry.** If `argon2.hash` rejects while building the dummy hash, the cause is a broken native binding or memory exhaustion: deterministic, and registration would be broken too. The promise is started at construction, marked handled in the constructor, and awaited in `onModuleInit`, so the application refuses to start. The red test proved the risk: without the guard, the rejected promise crashed the whole Jest process as an unhandled rejection.
- **Every helper class is a `*Service` or a `*UseCase`, in any domain.** `PasswordHasher` and `TokenIssuer` became `PasswordHasherService` and `TokenIssuerService`; `CLAUDE.md` no longer says services are "common only".
- **Test behavior, never wall-clock time, for timing protection.** The unit tests assert which method is called with what. The e2e suite asserts identical status and body for both 401 paths.
- **Unknown-email and wrong-password parity has to hold in three places:** status, body, and cost.
- **Tooling gotchas.**
  - `jest.spyOn` cannot redefine properties on the `argon2` module namespace ("Cannot redefine property: verify"). Spy on the instance method instead.
  - `restoreAllMocks` is unnecessary when the instance is rebuilt in `beforeEach`, but needed when spying on a class prototype.
  - oxlint type-aware flagged `no-misused-spread` and `unbound-method` in new specs. Running lint after every step catches this early.
  - zsh does not word-split an unquoted variable, so `perl -pi ... $files` silently renamed nothing; use `xargs`. `git grep -E` does not understand `\b`, which made a "no leftovers" check pass falsely; use `grep -rnw`.
- **Local ops.** The `db` container was already running, so the e2e suite needed no `docker compose` command. A transient auto-mode classifier failure on `git commit` resolved on retry. Amending is fine on an unpushed branch, but check for an upstream first.
- **Delete a weak test rather than rename it.** A test that only asserts `resolves.toBeUndefined()` on a method typed `Promise<void>` adds nothing TypeScript does not already enforce.

**Could have been better**

- **Implementation ran ahead of review.** Several files were written in one go before a review stop and had to be rolled back. The "stop after each step" rule came directly from that.
- **Self-review was left to the reviewer.** A leftover `afterEach(restoreAllMocks)`, an over-long first test ("trim and lowercase" in one test) and a vague test rename were caught by the reviewer, not by a self-review of the diff. Read your own diff before presenting a step.
- **The e2e suite was written after the endpoint existed**, so it could not fail first. Writing it outside-in, before the controller step, would honor TDD fully.
- **The "no inline object literals" testing rule is bent in places**: `{ accessToken: ... }` results, `{ password: 12345 }`, `'a'.repeat(129)`. A `generateMockAccessTokenDto` helper would remove most of them.
- **The repository mock default returns a full `User`** where `findByEmailWithPasswordHash` returns a `UserWithPasswordHash`.
- **Unit and e2e work ended up in one commit** (the e2e file was amended into the endpoint commit). Separate commits would read better.
- **The docs had drifted before this feature.** `CLAUDE.md` said `*.service.ts` was common-only and listed an `auth/controllers/` folder that does not exist. Doc updates belong in the same PR as the change that outdates them.

**Open flaws (not addressed here)**

- **Dependency direction in the error filter.** `DomainExceptionFilter` in `common/` imports errors from `@users` and `@auth`, and each new domain adds another import. Giving `DomainError` an `httpStatus` would invert that dependency.
- **The lowercase-email invariant is not enforced by the database.** Login relies on stored emails being lowercase (register guarantees it); a row created another way would be unreachable. A `citext` column or a lower-case unique index would enforce it.
- **No rehash on login.** Hashes made with old argon2 parameters keep their old cost (`argon2.needsRehash` is not used), while the dummy hash uses the current parameters, so parity can drift after a tuning change.
- **Brute force and CPU DoS.** Login is the natural target and argon2 is expensive. `MaxLength(128)` only bounds a single request. Rate limiting is a separate spec and should land before any real deployment.
- **A corrupt stored hash makes `argon2.verify` throw**, which surfaces as a 500.
- **JWT hardening.** No `iss` / `aud` claims, no revocation and no refresh tokens yet.
- **The e2e suites write to whatever `DATABASE_URL` points at**, which is the dev database locally.
- **Branch coverage headroom is thin** (78.75% against a 75% threshold), partly from the `emitDecoratorMetadata` guards described in the spec 001 recap.
